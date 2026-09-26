"""Genome (context policy) -> the exact text Jev sees for one block of a hurricane town.

The harness never computes an answer; it only chooses which reports Jev sees and how they read.

Ops:
  source ops (applied first):
    exclude_source   {source | sources}
    gloss_value      {source | sources, map: value -> explanation}
  selection ops (fill the 12-line budget in listed order):
    include_own      {k, sources?}                      reports filed at this block
    include_related  {radius 1-3, only_values?, sources?, show: raw|profile, k}
                     reports filed at nearby blocks; only_values keeps reports whose value is listed
Genome-level presentation: format raw | relative (neighbor locations said relative to this block).

Leak guard: genomes may not contain block coordinates or town ids (checked in validate()).
"""

import json
import math
import re
from collections import Counter, defaultdict
from pathlib import Path

from storm import SOURCES, STATES_OF, STORM_DIR, TOWNS, doc_text

BUDGET = 12
SHOWS = {"raw", "profile"}
FORMATS = {"raw", "relative"}
OPS = {"exclude_source", "gloss_value", "include_own", "include_related"}
INSTRUCTIONS = "What is the damage state of this block? Use the records if there are any."
LEAK = re.compile(r"\(\s*\d+\s*,\s*\d+\s*\)|\b(block|x|y)\s*[:=]?\s*\d+\s*,\s*\d+|\b(" + "|".join(TOWNS) + r")\b", re.I)


class GenomeError(ValueError):
    pass


class Town:
    def __init__(self, town: str):
        tdir = STORM_DIR / town
        self.town = town
        self.meta = json.loads((tdir / "town.json").read_text(encoding="utf-8"))
        self.mask = self.meta["mask"]
        self.cells = [(x, y) for y, row in enumerate(self.mask) for x, v in enumerate(row) if v]
        with open(tdir / "reports.jsonl", encoding="utf-8") as f:
            self.docs = [json.loads(line) for line in f]


def load_genome(path) -> dict:
    genome = json.loads(Path(path).read_text(encoding="utf-8-sig"))
    validate(genome)
    return genome


def _sources(op: dict) -> set:
    return set(op.get("sources", [])) | ({op["source"]} if "source" in op else set())


def validate(genome: dict) -> None:
    if "id" not in genome or not isinstance(genome.get("ops"), list):
        raise GenomeError("genome needs 'id' and a list of 'ops'")
    if genome.get("format", "raw") not in FORMATS:
        raise GenomeError(f"format must be one of {sorted(FORMATS)}")
    if m := LEAK.search(json.dumps(genome["ops"])):
        raise GenomeError(f"leak guard: ops may not name blocks or towns ({m.group(0)!r})")
    for op in genome["ops"]:
        name = op.get("op")
        if name not in OPS:
            raise GenomeError(f"unknown op: {op}")
        if bad := _sources(op) - set(SOURCES):
            raise GenomeError(f"unknown source(s) {sorted(bad)}; sources are {SOURCES}")
        if name in {"exclude_source", "gloss_value"} and not _sources(op):
            raise GenomeError(f"{name} needs 'source' or 'sources': {op}")
        if name == "gloss_value" and not isinstance(op.get("map"), dict):
            raise GenomeError(f"gloss_value needs a 'map' of value -> explanation: {op}")
        if name == "include_related":
            if not 1 <= int(op.get("radius", 1)) <= 3:
                raise GenomeError(f"radius must be 1-3: {op}")
            if op.get("show", "raw") not in SHOWS:
                raise GenomeError(f"show must be one of {sorted(SHOWS)}: {op}")
            if "only_values" in op and not isinstance(op["only_values"], list):
                raise GenomeError(f"only_values must be a list of report values: {op}")


class Prepared:
    def __init__(self, town: Town, genome: dict):
        self.town, self.genome = town, genome
        self.relative = genome.get("format", "raw") == "relative"
        self.glosses = defaultdict(dict)
        excluded = set()
        for op in genome["ops"]:
            if op["op"] == "exclude_source":
                excluded |= _sources(op)
            elif op["op"] == "gloss_value":
                for s in _sources(op):
                    self.glosses[s].update(op["map"])
        self.by_cell = defaultdict(list)
        for d in town.docs:
            if d["source"] not in excluded:
                self.by_cell[(d["x"], d["y"])].append(d)

    def near(self, x: int, y: int, radius: int) -> list:
        cells = [(x + dx, y + dy) for dx in range(-radius, radius + 1) for dy in range(-radius, radius + 1)
                 if (dx or dy) and math.hypot(dx, dy) <= radius + 0.5 and (x + dx, y + dy) in self.by_cell]
        return sorted(cells, key=lambda c: (math.hypot(c[0] - x, c[1] - y), c))


def _keep(op: dict, doc: dict) -> bool:
    srcs = _sources(op)
    if srcs and doc["source"] not in srcs:
        return False
    only = op.get("only_values")
    return only is None or doc["value"].lower() in {v.lower() for v in only}


def _votes(doc: dict, weight: float) -> list:
    """Structured hint for the fake backend only (it can't read text). Jev never sees this."""
    states = STATES_OF.get(doc["source"], {}).get(doc["value"], set())
    if doc["source"] == "social-post" and doc.get("verified"):
        weight *= 1.5  # like Jev, the fake trusts "verified: yes"
    return [(s, weight / len(states)) for s in states]


def header(x: int, y: int) -> str:
    return f"Block ({x}, {y}) of a coastal town grid, six hours after hurricane landfall."


def context(prep: Prepared, x: int, y: int) -> tuple[str, list[dict]]:
    target = (x, y) if prep.relative else None
    lines = []
    for op in prep.genome["ops"]:
        room = BUDGET - len(lines)
        if room <= 0:
            break
        if op["op"] == "include_own":
            own = [d for d in prep.by_cell.get((x, y), []) if _keep(op, d)]
            for d in own[: min(int(op.get("k", 3)), room)]:
                lines.append({"text": doc_text(d, target, prep.glosses), "kind": "own", "votes": _votes(d, 1.0)})
        elif op["op"] == "include_related":
            radius = int(op.get("radius", 1))
            cap = min(int(op.get("k", room)), room)
            docs = [d for c in prep.near(x, y, radius) for d in prep.by_cell[c] if _keep(op, d)]
            if op.get("show", "raw") == "raw":
                for d in docs[:cap]:  # the fake treats a neighbor's report almost like its own, as Jev does
                    lines.append({"text": doc_text(d, target, prep.glosses), "kind": "related",
                                  "votes": _votes(d, 0.8)})
            else:
                tally = defaultdict(Counter)
                for d in docs:
                    tally[d["source"]][d["value"]] += 1
                n_cells = len({(d["x"], d["y"]) for d in docs})
                for src in sorted(tally)[:cap]:
                    parts = []
                    for value, k in tally[src].most_common():
                        gloss = prep.glosses.get(src, {}).get(value)
                        parts.append(f"{value}{f' ({gloss})' if gloss else ''} x{k}")
                    total = sum(tally[src].values())
                    lines.append({"text": f"[profile: {n_cells} nearby blocks within {radius}] {src}: {', '.join(parts)}",
                                  "kind": "related",
                                  "votes": [v for value, k in tally[src].items()
                                            for v in _votes({"source": src, "value": value}, 0.6 * k / total)]})
    body = "\n".join(f"- {ln['text']}" for ln in lines) if lines else "(no records)"
    return f"{header(x, y)}\nRecords:\n{body}", lines
