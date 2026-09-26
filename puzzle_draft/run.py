"""CLI for the puzzle draft.

  python puzzle_draft/run.py fetch                         download the source pictures
  python puzzle_draft/run.py sheet                         contact sheets in out/
  python puzzle_draft/run.py build P1 --pic watermelon     build a puzzle (evidence pool + hidden truth)
  python puzzle_draft/run.py publish P1                    copy the public files into curator/ and leak-check
  python puzzle_draft/run.py preview P1 --ticket 5 9       the exact text Jev sees (--genome to pick a policy)
  python puzzle_draft/run.py run curator/genomes/baseline.json P1 [--backend fake]
  python puzzle_draft/run.py film P1 baseline iter_01 ... [--then P2:iter_03]
  python puzzle_draft/run.py truth P1                      render the true picture (never shown to the curator)
  python puzzle_draft/run.py leakcheck
"""

import argparse
import json
import re
import shutil
import sys
import time
import zlib
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))

from evidence import PUZZLES_DIR, SECRET_DIR, write_puzzle  # noqa: E402
from harness import Prepared, Puzzle, context, load_genome  # noqa: E402
from jevlib import get_backend, run_parallel  # noqa: E402
from palette import PICTURES, ROOT, contact_sheet, fetch  # noqa: E402
from render import animate, blend, filmstrip, fog, save  # noqa: E402

OUT = ROOT / "out"
CURATOR = ROOT / "curator"
TRACE_WORST = 10   # traces of the worst-routed tickets per run
TRACE_RANDOM = 20  # traces of randomly sampled tickets per run
REGION = 4  # region grid cell size: 4 accounts x 4 weeks
BRIEF = ROOT / "puzzle_draft" / "curator_brief.md"
BASELINE = {
    "id": "baseline",
    "rationale": "Current production policy: show Jev the ticket's own records only.",
    "prediction": "n/a",
    "ops": [
        {"op": "include_own", "k": 3},
    ],
    "format": "raw",
}


def published(pid: str) -> bool:
    return (CURATOR / "puzzles" / pid).exists()


def results_dir(pid: str, gid: str, private: bool = False) -> Path:
    if private or not published(pid):
        return OUT / "results" / pid / gid
    return CURATOR / "results" / pid / gid


def load_truth(pid: str, pal) -> np.ndarray:
    truth = json.loads((SECRET_DIR / pid / "truth.json").read_text(encoding="utf-8"))
    return np.array([[pal.index[v] for v in row] for row in truth["grid"]])


# ---------- scoring (the only code that reads the truth) ----------

def score(probs: np.ndarray, conf: np.ndarray, truth: np.ndarray, pal) -> dict:
    pred = probs.argmax(-1)
    present = sorted(set(truth.flatten().tolist()))
    recall = {pal.names[k]: float((pred[truth == k] == k).mean()) for k in present}
    soft = {pal.names[k]: float(probs[truth == k][:, k].mean()) for k in present}
    lab = probs @ pal.display_lab("dark")
    delta_e = float(np.linalg.norm(lab - pal.display_lab("dark")[truth], axis=-1).mean() * 100)
    p = np.clip(probs, 1e-9, 1)
    n = truth.shape[0]
    correct = pred == truth
    grid = [[float(correct[a:a + REGION, w:w + REGION].mean()) for w in range(0, n, REGION)]
            for a in range(0, n, REGION)]
    conf_grid = [[float(conf[a:a + REGION, w:w + REGION].mean()) for w in range(0, n, REGION)]
                 for a in range(0, n, REGION)]
    return {
        "mean_confidence": float(conf.mean()),
        "region_confidence": conf_grid,
        "balanced_accuracy": float(np.mean(list(recall.values()))),
        "balanced_soft_score": float(np.mean(list(soft.values()))),
        "accuracy": float(correct.mean()),
        "picture_error_deltaE": delta_e,
        "confident_wrong": int(((conf > 0.8) & ~correct).sum()),
        "mean_uncertainty": float((-(p * np.log(p)).sum(-1) / np.log(p.shape[-1])).mean()),
        "accuracy_by_queue": recall,
        "tickets_by_queue": {pal.names[k]: int((truth == k).sum()) for k in present},
        "region_accuracy": grid,
    }


