"""End-to-end access check before a real run: keys, Jev, the curator LLM, MongoDB logins, LangSmith.

  python puzzle_draft/preflight.py            all checks; exits 1 if a required one fails
  python puzzle_draft/preflight.py --bench 32 also time N parallel Jev calls

Jev and the curator both go through OpenRouter, so one OPENROUTER_API_KEY covers both.
Nothing here reads truth; the Mongo check writes and removes only `_check` documents.
"""

import argparse
import json
import os
import statistics
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import httpx  # noqa: E402

from jevlib import load_env, run_parallel  # noqa: E402

DEFAULT_CURATOR = "z-ai/glm-5.2"  # open model; ~$0.03 per curator step
# A hurricane-shaped block with all 12 states, so the check exercises the real choice size.
STATES = {
    "intact": "No meaningful damage", "flooded_street": "Water on streets, not inside homes",
    "flooded_homes": "Water inside homes", "roof_damage": "Roofs damaged, structure standing",
    "collapsed": "Structure collapsed", "fire": "Active fire", "road_blocked": "Road impassable",
    "power_out": "Power out, no visible damage", "downed_lines": "Power lines down",
    "shelter_open": "Shelter operating", "hospital_ok": "Hospital operating",
    "hospital_down": "Hospital not operating",
}
BLOCK = """Block (12, 7) in the town grid, 6 hours after landfall.
Records:
- [911-call] "Water's up to the second step, we're on the second floor with the kids"
- [drone-pass] Standing water covers the street and ground floors
- [pre-storm-map] Land use: dense housing; elevation: low"""

results = []


def check(name, required=True):
    def wrap(fn):
        start = time.perf_counter()
        try:
            detail = fn()
            status = "SKIP" if isinstance(detail, str) and detail.startswith("skipped") else "PASS"
        except Exception as e:  # report every failure, keep going
            status, detail = ("FAIL" if required else "WARN"), f"{type(e).__name__}: {str(e)[:220]}"
        results.append((status, name, detail, (time.perf_counter() - start) * 1000))
        print(f"  {status:<4} {name:<34} {detail}")
        return fn
    return wrap


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--bench", type=int, default=16)
    args = parser.parse_args()
    load_env()
    key = os.environ.get("OPENROUTER_API_KEY", "")

    @check("env: OPENROUTER_API_KEY")
    def _():
        if not key:
            raise RuntimeError("missing in .env (one key covers Jev and the curator)")
        return f"set ({key[:6]}…)"

    @check("openrouter: key valid + credit")
    def _():
        r = httpx.get("https://openrouter.ai/api/v1/key", headers={"Authorization": f"Bearer {key}"}, timeout=15)
        r.raise_for_status()
        d = r.json()["data"]
        left = "unlimited" if d.get("limit") is None else f"${d['limit'] - d.get('usage', 0):.2f} left"
        return f"label={d.get('label')!r}, used ${d.get('usage', 0):.2f}, {left}"

    jev = {}

    @check("jev: one 12-state call")
    def _():
        from typesafe_sdk import Choice

        from jevlib import make_client
        client, model = make_client()
        start = time.perf_counter()
        resp = client.system_one(model=model, state=BLOCK, questions={
            "state": Choice(instructions="What is the damage state of this block?", criteria=STATES)})
        ms = (time.perf_counter() - start) * 1000
        ans = (getattr(resp, "choices", None) or getattr(resp, "answers"))["state"]
        jev.update(client=client, model=model, Choice=Choice)
        return f"model={model}: pick={ans.choice} conf={float(ans.confidence):.2f} ({ms:.0f} ms)"

    @check(f"jev: {args.bench} parallel calls")
    def _():
        if not jev:
            return "skipped (single call failed)"

        def one(i):
            start = time.perf_counter()
            jev["client"].system_one(model=jev["model"], state=f"{BLOCK}\n(check {i})", questions={
                "state": jev["Choice"](instructions="What is the damage state of this block?", criteria=STATES)})
            return (time.perf_counter() - start) * 1000
        start = time.perf_counter()
        ms = sorted(run_parallel(one, range(args.bench), 16))
        wall = time.perf_counter() - start
        per_gen = wall / args.bench * 2600
        return (f"p50 {statistics.median(ms):.0f} ms, p95 {ms[int(0.95 * len(ms)) - 1]:.0f} ms, "
                f"wall {wall:.1f}s -> ~{per_gen:.0f}s per generation (2600 blocks)")

    @check("curator: LLM returns JSON")
    def _():
        model = os.environ.get("CURATOR_MODEL") or DEFAULT_CURATOR
        start = time.perf_counter()
        r = httpx.post("https://openrouter.ai/api/v1/chat/completions", timeout=120,
                       headers={"Authorization": f"Bearer {key}"},
                       json={"model": model, "max_tokens": 4000, "response_format": {"type": "json_object"},  # same mode as driver.py
                             "messages": [{"role": "user", "content":
                             'Reply with only this JSON, no prose: {"ok": true, "ops": []}'}]})
        r.raise_for_status()
        d = r.json()
        text = d["choices"][0]["message"]["content"].strip().removeprefix("```json").strip("` \n")
        json.loads(text)
        u = d.get("usage", {})
        return (f"{model}: valid JSON, {u.get('prompt_tokens')}+{u.get('completion_tokens')} tokens, "
                f"{(time.perf_counter() - start) * 1000:.0f} ms")

    for login in ("admin", "curator", "scorer", "dashboard"):
        @check(f"mongo: {login} login")
        def _(login=login):
            from db import connect
            db = connect(login)
            db.client.admin.command("ping")
            host = db.client.address[0] if db.client.address else "?"
            return f"ping ok ({'atlas' if 'mongodb.net' in host else host})"

    @check("mongo: permission matrix")
    def _():
        import io
        from contextlib import redirect_stdout

        import mongo_setup
        buf = io.StringIO()
        with redirect_stdout(buf):
            mongo_setup.cmd_check(None)
        return "curator/dashboard locked out of assessments; dashboard read-only"

    @check("mongo: truth is empty or loaded", required=False)
    def _():
        from db import connect
        db = connect("admin")
        counts = {c: db[c].estimated_document_count() for c in ("blocks", "reports", "assessments", "policies")}
        return ", ".join(f"{c}={n}" for c, n in counts.items())

    @check("langsmith: tracing key", required=False)
    def _():
        if not os.environ.get("LANGSMITH_API_KEY"):
            return "skipped (LANGSMITH_API_KEY not set; tracing is optional)"
        from langsmith import Client
        endpoint = os.environ.setdefault("LANGSMITH_ENDPOINT", "https://api.smith.langchain.com")
        next(iter(Client().list_projects(limit=1)), None)
        return f"ok, {endpoint}, project={os.environ.get('LANGSMITH_PROJECT', 'default')}"

    failed = [r for r in results if r[0] == "FAIL"]
    print(f"\n  {len(results) - len(failed)}/{len(results)} ok"
          + (f"; FAILED: {', '.join(r[1] for r in failed)}" if failed else "; ready for a real run"))
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
