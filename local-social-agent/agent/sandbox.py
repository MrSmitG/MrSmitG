"""Safety sandbox: path jailing, action gating, rate limiting and audit logging.

The sandbox is the single choke-point through which every tool must pass. It is
deliberately conservative: anything that touches the outside world is treated as
"sensitive" and, by default, either simulated (``dry_run``) or paused for explicit
human approval before running.
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from threading import Lock
from typing import Callable, Deque, List, Optional
from collections import deque

from .config import Config


class RiskLevel(str, Enum):
    """How dangerous an action is. Drives the approval / dry-run behaviour."""

    SAFE = "safe"          # local, reversible (image gen/edit, workspace files)
    SENSITIVE = "sensitive"  # touches the outside world (posting online)


class SandboxError(Exception):
    """Raised when the sandbox refuses to allow an action."""


class ApprovalRequired(Exception):
    """Raised when a sensitive action needs human sign-off before running."""

    def __init__(self, action: str, detail: str) -> None:
        super().__init__(f"approval required for '{action}'")
        self.action = action
        self.detail = detail


@dataclass
class AuditEntry:
    ts: str
    action: str
    risk: str
    detail: str
    outcome: str


class Sandbox:
    """Enforces the security policy for the whole agent."""

    def __init__(self, config: Config) -> None:
        self.config = config
        self._workspace = config.workspace_path
        self._workspace.mkdir(parents=True, exist_ok=True)
        self._audit: List[AuditEntry] = []
        self._post_times: Deque[float] = deque()
        self._lock = Lock()

    # -- properties ---------------------------------------------------------
    @property
    def mode(self) -> str:
        return self.config.sandbox.mode

    @property
    def workspace(self) -> Path:
        return self._workspace

    def is_live(self) -> bool:
        return self.mode == "live"

    # -- path jailing -------------------------------------------------------
    def resolve_path(self, relative: str) -> Path:
        """Resolve ``relative`` inside the workspace, rejecting escapes.

        Blocks absolute paths and ``..`` traversal so a tool (or a confused LLM)
        can never read or clobber files outside the sandbox.
        """
        if relative in (None, ""):
            raise SandboxError("empty path is not allowed")

        candidate = Path(relative)
        if candidate.is_absolute():
            raise SandboxError(f"absolute paths are not allowed: {relative!r}")

        # Resolve against the workspace and ensure containment.
        target = (self._workspace / candidate).resolve()
        workspace_resolved = self._workspace.resolve()
        if target != workspace_resolved and workspace_resolved not in target.parents:
            raise SandboxError(f"path escapes the sandbox: {relative!r}")
        return target

    # -- action gating ------------------------------------------------------
    def check_action(self, action: str, risk: RiskLevel, detail: str,
                     approved: bool = False) -> Optional[str]:
        """Decide whether an action may run.

        Returns a non-empty string when the action should be *simulated* instead
        of executed (the string is a human-readable reason). Returns ``None`` when
        the caller should proceed to actually perform the action. Raises
        :class:`ApprovalRequired` when human sign-off is needed first.
        """
        if risk == RiskLevel.SAFE:
            return None

        # Sensitive from here on.
        if not self.is_live():
            reason = f"sandbox is in '{self.mode}' mode - action simulated, nothing left this machine"
            self.record(action, risk, detail, outcome="simulated")
            return reason

        if self.config.sandbox.require_approval and not approved:
            raise ApprovalRequired(action, detail)

        self._enforce_rate_limit(action)
        return None

    def _enforce_rate_limit(self, action: str) -> None:
        limit = self.config.sandbox.max_posts_per_hour
        now = time.time()
        with self._lock:
            while self._post_times and now - self._post_times[0] > 3600:
                self._post_times.popleft()
            if len(self._post_times) >= limit:
                self.record(action, RiskLevel.SENSITIVE,
                            f"rate limit {limit}/hour", outcome="blocked")
                raise SandboxError(
                    f"rate limit reached ({limit} posts/hour) - refusing to post")
            self._post_times.append(now)

    # -- audit --------------------------------------------------------------
    def record(self, action: str, risk: RiskLevel, detail: str, outcome: str) -> None:
        entry = AuditEntry(
            ts=datetime.now(timezone.utc).isoformat(),
            action=action,
            risk=risk.value if isinstance(risk, RiskLevel) else str(risk),
            detail=detail,
            outcome=outcome,
        )
        self._audit.append(entry)

    def audit_log(self) -> List[dict]:
        return [vars(e) for e in self._audit]

    def write_audit(self) -> Path:
        path = self._workspace / "audit_log.json"
        path.write_text(json.dumps(self.audit_log(), indent=2), encoding="utf-8")
        return path
