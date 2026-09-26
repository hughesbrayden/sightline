"""The automatic loop: a blind curator LLM proposes genomes, Jev maps the storms, the gate keeps or rejects.

  python puzzle_draft/driver.py --gens 8                 real Jev, curator via OpenRouter (CURATOR_MODEL)
  python puzzle_draft/driver.py --gens 3 --backend fake  plumbing only (the fake ignores glosses)

Blindness: the curator prompt holds only the brief, its own past genomes with dev scores and gate pass/fail,
and the latest dev digest (scores + 30 traces). Every prompt is leak-checked before it is sent. Validation
scores go to `gate_scores` (scorer login); held-out storms are never touched here.
One stdout line per generation: gen, dev, val, gate, tokens, seconds.
"""

import argparse
import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import httpx  # noqa: E402

import storm  # noqa: E402
from jevlib import get_backend, load_env  # noqa: E402
from storm_harness import GenomeError, compile_pipeline, load_genome, validate  # noqa: E402
from storm_run import GENOMES, OUT, evaluate  # noqa: E402

BRIEF = Path(__file__).resolve().parent / "storm_curator_brief.md"
DEFAULT_MODEL = "z-ai/glm-5.2"
GATE_MARGIN = 0.01  # validation balanced accuracy must beat the best by this much (noise floor)
DEV, VAL = storm.SPLITS["dev"], storm.SPLITS["val"]
FORBIDDEN = re.compile(r"\b(" + "|".join(storm.TOWNS + ["secret", "assessments", "storm_reference", "ref_full",
                                                         "truth.json", "val_score", "held-?out", "Miami",
                                                         "Houston", "Orleans", "NYC", "Manhattan"]) + r")\b", re.I)


def now():
    return datetime.now(timezone.utc)


def leak_check(prompt: str) -> None:
    if m := FORBIDDEN.search(prompt):
        raise RuntimeError(f"LEAK CHECK FAILED: curator prompt contains {m.group(0)!r}; not sent")


def op_keys(genome: dict) -> set:
    return {json.dumps(op, sort_keys=True) for op in genome["ops"]} | {f"format={genome.get('format', 'raw')}"}


def near_duplicate(genome: dict, seen: list) -> dict | None:
    """Memory check: skip a genome identical or ~identical to one already tried."""
    keys = op_keys(genome)
    for g in seen:
        other = op_keys(g["genome"])
        if keys == other or (g["status"] == "rejected" and len(keys & other) / len(keys | other) >= 0.85):
            return g
    return None


def build_prompt(brief: str, history: list, digest: str) -> str:
    rows = ["| gen | status | dev balanced | life-safety found | false dispatches | gate | genome |", "|---|---|---|---|---|---|---|"]
    for h in history:
        d = h.get("dev") or {}
        bal = f"{d['balanced_accuracy']:.1%}" if d else "-"
        ls = f"{d['life_safety_found']}/{d['life_safety_total']}" if d else "-"
        fd = d.get("false_dispatches", "-") if d else "-"
        g = {k: h["genome"][k] for k in ("ops", "format") if k in h["genome"]}
        rows.append(f"| {h['gen']} | {h['status']} | {bal} | {ls} | {fd} | {h.get('gate') or '-'} | `{json.dumps(g)}` |")
    best = max((h for h in history if h["status"] == "accepted"), key=lambda h: h["gen"])
    return "\n".join([
        brief, "", "## Your history (the newest accepted genome is the one to build on)", "", *rows, "",
        f"Current accepted genome (gen {best['gen']}):", "```json", json.dumps(best["genome"], indent=1), "```", "",
        "## Latest digest", "", digest, "", "Propose the next genome. Return only the JSON object."])


def curator_step(prompt: str, model: str, key: str) -> tuple[dict, dict]:
    start = time.perf_counter()
    r = httpx.post("https://openrouter.ai/api/v1/chat/completions", timeout=300,
                   headers={"Authorization": f"Bearer {key}"},
                   json={"model": model, "max_tokens": 16000, "usage": {"include": True},  # room for hidden reasoning
                         "response_format": {"type": "json_object"},
                         "messages": [{"role": "user", "content": prompt}]})
    r.raise_for_status()
    d = r.json()
    choice = d["choices"][0]
    text = choice["message"].get("content") or ""
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        raise GenomeError(f"no JSON object in the reply ({choice.get('finish_reason')}, provider "
                          f"{d.get('provider')}): {text[:200]!r}")
    u = d.get("usage", {})
    return json.loads(m.group(0)), {"model": model, "prompt_tokens": u.get("prompt_tokens"),
                                    "completion_tokens": u.get("completion_tokens"), "cost": u.get("cost"),
                                    "seconds": round(time.perf_counter() - start, 1)}


