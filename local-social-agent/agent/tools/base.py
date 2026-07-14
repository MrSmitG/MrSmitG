"""Base classes shared by all tools."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, Optional

from ..sandbox import RiskLevel, Sandbox
from ..config import Config


@dataclass
class ToolContext:
    """Everything a tool needs from the host application."""

    config: Config
    sandbox: Sandbox
    # Injected lazily to avoid a circular import with the LLM layer.
    llm: Any = None


@dataclass
class ToolResult:
    """Uniform result object returned by every tool."""

    ok: bool
    summary: str
    data: Dict[str, Any] = field(default_factory=dict)
    # Relative workspace path of a produced artifact (e.g. an image), if any.
    artifact: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "ok": self.ok,
            "summary": self.summary,
            "data": self.data,
            "artifact": self.artifact,
        }


class Tool:
    """Base class. Subclasses implement :meth:`run`."""

    name: str = "tool"
    description: str = ""
    risk: RiskLevel = RiskLevel.SAFE
    # Minimal parameter documentation surfaced to the LLM.
    parameters: Dict[str, str] = {}

    def __init__(self, context: ToolContext) -> None:
        self.context = context

    @property
    def sandbox(self) -> Sandbox:
        return self.context.sandbox

    def spec(self) -> Dict[str, Any]:
        """Machine-readable description used when prompting the LLM."""
        return {
            "name": self.name,
            "description": self.description,
            "risk": self.risk.value,
            "parameters": self.parameters,
        }

    def run(self, args: Dict[str, Any], approved: bool = False) -> ToolResult:  # noqa: D401
        raise NotImplementedError
