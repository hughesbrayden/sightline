"""Evidence pool generator (v4): support ticket routing as a signal-integration problem.

The grid is accounts (rows) x weeks (columns); each cell is one ticket whose correct queue comes from
the hidden picture. Every queue is a unique (domain, intent) pair, and each system only reveals part
of it:
  analytics-export  -> the domain (6 clusters, 2 queues each)
  customer-form     -> the intent (4 topics, 2-4 queues each)
  event-log         -> one of 6 events, each shared by 2 queues
Hints are sometimes wrong, and a ticket usually has only one or two of them, so most tickets can't be
settled from their own records. Related tickets (same account nearby weeks, same week nearby accounts)
carry the missing signal, like the alignment in AlphaFold: helpful inside stable regions, misleading
where a customer's issue changes.

The truth grid goes to puzzle_draft/secret/<pid>/ and never into the curator folder. In v4 the curator
doesn't get the pool either; it only sees records through run traces.
"""

import json
import random
from pathlib import Path

from palette import Palette, fetch, image_to_grid

ROOT = Path(__file__).resolve().parent.parent
PUZZLES_DIR = ROOT / "puzzle_draft" / "puzzles"
SECRET_DIR = ROOT / "puzzle_draft" / "secret"

DOMAIN = {
    "billing": "money", "refunds": "money", "shipping": "goods", "returns": "goods",
    "account_access": "access", "security": "access", "technical": "product", "integrations": "product",
    "sales": "commercial", "feedback": "commercial", "legal": "admin", "no_action": "admin",
}
INTENT = {
    "billing": "broken", "shipping": "broken", "account_access": "broken", "technical": "broken",
    "refunds": "action", "returns": "action", "integrations": "action", "legal": "action",
    "sales": "question", "security": "info", "feedback": "info", "no_action": "info",
}
CLUSTER_OF_DOMAIN = {
    "money": "payments", "goods": "orders-and-delivery", "access": "identity",
    "product": "product-usage", "commercial": "plans-and-opinions", "admin": "admin-and-compliance",
}
TOPIC_OF_INTENT = {
    "broken": "Something isn't working", "action": "I need you to do something",
    "question": "I have a question", "info": "Just letting you know",
}
EVENT_OF_QUEUE = {  # each event is emitted by exactly two queues
    "billing": "payment_page_error", "technical": "payment_page_error",
    "shipping": "order_or_return_page", "returns": "order_or_return_page",
    "account_access": "login_or_device_alert", "security": "login_or_device_alert",
    "integrations": "data_export_requested", "legal": "data_export_requested",
    "sales": "pricing_or_survey_page", "feedback": "pricing_or_survey_page",
    "refunds": "reply_to_receipt_email", "no_action": "reply_to_receipt_email",
}
HINTS = {  # source -> (queue -> hint value)
    "analytics-export": {q: CLUSTER_OF_DOMAIN[d] for q, d in DOMAIN.items()},
    "customer-form": {q: TOPIC_OF_INTENT[i] for q, i in INTENT.items()},
    "event-log": EVENT_OF_QUEUE,
}
DEFAULT_KNOBS = {"coverage": 0.6, "accuracy": 0.9}  # calibrated: baseline ~46%, tuned inputs ~81% balanced


def ticket(a: int, w: int) -> str:
    return f"A{a:02d}-W{w:02d}"


def relation(a: int, w: int, a2: int, w2: int) -> str:
    if a2 == a:
        d = w2 - w
        return f"same account, {abs(d)} week{'s' if abs(d) != 1 else ''} {'later' if d > 0 else 'earlier'}"
    if w2 == w:
        return f"same week, account {a2 - a:+d}"
    return f"account {a2 - a:+d}, week {w2 - w:+d}"


def doc_text(doc: dict, target=None, relative: bool = False, glosses: dict | None = None) -> str:
    """Render a hint. With a target ticket and relative=True, phrase it relative to that ticket."""
    src, value = doc["source"], doc["payload"]["value"]
    (a, w), = doc["cells"]
    gloss = (glosses or {}).get(src, {}).get(value)
    shown = f"{value} ({gloss})" if gloss else value
    if target is not None and relative:
        who = "This ticket" if (a, w) == tuple(target) else f"Related ticket ({relation(*target, a, w)})"
    else:
        who = f"Ticket {ticket(a, w)}"
    if src == "analytics-export":
        return f"[analytics-export] {who} topic cluster: {shown}"
    if src == "customer-form":
        return f"[customer-form] {who}: customer chose \"{shown}\""
    if src == "event-log":
        return f"[event-log] {who} event: {shown}"
    raise ValueError(src)


def build(pic: str, n: int, palette_name: str, seed: int, knobs: dict | None = None):
    knobs = {**DEFAULT_KNOBS, **(knobs or {})}
    pal = Palette(palette_name)
    queues = pal.names
    grid = image_to_grid(fetch(pic), n, pal)
    truth = [[queues[grid[a, w]] for w in range(n)] for a in range(n)]
    rng = random.Random(seed)
    docs = []
    for a in range(n):
        for w in range(n):
            for src, table in HINTS.items():
                if rng.random() >= knobs["coverage"]:
                    continue
                value = table[truth[a][w]]
                if rng.random() >= knobs["accuracy"]:
                    value = rng.choice(sorted(set(table.values()) - {value}))
                docs.append({"type": "hint", "source": src, "cells": [[a, w]], "payload": {"value": value}})
    rng.shuffle(docs)
    pool = []
    for i, doc in enumerate(docs):
        doc = {"doc_id": f"d{i:04d}", **doc}
        doc["text"] = doc_text(doc)
        pool.append(doc)
    secret = {
        "truth": {"pic": pic, "grid": truth},
        "build": {"pic": pic, "n": n, "palette": palette_name, "seed": seed, "knobs": knobs},
    }
    return pal, pool, secret


def write_puzzle(pid: str, pic: str, n: int, palette_name: str, seed: int, knobs: dict | None = None) -> dict:
    pal, pool, secret = build(pic, n, palette_name, seed, knobs)
    pdir, sdir = PUZZLES_DIR / pid, SECRET_DIR / pid
    pdir.mkdir(parents=True, exist_ok=True)
    sdir.mkdir(parents=True, exist_ok=True)
    counts = {}
    for d in pool:
        counts[d["source"]] = counts.get(d["source"], 0) + 1
    public = {"puzzle_id": pid, "accounts": n, "weeks": n, "tickets": n * n, "palette": palette_name,
              "records": len(pool), "records_by_source": counts}
    (pdir / "puzzle.json").write_text(json.dumps(public, indent=2), encoding="utf-8")
    (pdir / "palette.json").write_text(json.dumps(
        {"queues_in_order": pal.names, "descriptions": pal.criteria(),
         "render_colors": dict(zip(pal.names, pal.display_hex("dark")))},
        indent=2), encoding="utf-8")
    with open(pdir / "evidence.jsonl", "w", encoding="utf-8") as f:
        for d in pool:
            f.write(json.dumps(d) + "\n")
    for name, data in secret.items():
        (sdir / f"{name}.json").write_text(json.dumps(data, indent=2), encoding="utf-8")
    return public
