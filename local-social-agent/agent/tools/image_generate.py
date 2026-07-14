"""Generate an image locally from a text prompt.

By default this uses a fully-offline procedural generator built on Pillow: it maps
the prompt to a deterministic colour palette and composition so results are
reproducible and never require a network call or a multi-gigabyte model download.

If you have a local Stable Diffusion stack installed (``diffusers`` + ``torch``)
you can flip ``LSA_USE_DIFFUSERS=1`` and it will be used instead - the rest of the
agent does not care which backend produced the pixels.
"""

from __future__ import annotations

import colorsys
import hashlib
import math
import os
import random
from datetime import datetime
from typing import Any, Dict, List, Tuple

from PIL import Image, ImageDraw, ImageFilter, ImageFont

from ..sandbox import RiskLevel
from .base import Tool, ToolResult


def _seed_from_prompt(prompt: str) -> int:
    digest = hashlib.sha256(prompt.encode("utf-8")).hexdigest()
    return int(digest[:16], 16)


def _palette(rng: random.Random) -> List[Tuple[int, int, int]]:
    """Build a pleasant, harmonious 3-colour palette in HSV space."""
    base_hue = rng.random()
    colours = []
    for offset in (0.0, 0.08, -0.10):
        hue = (base_hue + offset) % 1.0
        sat = rng.uniform(0.55, 0.85)
        val = rng.uniform(0.65, 0.95)
        r, g, b = colorsys.hsv_to_rgb(hue, sat, val)
        colours.append((int(r * 255), int(g * 255), int(b * 255)))
    return colours


def _vertical_gradient(size: Tuple[int, int], top: Tuple[int, int, int],
                       bottom: Tuple[int, int, int]) -> Image.Image:
    width, height = size
    base = Image.new("RGB", size, top)
    draw = ImageDraw.Draw(base)
    for y in range(height):
        t = y / max(height - 1, 1)
        r = int(top[0] + (bottom[0] - top[0]) * t)
        g = int(top[1] + (bottom[1] - top[1]) * t)
        b = int(top[2] + (bottom[2] - top[2]) * t)
        draw.line([(0, y), (width, y)], fill=(r, g, b))
    return base


def _load_font(size: int) -> ImageFont.FreeTypeFont:
    """Best-effort font load that works across macOS / Linux, else default."""
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",  # macOS
        "/System/Library/Fonts/SFNS.ttf",                     # macOS
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",  # Linux
    ]
    for path in candidates:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except OSError:
                continue
    return ImageFont.load_default()


class GenerateImageTool(Tool):
    name = "generate_image"
    description = (
        "Create a brand-new square image from a text prompt and save it to the "
        "workspace. Use this whenever the user wants a picture created from scratch."
    )
    risk = RiskLevel.SAFE
    parameters = {
        "prompt": "text description of the image to create (required)",
        "filename": "output filename, e.g. 'sunset.png' (optional)",
        "size": "pixel size of the square image, default 1024 (optional)",
    }

    def run(self, args: Dict[str, Any], approved: bool = False) -> ToolResult:
        prompt = str(args.get("prompt", "")).strip()
        if not prompt:
            return ToolResult(ok=False, summary="generate_image needs a 'prompt'.")

        size = int(args.get("size", 1024) or 1024)
        size = max(256, min(size, 2048))
        filename = str(args.get("filename") or self._auto_name(prompt))
        if not filename.lower().endswith((".png", ".jpg", ".jpeg")):
            filename += ".png"

        out_path = self.sandbox.resolve_path(filename)

        if os.environ.get("LSA_USE_DIFFUSERS") == "1":
            try:
                img = self._diffusers_image(prompt, size)
            except Exception as exc:  # pragma: no cover - optional path
                img = self._procedural_image(prompt, size)
                note = f"(diffusers unavailable: {exc}; used procedural generator)"
            else:
                note = "(rendered with local Stable Diffusion)"
        else:
            img = self._procedural_image(prompt, size)
            note = "(rendered with the offline procedural generator)"

        img.save(out_path)
        self.sandbox.record("generate_image", RiskLevel.SAFE, prompt, "created")
        rel = out_path.relative_to(self.sandbox.workspace.resolve()
                                   if out_path.is_absolute() else self.sandbox.workspace)
        return ToolResult(
            ok=True,
            summary=f"Created a {size}x{size} image for '{prompt}' {note}.",
            data={"prompt": prompt, "size": size},
            artifact=str(rel),
        )

    # -- helpers ------------------------------------------------------------
    def _auto_name(self, prompt: str) -> str:
        slug = "".join(c if c.isalnum() else "-" for c in prompt.lower())[:32].strip("-")
        stamp = datetime.now().strftime("%H%M%S")
        return f"{slug or 'image'}-{stamp}.png"

    def _procedural_image(self, prompt: str, size: int) -> Image.Image:
        rng = random.Random(_seed_from_prompt(prompt))
        palette = _palette(rng)
        img = _vertical_gradient((size, size), palette[0], palette[1])
        draw = ImageDraw.Draw(img, "RGBA")

        # Scatter translucent circles ("bokeh") for depth.
        for _ in range(rng.randint(14, 26)):
            radius = rng.randint(size // 20, size // 5)
            cx = rng.randint(0, size)
            cy = rng.randint(0, size)
            colour = palette[rng.randint(0, len(palette) - 1)]
            alpha = rng.randint(30, 110)
            draw.ellipse(
                [cx - radius, cy - radius, cx + radius, cy + radius],
                fill=(colour[0], colour[1], colour[2], alpha),
            )

        # A flowing accent wave across the composition.
        accent = palette[2]
        phase = rng.uniform(0, math.pi * 2)
        amp = size * rng.uniform(0.06, 0.14)
        mid = size * rng.uniform(0.45, 0.7)
        points = []
        for x in range(0, size + 1, 8):
            y = mid + amp * math.sin(phase + x / size * math.pi * rng.uniform(2, 4))
            points.append((x, y))
        points += [(size, size), (0, size)]
        draw.polygon(points, fill=(accent[0], accent[1], accent[2], 150))

        img = img.filter(ImageFilter.GaussianBlur(radius=size / 400))

        # Caption the prompt subtly in the lower-left corner.
        label = prompt if len(prompt) <= 40 else prompt[:37] + "..."
        font = _load_font(max(18, size // 28))
        draw = ImageDraw.Draw(img)
        margin = size // 20
        draw.text((margin + 2, size - margin + 2), label, font=font, fill=(0, 0, 0, 180))
        draw.text((margin, size - margin), label, font=font, fill=(255, 255, 255))
        return img

    def _diffusers_image(self, prompt: str, size: int) -> Image.Image:  # pragma: no cover
        from diffusers import StableDiffusionPipeline  # type: ignore
        import torch  # type: ignore

        model_id = os.environ.get("LSA_SD_MODEL", "runwayml/stable-diffusion-v1-5")
        device = "mps" if torch.backends.mps.is_available() else "cpu"
        pipe = StableDiffusionPipeline.from_pretrained(model_id)
        pipe = pipe.to(device)
        result = pipe(prompt, height=min(size, 768), width=min(size, 768))
        return result.images[0]
