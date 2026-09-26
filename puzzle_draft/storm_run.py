"""CLI for the hurricane world.

  python puzzle_draft/storm_run.py build                      generate all storms (coverage assertion) -> files
  python puzzle_draft/storm_run.py truth                      render true maps to out/storm/ (never for the curator)
  python puzzle_draft/storm_run.py load                       blocks/reports/assessments -> MongoDB (admin login)
  python puzzle_draft/storm_run.py preview NYC1 10 12 [--genome G]   the exact text Jev sees
  python puzzle_draft/storm_run.py run G [--split dev,val] [--backend fake] [--truth mongo|file]

`run` scores with the scorer login (truth from MongoDB `assessments`); --truth file is for offline work.
Held-out and cities splits are refused unless --final is passed: they are scored once, at the end.
"""

import argparse
import json
import sys
import time
import zlib
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parent))

import storm  # noqa: E402
from jevlib import get_backend, run_parallel  # noqa: E402
from palette import hex_to_rgb  # noqa: E402
from storm_harness import INSTRUCTIONS, Prepared, Town, context, load_genome  # noqa: E402

ROOT = storm.ROOT
OUT = ROOT / "out" / "storm"
GENOMES = ROOT / "puzzle_draft" / "storm_genomes"
TRACE_WORST, TRACE_RANDOM = 10, 20
S = storm.STATES
IDX = {s: i for i, s in enumerate(S)}


# ---------- truth (scorer only) ----------

def load_truth(town: str, source: str) -> dict:
    if source == "file":
        grid = json.loads((storm.SECRET_DIR / town / "truth.json").read_text(encoding="utf-8"))["grid"]
        return {(x, y): v for y, row in enumerate(grid) for x, v in enumerate(row) if v}
    from db import connect
    truth = {(d["x"], d["y"]): d["state"] for d in connect("scorer").assessments.find({"town": town})}
    if not truth:
        raise SystemExit(f"no assessments for {town} in MongoDB; run `storm_run.py load` (or pass --truth file)")
    return truth


def score(answers: dict, truth: dict) -> dict:
    cells = sorted(truth)
    pred = {c: answers[c]["choice"] for c in cells}
    present = [s for s in S if any(truth[c] == s for c in cells)]
    recall = {s: float(np.mean([pred[c] == s for c in cells if truth[c] == s])) for s in present}
    crit = [c for c in cells if truth[c] in storm.LIFE_SAFETY]
    brier = float(np.mean([sum((answers[c]["probs"].get(s, 0) - (truth[c] == s)) ** 2 for s in S) for c in cells]))
    conf = np.array([answers[c]["confidence"] for c in cells])
    correct = np.array([pred[c] == truth[c] for c in cells])
    return {
        "balanced_accuracy": float(np.mean(list(recall.values()))),
        "accuracy": float(correct.mean()),
        "life_safety_recall": float(np.mean([pred[c] == truth[c] for c in crit])) if crit else None,
        "life_safety_found": int(sum(pred[c] == truth[c] for c in crit)), "life_safety_total": len(crit),
        "false_dispatches": int(sum(pred[c] in storm.LIFE_SAFETY and truth[c] == "intact" for c in cells)),
        "brier": brier, "mean_confidence": float(conf.mean()),
        "confident_wrong": int(((conf > 0.8) & ~correct).sum()),
        "accuracy_by_state": recall, "blocks_by_state": {s: sum(truth[c] == s for c in cells) for s in present},
        "blocks": len(cells),
    }


# ---------- rendering ----------

def render(grid: dict, mask, path: Path, conf: dict | None = None, px: int = 14) -> None:
    img = Image.new("RGB", (storm.W * px, storm.H * px), hex_to_rgb(storm.SEA))
    draw = ImageDraw.Draw(img)
    sea = np.array(hex_to_rgb(storm.SEA))
    for y, row in enumerate(mask):
        for x, land in enumerate(row):
            if not land or (x, y) not in grid:
                continue
            rgb = np.array(hex_to_rgb(storm.COLORS[grid[(x, y)]]))
            if conf is not None:  # fade low-confidence calls toward the sea color
                rgb = sea + (rgb - sea) * (0.35 + 0.65 * conf[(x, y)])
            draw.rectangle([x * px, y * px, (x + 1) * px - 2, (y + 1) * px - 2], fill=tuple(int(v) for v in rgb))
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path)


# ---------- commands ----------

