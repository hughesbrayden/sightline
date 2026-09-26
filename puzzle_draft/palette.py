"""Palettes, OKLab color math, Twemoji fetching, image -> grid and contact sheets."""

import math
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
TWEMOJI_DIR = ROOT / "puzzle_draft" / "data" / "twemoji"
TWEMOJI_URL = "https://cdn.jsdelivr.net/gh/jdecked/twemoji@17.0.3/assets/72x72/{}.png"
CREDIT = "Pictures: Twemoji (jdecked/twemoji), CC-BY 4.0"

BG = "background"

# name -> (criteria description for Jev, anchor shades taken from Twemoji art; first = display)
CLASS_DEFS = {
    "red": ("bright red", ["#DD2E44", "#BE1931", "#A0041E", "#E2463E"]),
    "orange": ("orange", ["#F4900C", "#FFAC33", "#E27022"]),
    "yellow": ("yellow", ["#FFCC4D", "#FFD983", "#FFE8B6", "#FDCB58"]),
    "green": ("green", ["#77B255", "#5C913B", "#3E721D", "#A6D388", "#C6E5B3"]),
    "blue": ("blue", ["#55ACEE", "#3B88C3", "#226699", "#88C9F9", "#BBDDF5"]),
    "purple": ("purple or violet", ["#AA8DD8", "#744EAA", "#9266CC", "#553788"]),
    "pink": ("pink", ["#F4ABBA", "#EA596E", "#FF7892"]),
    "brown": ("brown or tan", ["#C1694F", "#662113", "#8A4B38", "#D99E82", "#BF6952"]),
    "white": ("white or very light gray", ["#FFFFFF", "#F5F8FA", "#E1E8ED"]),
    "gray": ("medium gray", ["#99AAB5", "#CCD6DD", "#66757F"]),
    "black": ("black or dark outline", ["#292F33", "#31373D", "#14171A", "#000000"]),
    BG: ("empty space, no object here", []),
}

# Hue order, background last. Fixed everywhere (Jev sees options in this order).
PALETTE_ORDERS = {
    "full": ["red", "orange", "yellow", "green", "blue", "purple", "pink",
             "brown", "white", "gray", "black", BG],
    "lite": ["red", "orange", "yellow", "green", "blue", "brown", "white", "black", BG],
}

# v3 framing: each color is a support queue. Jev chooses queues; the render colors tickets by queue.
QUEUES = {
    "red": ("billing", "charges, invoices, failed or declined payments"),
    "orange": ("refunds", "refund requests, chargebacks, money back"),
    "yellow": ("shipping", "delivery status, delays, lost or misdelivered packages"),
    "green": ("account_access", "login problems, passwords, two-factor codes, locked accounts"),
    "blue": ("technical", "bugs, errors, crashes, slowness in the product"),
    "purple": ("integrations", "API, webhooks, third-party connectors"),
    "pink": ("sales", "pricing, upgrades, plans, seats, discounts"),
    "brown": ("returns", "sending items back, exchanges, return labels"),
    "white": ("feedback", "suggestions, compliments, feature ideas"),
    "gray": ("security", "suspicious logins, phishing, exposed credentials"),
    "black": ("legal", "legal notices, data requests, privacy and compliance"),
    BG: ("no_action", "auto-replies, duplicates, empty or misdirected messages: close without routing"),
}
for _color, (_queue, _desc) in QUEUES.items():
    CLASS_DEFS[_queue] = (_desc, CLASS_DEFS[_color][1])
PALETTE_ORDERS["queues"] = [QUEUES[c][0] for c in PALETTE_ORDERS["full"]]
BG_DISPLAY = {"dark": "#1E232B", "light": "#EFEAE0"}
BG_REFERENCE = "#2A2F36"  # used for confusion distances, independent of display mode

