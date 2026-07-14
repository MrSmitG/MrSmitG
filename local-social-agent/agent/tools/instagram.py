"""Publish an image to Instagram - safely.

This tool is deliberately conservative:

* In ``dry_run`` mode (the default) it never touches the network. It validates the
  image, writes a "post receipt" to the workspace, and returns a simulated result
  so you can rehearse the whole flow with zero risk.
* In ``live`` mode it requires (a) ``instagram.enabled: true`` in config,
  (b) ``INSTAGRAM_USERNAME`` / ``INSTAGRAM_PASSWORD`` in the environment,
  (c) the optional ``instagrapi`` dependency, and (d) explicit human approval via
  the sandbox. Only then does it actually publish.

Note: automating Instagram may violate its Terms of Service and can get accounts
restricted. The safe default keeps you in simulation until you opt in.
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from typing import Any, Dict

from PIL import Image

from ..sandbox import RiskLevel
from .base import Tool, ToolResult


class PostToInstagramTool(Tool):
    name = "post_to_instagram"
    description = (
        "Publish an image from the workspace to Instagram with a caption. This is a "
        "SENSITIVE action: it is simulated in dry-run mode and requires explicit "
        "approval and credentials in live mode."
    )
    risk = RiskLevel.SENSITIVE
    parameters = {
        "image": "workspace filename of the image to post (required)",
        "caption": "caption text (including hashtags) to attach (required)",
    }

    def run(self, args: Dict[str, Any], approved: bool = False) -> ToolResult:
        image = str(args.get("image", "")).strip()
        caption = str(args.get("caption", "")).strip()
        if not image:
            return ToolResult(ok=False, summary="post_to_instagram needs an 'image'.")
        if not caption:
            return ToolResult(ok=False, summary="post_to_instagram needs a 'caption'.")

        img_path = self.sandbox.resolve_path(image)
        if not img_path.exists():
            return ToolResult(ok=False, summary=f"Image '{image}' not found in workspace.")

        # Validate the file really is an image before doing anything else.
        try:
            with Image.open(img_path) as im:
                width, height = im.size
        except Exception as exc:
            return ToolResult(ok=False, summary=f"'{image}' is not a valid image: {exc}")

        detail = f"image={image} ({width}x{height}), caption[:40]={caption[:40]!r}"

        # Ask the sandbox whether we may proceed. This raises ApprovalRequired when
        # human sign-off is needed, or returns a reason string to simulate instead.
        simulate_reason = self.sandbox.check_action(
            "post_to_instagram", RiskLevel.SENSITIVE, detail, approved=approved
        )

        if simulate_reason is not None:
            return self._simulate(image, caption, width, height, simulate_reason)

        return self._publish_live(img_path, image, caption, width, height)

    # -- dry run ------------------------------------------------------------
    def _simulate(self, image: str, caption: str, w: int, h: int, reason: str) -> ToolResult:
        receipt = {
            "simulated": True,
            "reason": reason,
            "image": image,
            "dimensions": f"{w}x{h}",
            "caption": caption,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        receipt_path = self.sandbox.resolve_path(
            f"post-receipt-{datetime.now().strftime('%Y%m%d-%H%M%S')}.json"
        )
        receipt_path.write_text(json.dumps(receipt, indent=2), encoding="utf-8")
        rel = receipt_path.relative_to(self.sandbox.workspace)
        return ToolResult(
            ok=True,
            summary=f"[SIMULATED] Would post '{image}' to Instagram. {reason}",
            data={"simulated": True, "receipt": receipt},
            artifact=str(rel),
        )

    # -- live ---------------------------------------------------------------
    def _publish_live(self, img_path, image: str, caption: str, w: int, h: int) -> ToolResult:
        if not self.context.config.instagram.enabled:
            return ToolResult(ok=False, summary="Instagram is disabled in config (instagram.enabled=false).")

        username = os.environ.get("INSTAGRAM_USERNAME")
        password = os.environ.get("INSTAGRAM_PASSWORD")
        if not username or not password:
            self.sandbox.record("post_to_instagram", RiskLevel.SENSITIVE, image, "blocked-no-creds")
            return ToolResult(
                ok=False,
                summary="Live mode needs INSTAGRAM_USERNAME and INSTAGRAM_PASSWORD in the environment.",
            )

        try:
            from instagrapi import Client  # type: ignore
        except ImportError:
            self.sandbox.record("post_to_instagram", RiskLevel.SENSITIVE, image, "blocked-no-lib")
            return ToolResult(
                ok=False,
                summary="Live posting needs the optional 'instagrapi' package (pip install instagrapi).",
            )

        try:
            client = Client()
            session_path = self.sandbox.resolve_path(f"ig-session-{username}.json")
            if session_path.exists():
                client.load_settings(session_path)
            client.login(username, password)
            client.dump_settings(session_path)
            media = client.photo_upload(str(img_path), caption)
            self.sandbox.record("post_to_instagram", RiskLevel.SENSITIVE, image, "posted")
            return ToolResult(
                ok=True,
                summary=f"Posted '{image}' to Instagram as @{username}.",
                data={"simulated": False, "media_pk": str(getattr(media, "pk", "")),
                      "code": getattr(media, "code", "")},
            )
        except Exception as exc:  # pragma: no cover - network path
            self.sandbox.record("post_to_instagram", RiskLevel.SENSITIVE, image, f"error:{exc}")
            return ToolResult(ok=False, summary=f"Instagram publish failed: {exc}")
