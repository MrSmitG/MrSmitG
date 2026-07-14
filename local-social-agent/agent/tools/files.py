"""List artifacts currently sitting in the sandboxed workspace."""

from __future__ import annotations

from typing import Any, Dict, List

from ..sandbox import RiskLevel
from .base import Tool, ToolResult


class ListFilesTool(Tool):
    name = "list_files"
    description = "List the files currently stored in the agent's workspace."
    risk = RiskLevel.SAFE
    parameters = {}

    def run(self, args: Dict[str, Any], approved: bool = False) -> ToolResult:
        workspace = self.sandbox.workspace
        files: List[Dict[str, Any]] = []
        for path in sorted(workspace.rglob("*")):
            if path.is_file():
                files.append({
                    "name": str(path.relative_to(workspace)),
                    "bytes": path.stat().st_size,
                })
        return ToolResult(
            ok=True,
            summary=f"{len(files)} file(s) in the workspace.",
            data={"files": files},
        )
