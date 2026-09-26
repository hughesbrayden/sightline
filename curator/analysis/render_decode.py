"""Decode a results render.png into per-ticket approximate queue mixtures.

Usage: python render_decode.py <genome_id>
Rows = accounts A00..A15, columns = weeks W00..W15.
"""
import json
import sys
from itertools import combinations
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
gid = sys.argv[1] if len(sys.argv) > 1 else "baseline"
pal = json.loads((ROOT / "puzzles/P1/palette.json").read_text())
colors = {q: np.array([int(h[i:i + 2], 16) for i in (1, 3, 5)], float)
          for q, h in pal["render_colors"].items()}
# merge the two near-identical darks for decoding purposes
colors_dec = {k: v for k, v in colors.items() if k not in ("legal", "no_action")}
colors_dec["dark"] = (colors["legal"] + colors["no_action"]) / 2

img = np.asarray(Image.open(ROOT / f"results/P1/{gid}/render.png").convert("RGB"), float)
H, W, _ = img.shape
n = 16
ch, cw = H // n, W // n

names = list(colors_dec)
M = np.stack([colors_dec[q] for q in names], 1)  # 3 x Q


def best_mix(c):
    best = None
    for k in (1, 2):
        for combo in combinations(range(len(names)), k):
            A = M[:, combo]
            if k == 1:
                w = np.array([1.0])
            else:
                # constrained LS: w1 + w2 = 1, 0<=w<=1
                a, b = A[:, 0], A[:, 1]
                d = a - b
                t = float(np.dot(c - b, d) / max(np.dot(d, d), 1e-9))
                t = min(max(t, 0.0), 1.0)
                w = np.array([t, 1 - t])
            err = np.linalg.norm(A @ w - c)
            if best is None or err < best[0] - 1e-6:
                best = (err, combo, w)
    err, combo, w = best
    parts = sorted(((w[i], names[j]) for i, j in enumerate(combo)), reverse=True)
    return err, parts


grid = []
for r in range(n):
    row = []
    for cidx in range(n):
        cell = img[r * ch + 4:(r + 1) * ch - 4, cidx * cw + 4:(cidx + 1) * cw - 4]
        c = cell.reshape(-1, 3).mean(0)
        err, parts = best_mix(c)
        top = parts[0]
        label = top[1][:4] if top[0] >= 0.6 else f"{parts[0][1][:3]}/{parts[1][1][:3]}"
        row.append(label)
    grid.append(row)

print("acct  " + " ".join(f"W{w:02d}".ljust(7) for w in range(n)))
for r, row in enumerate(grid):
    print(f"A{r:02d}  " + " ".join(x.ljust(7) for x in row))