# (key, codepoint, split). Train = food and plants; held-out = objects, animals, symbols.
PICTURES = [
    ("strawberry", "1f353", "train"), ("mushroom", "1f344", "train"),
    ("apple", "1f34e", "train"), ("watermelon", "1f349", "train"),
    ("carrot", "1f955", "train"), ("sunflower", "1f33b", "train"),
    ("tree", "1f332", "train"), ("egg", "1f95a", "train"),
    ("blueberries", "1fad0", "train"), ("banana", "1f34c", "train"),
    ("heart", "2764", "heldout"), ("rocket", "1f680", "heldout"),
    ("fish", "1f41f", "heldout"), ("frog", "1f438", "heldout"),
    ("ghost", "1f47b", "heldout"), ("fire", "1f525", "heldout"),
    ("balloon", "1f388", "heldout"), ("rainbow", "1f308", "heldout"),
    ("star", "2b50", "heldout"), ("soccer", "26bd", "heldout"),
]
PICTURE_CP = {key: cp for key, cp, _ in PICTURES}


def hex_to_rgb(h: str) -> tuple[int, int, int]:
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def srgb_to_oklab(rgb: np.ndarray) -> np.ndarray:
    """rgb in 0..1, shape (..., 3) -> OKLab (..., 3)."""
    c = np.where(rgb <= 0.04045, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4)
    r, g, b = c[..., 0], c[..., 1], c[..., 2]
    l = np.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
    m = np.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
    s = np.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
    return np.stack([
        0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
        1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
        0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
    ], axis=-1)


def oklab_to_srgb(lab: np.ndarray) -> np.ndarray:
    """OKLab (..., 3) -> rgb in 0..1, clipped."""
    L, a, b = lab[..., 0], lab[..., 1], lab[..., 2]
    l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
    m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
    s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3
    lin = np.stack([
        4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
        -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
        -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
    ], axis=-1)
    lin = np.clip(lin, 0, 1)
    return np.clip(np.where(lin <= 0.0031308, 12.92 * lin, 1.055 * lin ** (1 / 2.4) - 0.055), 0, 1)


class Palette:
    def __init__(self, name: str):
        self.name = name
        self.names = PALETTE_ORDERS[name]
        self.index = {n: i for i, n in enumerate(self.names)}
        self.bg = len(self.names) - 1  # background / no_action is always the last option
        anchors, owners = [], []
        for i, n in enumerate(self.names):
            for h in CLASS_DEFS[n][1]:
                anchors.append(hex_to_rgb(h))
                owners.append(i)
        self.anchor_lab = srgb_to_oklab(np.array(anchors) / 255.0)
        self.anchor_owner = np.array(owners)

    def criteria(self) -> dict:
        return {n: CLASS_DEFS[n][0] for n in self.names}

    def display_hex(self, bg_mode: str = "dark") -> list[str]:
        return [BG_DISPLAY[bg_mode] if i == self.bg else CLASS_DEFS[n][1][0] for i, n in enumerate(self.names)]

    def display_rgb(self, bg_mode: str = "dark") -> np.ndarray:
        return np.array([hex_to_rgb(h) for h in self.display_hex(bg_mode)], dtype=np.uint8)

    def display_lab(self, bg_mode: str = "dark") -> np.ndarray:
        return srgb_to_oklab(self.display_rgb(bg_mode) / 255.0)

    def reference_lab(self) -> np.ndarray:
        hexes = [BG_REFERENCE if i == self.bg else CLASS_DEFS[n][1][0] for i, n in enumerate(self.names)]
        return srgb_to_oklab(np.array([hex_to_rgb(h) for h in hexes]) / 255.0)


def fetch(key: str) -> Path:
    """Download (once) and return the local Twemoji PNG for a picture key."""
    cp = PICTURE_CP[key]
    TWEMOJI_DIR.mkdir(parents=True, exist_ok=True)
    path = TWEMOJI_DIR / f"{key}.png"
    if path.exists():
        return path
    for name in (cp, f"{cp}-fe0f"):
        request = urllib.request.Request(TWEMOJI_URL.format(name), headers={"User-Agent": "sightline"})
        try:
            with urllib.request.urlopen(request, timeout=20) as response:
                path.write_bytes(response.read())
                return path
        except Exception:
            continue
    raise RuntimeError(f"Could not download Twemoji {key} ({cp})")


