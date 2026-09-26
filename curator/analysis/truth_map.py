"""Estimate the truth picture: Jev's decoded predictions from a render, overwritten by
every labeled trace. Prints the grid and neighbor-vote simulations for uncertain cells.

Usage: python truth_map.py <genome_id_for_render>
Legend: . no_action, B billing, S shipping, A account_access, ? ambiguous prediction
Uppercase = confirmed by a trace label; lowercase = Jev's prediction only.
"""
import re
import subprocess
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
gid = sys.argv[1] if len(sys.argv) > 1 else "iter_02"
out = subprocess.run([sys.executable, str(Path(__file__).parent / "render_decode.py"), gid],
                     capture_output=True, text=True).stdout.splitlines()[1:]
pred = {}
m = {"dark": ".", "bill": "b", "ship": "s", "acco": "a"}
for a, ln in enumerate(out):
    cells = ln.split()[1:]
    for w, c in enumerate(cells):
        pred[(a, w)] = m.get(c, "?")

head = re.compile(r"^### Ticket A(\d\d)-W(\d\d): (\w+)\. Right queue (\w+);")
ab = {"no_action": "_", "billing": "B", "shipping": "S", "account_access": "A"}
truth = {}
for d in sorted((ROOT / "results/P1").glob("*/digest.md")):
    for ln in d.read_text(encoding="utf-8").splitlines():
        mm = head.match(ln)
        if mm:
            truth[(int(mm[1]), int(mm[2]))] = ab[mm[4]]

grid = {k: truth.get(k, pred[k]) for k in pred}
print("    " + "".join(f"{w:>3}" for w in range(16)))
for a in range(16):
    print(f"A{a:02d} " + "".join(f"{grid[(a, w)]:>3}" for w in range(16)))

norm = {".": "N", "_": "N", "b": "B", "B": "B", "s": "S", "S": "S", "a": "A", "A": "A", "?": "?"}


def neigh(a, w, scope, r):
    out = []
    for da in range(-r, r + 1):
        for dw in range(-r, r + 1):
            if (da, dw) == (0, 0):
                continue
            if scope == "same_account" and da != 0:
                continue
            if scope == "same_week" and dw != 0:
                continue
            if scope == "both" and da != 0 and dw != 0:
                continue
            k = (a + da, w + dw)
            if k in grid:
                out.append(norm[grid[k]])
    return Counter(out)


print("\nNeighbor label counts for labeled non-no_action tickets (truth, box r1 / both r1 / same_week r1 / same_account r1):")
for k in sorted(truth):
    if truth[k] == "_":
        continue
    a, w = k
    print(f"A{a:02d}-W{w:02d} {truth[k]}  box1={dict(neigh(a, w, 'box', 1))}  both1={dict(neigh(a, w, 'both', 1))}  "
          f"wk1={dict(neigh(a, w, 'same_week', 1))}  acct1={dict(neigh(a, w, 'same_account', 1))}")