def write_digest(path: Path, pid: str, genome: dict, s: dict, stats: dict, worst: list) -> None:
    lines = [
        f"# Eval results: `{genome['id']}` on puzzle {pid}",
        "",
        f"Rationale: {genome.get('rationale', '')}",
        f"Prediction: {genome.get('prediction', '')}",
        "",
        "| Score | Value |",
        "|---|---|",
        f"| Balanced accuracy (mean of per-queue accuracy) | {s['balanced_accuracy']:.1%} |",
        f"| Balanced soft score (mean probability on the right queue, per queue) | {s['balanced_soft_score']:.1%} |",
        f"| Plain accuracy | {s['accuracy']:.1%} |",
        f"| Confident but wrong (confidence > 0.8) | {s['confident_wrong']} tickets |",
        f"| Jev's mean confidence (0-1, needs no labels) | {s['mean_confidence']:.2f} |",
        f"| Cost | {stats['tokens']} input tokens for {stats['calls']} tickets |",
        "",
        "| Queue | Tickets | Accuracy |",
        "|---|---|---|",
    ]
    for queue, acc in sorted(s["accuracy_by_queue"].items(), key=lambda kv: -s["tickets_by_queue"][kv[0]]):
        lines.append(f"| {queue} | {s['tickets_by_queue'][queue]} | {acc:.0%} |")
    for title, grid, fmt in (("Accuracy", s["region_accuracy"], "{:.0%}"),
                             ("Jev's mean confidence", s["region_confidence"], "{:.2f}")):
        lines += ["", f"{title} by region ({REGION} accounts x {REGION} weeks per cell):", "",
                  "| accounts \\ weeks | " + " | ".join(f"W{w * REGION:02d}-{w * REGION + REGION - 1:02d}" for w in range(len(grid[0]))) + " |",
                  "|---|" + "---|" * len(grid[0])]
        for a, row in enumerate(grid):
            lines.append(f"| A{a * REGION:02d}-{a * REGION + REGION - 1:02d} | " + " | ".join(fmt.format(v) for v in row) + " |")
    lines += [
        "",
        "`render.png` is Jev's routing map: accounts are rows, weeks are columns, and each ticket is drawn in the "
        "probability-weighted mix of its queues' colors (see `palette.json`). Correct routing draws a clean picture.",
    ]
    for title, group in (("Traces: worst-routed tickets", worst[0]), ("Traces: random sample of tickets", worst[1])):
        lines += ["", f"## {title} ({len(group)})", ""]
        for a, w, true_name, probs, conf, state in group:
            best = ", ".join(f"{k} {v:.0%}" for k, v in sorted(probs.items(), key=lambda kv: -kv[1])[:3])
            verdict = "correct" if max(probs, key=probs.get) == true_name else "WRONG"
            lines += [f"### Ticket A{a:02d}-W{w:02d}: {verdict}. Right queue {true_name}; Jev said {best} "
                      f"(confidence {conf:.2f})", "", "```", state, "```", ""]
    path.write_text("\n".join(lines), encoding="utf-8")


# ---------- commands ----------

def cmd_fetch(_args) -> None:
    for key, cp, split in PICTURES:
        path = fetch(key)
        print(f"  {key:<12} {cp:<6} {split:<8} {path.stat().st_size:>6} bytes")


def cmd_sheet(_args) -> None:
    for mode in ("dark", "light"):
        path = OUT / f"sheet_{mode}.png"
        contact_sheet(mode, path)
        print(f"  wrote {path.relative_to(ROOT)}")


def cmd_build(args) -> None:
    knobs = {}
    for kv in args.knob or []:  # name=value (e.g. coverage=0.6), or source.field=value for per-source knobs
        key, v = kv.split("=")
        value = float(v) if "." in v else int(v)
        if "." in key:
            src, field = key.rsplit(".", 1)
            knobs.setdefault(src, {})[field] = value
        else:
            knobs[key] = value
    info = write_puzzle(args.pid, args.pic, args.size, args.palette, args.seed, knobs)
    print(f"  built {args.pid}: {info['records']} records {info['records_by_source']}")


def cmd_publish(args) -> None:
    dest = CURATOR / "puzzles" / args.pid
    dest.mkdir(parents=True, exist_ok=True)
    for name in ("puzzle.json", "palette.json"):  # v4: no record pool; the curator sees records only in traces
        shutil.copy(PUZZLES_DIR / args.pid / name, dest / name)
    shutil.copy(BRIEF, CURATOR / "README.md")
    genomes = CURATOR / "genomes"
    genomes.mkdir(parents=True, exist_ok=True)
    if not (genomes / "baseline.json").exists():
        (genomes / "baseline.json").write_text(json.dumps(BASELINE, indent=2), encoding="utf-8")
    print(f"  published {args.pid} to curator/")
    cmd_leakcheck(args)


