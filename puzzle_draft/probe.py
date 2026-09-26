"""Phase 1: probe how Jev behaves before we design around it. About 40 uncached calls.

Run: python puzzle_draft/probe.py
"""

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from jevlib import JevBackend, run_parallel  # noqa: E402
from palette import Palette  # noqa: E402

N = 16
PAL = Palette("full")
CRITERIA = PAL.criteria()
REVERSED = dict(reversed(list(CRITERIA.items())))


def header(r: int, c: int) -> str:
    return (f"Hidden pixel-art picture, {N} x {N} pixels (row 0 = top, column 0 = left). "
            f"Target pixel: row {r}, column {c}.")


def state(r: int, c: int, lines: list[str]) -> str:
    body = "\n".join(f"- {line}" for line in lines) if lines else "(no evidence)"
    return f"{header(r, c)}\nEvidence:\n{body}"


def entropy_ratio(probs: dict) -> float:
    h = -sum(p * math.log(p) for p in probs.values() if p > 0)
    return h / math.log(len(probs))


def top3(probs: dict) -> str:
    best = sorted(probs.items(), key=lambda kv: -kv[1])[:3]
    return ", ".join(f"{k} {v:.2f}" for k, v in best)


CANNED = [
    ("block line 75/25", 5, 9, ["[survey] The 4 x 4 block containing this pixel: red 75%, yellow 25%."]),
    ("block line 50/50", 5, 9, ["[survey] The 4 x 4 block containing this pixel: red 50%, yellow 50%."]),
    ("block line 90/10", 5, 9, ["[survey] The 4 x 4 block containing this pixel: red 90%, yellow 10%."]),
    ("abs block, target inside", 5, 9, ["[survey] Rows 4-7, columns 8-11: red 75%, yellow 25%."]),
    ("abs block, target outside", 12, 2, ["[survey] Rows 4-7, columns 8-11: red 75%, yellow 25%."]),
    ("sensors 90% red vs 60% blue", 5, 9, [
        "[sensor S3, stated reliability 90%] Pixel (5,9) reads red.",
        "[sensor S5, stated reliability 60%] Pixel (5,9) reads blue."]),
    ("sensors 60% red vs 90% blue", 5, 9, [
        "[sensor S3, stated reliability 60%] Pixel (5,9) reads red.",
        "[sensor S5, stated reliability 90%] Pixel (5,9) reads blue."]),
    ("1x 90% red vs 3x 60% blue", 5, 9, [
        "[sensor S3, stated reliability 90%] Pixel (5,9) reads red.",
        "[sensor S5, stated reliability 60%] Pixel (5,9) reads blue.",
        "[sensor S6, stated reliability 60%] Pixel (5,9) reads blue.",
        "[sensor S8, stated reliability 60%] Pixel (5,9) reads blue."]),
    ("row run, col 9 (answer red)", 5, 9, [
        "[linescan] Row 5, left to right: background x2, green x1, red x10, background x3."]),
    ("row run, col 2 (answer green)", 5, 2, [
        "[linescan] Row 5, left to right: background x2, green x1, red x10, background x3."]),
    ("row run, col 14 (answer background)", 5, 14, [
        "[linescan] Row 5, left to right: background x2, green x1, red x10, background x3."]),
    ("other pixel's read only", 5, 9, [
        "[sensor S3, stated reliability 90%] Pixel (9,5) reads blue."]),
    ("neighbor relation only", 5, 9, [
        "[survey] Pixel (5,9) matches pixel (5,10)."]),
    ("neighbor relation + neighbor read", 5, 9, [
        "[survey] Pixel (5,9) matches pixel (5,10).",
        "[sensor S3, stated reliability 90%] Pixel (5,10) reads green."]),
]


def main() -> None:
    jev = JevBackend(use_cache=False)
    pixels = [(0, 0), (0, 8), (0, 15), (8, 0), (8, 8), (8, 15), (15, 0), (15, 8), (15, 15)]

    jobs = [("palette only", r, c, [], CRITERIA) for r, c in pixels]
    jobs += [("palette only, reversed", r, c, [], REVERSED) for r, c in pixels]
    jobs += [("repeat (determinism)", 8, 8, [], CRITERIA)] * 3
    jobs += [(label, r, c, lines, CRITERIA) for label, r, c, lines in CANNED]

    def go(job):
        label, r, c, lines, crit = job
        return job, jev.ask(state(r, c, lines), crit)

    results = run_parallel(go, jobs, workers=16)

    print("\n== 1. Palette only (no evidence): is the answer flat (haze) or peaky (solid color)? ==")
    for (label, r, c, _, _), out in results:
        if label.startswith("palette only"):
            order = "reversed" if "reversed" in label else "hue"
            print(f"  ({r:2},{c:2}) {order:8} choice={out['choice']:<10} "
                  f"max={max(out['probs'].values()):.2f} flatness={entropy_ratio(out['probs']):.2f} "
                  f"conf={out['confidence']:.2f} | {top3(out['probs'])}")

    print("\n== 2. Determinism: same call 3 times ==")
    for (label, *_), out in results:
        if label.startswith("repeat"):
            print(f"  {top3(out['probs'])}  conf={out['confidence']:.3f}")

    print("\n== 3. Does Jev use the evidence the way we expect? ==")
    for (label, r, c, lines, _), out in results:
        if lines:
            print(f"  {label:<38} choice={out['choice']:<10} conf={out['confidence']:.2f} | {top3(out['probs'])}")

    tokens = sum((out.get("tokens") or 0) for _, out in results)
    ms = [out["ms"] for _, out in results]
    print(f"\n{len(results)} calls, {tokens} input tokens, median latency {sorted(ms)[len(ms) // 2]:.0f} ms")


if __name__ == "__main__":
    main()
