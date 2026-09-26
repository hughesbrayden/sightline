"""Jev smoke test and latency benchmark for the hackathon.

Setup:
    pip install typesafe-sdk
    Copy .env.example to .env and fill in at least one key.

Run:
    python jev_smoke_test.py                 # one pixel judgment, timed
    python jev_smoke_test.py --bench 50      # 50 sequential + 50 parallel calls per route
"""

import argparse
import os
import statistics
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from typesafe_sdk import Choice, TypeSafeClient

# A tiny slice of the evidence pool for one pixel, shaped like the real puzzle.
EVIDENCE = """\
Target: pixel at row 3, column 5 of a 16x16 image.
[row clue] Row 3 runs: 2 4 2
[column clue] Column 5 runs: 7
[neighbor] Pixel (3,4) is ON. Pixel (3,6) is ON.
[sensor, reliability 0.8] Pixel (3,5) reads ON.
[region hint] Rows 2-6, columns 4-7 are mostly filled.
"""

QUESTIONS = {
    "pixel": Choice(
        instructions="Is the target pixel ON or OFF?",
        criteria={
            "on": "The pixel is filled",
            "off": "The pixel is empty",
        },
    ),
}


def load_env(path: Path = Path(__file__).with_name(".env")) -> None:
    """Read KEY=value lines from .env without overriding real env vars."""
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"'))


def available_routes() -> dict[str, tuple[TypeSafeClient, str]]:
    routes = {}
    if key := os.environ.get("TYPESAFE_API_KEY"):
        routes["typesafe-direct"] = (TypeSafeClient(api_key=key), "jev-latest")
    if key := os.environ.get("OPENROUTER_API_KEY"):
        routes["openrouter"] = (
            TypeSafeClient(api_key=key, base_url="https://openrouter.ai/api"),
            "jev-1.13",
        )
    if not routes:
        sys.exit("No key found. Add TYPESAFE_API_KEY or OPENROUTER_API_KEY to .env")
    return routes


def call(client: TypeSafeClient, model: str):
    start = time.perf_counter()
    response = client.system_one(model=model, state=EVIDENCE, questions=QUESTIONS)
    elapsed_ms = (time.perf_counter() - start) * 1000
    # Docs show both .choices and .answers depending on version.
    answers = getattr(response, "choices", None) or getattr(response, "answers")
    return answers["pixel"], elapsed_ms


def summarize(label: str, latencies: list[float], wall_ms: float | None = None) -> None:
    ordered = sorted(latencies)
    p95 = ordered[max(0, round(0.95 * len(ordered)) - 1)]
    line = (
        f"  {label:<10} n={len(ordered):<4} p50={statistics.median(ordered):6.0f} ms"
        f"  p95={p95:6.0f} ms  max={ordered[-1]:6.0f} ms"
    )
    if wall_ms is not None:
        line += f"  wall={wall_ms:6.0f} ms"
    print(line)


def smoke(routes) -> None:
    for name, (client, model) in routes.items():
        pixel, ms = call(client, model)
        print(f"[{name}] model={model}")
        print(f"  choice:        {pixel.choice}")
        print(f"  confidence:    {pixel.confidence:.3f}")
        print(f"  probabilities: {pixel.probabilities}")
        print(f"  latency:       {ms:.0f} ms")


def bench(routes, runs: int, workers: int) -> None:
    for name, (client, model) in routes.items():
        print(f"[{name}] model={model}")
        call(client, model)  # warm-up, not counted

        sequential = [call(client, model)[1] for _ in range(runs)]
        summarize("sequential", sequential)

        start = time.perf_counter()
        with ThreadPoolExecutor(max_workers=workers) as pool:
            results = list(pool.map(lambda _: call(client, model)[1], range(runs)))
        summarize("parallel", results, (time.perf_counter() - start) * 1000)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--bench", type=int, metavar="N", help="run N calls per mode")
    parser.add_argument("--workers", type=int, default=16, help="parallel workers")
    args = parser.parse_args()

    load_env()
    routes = available_routes()
    if args.bench:
        bench(routes, args.bench, args.workers)
    else:
        smoke(routes)


if __name__ == "__main__":
    main()
