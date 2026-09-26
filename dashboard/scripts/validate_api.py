"""Validate the dashboard API contract against a running server (read-only; spends nothing).

  python dashboard/scripts/validate_api.py [http://localhost:3000] [--run live-1]
"""

import json
import ssl
import statistics
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

BASE = next((a for a in sys.argv[1:] if a.startswith("http")), "http://localhost:3000").rstrip("/")
try:  # python.org builds on macOS ship without root certificates
    import certifi
    CTX = ssl.create_default_context(cafile=certifi.where())
except ImportError:
    CTX = None
RUN = sys.argv[sys.argv.index("--run") + 1] if "--run" in sys.argv else "live-1"
META = json.loads((Path(__file__).resolve().parent.parent / "lib" / "storm-meta.json").read_text())
results = []


def get(path):
    start = time.perf_counter()
    try:
        with urllib.request.urlopen(BASE + path, timeout=30, context=CTX) as r:
            body = r.read()
            return r.status, json.loads(body), len(body), (time.perf_counter() - start) * 1000
    except urllib.error.HTTPError as e:
        body = e.read()
        return e.code, json.loads(body or b"{}"), len(body), (time.perf_counter() - start) * 1000


def check(group, name, ok, detail=""):
    results.append((group, name, bool(ok), detail))


def keys(obj, required):
    missing = [k for k in required if k not in obj]
    return not missing, f"missing {missing}" if missing else ""


