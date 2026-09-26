"""PRIVATE: print a few tickets with a given own-hint combination: the context Jev saw, its answer, the truth.

Run: python puzzle_draft/show_cases.py P1 sw_gloss_own cluster+event 4
"""

import json
import sys
from collections import defaultdict
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))

from harness import Prepared, Puzzle, context, load_genome  # noqa: E402

HERE = Path(__file__).resolve().parent
SHORT = {"analytics-export": "cluster", "customer-form": "topic", "event-log": "event"}


def main(pid: str, gid: str, combo: str, limit: int) -> None:
    puzzle = Puzzle(pid)
    pal, n = puzzle.palette, puzzle.n
    truth = json.loads((HERE / "secret" / pid / "truth.json").read_text(encoding="utf-8"))["grid"]
    probs = np.load(HERE.parent / "out" / "runs" / pid / gid / "probs.npy")
    prep = Prepared(puzzle, load_genome(HERE / "reference_genomes" / f"{gid}.json"))
    own = defaultdict(list)
    for d in puzzle.docs:
        own[tuple(d["cells"][0])].append(d)
    shown = 0
    for a in range(n):
        for w in range(n):
            key = "+".join(sorted({SHORT[d["source"]] for d in own[(a, w)]})) or "none"
            if key != combo or shown >= limit:
                continue
            top = sorted(zip(pal.names, probs[a, w]), key=lambda kv: -kv[1])[:3]
            print(f"\n--- A{a:02d}-W{w:02d} truth={truth[a][w]} Jev=" + ", ".join(f"{q} {p:.2f}" for q, p in top))
            print(context(prep, a, w)[0])
            shown += 1


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2], sys.argv[3], int(sys.argv[4]))
