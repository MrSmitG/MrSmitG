"""Tool registry.

Tools are the only way the agent can affect the world. Each tool declares its
name, a description (fed to the LLM), a JSON-ish parameter schema, and a risk
level so the sandbox can gate it.
"""

from __future__ import annotations

from typing import Dict, List

from .base import Tool, ToolContext, ToolResult
from .image_generate import GenerateImageTool
from .image_edit import EditImageTool
from .caption import WriteCaptionTool
from .files import ListFilesTool
from .instagram import PostToInstagramTool


def build_registry(context: ToolContext) -> Dict[str, Tool]:
    """Instantiate every tool and return a name -> tool mapping."""
    tools: List[Tool] = [
        GenerateImageTool(context),
        EditImageTool(context),
        WriteCaptionTool(context),
        ListFilesTool(context),
        PostToInstagramTool(context),
    ]
    return {t.name: t for t in tools}


__all__ = [
    "Tool",
    "ToolContext",
    "ToolResult",
    "build_registry",
]