class Lineage:
    """Mongo writes, each through the login allowed to make it. Falls back to local JSON if Mongo is down."""

    def __init__(self, run: str, enabled: bool):
        self.run, self.enabled = run, enabled
        self.local = OUT / "lineage" / f"{run}.jsonl"
        self.local.parent.mkdir(parents=True, exist_ok=True)
        if enabled:
            from db import connect
            self.curator, self.scorer = connect("curator"), connect("scorer")

    def policy(self, doc: dict) -> None:
        doc = {"run": self.run, "created": now(), **doc}
        with open(self.local, "a", encoding="utf-8") as f:
            f.write(json.dumps(doc, default=str) + "\n")
        if self.enabled:
            self.curator.policies.update_one({"run": self.run, "gen": doc["gen"]}, {"$set": doc}, upsert=True)

    def scores(self, gen: int, result: dict, gate: str | None) -> None:
        if not self.enabled:
            return
        for t in VAL:
            self.scorer.gate_scores.insert_one({"run": self.run, "gen": gen, "town": t, "gate": gate,
                                                "val_score": result["towns"][t]["balanced_accuracy"],
                                                "life_safety_recall": result["towns"][t]["life_safety_recall"],
                                                "false_dispatches": result["towns"][t]["false_dispatches"],
                                                "created": now()})
        docs = [{"ts": now(), "meta": {"run": self.run, "gen": gen, "town": t}, "x": c[0], "y": c[1],
                 "pick": a["choice"], "conf": a["confidence"], "correct": a["choice"] == result["truths"][t][c],
                 "truth": result["truths"][t][c],  # graded map published by the scorer (dev/val only)
                 "probs": {k: round(v, 4) for k, v in a["probs"].items() if v >= 0.005},
                 "lines": result["contexts"][(t, c)].split("\n")}  # exactly what Jev saw, for the block card
                for (t, c), a in result["answers"].items()]
        self.scorer.runs.insert_many(docs, ordered=False)


