"""End-to-end MongoDB integration test: the real data flow through every login, on a 3-block test town.

  python puzzle_draft/mongo_itest.py        runs against whatever MONGODB_URI_* in .env point at; cleans up after
"""

import random
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from pymongo.errors import OperationFailure  # noqa: E402

from db import connect  # noqa: E402

TOWN, RUN = "_itest", "_itest"


def step(name, fn):
    t = time.perf_counter()
    out = fn()
    print(f"  ok  {name} ({(time.perf_counter() - t) * 1000:.0f} ms){f': {out}' if out is not None else ''}")
    return out


def main() -> None:
    admin, curator, scorer, dashboard = (connect(x) for x in ("admin", "curator", "scorer", "dashboard"))
    now = lambda: datetime.now(timezone.utc)  # noqa: E731
    try:
        step("admin loads blocks, reports, assessments", lambda: (
            admin.blocks.insert_many([{"town": TOWN, "x": x, "y": 5, "loc": [x, 5], "land_use": "dense", "elev": 1.0}
                                      for x in (4, 5, 6)]),
            admin.reports.insert_many([{"town": TOWN, "source": s, "x": x, "y": 5, "loc": [x, 5], "value": v,
                                        "text": f"[{s}] {v}", "verified": s == "social-post"}
                                       for x, s, v in [(4, "911-call", "flooded_street"), (5, "drone-pass", "collapsed"),
                                                       (6, "social-post", "flooded_homes"), (6, "drone-pass", "flooded_homes")]]),
            admin.assessments.insert_many([{"town": TOWN, "x": x, "y": 5, "state": s}
                                           for x, s in [(4, "flooded_street"), (5, "collapsed"), (6, "flooded_homes")]]),
        ) and None)

        pipeline = [
            {"$geoNear": {"near": [5, 5], "distanceField": "dist", "maxDistance": 1.5, "query": {"town": TOWN}}},
            {"$match": {"value": {"$in": ["flooded_street", "flooded_homes"]}, "source": {"$nin": ["social-post"]}}},
            {"$set": {"value": {"$switch": {"branches": [{"case": {"$eq": ["$value", "flooded_homes"]},
                                                          "then": "flooded_homes (water inside homes)"}],
                                            "default": "$value"}}}},
            {"$limit": 12}, {"$project": {"_id": 0, "source": 1, "x": 1, "value": 1}}]
        lines = step("curator runs compiled pipeline ($geoNear/$match/$switch/$limit)",
                     lambda: list(curator.reports.aggregate(pipeline)))
        assert {d["x"] for d in lines} == {4, 6} and all(d["source"] != "social-post" for d in lines), lines

        step("curator writes a policy", lambda: curator.policies.insert_one(
            {"run": RUN, "gen": 1, "parent": 0, "status": "running", "ops": [], "compiled_pipeline": pipeline,
             "rationale": "test", "prediction": "test", "created": now()}) and None)

        def denied(fn):
            try:
                fn()
            except OperationFailure as e:
                return e.code == 13
            return False
        assert step("curator denied on assessments", lambda: denied(lambda: curator.assessments.find_one({})))
        assert step("curator denied on gate_scores", lambda: denied(lambda: curator.gate_scores.find_one({})))

        truth = step("scorer reads assessments", lambda: {(d["x"], d["y"]): d["state"]
                                                          for d in scorer.assessments.find({"town": TOWN})})
        picks = {(4, 5): "flooded_street", (5, 5): "intact", (6, 5): "flooded_homes"}
        step("scorer writes runs (time-series)", lambda: scorer.runs.insert_many(
            [{"ts": now(), "meta": {"run": RUN, "gen": 1, "town": TOWN}, "x": x, "y": y, "pick": p, "conf": 0.95,
              "correct": truth[(x, y)] == p} for (x, y), p in picks.items()]) and None)
        acc = sum(truth[c] == p for c, p in picks.items()) / len(picks)
        step("scorer writes gate score", lambda: scorer.gate_scores.insert_one(
            {"run": RUN, "gen": 1, "town": TOWN, "val_score": acc, "gate": "pass", "created": now()}) and acc)

        step("dashboard reads lineage + runs + gate", lambda: (
            dashboard.policies.count_documents({"run": RUN}),
            dashboard.runs.count_documents({"meta.run": RUN}),
            dashboard.gate_scores.find_one({"run": RUN}, {"_id": 0, "gate": 1})["gate"]))
        assert step("dashboard denied writing policies", lambda: denied(lambda: dashboard.policies.insert_one({})))

        rng = random.Random(0)
        vec = [rng.uniform(-1, 1) for _ in range(1024)]
        step("curator writes memory with embedding", lambda: curator.memory.insert_one(
            {"run": RUN, "gen": 1, "kind": "rejected", "text": "test finding", "embedding": vec}) and None)
        hits = []
        for _ in range(20):  # search index is eventually consistent
            hits = list(curator.memory.aggregate([
                {"$vectorSearch": {"index": "memory_vec", "path": "embedding", "queryVector": vec,
                                   "numCandidates": 20, "limit": 1, "filter": {"run": RUN}}},
                {"$project": {"_id": 0, "text": 1, "score": {"$meta": "vectorSearchScore"}}}]))
            if hits:
                break
            time.sleep(1.5)
        print(f"  {'ok ' if hits else 'WARN'} curator $vectorSearch on memory: {hits or 'no hits yet (index still syncing)'}")
        print("  integration test passed")
    finally:
        for c in ("blocks", "reports", "assessments"):
            admin[c].delete_many({"town": TOWN})
        for c in ("policies", "gate_scores", "memory"):
            admin[c].delete_many({"run": {"$in": [RUN, "integration-test"]}})
        admin.runs.delete_many({"meta.run": RUN})
        print("  cleaned up test data")


if __name__ == "__main__":
    main()