def image_to_grid(path: Path, n: int, palette: Palette, bg_min_share: float = 0.6) -> np.ndarray:
    """Map pixels to the nearest palette shade in OKLab, then take the most common color per cell.

    Background only wins a cell when it covers at least bg_min_share of it, which keeps thin outlines.
    """
    img = Image.open(path).convert("RGBA")
    k = math.ceil(img.width / n)
    img = img.resize((n * k, n * k), Image.NEAREST)
    arr = np.asarray(img).astype(float) / 255.0
    lab = srgb_to_oklab(arr[..., :3])
    dist = ((lab[..., None, :] - palette.anchor_lab[None, None]) ** 2).sum(-1)
    cls = palette.anchor_owner[dist.argmin(-1)]
    cls[arr[..., 3] < 0.5] = palette.bg

    cells = cls.reshape(n, k, n, k).transpose(0, 2, 1, 3).reshape(n, n, k * k)
    counts = np.stack([(cells == i).sum(-1) for i in range(len(palette.names))], axis=-1)
    bg_share = counts[..., palette.bg] / (k * k)
    non_bg = counts.copy()
    non_bg[..., palette.bg] = -1
    return np.where(bg_share >= bg_min_share, palette.bg, non_bg.argmax(-1))


def upscale(rgb: np.ndarray, size: int) -> Image.Image:
    n = rgb.shape[0]
    scale = max(1, size // n)
    return Image.fromarray(rgb.astype(np.uint8)).resize((n * scale, n * scale), Image.NEAREST)


def grid_to_rgb(grid: np.ndarray, palette: Palette, bg_mode: str = "dark") -> np.ndarray:
    return palette.display_rgb(bg_mode)[grid]


def font(size: int = 14):
    return ImageFont.load_default(size=size)


def contact_sheet(bg_mode: str, out_path: Path, cell: int = 128) -> None:
    """Rows = pictures; columns = source + 16/24/32 grids x full/lite palettes."""
    columns = [(n, p) for n in (16, 24, 32) for p in ("full", "lite")]
    palettes = {p: Palette(p) for p in ("full", "lite")}
    header, label_w, pad = 40, 130, 8
    width = label_w + (len(columns) + 1) * (cell + pad) + pad
    height = header + len(PICTURES) * (cell + pad) + 40
    bg = hex_to_rgb(BG_DISPLAY[bg_mode])
    fg = (235, 235, 235) if bg_mode == "dark" else (30, 30, 30)
    sheet = Image.new("RGB", (width, height), bg)
    draw = ImageDraw.Draw(sheet)

    titles = ["source"] + [f"{n}x{n} {p}" for n, p in columns]
    for j, title in enumerate(titles):
        draw.text((label_w + pad + j * (cell + pad), 12), title, fill=fg, font=font(14))

    for i, (key, _, split) in enumerate(PICTURES):
        y = header + i * (cell + pad)
        draw.text((8, y + cell // 2 - 16), key, fill=fg, font=font(15))
        draw.text((8, y + cell // 2 + 4), split, fill=fg, font=font(12))
        src = Image.open(fetch(key)).convert("RGBA").resize((cell, cell), Image.LANCZOS)
        tile = Image.new("RGB", (cell, cell), bg)
        tile.paste(src, (0, 0), src)
        sheet.paste(tile, (label_w + pad, y))
        for j, (n, p) in enumerate(columns, start=1):
            grid = image_to_grid(fetch(key), n, palettes[p])
            img = upscale(grid_to_rgb(grid, palettes[p], bg_mode), cell).resize((cell, cell), Image.NEAREST)
            sheet.paste(img, (label_w + pad + j * (cell + pad), y))

    draw.text((8, height - 28), CREDIT, fill=fg, font=font(12))
    out_path.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(out_path)