def cmd_build(_args) -> None:
    worlds = storm.build_all()
    print(f"  {'state':<15}" + "".join(f"{t:>6}" for t in storm.TOWNS) + "    dev")
    for s in S:
        c = [storm.counts(worlds[t])[s] for t in storm.TOWNS]
        print(f"  {s:<15}" + "".join(f"{v:>6}" for v in c) + f"{sum(c[:3]):>7}")
    print(f"  {'land blocks':<15}" + "".join(f"{len(worlds[t]['cells']):>6}" for t in storm.TOWNS))
    print(f"  {'reports':<15}" + "".join(f"{len(worlds[t]['reports']):>6}" for t in storm.TOWNS))
    print(f"  coverage assertion passed; wrote {storm.STORM_DIR.relative_to(ROOT)}/ and secret truth")


def cmd_truth(args) -> None:
    for t in args.towns.split(",") if args.towns else storm.TOWNS:
        town = Town(t)
        render(load_truth(t, "file"), town.mask, OUT / f"truth_{t}.png")
    tiles = [Image.open(OUT / f"truth_{t}.png") for t in storm.TOWNS]
    rows = -(-len(tiles) // 4)
    sheet = Image.new("RGB", (4 * tiles[0].width + 30, rows * (tiles[0].height + 25)), (20, 24, 30))
    d = ImageDraw.Draw(sheet)
    for i, (t, tile) in enumerate(zip(storm.TOWNS, tiles)):
        x, y = (i % 4) * (tile.width + 10), (i // 4) * (tile.height + 25) + 20
        split = next(k for k, v in storm.SPLITS.items() if t in v)
        d.text((x + 4, y - 16), f"{t} ({split})", fill=(230, 230, 230))
        sheet.paste(tile, (x, y))
    sheet.save(OUT / "truth_sheet.png")
    print(f"  wrote out/storm/truth_<town>.png and out/storm/truth_sheet.png")


def cmd_load(_args) -> None:
    from db import connect
    db = connect("admin")
    for t in storm.TOWNS:
        town = Town(t)
        truth = load_truth(t, "file")
        meta = town.meta
        for c in ("blocks", "reports", "assessments"):
            db[c].delete_many({"town": t})
        db.blocks.insert_many([{"town": t, "city": meta["city"], "x": x, "y": y, "loc": [x, y],
                                "land_use": meta["land_use"][y][x], "elev": meta["elev"][y][x]} for x, y in town.cells])
        db.reports.insert_many([{"town": t, "loc": [d["x"], d["y"]], "text": storm.doc_text(d), **d}
                                for d in town.docs])
        db.assessments.insert_many([{"town": t, "x": x, "y": y, "state": s} for (x, y), s in truth.items()])
        print(f"  {t}: {len(town.cells)} blocks, {len(town.docs)} reports, {len(truth)} assessments")


def cmd_preview(args) -> None:
    genome = load_genome(args.genome) if args.genome else load_genome(GENOMES / "baseline.json")
    prep = Prepared(Town(args.town), genome)
    for x, y in zip(args.xy[0::2], args.xy[1::2]):
        print(f"\n--- {genome['id']} | {args.town} block ({x}, {y}) ---\n{context(prep, x, y)[0]}")


def evaluate(genome: dict, towns: list, backend, truth_source: str = "mongo", workers: int = 16,
             quiet: bool = False) -> dict:
    """Run one genome on the given towns and score it. The scorer part reads truth; nothing else does."""
    criteria = storm.DESCRIPTIONS
    jobs, contexts = [], {}
    for t in towns:
        prep = Prepared(Town(t), genome)
        for cell in prep.town.cells:
            contexts[(t, cell)] = context(prep, *cell)
            jobs.append((t, cell))

    def ask(job):
        state, lines = contexts[job]
        return job, backend.ask(state, criteria, [v for ln in lines for v in ln["votes"]], instructions=INSTRUCTIONS)

    start = time.perf_counter()
    answers = dict(run_parallel(ask, jobs, workers))
    wall = time.perf_counter() - start
    stats = {"backend": backend.name, "calls": len(jobs), "cached": sum(1 for a in answers.values() if a.get("cached")),
             "tokens": sum(a.get("tokens") or 0 for a in answers.values()), "wall_s": round(wall, 1)}
    run_dir = OUT / "runs" / genome["id"]
    per_town, pooled, truths = {}, {}, {}
    for t in towns:
        truth = truths[t] = load_truth(t, truth_source)
        town_answers = {c: answers[(t, c)] for c in truth}
        s = per_town[t] = score(town_answers, truth)
        split = next(k for k, v in storm.SPLITS.items() if t in v)
        if split == "dev":
            pooled.update({(t, c): (answers[(t, c)], truth[c]) for c in truth})
        render({c: a["choice"] for c, a in town_answers.items()}, Town(t).meta["mask"], run_dir / f"{t}.png",
               conf={c: a["confidence"] for c, a in town_answers.items()})
        (run_dir / f"{t}.json").write_text(json.dumps(
            {"scores": s, "cells": [{"x": c[0], "y": c[1], "pick": a["choice"], "conf": a["confidence"],
                                     "probs": a["probs"]} for c, a in town_answers.items()]}), encoding="utf-8")
        if not quiet:
            tag = " [FAKE]" if backend.name == "fake" else ""
            print(f"  {genome['id']} {t:<5} {split:<7}{tag} bal {s['balanced_accuracy']:.1%}  acc {s['accuracy']:.1%}  "
                  f"life-safety {s['life_safety_found']}/{s['life_safety_total']}  false-dispatch {s['false_dispatches']}"
                  f"  brier {s['brier']:.3f}  conf {s['mean_confidence']:.2f}")
    dev = None
    if pooled:
        dev = score({k: a for k, (a, _) in pooled.items()}, {k: tr for k, (_, tr) in pooled.items()})
        write_digest(run_dir / "digest.md", genome, dev, stats, pooled, contexts)
    (run_dir / "summary.json").write_text(json.dumps(
        {"genome": genome, "towns": per_town, "dev": dev, "stats": stats,
         "created": datetime.now(timezone.utc).isoformat()}, indent=2), encoding="utf-8")
    return {"towns": per_town, "dev": dev, "stats": stats, "answers": answers, "truths": truths,
            "contexts": {k: v[0] for k, v in contexts.items()}, "digest": run_dir / "digest.md" if pooled else None}


def cmd_run(args) -> None:
    genome = load_genome(args.genome)
    split_names = args.split.split(",")
    if {"heldout", "cities"} & set(split_names) and not args.final:
        sys.exit("held-out and cities are scored once, at the end: pass --final")
    towns = [t for sp in split_names for t in storm.SPLITS[sp]]
    backend = get_backend(args.backend, use_cache=not args.no_cache)
    if args.final:
        from db import connect
        scorer = connect("scorer")
        # once per genome per world version: new storm data may be scored once; old scores stay on record
        if done := scorer.heldout_scores.count_documents({"genome_id": genome["id"], "town": {"$in": towns},
                                                          "world": storm.WORLD_VERSION}):
            sys.exit(f"{genome['id']} already has {done} once-only scores on world {storm.WORLD_VERSION}; "
                     "held-out is scored once. Not running.")
        if args.run is None or args.gen is None:
            sys.exit("--final needs --run and --gen (the lineage generation this genome came from), for the dashboard")
    r = evaluate(genome, towns, backend, args.truth, args.workers)
    if args.final:  # once-only scoring of tonight's storm and the other cities: record it (scorer login)
        rows = [{"ts": datetime.now(timezone.utc), "meta": {"run": args.run, "gen": args.gen, "town": t},
                 "x": c[0], "y": c[1], "pick": a["choice"], "conf": a["confidence"],
                 "correct": a["choice"] == r["truths"][t][c], "truth": r["truths"][t][c],
                 "probs": {k: round(v, 4) for k, v in a["probs"].items() if v >= 0.005},
                 "lines": r["contexts"][(t, c)].split("\n")}
                for (t, c), a in r["answers"].items()]
        scorer.runs.insert_many(rows, ordered=False)
        print(f"  wrote {len(rows)} map rows for the dashboard (run {args.run}, gen {args.gen})")
        for t in towns:
            s = r["towns"][t]
            scorer.heldout_scores.insert_one({
                "genome_id": genome["id"], "town": t, "world": storm.WORLD_VERSION,
                "split": next(k for k, v in storm.SPLITS.items() if t in v),
                "score": s["balanced_accuracy"], "life_safety_recall": s["life_safety_recall"],
                "life_safety_found": s["life_safety_found"], "life_safety_total": s["life_safety_total"],
                "false_dispatches": s["false_dispatches"], "created": datetime.now(timezone.utc)})
        print(f"  recorded {len(towns)} once-only scores in heldout_scores")
    if r["dev"]:
        st = r["stats"]
        print(f"  {genome['id']} DEV pooled: bal {r['dev']['balanced_accuracy']:.1%} | {st['calls']} calls "
              f"({st['cached']} cached), {st['tokens']} tokens, {st['wall_s']}s | digest "
              f"{r['digest'].relative_to(ROOT)}")


def write_digest(path: Path, genome: dict, s: dict, stats: dict, pooled: dict, contexts: dict) -> None:
    """What the curator gets: pooled dev scores + 30 traces. No renders, no validation or held-out numbers."""
    lines = [f"# Eval results: `{genome['id']}` on the past storms", "",
             f"Rationale: {json.dumps(genome.get('rationale', ''))}", f"Prediction: {genome.get('prediction', '')}", "",
             "| Score | Value |", "|---|---|",
             f"| Balanced accuracy (mean of per-state accuracy) | {s['balanced_accuracy']:.1%} |",
             f"| Plain accuracy | {s['accuracy']:.1%} |",
             f"| Life-safety blocks found (collapsed, flooded_homes, fire, hospital_down) | "
             f"{s['life_safety_found']} of {s['life_safety_total']} |",
             f"| False dispatches (life-safety call on an intact block) | {s['false_dispatches']} |",
             f"| Confident but wrong (confidence > 0.8) | {s['confident_wrong']} blocks |",
             f"| Jev's mean confidence | {s['mean_confidence']:.2f} |",
             f"| Cost | {stats['tokens']} input tokens for {stats['calls']} blocks |", "",
             "| True state | Blocks | Accuracy |", "|---|---|---|"]
    for st, acc in sorted(s["accuracy_by_state"].items(), key=lambda kv: -s["blocks_by_state"][kv[0]]):
        lines.append(f"| {st} | {s['blocks_by_state'][st]} | {acc:.0%} |")
    keys = sorted(pooled)
    p_true = [pooled[k][0]["probs"].get(pooled[k][1], 0) for k in keys]
    worst = [keys[i] for i in np.argsort(p_true)[:TRACE_WORST]]
    rest = [k for k in keys if k not in set(worst)]
    rng = np.random.default_rng(zlib.crc32(genome["id"].encode()))
    sample = [rest[i] for i in sorted(rng.choice(len(rest), size=min(TRACE_RANDOM, len(rest)), replace=False))]
    for title, group in (("Traces: worst blocks", worst), ("Traces: random sample of blocks", sample)):
        lines += ["", f"## {title} ({len(group)})", ""]
        for k in group:
            a, true = pooled[k]
            top = ", ".join(f"{n} {p:.0%}" for n, p in sorted(a["probs"].items(), key=lambda kv: -kv[1])[:3])
            verdict = "correct" if a["choice"] == true else "WRONG"
            lines += [f"### {verdict}. True state {true}; Jev said {top} (confidence {a['confidence']:.2f})", "",
                      "```", contexts[k][0], "```", ""]
    path.write_text("\n".join(lines), encoding="utf-8")


def cmd_refs(args) -> None:
    from db import connect
    doc = {"run": "refs", "kind": "refs", "created": datetime.now(timezone.utc)}
    for name, gid in (("baseline", "baseline"), ("ceiling", args.ceiling)):
        summ = json.loads((OUT / "runs" / gid / "summary.json").read_text(encoding="utf-8"))
        doc[name] = {"dev": summ["dev"]["balanced_accuracy"],
                     "val": summ["towns"][storm.SPLITS["val"][0]]["balanced_accuracy"],
                     "dev_false_dispatches": summ["dev"]["false_dispatches"]}
    connect("scorer").gate_scores.insert_one(doc)  # insert-only role: the dashboard reads the newest refs doc
    print(f"  refs: baseline {doc['baseline']}, ceiling {doc['ceiling']}")


def main() -> None:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("build").set_defaults(fn=cmd_build)
    p = sub.add_parser("truth")
    p.add_argument("--towns")
    p.set_defaults(fn=cmd_truth)
    sub.add_parser("load").set_defaults(fn=cmd_load)
    p = sub.add_parser("refs", help="store baseline + builder-ceiling scores for the dashboard")
    p.add_argument("--ceiling", default="ref_full_v3c")
    p.set_defaults(fn=cmd_refs)
    p = sub.add_parser("preview")
    p.add_argument("town")
    p.add_argument("xy", type=int, nargs="+")
    p.add_argument("--genome")
    p.set_defaults(fn=cmd_preview)
    p = sub.add_parser("run")
    p.add_argument("genome")
    p.add_argument("--split", default="dev,val")
    p.add_argument("--backend", choices=["jev", "fake"], default="jev")
    p.add_argument("--truth", choices=["mongo", "file"], default="mongo")
    p.add_argument("--workers", type=int, default=16)
    p.add_argument("--no-cache", action="store_true")
    p.add_argument("--final", action="store_true", help="allow the once-only held-out / cities scoring")
    p.add_argument("--run", help="with --final: the lineage run this genome came from (e.g. live-1)")
    p.add_argument("--gen", type=int, help="with --final: the generation this genome came from")
    p.set_defaults(fn=cmd_run)
    args = parser.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