def main():
    # ---------- /api/state ----------
    code, s, size, ms = get(f"/api/state?run={RUN}")
    check("state", "200 for the run", code == 200, f"{ms:.0f} ms, {size / 1024:.1f} KB")
    check("state", "top-level keys", *keys(s, ["run", "refs", "gens", "heldout", "probe"]))
    check("state", "run fields", *keys(s["run"], ["id", "used", "status", "cost_usd", "best_gen"]))
    check("state", "refs baseline+ceiling {dev,val}",
          all(isinstance(s["refs"][k][m], float) for k in ("baseline", "ceiling") for m in ("dev", "val")),
          f"baseline val {s['refs']['baseline']['val']:.3f}, ceiling val {s['refs']['ceiling']['val']:.3f}")
    gen_fields = ["gen", "parent", "status", "gate", "dev", "val", "life_safety_found", "false_dispatches",
                  "hypothesis", "refuted_if", "prediction", "ops", "pipeline", "curator"]
    bad = [g["gen"] for g in s["gens"] if not keys(g, gen_fields)[0]]
    check("state", "every gen has the contract fields", not bad, f"{len(s['gens'])} gens" + (f"; bad {bad}" if bad else ""))
    check("state", "gens sorted by gen, start at 0", [g["gen"] for g in s["gens"]] == sorted(g["gen"] for g in s["gens"])
          and s["gens"][0]["gen"] == 0)
    statuses = {g["status"] for g in s["gens"]}
    check("state", "status values in contract", statuses <= {"accepted", "rejected", "skipped", "running", "invalid"},
          ", ".join(sorted(statuses)))
    scored = [g for g in s["gens"] if g["status"] in ("accepted", "rejected")]
    check("state", "scored gens have dev and val", all(g["dev"] is not None and g["val"] is not None for g in scored),
          f"{len(scored)} scored")
    acc = [g for g in s["gens"] if g["status"] == "accepted"]
    check("state", "accepted val strictly rises", all(b["val"] > a["val"] for a, b in zip(acc, acc[1:])),
          " -> ".join(f"{g['val']:.3f}" for g in acc))
    check("state", "best_gen = last accepted", s["run"]["best_gen"] == acc[-1]["gen"], f"best_gen {s['run']['best_gen']}")
    check("state", "pipelines compiled (no coordinates)", all(g["pipeline"] for g in scored) and
          '"$$x"' in json.dumps(scored[-1]["pipeline"]))
    check("state", "probe shows denial", s["probe"] and s["probe"]["denied"], (s["probe"] or {}).get("error", ""))
    code, d, _, _ = get("/api/state")
    check("state", "no ?run -> newest run", code == 200 and d["run"]["id"], f"resolved to {d['run']['id']}")
    code, d, _, _ = get("/api/state?run=does-not-exist")
    check("state", "unknown run -> empty gens (not a crash)", code in (200, 404) and not d.get("gens"), f"HTTP {code}")

    # ---------- /api/map ----------
    best = s["run"]["best_gen"]
    for town in META["splits"]["dev"] + META["splits"]["val"]:
        code, m, size, ms = get(f"/api/map?run={RUN}&gen={best}&town={town}")
        land = sum(map(sum, m["mask"]))
        cell_ok = all({"x", "y", "pick", "conf", "correct"} <= set(c) for c in m["cells"])
        in_mask = all(m["mask"][c["y"]][c["x"]] == 1 for c in m["cells"])
        check("map", f"{town} ({m['split']})", code == 200 and len(m["cells"]) == land and cell_ok and in_mask
              and len(m["mask"]) == 32 and all(len(r) == 32 for r in m["mask"]),
              f"{land} land = {len(m['cells'])} cells, acc {m['accuracy']:.3f}, {ms:.0f} ms, {size / 1024:.0f} KB")
    check("map", "12 states, a color for each", len(m["states"]) == 12 and set(m["colors"]) == set(m["states"]))
    check("map", "picks are valid state names", all(c["pick"] in m["states"] for c in m["cells"]))
    code, m, _, _ = get(f"/api/map?run={RUN}&town={META['splits']['dev'][0]}")
    check("map", "no ?gen -> newest gen with a map", code == 200 and m["gen"] >= best, f"gen {m['gen']}")
    code, m, _, _ = get(f"/api/map?run={RUN}&gen={best}&town=NYC1")
    held = s["heldout"]
    check("map", "tonight (NYC1) hidden until scored", (len(m["cells"]) == 0) == (not held),
          f"{len(m['cells'])} cells, heldout scores: {len(held)}; mask still drawn ({sum(map(sum, m['mask']))} land)")
    code, m, _, _ = get(f"/api/map?run={RUN}&gen={best}&town=NOPE")
    check("map", "unknown town -> empty, no crash", code in (200, 404) and not m.get("cells"), f"HTTP {code}")

    # ---------- /api/block ----------
    code, m, _, _ = get(f"/api/map?run={RUN}&gen={best}&town=MIA1")
    wrong = next(c for c in m["cells"] if not c["correct"])
    code, b, size, ms = get(f"/api/block?run={RUN}&gen={best}&town=MIA1&x={wrong['x']}&y={wrong['y']}")
    check("block", "200 + contract fields", code == 200 and keys(b, ["lines", "jev", "assessment", "correct"])[0],
          f"{ms:.0f} ms")
    check("block", "lines = header + 'Records:' + <=12 records",
          b["lines"] and b["lines"][1] == "Records:" and len(b["lines"]) - 2 <= 12, f"{len(b['lines']) - 2} records")
    probs = [p for _, p in b["jev"]["probs"]]
    check("block", "probs sorted high->low, pick = top", probs == sorted(probs, reverse=True)
          and b["jev"]["probs"][0][0] == b["jev"]["pick"], f"top {b['jev']['probs'][0]}")
    check("block", "wrong block shows the assessment", b["correct"] is False and b["assessment"] in META["states"]
          and b["assessment"] != b["jev"]["pick"], f"Jev {b['jev']['pick']} vs assessment {b['assessment']}")
    code, b, _, _ = get(f"/api/block?run={RUN}&gen={best}&town=NYC1&x=10&y=12")
    check("block", "tonight's block hidden until scored", (code == 404) == (not held), f"HTTP {code}")
    code, _, _, _ = get(f"/api/block?run={RUN}&gen={best}&town=MIA1")
    check("block", "missing x/y -> 400", code == 400, f"HTTP {code}")
    code, _, _, _ = get(f"/api/block?run={RUN}&gen={best}&town=MIA1&x=31&y=31")
    check("block", "sea / unknown block -> 404", code == 404, f"HTTP {code}")

    # ---------- /api/reports ----------
    code, r, size, ms = get("/api/reports?town=NYC1&until_hour=6")
    hours = [x["hour"] for x in r["reports"]]
    check("reports", "200, sorted by hour, all <= until_hour", code == 200 and hours == sorted(hours) and max(hours) <= 6,
          f"{r['count']} reports, {ms:.0f} ms, {size / 1024:.0f} KB")
    check("reports", "pre-storm map excluded by default", all(x["source"] != "pre-storm-map" for x in r["reports"]))
    check("reports", "fields for the feed", all({"hour", "source", "x", "y", "text"} <= set(x) for x in r["reports"]))
    code, r1, _, _ = get("/api/reports?town=NYC1&until_hour=1")
    check("reports", "until_hour filters", r1["count"] < r["count"], f"{r1['count']} by hour 1")
    code, r2, _, _ = get("/api/reports?town=NYC1&sources=drone-pass,911-call")
    check("reports", "sources filter", {x["source"] for x in r2["reports"]} <= {"drone-pass", "911-call"}, f"{r2['count']}")
    check("reports", "no truth fields in reports", not any(k in json.dumps(r["reports"]) for k in ('"state"', '"truth"')))

    # ---------- security + performance ----------
    static = Path(__file__).resolve().parent.parent / ".next" / "static"
    blob = "".join(p.read_text(errors="ignore") for p in static.rglob("*.js")) if static.exists() else ""
    check("security", "no Mongo URI / env name in browser bundle",
          static.exists() and "mongodb+srv" not in blob and "MONGODB_URI" not in blob, f"{len(blob) // 1024} KB of client JS scanned")
    lat = []
    for _ in range(10):
        lat.append(get(f"/api/state?run={RUN}")[3])
    check("perf", "/api/state p50 under 2 s poll", statistics.median(lat) < 1500,
          f"p50 {statistics.median(lat):.0f} ms, max {max(lat):.0f} ms over 10 calls")

    width = max(len(n) for _, n, _, _ in results)
    for group, name, ok, detail in results:
        print(f"  {'PASS' if ok else 'FAIL'}  {group:<8} {name:<{width}}  {detail}")
    failed = [r for r in results if not r[2]]
    print(f"\n  {len(results) - len(failed)}/{len(results)} checks passed")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
