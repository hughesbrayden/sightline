"""Jev client, response cache, fake backend and thread pool shared by the draft tools.

Lifted from jev_smoke_test.py (load_env, client selection, timed call) and extended
with an on-disk cache so re-runs are free and a fake backend for dry runs.
"""

import hashlib
import json
import math
import os
import sqlite3
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE_PATH = ROOT / "puzzle_draft" / "cache" / "jev_cache.sqlite"

# Fixed for the whole draft so context is the only variable.
INSTRUCTIONS = "Which support queue should handle this ticket? Use the records if there are any."


def load_env() -> None:
    """Read KEY=value lines from .env without overriding real env vars.

    JEV_ENV_FILE points at a different .env (used before the session moved folders).
    """
    candidates = []
    if os.environ.get("JEV_ENV_FILE"):
        candidates.append(Path(os.environ["JEV_ENV_FILE"]))
    candidates.append(ROOT / ".env")
    for path in candidates:
        if not path.exists():
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                if value.strip():
                    os.environ.setdefault(key.strip(), value.strip().strip('"'))
        return


def make_client():
    from typesafe_sdk import TypeSafeClient

    load_env()
    if key := os.environ.get("TYPESAFE_API_KEY"):
        return TypeSafeClient(api_key=key), "jev-latest"
    if key := os.environ.get("OPENROUTER_API_KEY"):
        return TypeSafeClient(api_key=key, base_url="https://openrouter.ai/api"), "jev-1.13"
    sys.exit("No key found. Add TYPESAFE_API_KEY or OPENROUTER_API_KEY to .env")


class Cache:
    def __init__(self, path: Path = CACHE_PATH):
        path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._db = sqlite3.connect(path, check_same_thread=False)
        self._db.execute("CREATE TABLE IF NOT EXISTS calls (key TEXT PRIMARY KEY, value TEXT)")
        self._db.commit()

    def get(self, key: str):
        with self._lock:
            row = self._db.execute("SELECT value FROM calls WHERE key = ?", (key,)).fetchone()
        return json.loads(row[0]) if row else None

    def put(self, key: str, value: dict) -> None:
        with self._lock:
            self._db.execute("INSERT OR REPLACE INTO calls VALUES (?, ?)", (key, json.dumps(value)))
            self._db.commit()


def _normalize(probs: dict, names: list[str]) -> dict:
    total = sum(max(0.0, float(probs.get(n, 0.0))) for n in names) or 1.0
    return {n: max(0.0, float(probs.get(n, 0.0))) / total for n in names}


class JevBackend:
    name = "jev"

    def __init__(self, use_cache: bool = True):
        self.client, self.model = make_client()
        self.cache = Cache() if use_cache else None

    def ask(self, state: str, criteria: dict, votes=None) -> dict:
        from typesafe_sdk import Choice

        key = hashlib.sha1(
            json.dumps([self.model, INSTRUCTIONS, state, criteria], sort_keys=True).encode()
        ).hexdigest()
        if self.cache and (hit := self.cache.get(key)):
            return {**hit, "cached": True}

        start = time.perf_counter()
        for attempt in range(5):  # on top of the SDK's own retries: the API occasionally drops connections
            try:
                response = self.client.system_one(
                    model=self.model,
                    state=state,
                    questions={"pixel": Choice(instructions=INSTRUCTIONS, criteria=criteria)},
                )
                break
            except Exception:
                if attempt == 4:
                    raise
                time.sleep(2 ** attempt)
        ms = (time.perf_counter() - start) * 1000
        answers = getattr(response, "choices", None) or getattr(response, "answers")
        answer = answers["pixel"]
        usage = getattr(response, "usage", None)
        out = {
            "probs": _normalize(dict(answer.probabilities), list(criteria)),
            "choice": answer.choice,
            "confidence": float(answer.confidence),
            "tokens": getattr(usage, "input_tokens", None) if usage else None,
            "ms": ms,
        }
        if self.cache:
            self.cache.put(key, out)
        return {**out, "cached": False}


class FakeBackend:
    """Softmax over the structured votes attached to each context line. Free, for dry runs."""

    name = "fake"

    def ask(self, state: str, criteria: dict, votes=None) -> dict:
        names = list(criteria)
        score = {n: 0.0 for n in names}
        for color, weight in votes or []:
            if color in score:
                score[color] += weight
        top = max(score.values())
        exps = {n: math.exp(2.5 * (s - top)) for n, s in score.items()}
        total = sum(exps.values())
        probs = {n: e / total for n, e in exps.items()}
        entropy = -sum(p * math.log(p) for p in probs.values() if p > 0)
        return {
            "probs": probs,
            "choice": max(probs, key=probs.get),
            "confidence": 1 - entropy / math.log(len(names)),
            "tokens": 0,
            "ms": 0.0,
            "cached": False,
        }


def get_backend(name: str, use_cache: bool = True):
    return JevBackend(use_cache) if name == "jev" else FakeBackend()


def run_parallel(fn, items, workers: int = 16) -> list:
    with ThreadPoolExecutor(max_workers=workers) as pool:
        return list(pool.map(fn, items))
