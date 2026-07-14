"""Write an Instagram-style caption (+ hashtags) for a topic or an image."""

from __future__ import annotations

import json
import re
from typing import Any, Dict, List

from ..sandbox import RiskLevel
from .base import Tool, ToolResult

_STOPWORDS = {
    "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "with",
    "at", "by", "from", "as", "is", "it", "this", "that", "my", "your",
    "after", "post", "pic", "pics", "picture", "photo", "image", "images",
    "insta", "instagram",
}


class WriteCaptionTool(Tool):
    name = "write_caption"
    description = (
        "Write a short, engaging Instagram caption with relevant hashtags for a "
        "given topic. Uses the local LLM when available and falls back to a "
        "built-in generator otherwise."
    )
    risk = RiskLevel.SAFE
    parameters = {
        "topic": "what the post is about, e.g. 'a golden-hour beach sunset' (required)",
        "tone": "optional tone, e.g. 'playful', 'inspirational', 'minimal'",
        "hashtag_count": "how many hashtags to include (default 8)",
    }

    def run(self, args: Dict[str, Any], approved: bool = False) -> ToolResult:
        topic = str(args.get("topic", "")).strip()
        if not topic:
            return ToolResult(ok=False, summary="write_caption needs a 'topic'.")
        tone = str(args.get("tone", "friendly")).strip() or "friendly"
        count = int(args.get("hashtag_count", 8) or 8)
        count = max(0, min(count, 30))

        caption = self._via_llm(topic, tone, count)
        if caption is None:
            caption = self._fallback(topic, tone, count)

        self.sandbox.record("write_caption", RiskLevel.SAFE, topic, "created")
        return ToolResult(
            ok=True,
            summary="Wrote a caption.",
            data={"caption": caption["text"], "hashtags": caption["hashtags"],
                  "full": caption["full"]},
        )

    def _via_llm(self, topic: str, tone: str, count: int):
        llm = self.context.llm
        if llm is None or not llm.available():
            return None
        prompt = (
            f"Write a {tone} Instagram caption for a post about: {topic}.\n"
            f"Then list exactly {count} relevant lowercase hashtags.\n"
            "Respond as JSON with keys 'caption' (string) and 'hashtags' (list of "
            "strings without the # symbol). Keep the caption under 200 characters."
        )
        try:
            raw = llm.complete(prompt)
            match = re.search(r"\{.*\}", raw, re.DOTALL)
            if not match:
                return None
            obj = json.loads(match.group(0))
            text = str(obj.get("caption", "")).strip()
            tags = [str(t).lstrip("#").strip() for t in obj.get("hashtags", []) if str(t).strip()]
            if not text:
                return None
            hashtags = ["#" + t.replace(" ", "") for t in tags[:count]]
            return {"text": text, "hashtags": hashtags,
                    "full": (text + "\n\n" + " ".join(hashtags)).strip()}
        except Exception:
            return None

    def _fallback(self, topic: str, tone: str, count: int) -> Dict[str, Any]:
        # Normalise the subject so sentences read naturally regardless of any
        # leading article the user (or planner) included.
        subject = re.sub(r"^(a|an|the)\s+", "", topic.strip(), flags=re.IGNORECASE)
        subject = subject or topic.strip()
        templates = {
            "playful": f"Caught a little magic today. {subject.capitalize()} just hits different.",
            "inspirational": f"Chase the light, always. Grateful for moments like this {subject}.",
            "minimal": f"{subject.capitalize()}.",
            "friendly": f"Loving this {subject}. Some views never get old.",
        }
        text = templates.get(tone, templates["friendly"])
        words = [w for w in re.split(r"[^a-zA-Z0-9]+", topic.lower()) if w and w not in _STOPWORDS]
        seeds = words + ["photography", "instadaily", "vibes", "mood", "aesthetic",
                         "picoftheday", "instagood", "content"]
        seen: List[str] = []
        for w in seeds:
            if w not in seen:
                seen.append(w)
            if len(seen) >= count:
                break
        hashtags = ["#" + w for w in seen[:count]]
        return {"text": text, "hashtags": hashtags,
                "full": (text + "\n\n" + " ".join(hashtags)).strip()}
