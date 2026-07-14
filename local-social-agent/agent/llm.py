"""Local LLM access with a graceful offline fallback.

The primary backend is a locally-running Ollama server. Because a local model may
be absent, still downloading, or too small to emit clean JSON, every LLM-driven
feature has a deterministic Python fallback so the agent never hard-fails.
"""

from __future__ import annotations

import json
import re
from typing import Any, Dict, List, Optional

import requests

from .config import LLMConfig


class LocalLLM:
    """Thin client over the Ollama HTTP API + heuristic planning fallback."""

    def __init__(self, config: LLMConfig) -> None:
        self.config = config
        self._available: Optional[bool] = None

    # -- availability -------------------------------------------------------
    def available(self) -> bool:
        """Return True if the configured Ollama server answers a tags request."""
        if self._available is not None:
            return self._available
        try:
            resp = requests.get(f"{self.config.base_url}/api/tags", timeout=2)
            self._available = resp.status_code == 200
        except requests.RequestException:
            self._available = False
        return self._available

    def refresh_availability(self) -> bool:
        self._available = None
        return self.available()

    # -- raw completion -----------------------------------------------------
    def complete(self, prompt: str, system: Optional[str] = None) -> str:
        """Single-shot text completion. Raises on transport failure."""
        payload: Dict[str, Any] = {
            "model": self.config.model,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": 0.7},
        }
        if system:
            payload["system"] = system
        resp = requests.post(
            f"{self.config.base_url}/api/generate",
            json=payload,
            timeout=self.config.timeout,
        )
        resp.raise_for_status()
        return resp.json().get("response", "")

    # -- planning -----------------------------------------------------------
    def plan(self, user_request: str, tools: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Turn a natural-language request into an ordered list of tool calls.

        Returns a dict: {"plan": [{"tool": str, "args": {...}, "why": str}, ...],
                         "source": "llm"|"fallback"}.
        """
        if self.available():
            llm_plan = self._plan_via_llm(user_request, tools)
            if llm_plan:
                return {"plan": llm_plan, "source": "llm"}
        return {"plan": heuristic_plan(user_request), "source": "fallback"}

    def _plan_via_llm(self, user_request: str, tools: List[Dict[str, Any]]):
        tool_docs = "\n".join(
            f"- {t['name']} ({t['risk']}): {t['description']} params={t['parameters']}"
            for t in tools
        )
        system = (
            "You are a planning module for a local social-media agent. Given a user "
            "request, output ONLY a JSON object of the form "
            '{"plan": [{"tool": "<name>", "args": {...}, "why": "<short reason>"}]}. '
            "Chain tools when needed (generate an image, then edit it, then write a "
            "caption, then post it). Reference a previous step's produced file with "
            'the placeholder "$LAST_IMAGE" in args. Do not add commentary.'
        )
        prompt = f"Available tools:\n{tool_docs}\n\nUser request: {user_request}\n\nJSON plan:"
        try:
            raw = self.complete(prompt, system=system)
            match = re.search(r"\{.*\}", raw, re.DOTALL)
            if not match:
                return None
            obj = json.loads(match.group(0))
            plan = obj.get("plan")
            if isinstance(plan, list) and all(isinstance(s, dict) and "tool" in s for s in plan):
                return plan
        except Exception:
            return None
        return None


# ---------------------------------------------------------------------------
# Heuristic fallback planner
# ---------------------------------------------------------------------------

_POST_WORDS = ("post", "publish", "upload", "share")
_EDIT_WORDS = ("edit", "filter", "enhance", "retouch", "adjust", "brighten")
_CAPTION_WORDS = ("caption", "hashtag", "write", "description")
_GEN_WORDS = ("create", "generate", "make", "draw", "design", "picture", "image", "photo", "pic")
_LIST_WORDS = ("list", "show files", "what files", "workspace")


def _extract_subject(text: str) -> str:
    """Pull a plausible image subject out of a free-form request."""
    lowered = text.strip()
    # Common phrasings: "... of X", "... about X", "picture of a X"
    m = re.search(r"(?:of|about|showing|with)\s+(.*)", lowered, re.IGNORECASE)
    if m:
        subject = m.group(1)
    else:
        subject = lowered
    # Trim trailing action clauses ("and post it", "then edit", ", edit it", etc.)
    subject = re.split(r"\s*(?:,|\band\b|\bthen\b)\s*", subject, maxsplit=1)[0]
    for verb in _GEN_WORDS + _EDIT_WORDS + _POST_WORDS:
        subject = re.sub(rf"^\s*{verb}\s+", "", subject, flags=re.IGNORECASE)
    subject = subject.strip(" .!\"'")
    return subject or "an aesthetic scene"


def heuristic_plan(user_request: str) -> List[Dict[str, Any]]:
    """Deterministic best-effort planner used when no LLM is available.

    Recognises the common "create -> edit -> caption -> post" pipeline and any
    subset of it, so the flagship Instagram workflow works fully offline.
    """
    text = user_request.lower()
    subject = _extract_subject(user_request)
    plan: List[Dict[str, Any]] = []

    wants_gen = any(w in text for w in _GEN_WORDS)
    wants_edit = any(w in text for w in _EDIT_WORDS)
    wants_caption = any(w in text for w in _CAPTION_WORDS) or any(w in text for w in _POST_WORDS)
    wants_post = any(w in text for w in _POST_WORDS)
    wants_list = any(w in text for w in _LIST_WORDS)

    if wants_list and not (wants_gen or wants_edit or wants_post):
        return [{"tool": "list_files", "args": {}, "why": "user asked to see workspace files"}]

    # If the user mentions posting/editing but not generating, assume they still
    # want a fresh image to work with (nothing else in the sandbox yet).
    if wants_post or wants_edit or wants_gen or wants_caption:
        wants_gen = True

    if wants_gen:
        plan.append({
            "tool": "generate_image",
            "args": {"prompt": subject, "filename": "post.png"},
            "why": f"create an image of '{subject}'",
        })

    if wants_edit or wants_post:
        ops = [{"op": "square"}, {"op": "saturation", "value": 1.2},
               {"op": "contrast", "value": 1.08}]
        plan.append({
            "tool": "edit_image",
            "args": {"source": "$LAST_IMAGE", "operations": ops, "output": "post-edited.png"},
            "why": "polish the image and crop it to Instagram's square format",
        })

    if wants_caption or wants_post:
        plan.append({
            "tool": "write_caption",
            "args": {"topic": subject, "tone": "friendly", "hashtag_count": 8},
            "why": "draft a caption with hashtags",
        })

    if wants_post:
        plan.append({
            "tool": "post_to_instagram",
            "args": {"image": "$LAST_IMAGE", "caption": "$LAST_CAPTION"},
            "why": "publish the finished post to Instagram",
        })

    if not plan:
        # Nothing matched - default to generating something from the raw request.
        plan.append({
            "tool": "generate_image",
            "args": {"prompt": subject, "filename": "image.png"},
            "why": "no explicit action detected; generating an image from the request",
        })

    return plan
