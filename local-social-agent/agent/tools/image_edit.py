"""Edit an existing workspace image with common photo operations.

Supports the everyday tweaks a social post needs: brightness/contrast/saturation,
filters (grayscale, sepia, blur, sharpen), square-cropping for the Instagram grid,
resizing, and burning a text overlay onto the image.
"""

from __future__ import annotations

import os
from typing import Any, Dict, List

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageOps

from ..sandbox import RiskLevel
from .base import Tool, ToolResult
from .image_generate import _load_font

_SUPPORTED = {
    "brightness", "contrast", "saturation", "grayscale", "sepia",
    "blur", "sharpen", "square", "resize", "text",
}


class EditImageTool(Tool):
    name = "edit_image"
    description = (
        "Edit an existing image in the workspace. Provide the source filename and a "
        "list of operations. Supported ops: brightness, contrast, saturation, "
        "grayscale, sepia, blur, sharpen, square (crop to 1:1), resize, text overlay."
    )
    risk = RiskLevel.SAFE
    parameters = {
        "source": "filename of the image to edit, e.g. 'sunset.png' (required)",
        "operations": (
            "list of ops, e.g. "
            "[{'op':'brightness','value':1.2}, {'op':'sepia'}, "
            "{'op':'text','value':'Hello','position':'bottom'}]"
        ),
        "output": "output filename (optional; defaults to '<source>-edited.png')",
    }

    def run(self, args: Dict[str, Any], approved: bool = False) -> ToolResult:
        source = str(args.get("source", "")).strip()
        if not source:
            return ToolResult(ok=False, summary="edit_image needs a 'source' filename.")

        src_path = self.sandbox.resolve_path(source)
        if not src_path.exists():
            return ToolResult(ok=False, summary=f"Source image '{source}' not found in workspace.")

        operations = args.get("operations") or []
        if isinstance(operations, dict):
            operations = [operations]
        if not isinstance(operations, list):
            return ToolResult(ok=False, summary="'operations' must be a list of operation objects.")

        output = str(args.get("output") or self._default_output(source))
        if not output.lower().endswith((".png", ".jpg", ".jpeg")):
            output += ".png"
        out_path = self.sandbox.resolve_path(output)

        img = Image.open(src_path).convert("RGB")
        applied: List[str] = []
        for raw in operations:
            if not isinstance(raw, dict):
                continue
            op = str(raw.get("op", "")).lower()
            if op not in _SUPPORTED:
                return ToolResult(ok=False, summary=f"Unsupported operation: {op!r}.")
            img = self._apply(img, op, raw)
            applied.append(op)

        img.save(out_path)
        self.sandbox.record("edit_image", RiskLevel.SAFE,
                            f"{source} -> {output}: {applied}", "edited")
        rel = out_path.relative_to(self.sandbox.workspace.resolve()
                                   if out_path.is_absolute() else self.sandbox.workspace)
        return ToolResult(
            ok=True,
            summary=f"Edited '{source}' with {applied or 'no'} operation(s) -> '{output}'.",
            data={"operations": applied},
            artifact=str(rel),
        )

    def _default_output(self, source: str) -> str:
        stem, _, _ = source.rpartition(".")
        return f"{stem or source}-edited.png"

    def _apply(self, img: Image.Image, op: str, raw: Dict[str, Any]) -> Image.Image:
        value = raw.get("value")
        if op == "brightness":
            return ImageEnhance.Brightness(img).enhance(float(value if value is not None else 1.1))
        if op == "contrast":
            return ImageEnhance.Contrast(img).enhance(float(value if value is not None else 1.1))
        if op == "saturation":
            return ImageEnhance.Color(img).enhance(float(value if value is not None else 1.2))
        if op == "grayscale":
            return ImageOps.grayscale(img).convert("RGB")
        if op == "sepia":
            gray = ImageOps.grayscale(img)
            return ImageOps.colorize(gray, black="#2b1700", white="#ffdca8").convert("RGB")
        if op == "blur":
            return img.filter(ImageFilter.GaussianBlur(float(value if value is not None else 2)))
        if op == "sharpen":
            return img.filter(ImageFilter.SHARPEN)
        if op == "square":
            side = min(img.size)
            return ImageOps.fit(img, (side, side), Image.LANCZOS)
        if op == "resize":
            side = int(value or 1080)
            return img.resize((side, side), Image.LANCZOS)
        if op == "text":
            return self._overlay_text(img, str(value or ""), str(raw.get("position", "bottom")))
        return img

    def _overlay_text(self, img: Image.Image, text: str, position: str) -> Image.Image:
        if not text:
            return img
        draw = ImageDraw.Draw(img)
        w, h = img.size
        font = _load_font(max(24, w // 18))
        bbox = draw.textbbox((0, 0), text, font=font)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        x = (w - tw) // 2
        y = h - th - h // 12 if position == "bottom" else (h // 12 if position == "top" else (h - th) // 2)
        # Drop shadow for legibility over any background.
        draw.text((x + 2, y + 2), text, font=font, fill=(0, 0, 0))
        draw.text((x, y), text, font=font, fill=(255, 255, 255))
        return img
