"""Genome (context policy) -> the exact text Jev sees for one ticket (v4: signal integration).

Each ticket has a few ambiguous hints of its own. Related tickets (same account nearby weeks, same week
nearby accounts) carry more hints, like the sequence alignment AlphaFold reads. The genome decides how
much related context to pull in, which related tickets to trust, and how to show it. The harness never
computes an answer; Jev integrates the hints.

Ops:
  source ops (applied first): exclude_source, gloss_value
  selection ops (fill the budget in listed order): include_own, include_related
Genome-level presentation: format (raw | relative).
"""

import json
from collections import Counter, defaultdict
from pathlib import Path

from evidence import HINTS, PUZZLES_DIR, doc_text
from palette import Palette

BUDGET = 12
SCOPES = {"same_account", "same_week", "both", "box"}
FILTERS = {"all", "lookalike"}
SHOWS = {"raw", "profile"}
FORMATS = {"raw", "relative"}
SOURCE_OPS = {"exclude_source", "gloss_value"}
SELECT_OPS = {"include_own", "include_related"}
HINT_QUEUES = {src: {v: {q for q, x in table.items() if x == v} for v in set(table.values())}
               for src, table in HINTS.items()}


class GenomeError(ValueError):
    pass


class Puzzle:
    def __init__(self, pid: str):
        pdir = PUZZLES_DIR / pid
        self.pid = pid
        self.meta = json.loads((pdir / "puzzle.json").read_text(encoding="utf-8"))
        self.n = self.meta["accounts"]
        self.palette = Palette(self.meta["palette"])
        with open(pdir / "evidence.jsonl", encoding="utf-8") as f:
            self.docs = [json.loads(line) for line in f]


def load_genome(path: Path) -> dict:
    genome = json.loads(Path(path).read_text(encoding="utf-8-sig"))  # tolerate BOMs from PowerShell editors
    validate(genome)
    return genome


def validate(genome: dict) -> None:
    if "id" not in genome or "ops" not in genome:
        raise GenomeError("genome needs 'id' and 'ops'")
    if genome.get("format", "raw") not in FORMATS:
        raise GenomeError(f"format must be one of {sorted(FORMATS)}")
    for op in genome["ops"]:
        name = op.get("op")
        if name == "include_related":
            if op.get("scope", "same_account") not in SCOPES:
                raise GenomeError(f"scope must be one of {sorted(SCOPES)}: {op}")
            if op.get("filter", "all") not in FILTERS:
                raise GenomeError(f"filter must be one of {sorted(FILTERS)}: {op}")
            if op.get("show", "raw") not in SHOWS:
                raise GenomeError(f"show must be one of {sorted(SHOWS)}: {op}")
            if not 1 <= int(op.get("radius", 1)) <= 8:
                raise GenomeError(f"radius must be 1-8: {op}")
        elif name == "gloss_value":
            if not isinstance(op.get("map"), dict):
                raise GenomeError(f"gloss_value needs a 'map' of value -> explanation: {op}")
        elif name not in SOURCE_OPS | SELECT_OPS:
            raise GenomeError(f"unknown op: {op}")


def _sources(op: dict) -> set:
    return set(op.get("sources", [])) | ({op["source"]} if "source" in op else set())


class Prepared:
    def __init__(self, puzzle: Puzzle, genome: dict):
        self.puzzle, self.genome, self.n = puzzle, genome, puzzle.n
        self.glosses = defaultdict(dict)
        excluded = set()
        for op in genome["ops"]:
            if op["op"] == "exclude_source":
                excluded |= _sources(op)
            elif op["op"] == "gloss_value":
                for s in _sources(op):
                    self.glosses[s].update(op["map"])
        self.by_ticket = defaultdict(list)
        for d in puzzle.docs:
            if d["source"] not in excluded:
                self.by_ticket[tuple(d["cells"][0])].append(d)

    def related(self, op: dict, a: int, w: int) -> list[tuple[int, int]]:
        r, scope = int(op.get("radius", 1)), op.get("scope", "same_account")
        cells = []
        for da in range(-r, r + 1):
            for dw in range(-r, r + 1):
                if (da, dw) == (0, 0):
                    continue
                if scope == "same_account" and da:
                    continue
                if scope == "same_week" and dw:
                    continue
                if scope == "both" and da and dw:
                    continue
                a2, w2 = a + da, w + dw
                if 0 <= a2 < self.n and 0 <= w2 < self.n:
                    cells.append((a2, w2))
        cells.sort(key=lambda c: (abs(c[0] - a) + abs(c[1] - w), c))
        if op.get("filter", "all") == "lookalike":
            own = {(d["source"], d["payload"]["value"]) for d in self.by_ticket.get((a, w), [])}
            if own:
                cells = [c for c in cells
                         if own & {(d["source"], d["payload"]["value"]) for d in self.by_ticket.get(c, [])}]
        cells = [c for c in cells if self.by_ticket.get(c)]
        return cells[: int(op.get("max_tickets", 99))]


def _votes(src: str, value: str, weight: float) -> list:
    qs = HINT_QUEUES[src].get(value, set())
    return [(q, weight / len(qs)) for q in qs]


def header(a: int, w: int) -> str:
    return f"Support ticket from account A{a:02d} in week {w} (ticket A{a:02d}-W{w:02d})."


def context(prep: Prepared, a: int, w: int) -> tuple[str, list[dict]]:
    relative = prep.genome.get("format", "raw") == "relative"
    lines = []
    for op in prep.genome["ops"]:
        room = BUDGET - len(lines)
        if room <= 0:
            break
        if op["op"] == "include_own":
            for d in prep.by_ticket.get((a, w), [])[: min(int(op.get("k", 3)), room)]:
                lines.append({"text": doc_text(d, (a, w), relative, prep.glosses), "kind": "own",
                              "votes": _votes(d["source"], d["payload"]["value"], 1.0)})
        elif op["op"] == "include_related":
            cells = prep.related(op, a, w)
            cap = min(int(op.get("k", room)), room)
            if op.get("show", "raw") == "raw":
                added = 0
                for c in cells:
                    for d in prep.by_ticket[c]:
                        if added >= cap:
                            break
                        lines.append({"text": doc_text(d, (a, w), relative, prep.glosses), "kind": "related",
                                      "votes": _votes(d["source"], d["payload"]["value"], 0.4)})
                        added += 1
            else:
                counts = defaultdict(Counter)
                for c in cells:
                    for d in prep.by_ticket[c]:
                        counts[d["source"]][d["payload"]["value"]] += 1
                label = f"{len(cells)} related tickets ({op.get('scope', 'same_account')}, radius {op.get('radius', 1)})"
                for src in sorted(counts)[:cap]:
                    parts = []
                    for value, k in counts[src].most_common():
                        gloss = prep.glosses.get(src, {}).get(value)
                        parts.append(f"{value}{f' ({gloss})' if gloss else ''} x{k}")
                    total = sum(counts[src].values())
                    lines.append({"text": f"[profile: {label}] {src}: {', '.join(parts)}", "kind": "related",
                                  "votes": [v for value, k in counts[src].items()
                                            for v in _votes(src, value, 0.8 * k / total)]})
    body = "\n".join(f"- {ln['text']}" for ln in lines) if lines else "(no records)"
    return f"{header(a, w)}\nRecords:\n{body}", lines