def cmd_preview(args) -> None:
    genome = load_genome(args.genome) if args.genome else BASELINE
    prep = Prepared(Puzzle(args.pid), genome)
    for a, w in zip(args.ticket[0::2], args.ticket[1::2]):
        state, _ = context(prep, a, w)
        print(f"\n--- genome {genome['id']}, ticket A{a:02d}-W{w:02d} ---\n{state}")


def cmd_run(args) -> None:
    genome = load_genome(args.genome)
    puzzle = Puzzle(args.pid)
    pal, n = puzzle.palette, puzzle.n
    prep = Prepared(puzzle, genome)
    criteria = pal.criteria()
    backend = get_backend(args.backend, use_cache=not args.no_cache)
    cells = [(r, c) for r in range(n) for c in range(n)]
    contexts = {cell: context(prep, *cell) for cell in cells}

    def ask(cell):
        state, lines = contexts[cell]
        votes = [v for ln in lines for v in ln["votes"]]
        return cell, backend.ask(state, criteria, votes)

    start = time.perf_counter()
    answers = dict(run_parallel(ask, cells, args.workers))
    wall = time.perf_counter() - start

    probs = np.zeros((n, n, len(pal.names)))
    conf = np.zeros((n, n))
    for (r, c), a in answers.items():
        probs[r, c] = [a["probs"].get(name, 0.0) for name in pal.names]
        conf[r, c] = a["confidence"]
    truth = load_truth(args.pid, pal)
    s = score(probs, conf, truth, pal)
    stats = {"backend": backend.name, "calls": len(cells),
             "cached": sum(1 for a in answers.values() if a.get("cached")),
             "tokens": sum((a.get("tokens") or 0) for a in answers.values()), "wall_s": wall}

    rdir = results_dir(args.pid, genome["id"], args.private)
    rdir.mkdir(parents=True, exist_ok=True)
    p_true = np.take_along_axis(probs, truth[..., None], -1)[..., 0]
    save(blend(probs, pal), rdir / "render.png")
    (rdir / "scores.json").write_text(json.dumps({**s, **stats}, indent=2), encoding="utf-8")
    def trace(idx):
        a, w = divmod(int(idx), n)
        return (a, w, pal.names[truth[a, w]], answers[(a, w)]["probs"], answers[(a, w)]["confidence"],
                contexts[(a, w)][0])

    worst_idx = [int(i) for i in np.argsort(p_true, axis=None)[:TRACE_WORST]]
    rest = [i for i in range(n * n) if i not in worst_idx]
    rng = np.random.default_rng(zlib.crc32(genome["id"].encode()))  # same genome id -> same sample
    random_idx = sorted(rng.choice(rest, size=min(TRACE_RANDOM, len(rest)), replace=False).tolist())
    write_digest(rdir / "digest.md", args.pid, genome, s, stats,
                 ([trace(i) for i in worst_idx], [trace(i) for i in random_idx]))

    run_dir = OUT / "runs" / args.pid / genome["id"]
    run_dir.mkdir(parents=True, exist_ok=True)
    np.save(run_dir / "probs.npy", probs)
    np.save(run_dir / "conf.npy", conf)
    save(fog(probs, pal), run_dir / "render_fog.png")
    (run_dir / "scores.json").write_text(json.dumps({**s, **stats}, indent=2), encoding="utf-8")

    tag = " [FAKE BACKEND]" if backend.name == "fake" else ""
    print(f"  {genome['id']} on {args.pid}{tag}: balanced acc {s['balanced_accuracy']:.1%}, "
          f"soft {s['balanced_soft_score']:.1%}, acc {s['accuracy']:.1%}, dE {s['picture_error_deltaE']:.1f}, "
          f"confident-wrong {s['confident_wrong']} | {stats['calls']} calls ({stats['cached']} cached), "
          f"{stats['tokens']} tokens, {wall:.1f}s")
    print(f"  results: {rdir.relative_to(ROOT)}")
    if published(args.pid):
        cmd_leakcheck(args)


def cmd_truth(args) -> None:
    pal = Puzzle(args.pid).palette
    truth = load_truth(args.pid, pal)
    path = OUT / f"truth_{args.pid}.png"
    save(pal.display_rgb("dark")[truth], path)
    print(f"  wrote {path.relative_to(ROOT)}")


