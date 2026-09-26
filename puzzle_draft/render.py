"""Renders: probability-blend "haze" picture, error heatmap, filmstrip and focus animation."""

from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

from palette import BG_DISPLAY, CREDIT, Palette, font, hex_to_rgb, oklab_to_srgb, srgb_to_oklab, upscale

SIZE = 384


def blend_lab(probs: np.ndarray, pal: Palette, bg_mode: str = "dark") -> np.ndarray:
    """Expected color in OKLab: uncertain pixels become muted mixes (the haze)."""
    return probs @ pal.display_lab(bg_mode)


def blend(probs: np.ndarray, pal: Palette, bg_mode: str = "dark") -> np.ndarray:
    return (oklab_to_srgb(blend_lab(probs, pal, bg_mode)) * 255).round().astype(np.uint8)


def fog(probs: np.ndarray, pal: Palette, bg_mode: str = "dark") -> np.ndarray:
    """Alternative: blend faded toward the background by uncertainty (normalized entropy)."""
    p = np.clip(probs, 1e-9, 1)
    h = -(p * np.log(p)).sum(-1) / np.log(p.shape[-1])
    lab = blend_lab(probs, pal, bg_mode)
    bg_lab = srgb_to_oklab(np.array(hex_to_rgb(BG_DISPLAY[bg_mode])) / 255.0)
    mixed = lab * (1 - h[..., None]) + bg_lab * h[..., None]
    return (oklab_to_srgb(mixed) * 255).round().astype(np.uint8)


def heatmap(p_true: np.ndarray) -> np.ndarray:
    """Bright = Jev put little probability on the true color."""
    stops = np.array([hex_to_rgb("#1E232B"), hex_to_rgb("#C0392B"), hex_to_rgb("#FFD166")], dtype=float)
    v = np.clip(1 - p_true, 0, 1) * 2
    lo = np.floor(v).clip(0, 1).astype(int)
    t = (v - lo)[..., None]
    return (stops[lo] * (1 - t) + stops[lo + 1] * t).round().astype(np.uint8)


def save(rgb: np.ndarray, path: Path, size: int = SIZE) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    upscale(rgb, size).save(path)


def panel(rgb: np.ndarray, caption: str, sub: str = "", size: int = 256) -> Image.Image:
    bg = hex_to_rgb(BG_DISPLAY["dark"])
    img = Image.new("RGB", (size, size + 52), bg)
    img.paste(upscale(rgb, size).resize((size, size), Image.NEAREST), (0, 0))
    draw = ImageDraw.Draw(img)
    draw.text((6, size + 6), caption, fill=(235, 235, 235), font=font(15))
    draw.text((6, size + 28), sub, fill=(170, 175, 185), font=font(12))
    return img


def filmstrip(frames: list[tuple[str, str, np.ndarray]], path: Path) -> None:
    panels = [panel(rgb, cap, sub) for cap, sub, rgb in frames]
    w, h, pad = panels[0].width, panels[0].height, 10
    sheet = Image.new("RGB", (pad + len(panels) * (w + pad), h + 2 * pad + 20), hex_to_rgb(BG_DISPLAY["dark"]))
    for i, p in enumerate(panels):
        sheet.paste(p, (pad + i * (w + pad), pad))
    ImageDraw.Draw(sheet).text((pad, h + pad + 4), CREDIT, fill=(150, 155, 165), font=font(11))
    path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(path)


def animate(frames: list[tuple[str, str, np.ndarray]], gif_path: Path,
            hold_ms: int = 1200, fade_steps: int = 6, fade_ms: int = 60, final_ms: int = 3000) -> None:
    """Crossfade between frames in OKLab, caption on every frame."""
    images, durations = [], []
    labs = [srgb_to_oklab(rgb / 255.0) for _, _, rgb in frames]
    for i, (cap, sub, rgb) in enumerate(frames):
        if i > 0:
            for s in range(1, fade_steps + 1):
                t = s / (fade_steps + 1)
                mid = (oklab_to_srgb(labs[i - 1] * (1 - t) + labs[i] * t) * 255).round().astype(np.uint8)
                images.append(panel(mid, cap, sub, 320))
                durations.append(fade_ms)
        images.append(panel(rgb, cap, sub, 320))
        durations.append(final_ms if i == len(frames) - 1 else hold_ms)
    gif_path.parent.mkdir(parents=True, exist_ok=True)
    images[0].save(gif_path, save_all=True, append_images=images[1:], duration=durations, loop=0,
                   optimize=False, disposal=2)
    images[0].save(gif_path.with_suffix(".webp"), save_all=True, append_images=images[1:],
                   duration=durations, loop=0, lossless=True)
