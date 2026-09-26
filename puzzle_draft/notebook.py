"""The harness's lab notebook: what each generation tried, what it predicted, what happened, and the verdict.

The curator is stateless (a fresh subagent or LLM call each generation), so this notebook is the loop's memory.
Each lesson is embedded and stored in MongoDB `memory` (curator login, `memory_vec` vector index); the prompt
gets the most relevant past lessons via $vectorSearch, and a proposal too close to a rejected lesson is skipped.

Backends: "atlas" (Voyage embeddings + $vectorSearch, through the curator login) or "local" (a jsonl file with a
TF-IDF cosine, for offline runs). Both keep the same local jsonl log.

Embedding keys, in order of preference:
  MONGODB_MODEL_API_KEY   an Atlas model API key (Atlas UI > AI Model APIs); calls https://ai.mongodb.com/v1
  VOYAGE_API_KEY          a key from dash.voyageai.com; calls https://api.voyageai.com/v1
VOYAGE_MODEL overrides the model (default voyage-4); vectors are always 1024-d to match the memory_vec index.
"""

import json
import math
import os
import re
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from jevlib import load_env  # noqa: E402

ENDPOINTS = {"MONGODB_MODEL_API_KEY": "https://ai.mongodb.com/v1/embeddings",
             "VOYAGE_API_KEY": "https://api.voyageai.com/v1/embeddings"}
EMBED_DIM = 1024  # matches mongo_setup.EMBED_DIM and the memory_vec index
# Atlas reports cosine as (1 + cos) / 2. Calibrated on lesson text: the same idea reworded scores ~0.78-0.80, a
# different idea about the same source ~0.775, unrelated ideas ~0.67-0.71. Text alone can't split the first two,
# so near_rejected() also requires the same structural change (op type + source); see evolve.signature().
NEAR_REJECTED = {"atlas": 0.76, "local": 0.60}


def embedding_key() -> tuple[str, str] | None:
    """(endpoint, key) for the first embedding key found, or None."""
    load_env()
    for name, url in ENDPOINTS.items():
        if key := os.environ.get(name):
            return url, key
    return None


def _tokens(text: str) -> list:
    return re.findall(r"[a-z0-9_\-]+", text.lower())


def _tfidf_cos(a: str, b: str, df: Counter, n: int) -> float:
    def vec(t):
        tf = Counter(_tokens(t))
        return {w: c * math.log((1 + n) / (1 + df[w])) for w, c in tf.items()}
    va, vb = vec(a), vec(b)
    dot = sum(v * vb.get(w, 0) for w, v in va.items())
    na, nb = math.sqrt(sum(v * v for v in va.values())), math.sqrt(sum(v * v for v in vb.values()))
    return dot / (na * nb) if na and nb else 0.0


class Notebook:
    def __init__(self, run: str, path: Path, backend: str = "local"):
        load_env()
        self.run, self.path = run, path
        self.backend = backend
        self.embed_via = embedding_key()
        if backend == "atlas" and not self.embed_via:
            print("  notebook: no MONGODB_MODEL_API_KEY or VOYAGE_API_KEY; using the local backend")
            self.backend = "local"
        self.db = None
        if self.backend == "atlas":
            from db import connect
            self.db = connect("curator")
        path.parent.mkdir(parents=True, exist_ok=True)
        self.lessons = [json.loads(l) for l in path.read_text(encoding="utf-8").splitlines()] if path.exists() else []

    # ----- embeddings -----
    def _embed(self, text: str, input_type: str) -> list:
        import httpx
        url, key = self.embed_via
        r = httpx.post(url, timeout=60, headers={"Authorization": f"Bearer {key}"},
                       json={"input": [text], "model": os.environ.get("VOYAGE_MODEL", "voyage-4"),
                             "input_type": input_type, "output_dimension": EMBED_DIM})
        r.raise_for_status()
        return r.json()["data"][0]["embedding"]

    # ----- write -----
    def write(self, lesson: dict) -> None:
        lesson = {"run": self.run, "created": datetime.now(timezone.utc).isoformat(), **lesson}
        if self.backend == "atlas":
            doc = {**lesson, "kind": lesson["verdict"], "embedding": self._embed(lesson["text"], "document")}
            self.db.memory.insert_one(doc)
        self.lessons.append(lesson)
        with open(self.path, "a", encoding="utf-8") as f:
            f.write(json.dumps(lesson) + "\n")

    # ----- read -----
    def _scored(self, query: str, pool: list, k: int) -> list:
        if not pool:
            return []
        if self.backend == "atlas":
            kinds = sorted({l["verdict"] for l in pool})
            hits = self.db.memory.aggregate([
                {"$vectorSearch": {"index": "memory_vec", "path": "embedding", "queryVector": self._embed(query, "query"),
                                   "numCandidates": 100, "limit": k,
                                   "filter": {"run": self.run, "kind": {"$in": kinds}}}},
                {"$project": {"_id": 0, "text": 1, "gen": 1, "verdict": 1, "signature": 1,
                              "score": {"$meta": "vectorSearchScore"}}}])
            return [(h["score"], h) for h in hits]
        df = Counter(w for l in pool for w in set(_tokens(l["text"])))
        scored = [(_tfidf_cos(query, l["text"], df, len(pool)), l) for l in pool]
        return sorted(scored, key=lambda x: -x[0])[:k]

    def relevant(self, query: str, k: int = 5) -> list:
        """The k past lessons most relevant to the current situation."""
        return [l for _, l in self._scored(query, self.lessons, k)]

    def near_rejected(self, text: str, signature: list) -> dict | None:
        """A rejected lesson that is both semantically close to this proposal and makes the same structural change."""
        pool = [l for l in self.lessons if l["verdict"] in ("rejected", "screened_out")]
        for score, lesson in self._scored(text, pool, 3):
            if score >= NEAR_REJECTED[self.backend] and set(lesson.get("signature") or []) & set(signature):
                return {**lesson, "similarity": round(score, 3)}
        return None