def cmd_film(args) -> None:
    frames = []
    runs = [(args.pid, g) for g in args.genomes] + [tuple(x.split(":")) for x in args.then or []]
    for pid, gid in runs:
        pal = Puzzle(pid).palette
        run_dir = OUT / "runs" / pid / gid
        probs = np.load(run_dir / "probs.npy")
        s = json.loads((run_dir / "scores.json").read_text(encoding="utf-8"))
        label = gid if pid == args.pid else f"{gid} on {pid} (held-out)"
        frames.append((label, f"balanced acc {s['balanced_accuracy']:.0%}, dE {s['picture_error_deltaE']:.0f}",
                       blend(probs, pal)))
    for pid in dict.fromkeys(p for p, _ in runs):
        pal = Puzzle(pid).palette
        frames.append((f"truth {pid}", "", pal.display_rgb("dark")[load_truth(pid, pal)]))
    filmstrip(frames, OUT / f"film_{args.pid}.png")
    animate(frames, OUT / f"focus_{args.pid}.gif")
    print(f"  wrote out/film_{args.pid}.png, out/focus_{args.pid}.gif and .webp")


def cmd_leakcheck(_args=None) -> None:
    """Fail loudly if anything that reveals the answer or the hidden quirks is in curator/."""
    tokens = ["true_reliability", "false_doc", "quirk", "overstated", "shift_map", "mirrored",
              "twemoji", "secret", "scan_accuracy", "calibration", "calibration_fault", "roster",
              "geometry", "territory", "renumbering", "eu_renumbering", "reason_codes", "numbering",
              "stale", "lag", "misjoined", "fault", "swapped"]
    tokens += [key for key, _, _ in PICTURES] + [cp for _, cp, _ in PICTURES]
    pattern = re.compile(r"\b(" + "|".join(map(re.escape, tokens)) + r")\b", re.IGNORECASE)
    problems = [f"{p.relative_to(ROOT)}: raw record pool must not be in curator/" for p in CURATOR.rglob("evidence.jsonl")]
    for path in CURATOR.rglob("*"):
        rel = path.relative_to(CURATOR).parts
        curator_written = rel[0] == "analysis" or (rel[0] == "genomes" and path.name != "baseline.json")
        if curator_written or not path.is_file() or path.suffix not in {".md", ".json", ".jsonl", ".txt", ".py", ".csv"}:
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        if path.name == "digest.md":  # the curator's own rationale and prediction are echoed there
            text = "\n".join(ln for ln in text.splitlines() if not ln.startswith(("Rationale:", "Prediction:")))
        for m in pattern.finditer(text):
            problems.append(f"{path.relative_to(ROOT)}: '{m.group(0)}'")
    if problems:
        print("  LEAK CHECK FAILED:\n    " + "\n    ".join(problems[:20]))
        sys.exit(1)
    print("  leak check passed: no answer or quirk terms in curator/")


def main() -> None:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("fetch").set_defaults(fn=cmd_fetch)
    sub.add_parser("sheet").set_defaults(fn=cmd_sheet)

    p = sub.add_parser("build")
    p.add_argument("pid")
    p.add_argument("--pic", required=True)
    p.add_argument("--size", type=int, default=16)
    p.add_argument("--palette", default="queues")
    p.add_argument("--seed", type=int, default=7)
    p.add_argument("--knob", action="append", help="override a difficulty knob, e.g. false_share=0.3")
    p.set_defaults(fn=cmd_build)

    p = sub.add_parser("publish")
    p.add_argument("pid")
    p.set_defaults(fn=cmd_publish)

    p = sub.add_parser("preview")
    p.add_argument("pid")
    p.add_argument("--ticket", type=int, nargs="+", required=True, help="account week [account week ...]")
    p.add_argument("--genome")
    p.set_defaults(fn=cmd_preview)

    p = sub.add_parser("run")
    p.add_argument("genome")
    p.add_argument("pid")
    p.add_argument("--backend", choices=["jev", "fake"], default="jev")
    p.add_argument("--workers", type=int, default=16)
    p.add_argument("--no-cache", action="store_true")
    p.add_argument("--private", action="store_true", help="write results to out/, never to curator/")
    p.set_defaults(fn=cmd_run)

    p = sub.add_parser("film")
    p.add_argument("pid")
    p.add_argument("genomes", nargs="+")
    p.add_argument("--then", action="append", help="pid:genome_id for a held-out frame")
    p.set_defaults(fn=cmd_film)

    p = sub.add_parser("truth")
    p.add_argument("pid")
    p.set_defaults(fn=cmd_truth)

    sub.add_parser("leakcheck").set_defaults(fn=cmd_leakcheck)
    args = parser.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
