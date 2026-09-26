"""PRIVATE: per-ticket accuracy of a run, split by which hint types the ticket has of its own.

Run: python puzzle_draft/analyze_hints.py P1 sw_gloss_own
"""

import json
import sys
from collections import defaultdict
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))

from harness import HINT_QUEUES, Puzzle  # noqa: E402

HERE = Path(__file__).resolve().parent
SHORT = {"analytics-export": "cluster", "customer-form": "topic", "event-log": "event"}


def main(pid: str, gid: str) -> None:
    puzzle = Puzzle(pid)
    pal, n = puzzle.palette, puzzle.n
    truth = json.loads((HERE / "secret" / pid / "truth.json").read_text(encoding="utf-8"))["grid"]
    probs = np.load(HERE.parent / "out" / "runs" / pid / gid / "probs.npy")
    own = defaultdict(list)
    for d in puzzle.docs:
        own[tuple(d["cells"][0])].append(d)
    groups = defaultdict(lambda: [0, 0, 0])  # correct, total, hints-consistent-and-unique
    for a in range(n):
        for w in range(n):
            docs = own[(a, w)]
            key = "+".join(sorted({SHORT[d["source"]] for d in docs})) or "none"
            pred = pal.names[int(probs[a, w].argmax())]
            g = groups[key]
            g[0] += pred == truth[a][w]
            g[1] += 1
            candidates = set(pal.names)
            for d in docs:
                candidates &= HINT_QUEUES[d["source"]][d["payload"]["value"]]
            g[2] += candidates == {truth[a][w]}
    print(f"  {'own hints':<22}{'tickets':>8}{'Jev right':>11}{'hints pin it':>14}")
    for key, (c, t, u) in sorted(groups.items(), key=lambda kv: -kv[1][1]):
        print(f"  {key:<22}{t:>8}{c / t:>11.0%}{u / t:>14.0%}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
