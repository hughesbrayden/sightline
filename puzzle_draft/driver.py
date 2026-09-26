"""The automatic loop: a blind curator LLM proposes genomes, Jev maps the storms, the gate keeps or rejects.

  python puzzle_draft/driver.py --gens 8                 real Jev, curator via OpenRouter (CURATOR_MODEL)
  python puzzle_draft/driver.py --gens 3 --backend fake  plumbing only (the fake ignores glosses)
  python puzzle_draft/driver.py --curator inbox --inbox DIR --run R [--resume]
      step mode for an external curator (e.g. a Claude subagent): writes DIR/gNN_prompt.md and exits with code 3;
      the curator writes DIR/gNN_reply.json (the genome); rerun with --resume to score it and write the next prompt

Blindness: the curator prompt holds only the brief, its own past genomes with dev scores and gate verdicts (with
the pooled validation P(better) and the failed criterion, never validation traces), its notebook lessons, and the
latest dev digest (scores + 30 traces + blocks fixed/broken). Every prompt is leak-checked before it is sent.
Validation scores go to `gate_scores` (scorer login); held-out storms are never touched here.

The gate (robust, from the harness lab): a paired, stratified bootstrap of the balanced-accuracy gain over both
validation storms (NYC0 + HOU0) must give P(better) >= 0.90, dev may not drop more than 1 point, and expected harm
(5 x missed life-safety blocks + false dispatches) may not rise more than 5%. The lab notebook stores one lesson
per generation in MongoDB `memory` (vector-embedded) and retrieves the relevant ones with $vectorSearch; a
proposal too close to a rejected lesson is skipped unscored.
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

import gatestats as G  # noqa: E402
import storm  # noqa: E402
from jevlib import get_backend, load_env  # noqa: E402
from storm_harness import GenomeError, compile_pipeline, load_genome, validate  # noqa: E402
from storm_run import GENOMES, OUT, evaluate  # noqa: E402
import tracing  # noqa: E402

BRIEF = Path(__file__).resolve().parent / "storm_curator_brief.md"
BRIEF_GATE = Path(__file__).resolve().parent / "storm_curator_brief_gate.md"
DEFAULT_MODEL = "z-ai/glm-5.2"
GATE_P = 0.90         # P(child better than parent on validation), paired stratified bootstrap
DEV_TOLERANCE = 0.01  # dev balanced accuracy may not drop more than this
HARM_SLACK = 0.05     # expected harm may not rise more than this share of the parent's validation harm
DEV, VAL = storm.SPLITS["dev"], storm.SPLITS["val"]
GATE_TOWNS = VAL + storm.SPLITS.get("val2", [])  # the gate pools both validation storms; the dashboard shows VAL
FORBIDDEN = re.compile(r"\b(" + "|".join(storm.TOWNS + ["secret", "assessments", "storm_reference", "ref_full",
                                                         "truth.json", "val_score", "held-?out", "Miami",
                                                         "Houston", "Orleans", "NYC", "Manhattan"]) + r")\b", re.I)


def now():
    return datetime.now(timezone.utc)


def value_catalog() -> str:
    """The exact values each source can report: what gloss_value keys and only_values must use."""
    rows = [f"- `{src}`: " + ", ".join(f"`{v}`" for v in storm.VALUES[src]) for src in storm.SOURCES]
    return "\n\n## Report values\n\n" + "\n".join(rows) + "\n"


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


def build_prompt(brief: str, history: list, digest: str, lessons: list = ()) -> str:
    rows = ["| gen | status | dev balanced | life-safety found | false dispatches | gate | genome |", "|---|---|---|---|---|---|---|"]
    for h in history:
        d = h.get("dev") or {}
        bal = f"{d['balanced_accuracy']:.1%}" if d else "-"
        ls = f"{d['life_safety_found']}/{d['life_safety_total']}" if d else "-"
        fd = d.get("false_dispatches", "-") if d else "-"
        g = {k: h["genome"][k] for k in ("ops", "format") if k in h["genome"]}
        gate = h.get("gate") or "-"
        if h.get("reason") and h.get("gate") != "baseline":
            gate = f"{gate}: {h['reason']}"
        rows.append(f"| {h['gen']} | {h['status']} | {bal} | {ls} | {fd} | {gate} | `{json.dumps(g)}` |")
    best = max((h for h in history if h["status"] == "accepted"), key=lambda h: h["gen"])
    return "\n".join([
        brief, "", "## Your history (the newest accepted genome is the one to build on)", "", *rows, "",
        f"Current accepted genome (gen {best['gen']}):", "```json", json.dumps(best["genome"], indent=1), "```", "",
        "## Relevant lessons from your notebook", "",
        *([f"- (gen {l['gen']}, {l['verdict']}) {l['text']}" for l in lessons] or ["(none yet)"]), "",
        "## Latest digest", "", digest, "", "Propose the next genome: one targeted change. Return only the JSON object."])


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


WAITING = 3  # exit code: an inbox prompt is waiting for the external curator


def inbox_step(inbox: Path, gen: int, prompt: str) -> tuple[dict, dict]:
    """External curator: use gNN_reply.json if it exists; otherwise write gNN_prompt.md and stop the run."""
    reply = inbox / f"g{gen:02d}_reply.json"
    if reply.exists():
        text = reply.read_text(encoding="utf-8-sig")
        m = re.search(r"\{.*\}", text, re.S)
        if not m:
            raise GenomeError(f"no JSON object in {reply.name}")
        return json.loads(m.group(0)), {"model": "inbox", "reply_file": reply.name}
    inbox.mkdir(parents=True, exist_ok=True)
    (inbox / f"g{gen:02d}_prompt.md").write_text(prompt, encoding="utf-8")
    print(f"  gen {gen}  waiting for the curator: wrote {inbox / f'g{gen:02d}_prompt.md'}; "
          f"put the genome in {reply.name} and rerun with --resume")
    sys.exit(WAITING)


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
        self.last = getattr(self, "last", {})
        doc = {**self.last.get(doc["gen"], {}), "run": self.run, "created": now(), **doc}
        self.last[doc["gen"]] = doc
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
    parser.add_argument("--curator", choices=["openrouter", "inbox"], default="openrouter",
                        help="inbox: an external curator answers prompt files (step mode, see the docstring)")
    parser.add_argument("--inbox", type=Path, help="with --curator inbox: folder for gNN_prompt.md / gNN_reply.json")
    parser.add_argument("--notebook", choices=["atlas", "local", "off"], default="atlas",
                        help="lab notebook: Atlas vector search (default), a local TF-IDF fallback, or none")
    args = parser.parse_args()
    load_env()
    if args.curator == "inbox":
        if not args.inbox:
            sys.exit("--curator inbox needs --inbox DIR (keep it outside the repo so the curator stays blind)")
        key, model = None, "inbox"
    else:
        key = os.environ.get("OPENROUTER_API_KEY") or sys.exit("OPENROUTER_API_KEY missing")
        model = os.environ.get("CURATOR_MODEL") or DEFAULT_MODEL
    run = args.run or now().strftime("run-%m%d-%H%M")
    backend = get_backend(args.backend)
    lineage = Lineage(run, enabled=not args.no_mongo)
    brief = BRIEF.read_text(encoding="utf-8") + value_catalog() + BRIEF_GATE.read_text(encoding="utf-8")
    notebook = None
    if args.notebook != "off":
        from notebook import Notebook
        notebook = Notebook(run, OUT / "lineage" / f"{run}_notebook.jsonl",
                            "local" if args.no_mongo else args.notebook)
    towns = DEV + GATE_TOWNS
    print(f"  {run}: curator {model}, backend {backend.name}, budget {args.gens} generations, gate P(better) >= "
          f"{GATE_P} on {'+'.join(GATE_TOWNS)}, notebook {notebook.backend if notebook else 'off'}")

    def keyed(res, ts):
        truth = {(t, c): s for t in ts for c, s in res["truths"][t].items()}
        return {k: res["answers"][k] for k in truth}, truth

    def lesson(rec, verdict, note=""):
        if not notebook:
            return
        d, v = rec.get("dev_gain"), rec.get("val_gain")
        pc = rec.get("predicted")
        text = (f"Hypothesis: {rec['hypothesis']}. Change: {rec['change']}. "
                f"Predicted dev change: {'n/a' if pc is None else f'{pc:+.1%}'}. "
                + (f"Result: dev {d['gain']:+.1%}, validation {v['gain']:+.1%} (P better {v['p_better']:.2f}), "
                   f"harm {v['harm_delta']:+d}. " if d else "")
                + (f"Fixed {rec['fixed']}. Broke {rec['broke']}. " if rec.get("fixed") is not None else "")
                + f"Verdict: {verdict}{f' ({note})' if note else ''}.")
        notebook.write({"gen": rec["gen"], "verdict": verdict, "text": text, "signature": rec["signature"]})

    if args.resume:  # rebuild the curator's own history from the local lineage; it sees nothing new
        docs = {}
        for line in (OUT / "lineage" / f"{run}.jsonl").read_text(encoding="utf-8").splitlines():
            d = json.loads(line)
            docs.setdefault(d["gen"], {}).update(d)  # later lines (e.g. a trace_url) add to the record
        history = [{"gen": g, "status": d["status"], "gate": d.get("gate"), "dev": d.get("dev_score"),
                    "reason": d.get("gate_reason") or d.get("note"),
                    "genome": {"id": d.get("genome_id"), "ops": d.get("ops", []), "format": d.get("format", "raw"),
                               "rationale": d.get("rationale"), "prediction": d.get("prediction")}}
                   for g, d in sorted(docs.items()) if d["status"] != "running"]
        best = max((h for h in history if h["status"] == "accepted"), key=lambda h: h["gen"])
        best_res = evaluate(best["genome"], towns, backend, args.truth, quiet=True)  # parent answers; cached: free
        best_val = best_res["towns"][VAL[0]]["balanced_accuracy"]
        last = max((h for h in history if h.get("dev")), key=lambda h: h["gen"])
        last_dir = OUT / "runs" / last["genome"]["id"]
        digest = next((last_dir / f).read_text(encoding="utf-8") for f in ("digest_curator.md", "digest.md")
                      if (last_dir / f).exists())
        first = max(docs) + 1
        print(f"  resuming {run} at gen {first}: best gen {best['gen']} (val {best_val:.1%})")
    else:
        base = load_genome(args.seed or GENOMES / "baseline.json")
        base = {**base, "id": f"{run}_g00"}
        t0 = time.perf_counter()
        res = best_res = evaluate(base, towns, backend, args.truth, quiet=True)
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

    traced = []  # (gen, root span): trace links are resolved after upload
    for gen in range(first, first + args.gens):
        t0 = time.perf_counter()
        parent = max(h["gen"] for h in history if h["status"] == "accepted")
        with tracing.span(f"{run} · generation {gen}", inputs={"run": run, "gen": gen, "parent_gen": parent, "best_val_so_far": best_val},
                          metadata={"run": run, "gen": gen, "curator_model": model, "backend": backend.name},
                          tags=[run, "generation"]) as root:
            traced.append((gen, root))
            with tracing.span("prompt + leak check", inputs={"history_generations": len(history)}) as sp:
                lessons = notebook.relevant(digest[:4000], k=5) if notebook and notebook.lessons else []
                prompt = build_prompt(brief, history, digest, lessons)
                leak_check(prompt)
                tracing.out(sp, {"leak_check": "passed", "prompt_chars": len(prompt), "prompt": prompt,
                                 "lessons_retrieved": [{"gen": l["gen"], "verdict": l["verdict"]} for l in lessons]})
            genome, usage, error = None, {}, None
            for attempt in range(4):
                msg = prompt if not error else f"{prompt}\n\nYour last reply was invalid: {error}. Fix it."
                with tracing.span("curator" if args.curator != "inbox" else "curator (inbox)", run_type="llm",
                                  inputs={"messages": [{"role": "user", "content": msg}]},
                                  metadata={"attempt": attempt, "ls_model_name": model, "ls_provider": "openrouter"}) as cs:
                    try:
                        if args.curator == "inbox":
                            genome, usage = inbox_step(args.inbox, gen, prompt)
                        else:
                            genome, usage = curator_step(msg, model, key)
                        genome["id"] = f"{run}_g{gen:02d}"
                        validate(genome)
                        tracing.out(cs, {"genome": genome, "valid": True, "usage_metadata": {
                            "input_tokens": usage.get("prompt_tokens") or 0, "output_tokens": usage.get("completion_tokens") or 0,
                            "total_tokens": (usage.get("prompt_tokens") or 0) + (usage.get("completion_tokens") or 0)},
                            "cost_usd": usage.get("cost")})
                        break
                    except (GenomeError, json.JSONDecodeError, httpx.HTTPError, KeyError) as e:
                        error, genome = str(e)[:300], None
                        tracing.out(cs, {"valid": False, "error": error})
                        if args.curator == "inbox":  # hand the error back to the curator with the same prompt
                            bad = args.inbox / f"g{gen:02d}_reply.json"
                            bad.replace(bad.with_name(f"g{gen:02d}_reply_invalid_{attempt}.json"))
                            inbox_step(args.inbox, gen, f"{prompt}\n\nYour last reply was invalid: {error}. Fix it.")
            if genome is None:
                history.append({"gen": gen, "status": "invalid", "genome": {"ops": []}, "gate": None})
                lineage.policy({"gen": gen, "parent": parent, "status": "invalid", "error": error, "curator": usage})
                tracing.out(root, {"status": "invalid", "error": error})
                print(f"  gen {gen}  INVALID after 4 tries: {error}")
                continue
            base_doc = {"gen": gen, "parent": parent, "genome_id": genome["id"], "ops": genome["ops"],
                        "format": genome.get("format", "raw"), "compiled_pipeline": compile_pipeline(genome),
                        "rationale": genome.get("rationale"), "prediction": genome.get("prediction"), "curator": usage}
            parent_genome = next(h["genome"] for h in history if h["gen"] == parent)
            rationale = genome.get("rationale")
            hyp = rationale.get("hypothesis", "") if isinstance(rationale, dict) else str(rationale or "")
            rec = {"gen": gen, "hypothesis": hyp, "change": G.ops_diff(parent_genome, genome),
                   "signature": G.signature(parent_genome, genome), "predicted": G.predicted_change(genome)}
            base_doc["signature"] = rec["signature"]
            with tracing.span("memory check", inputs={"ops": genome["ops"], "signature": rec["signature"]}) as ms:
                skip = None
                if dup := near_duplicate(genome, history):
                    skip = f"near-duplicate of gen {dup['gen']}"
                elif notebook and (near := notebook.near_rejected(f"{hyp}. Change: {rec['change']}", rec["signature"])):
                    skip = f"too close to rejected lesson from gen {near['gen']} (similarity {near['similarity']})"
                tracing.out(ms, {"skip": skip})
            if skip:
                history.append({"gen": gen, "status": "skipped", "genome": genome, "gate": None, "reason": skip})
                lineage.policy({**base_doc, "status": "skipped", "note": f"{skip}; not scored"})
                lesson(rec, "skipped", skip)
                tracing.out(root, {"status": "skipped", "reason": skip})
                print(f"  gen {gen}  skipped    {skip} ({usage.get('seconds')}s curator)")
                continue
            lineage.policy({**base_doc, "status": "running"})
            with tracing.span("evaluate: Jev maps every block, scorer grades", inputs={
                    "genome": genome, "compiled_pipeline": base_doc["compiled_pipeline"], "towns": towns}) as ev:
                res = evaluate(genome, towns, backend, args.truth, quiet=True)
                v = res["towns"][VAL[0]]
                tracing.out(ev, {"dev": dev_summary(res["dev"]), "stats": res["stats"],
                                 "validation": {k: v[k] for k in ("balanced_accuracy", "life_safety_recall", "false_dispatches")},
                                 "curator_digest": res["digest"].read_text(encoding="utf-8")})
            val = res["towns"][VAL[0]]["balanced_accuracy"]
            with tracing.span("gate", inputs={"val_towns": GATE_TOWNS, "p_threshold": GATE_P,
                                              "dev_tolerance": DEV_TOLERANCE, "harm_slack": HARM_SLACK}) as gs:
                pa_dev, t_dev = keyed(best_res, DEV)
                ch_dev, _ = keyed(res, DEV)
                pa_val, t_val = keyed(best_res, GATE_TOWNS)
                ch_val, _ = keyed(res, GATE_TOWNS)
                d_gain, v_gain = G.paired_gain(pa_dev, ch_dev, t_dev), G.paired_gain(pa_val, ch_val, t_val)
                harm_cap = HARM_SLACK * v_gain["harm_parent"]
                fails = ([f"validation P(better) {v_gain['p_better']:.2f} < {GATE_P}"] if v_gain["p_better"] < GATE_P else []) + \
                        ([f"dev {d_gain['gain']:+.1%} below -{DEV_TOLERANCE:.0%}"] if d_gain["gain"] < -DEV_TOLERANCE else []) + \
                        ([f"harm +{v_gain['harm_delta']} over the cap {harm_cap:.0f}"] if v_gain["harm_delta"] > harm_cap else [])
                gate = "fail" if fails else "pass"
                reason = "; ".join(fails) or f"P(better) {v_gain['p_better']:.2f}, validation {v_gain['gain']:+.1%}"
                status = "accepted" if gate == "pass" else "rejected"
                tracing.out(gs, {"gate": gate, "status": status, "reason": reason, "dev": d_gain, "val": v_gain})
            fl = G.flips(pa_dev, ch_dev, t_dev)
            top = lambda d, sign: ", ".join(f"{s} {sign}{n}" for s, n in sorted(d.items(), key=lambda kv: -kv[1])[:5]) or "none"  # noqa: E731
            rec.update({"dev_gain": d_gain, "val_gain": v_gain, "fixed": top(fl["fixed"], "+"), "broke": top(fl["broke"], "-")})
            if gate == "pass":
                best_val, best_res = val, res
            history.append({"gen": gen, "status": status, "genome": genome, "dev": dev_summary(res["dev"]), "gate": gate,
                            "reason": reason})
            lineage.policy({**base_doc, "status": status, "dev_score": dev_summary(res["dev"]), "gate": gate,
                            "gate_reason": reason, "gate_detail": {"dev": d_gain, "val": v_gain, "val_towns": GATE_TOWNS,
                                                                   "p_threshold": GATE_P, "harm_cap": harm_cap}})
            lineage.scores(gen, res, gate)
            lesson(rec, status, reason)
            digest = res["digest"].read_text(encoding="utf-8") + (
                f"\n\n## What this genome changed on the past storms, vs the accepted genome (gen {parent})\n\n"
                f"Change: {rec['change']}\n\nBlocks fixed, by true state: {rec['fixed']}\n\n"
                f"Blocks broken, by true state: {rec['broke']}\n")
            (OUT / "runs" / genome["id"] / "digest_curator.md").write_text(digest, encoding="utf-8")  # read on --resume
            tracing.out(root, {"status": status, "gate": gate, "dev_balanced_accuracy": res["dev"]["balanced_accuracy"],
                               "val_balanced_accuracy": val, "hypothesis": hyp, "ops": genome["ops"]})
            tracing.scores(root, {"dev_balanced_accuracy": res["dev"]["balanced_accuracy"], "val_balanced_accuracy": val,
                                  "life_safety_recall": res["dev"]["life_safety_recall"],
                                  "false_dispatches": res["dev"]["false_dispatches"], "brier": res["dev"]["brier"],
                                  "gate_pass": 1.0 if gate == "pass" else 0.0, "val_p_better": v_gain["p_better"],
                                  "val_gain_pooled": v_gain["gain"], "harm_delta": float(v_gain["harm_delta"])})
            print(f"  gen {gen}  {status:<9}  dev {res['dev']['balanced_accuracy']:.1%}  val {val:.1%}  "
                  f"P {v_gain['p_better']:.2f} harm {v_gain['harm_delta']:+d}  gate {gate:<4}  "
                  f"curator {usage.get('prompt_tokens')}+{usage.get('completion_tokens')} tok ${usage.get('cost') or 0:.3f}  "
                  f"jev {res['stats']['tokens']} tok  {time.perf_counter() - t0:.0f}s  | {hyp[:90]}"
)
    tracing.flush()
    for g, root in traced:  # link each generation's lineage record to its LangSmith trace
        if (link := tracing.url(root)):
            lineage.policy({"gen": g, "trace_url": link})
            print(f"  trace gen {g}: {link}")
    accepted = [h for h in history if h["status"] == "accepted"]
    print(f"  done: {len(accepted) - 1} accepted of {args.gens}; best gen {accepted[-1]['gen']} "
          f"(dev {accepted[-1]['dev']['balanced_accuracy']:.1%}, val {best_val:.1%}). Lineage: {lineage.local.relative_to(storm.ROOT)}")
    (OUT / "lineage" / f"{run}_best.json").write_text(json.dumps(accepted[-1]["genome"], indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
