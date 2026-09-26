"""Tally (source, value) -> right queue over every trace in every digest.

Only the traced ticket's OWN records are counted (lines naming the ticket itself,
or 'This ticket' in relative format). Tickets are de-duplicated across runs.
Glosses in parentheses are stripped.
"""
import re
from collections import Counter, defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
head_re = re.compile(r"^### Ticket (A\d\d-W\d\d): (\w+)\. Right queue (\w+); Jev said (.*)$")
rec_re = re.compile(r"^- \[([\w-]+)\] (.*)$")

tickets = {}  # id -> (truth, [(src, value)])
for digest in sorted((ROOT / "results/P1").glob("*/digest.md")):
    lines = digest.read_text(encoding="utf-8").splitlines()
    cur = None
    for ln in lines:
        m = head_re.match(ln)
        if m:
            cur = m.group(1)
            if cur in tickets:
                cur = None  # already have it
                continue
            tickets[cur] = (m.group(3), [])
            continue
        if cur is None:
            continue
        m = rec_re.match(ln)
        if not m:
            continue
        src, text = m.groups()
        own = (f"Ticket {cur}" in text) or text.startswith("This ticket")
        if not own:
            continue
        text = re.sub(r"\s*\((?:[^()]|\([^()]*\))*\)\s*$", "", text)  # strip gloss
        if src == "customer-form":
            v = re.search(r'chose "(.*)"', text)
            val = v.group(1) if v else text
            val = re.sub(r"\s*\((?:[^()]|\([^()]*\))*\)\s*$", "", val)  # gloss inside quotes
        elif src == "event-log":
            val = text.split("event:")[-1].strip()
        else:
            val = text.split("cluster:")[-1].strip()
        tickets[cur][1].append((src, val))

tally = defaultdict(Counter)
norec = Counter()
for tid, (truth, recs) in tickets.items():
    if not recs:
        norec[truth] += 1
    for src, val in recs:
        tally[(src, val)][truth] += 1

print(f"{len(tickets)} distinct traced tickets")
for key in sorted(tally):
    print(f"{key[0]:17s} {key[1]:32s} {dict(tally[key])}")
print("no own records:", dict(norec))
print()
for tid in sorted(tickets):
    truth, recs = tickets[tid]
    print(tid, truth.ljust(15), "; ".join(f"{s[:5]}={v}" for s, v in recs))
