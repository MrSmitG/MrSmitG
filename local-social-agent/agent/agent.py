"""The agent orchestrator.

Given a natural-language request it builds a plan (via the local LLM or the
heuristic fallback), then executes the plan step-by-step through the sandbox.
Sensitive steps pause the task for human approval; the caller resumes them once
the user clicks "approve".
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from .config import Config
from .llm import LocalLLM
from .sandbox import ApprovalRequired, Sandbox, SandboxError
from .tools import ToolContext, build_registry


@dataclass
class StepRecord:
    tool: str
    args: Dict[str, Any]
    why: str
    status: str = "pending"          # pending | done | error | skipped | awaiting_approval
    summary: str = ""
    artifact: Optional[str] = None
    data: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Task:
    id: str
    request: str
    plan: List[StepRecord]
    plan_source: str
    cursor: int = 0
    status: str = "running"          # running | awaiting_approval | done | error
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    last_image: Optional[str] = None
    last_caption: Optional[str] = None
    pending_detail: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "request": self.request,
            "status": self.status,
            "plan_source": self.plan_source,
            "cursor": self.cursor,
            "created_at": self.created_at,
            "last_image": self.last_image,
            "last_caption": self.last_caption,
            "pending_detail": self.pending_detail,
            "steps": [
                {
                    "tool": s.tool,
                    "args": s.args,
                    "why": s.why,
                    "status": s.status,
                    "summary": s.summary,
                    "artifact": s.artifact,
                    "data": s.data,
                }
                for s in self.plan
            ],
        }


class Agent:
    def __init__(self, config: Config) -> None:
        self.config = config
        self.sandbox = Sandbox(config)
        self.llm = LocalLLM(config.llm)
        self.tool_ctx = ToolContext(config=config, sandbox=self.sandbox, llm=self.llm)
        self.tools = build_registry(self.tool_ctx)
        self.tasks: Dict[str, Task] = {}

    # -- public API ---------------------------------------------------------
    def tool_specs(self) -> List[Dict[str, Any]]:
        return [t.spec() for t in self.tools.values()]

    def start_task(self, request: str) -> Task:
        request = (request or "").strip()
        planned = self.llm.plan(request, self.tool_specs())
        steps = [
            StepRecord(tool=s.get("tool", ""), args=dict(s.get("args", {}) or {}),
                       why=s.get("why", ""))
            for s in planned["plan"]
        ][: self.config.sandbox.max_steps_per_task]

        task = Task(id=uuid.uuid4().hex[:12], request=request, plan=steps,
                    plan_source=planned["source"])
        self.tasks[task.id] = task
        self._run(task)
        return task

    def approve(self, task_id: str, approved: bool) -> Task:
        task = self.tasks.get(task_id)
        if task is None:
            raise KeyError(task_id)
        if task.status != "awaiting_approval":
            return task
        step = task.plan[task.cursor]
        if not approved:
            step.status = "skipped"
            step.summary = "User denied approval; action skipped."
            task.cursor += 1
            task.status = "running"
            self.sandbox.record(step.tool, self.tools[step.tool].risk,
                                task.pending_detail, "denied")
            self._run(task)
            return task
        # Approved: execute this step with the approval flag, then continue.
        task.status = "running"
        self._execute_step(task, step, approved=True)
        if step.status == "done":
            task.cursor += 1
        self._run(task)
        return task

    def get_task(self, task_id: str) -> Optional[Task]:
        return self.tasks.get(task_id)

    # -- execution ----------------------------------------------------------
    def _run(self, task: Task) -> None:
        while task.cursor < len(task.plan) and task.status == "running":
            step = task.plan[task.cursor]
            self._execute_step(task, step, approved=False)
            if task.status == "awaiting_approval":
                return
            if step.status == "error":
                task.status = "error"
                return
            task.cursor += 1
        if task.status == "running":
            task.status = "done"
            self.sandbox.write_audit()

    def _execute_step(self, task: Task, step: StepRecord, approved: bool) -> None:
        tool = self.tools.get(step.tool)
        if tool is None:
            step.status = "error"
            step.summary = f"Unknown tool '{step.tool}'."
            return

        args = self._resolve_placeholders(dict(step.args), task)
        step.args = args  # persist resolved values so the UI shows real filenames
        try:
            result = tool.run(args, approved=approved)
        except ApprovalRequired as exc:
            step.status = "awaiting_approval"
            task.status = "awaiting_approval"
            task.pending_detail = exc.detail
            return
        except SandboxError as exc:
            step.status = "error"
            step.summary = f"Blocked by sandbox: {exc}"
            return
        except Exception as exc:  # defensive: a tool bug shouldn't crash the agent
            step.status = "error"
            step.summary = f"Tool raised an unexpected error: {exc}"
            return

        step.summary = result.summary
        step.data = result.data
        step.artifact = result.artifact
        step.status = "done" if result.ok else "error"

        # Thread produced artifacts/captions into later steps.
        if result.artifact and result.artifact.lower().endswith((".png", ".jpg", ".jpeg")):
            task.last_image = result.artifact
        caption = result.data.get("full") or result.data.get("caption")
        if caption:
            task.last_caption = caption

    def _resolve_placeholders(self, args: Dict[str, Any], task: Task) -> Dict[str, Any]:
        for key, value in list(args.items()):
            if value == "$LAST_IMAGE":
                args[key] = task.last_image or "post.png"
            elif value == "$LAST_CAPTION":
                args[key] = task.last_caption or "Check out my latest post!"
        return args