def dev_summary(d: dict) -> dict:
    return {k: d[k] for k in ("balanced_accuracy", "accuracy", "life_safety_recall", "life_safety_found",
                              "life_safety_total", "false_dispatches", "brier", "mean_confidence")}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--gens", type=int, default=8)
    parser.add_argument("--backend", choices=["jev", "fake"], default="jev")
    parser.add_argument("--run", default=None, help="run id (default: timestamp)")
    parser.add_argument("--truth", choices=["mongo", "file"], default="mongo")
    parser.add_argument("--no-mongo", action="store_true", help="keep lineage local only")
    parser.add_argument("--seed", help="start from this genome instead of the baseline (e.g. a previous run's best)")
    parser.add_argument("--resume", action="store_true", help="continue --run from its local lineage (adds --gens more)")
    args = parser.parse_args()
    load_env()
    key = os.environ.get("OPENROUTER_API_KEY") or sys.exit("OPENROUTER_API_KEY missing")
    model = os.environ.get("CURATOR_MODEL") or DEFAULT_MODEL
    run = args.run or now().strftime("run-%m%d-%H%M")
    backend = get_backend(args.backend)
    lineage = Lineage(run, enabled=not args.no_mongo)
    brief = BRIEF.read_text(encoding="utf-8")
    print(f"  {run}: curator {model}, backend {backend.name}, budget {args.gens} generations, gate margin {GATE_MARGIN:.0%}")

    if args.resume:  # rebuild the curator's own history from the local lineage; it sees nothing new
        docs = {}
        for line in (OUT / "lineage" / f"{run}.jsonl").read_text(encoding="utf-8").splitlines():
            d = json.loads(line)
            docs[d["gen"]] = d
        history = [{"gen": g, "status": d["status"], "gate": d.get("gate"), "dev": d.get("dev_score"),
                    "genome": {"id": d.get("genome_id"), "ops": d.get("ops", []), "format": d.get("format", "raw"),
                               "rationale": d.get("rationale"), "prediction": d.get("prediction")}}
                   for g, d in sorted(docs.items()) if d["status"] != "running"]
        best = max((h for h in history if h["status"] == "accepted"), key=lambda h: h["gen"])
        summ = json.loads((OUT / "runs" / best["genome"]["id"] / "summary.json").read_text(encoding="utf-8"))
        best_val = summ["towns"][VAL[0]]["balanced_accuracy"]
        last = max((h for h in history if h.get("dev")), key=lambda h: h["gen"])
        digest = (OUT / "runs" / last["genome"]["id"] / "digest.md").read_text(encoding="utf-8")
        first = max(docs) + 1
        print(f"  resuming {run} at gen {first}: best gen {best['gen']} (val {best_val:.1%})")
    else:
        base = load_genome(args.seed or GENOMES / "baseline.json")
        base = {**base, "id": f"{run}_g00"}
        t0 = time.perf_counter()
        res = evaluate(base, DEV + VAL, backend, args.truth, quiet=True)
        best_val = res["towns"][VAL[0]]["balanced_accuracy"]
        history = [{"gen": 0, "status": "accepted", "genome": base, "dev": dev_summary(res["dev"]), "gate": "baseline"}]
        lineage.policy({"gen": 0, "parent": None, "status": "accepted", "genome_id": base["id"], "ops": base["ops"],
                        "format": base.get("format", "raw"), "compiled_pipeline": compile_pipeline(base),
                        "rationale": base["rationale"], "prediction": base["prediction"],
                        "dev_score": dev_summary(res["dev"]), "gate": "baseline"})
        lineage.scores(0, res, "baseline")
        digest = res["digest"].read_text(encoding="utf-8")
        print(f"  gen 0  baseline   dev {res['dev']['balanced_accuracy']:.1%}  val {best_val:.1%}  gate baseline  "
              f"jev {res['stats']['tokens']} tok  {time.perf_counter() - t0:.0f}s")
        first = 1

    for gen in range(first, first + args.gens):
        t0 = time.perf_counter()
        parent = max(h["gen"] for h in history if h["status"] == "accepted")
        prompt = build_prompt(brief, history, digest)
        leak_check(prompt)
        genome, usage, error = None, {}, None
        for attempt in range(4):
            try:
                genome, usage = curator_step(prompt if not error else
                                             f"{prompt}\n\nYour last reply was invalid: {error}. Fix it.", model, key)
                genome["id"] = f"{run}_g{gen:02d}"
                validate(genome)
                break
            except (GenomeError, json.JSONDecodeError, httpx.HTTPError, KeyError) as e:
                error, genome = str(e)[:300], None
        if genome is None:
            history.append({"gen": gen, "status": "invalid", "genome": {"ops": []}, "gate": None})
            lineage.policy({"gen": gen, "parent": parent, "status": "invalid", "error": error, "curator": usage})
            print(f"  gen {gen}  INVALID after 4 tries: {error}")
            continue
        base_doc = {"gen": gen, "parent": parent, "genome_id": genome["id"], "ops": genome["ops"],
                    "format": genome.get("format", "raw"), "compiled_pipeline": compile_pipeline(genome),
                    "rationale": genome.get("rationale"), "prediction": genome.get("prediction"), "curator": usage}
        if dup := near_duplicate(genome, history):
            history.append({"gen": gen, "status": "skipped", "genome": genome, "gate": f"repeat of gen {dup['gen']}"})
            lineage.policy({**base_doc, "status": "skipped", "note": f"near-duplicate of gen {dup['gen']}; not scored"})
            print(f"  gen {gen}  skipped    near-duplicate of gen {dup['gen']} ({usage.get('seconds')}s curator)")
            continue
        lineage.policy({**base_doc, "status": "running"})
        res = evaluate(genome, DEV + VAL, backend, args.truth, quiet=True)
        val = res["towns"][VAL[0]]["balanced_accuracy"]
        gate = "pass" if val > best_val + GATE_MARGIN else "fail"
        status = "accepted" if gate == "pass" else "rejected"
        if gate == "pass":
            best_val = val
        history.append({"gen": gen, "status": status, "genome": genome, "dev": dev_summary(res["dev"]), "gate": gate})
        lineage.policy({**base_doc, "status": status, "dev_score": dev_summary(res["dev"]), "gate": gate})
        lineage.scores(gen, res, gate)
        digest = res["digest"].read_text(encoding="utf-8")
        print(f"  gen {gen}  {status:<9}  dev {res['dev']['balanced_accuracy']:.1%}  val {val:.1%}  gate {gate:<4}  "
              f"curator {usage.get('prompt_tokens')}+{usage.get('completion_tokens')} tok ${usage.get('cost') or 0:.3f}  "
              f"jev {res['stats']['tokens']} tok  {time.perf_counter() - t0:.0f}s  | {genome.get('rationale', {}).get('hypothesis', '')[:90]}")
    accepted = [h for h in history if h["status"] == "accepted"]
    print(f"  done: {len(accepted) - 1} accepted of {args.gens}; best gen {accepted[-1]['gen']} "
          f"(dev {accepted[-1]['dev']['balanced_accuracy']:.1%}, val {best_val:.1%}). Lineage: {lineage.local.relative_to(storm.ROOT)}")
    (OUT / "lineage" / f"{run}_best.json").write_text(json.dumps(accepted[-1]["genome"], indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
