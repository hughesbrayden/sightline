"""Rebuild a run's `runs` rows (pick, conf, probs, the exact lines Jev saw, graded truth) from local artifacts.

  python puzzle_draft/backfill_runs.py live-1 [--gens 0-8]

For rows written before the driver stored context lines. Deletes with the admin login (the scorer role is
insert-only), re-inserts with the scorer login. Dev and validation storms only; held-out is never touched.
"""

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import storm  # noqa: E402
from db import connect  # noqa: E402
from storm_harness import Prepared, Town, context  # noqa: E402
from storm_run import OUT, load_truth  # noqa: E402


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("run")
    parser.add_argument("--gens", help="range like 0-8 (default: every evaluated gen in the lineage)")
    args = parser.parse_args()
    lo, hi = (map(int, args.gens.split("-")) if args.gens else (0, 10 ** 6))
    docs = {}
    for line in (OUT / "lineage" / f"{args.run}.jsonl").read_text(encoding="utf-8").splitlines():
        d = json.loads(line)
        docs[d["gen"]] = d
    admin, scorer = connect("admin"), connect("scorer")
    towns = storm.SPLITS["dev"] + storm.SPLITS["val"]
    truths = {t: load_truth(t, "file") for t in towns}
    for gen, d in sorted(docs.items()):
        if not (lo <= gen <= hi) or d.get("status") not in ("accepted", "rejected"):
            continue
        genome = {"id": d["genome_id"], "ops": d["ops"], "format": d.get("format", "raw")}
        rows = []
        for t in towns:
            prep = Prepared(Town(t), genome)
            cells = json.loads((OUT / "runs" / d["genome_id"] / f"{t}.json").read_text(encoding="utf-8"))["cells"]
            for c in cells:
                x, y = c["x"], c["y"]
                rows.append({"ts": datetime.now(timezone.utc), "meta": {"run": args.run, "gen": gen, "town": t},
                             "x": x, "y": y, "pick": c["pick"], "conf": c["conf"],
                             "correct": c["pick"] == truths[t][(x, y)], "truth": truths[t][(x, y)],
                             "probs": {k: round(v, 4) for k, v in c["probs"].items() if v >= 0.005},
                             "lines": context(prep, x, y)[0].split("\n")})
        deleted = admin.runs.delete_many({"meta.run": args.run, "meta.gen": gen}).deleted_count
        scorer.runs.insert_many(rows, ordered=False)
        print(f"  {args.run} gen {gen}: replaced {deleted} rows with {len(rows)} (lines + probs + truth)")


if __name__ == "__main__":
    main()
