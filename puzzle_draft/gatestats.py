"""Statistics for the robust gate: a paired, stratified bootstrap of the balanced-accuracy gain, plus harm.

Why paired and stratified: balanced accuracy averages 12 per-state recalls, and some states have only 4 blocks per
storm (the hospital campuses), so one block can move the score ~2 points. Comparing child vs parent on the same
blocks, resampling within each true state, gives the probability that a change really helps.

Keys are (town, cell); `truth` maps key -> true state; answers map key -> Jev's answer dict.
"""

import json
from collections import defaultdict

import numpy as np

import storm

LIFE_SAFETY = set(storm.LIFE_SAFETY)
MISS_WEIGHT = 5  # expected harm: a missed life-safety block counts as 5 false dispatches (wasted crew trips)


def paired_gain(parent: dict, child: dict, truth: dict, n_boot: int = 2000, seed: int = 0) -> dict:
    """Bootstrap the balanced-accuracy gain child - parent on the same blocks, resampling within each true state.

    Returns the observed gain, P(gain > 0), a 90% interval, and harm (5 x missed life-safety + false dispatches)."""
    keys = sorted(truth)
    by_state = defaultdict(list)
    for k in keys:
        by_state[truth[k]].append(k)
    rng = np.random.default_rng(seed)
    diffs, observed = np.zeros(n_boot), 0.0
    for s, ks in by_state.items():
        p = np.array([parent[k]["choice"] == s for k in ks], dtype=float)
        c = np.array([child[k]["choice"] == s for k in ks], dtype=float)
        observed += c.mean() - p.mean()
        idx = rng.integers(0, len(ks), size=(n_boot, len(ks)))
        diffs += (c[idx] - p[idx]).mean(axis=1)
    diffs /= len(by_state)
    observed /= len(by_state)
    crit = [k for k in keys if truth[k] in LIFE_SAFETY]
    found = lambda a: sum(a[k]["choice"] == truth[k] for k in crit)  # noqa: E731
    fd = lambda a: sum(a[k]["choice"] in LIFE_SAFETY and truth[k] == "intact" for k in keys)  # noqa: E731
    harm = lambda a: MISS_WEIGHT * (len(crit) - found(a)) + fd(a)  # noqa: E731
    return {"gain": float(observed), "p_better": float((diffs > 0).mean()),
            "ci90": [float(np.percentile(diffs, 5)), float(np.percentile(diffs, 95))],
            "life_safety_found_delta": int(found(child) - found(parent)),
            "false_dispatch_delta": int(fd(child) - fd(parent)),
            "harm_parent": int(harm(parent)), "harm_delta": int(harm(child) - harm(parent)),
            "blocks_changed_answer": int(sum(parent[k]["choice"] != child[k]["choice"] for k in keys)),
            "blocks": len(keys)}


def flips(parent: dict, child: dict, truth: dict) -> dict:
    """Blocks the change fixed and broke, by true state (for the curator's digest)."""
    fixed, broke = defaultdict(int), defaultdict(int)
    for k, s in truth.items():
        was, now = parent[k]["choice"] == s, child[k]["choice"] == s
        if now and not was:
            fixed[s] += 1
        elif was and not now:
            broke[s] += 1
    return {"fixed": dict(fixed), "broke": dict(broke)}


def ops_diff(parent: dict, child: dict) -> str:
    pa = [json.dumps(o, sort_keys=True) for o in parent["ops"]]
    ch = [json.dumps(o, sort_keys=True) for o in child["ops"]]
    parts = [f"+ {o}" for o in ch if o not in pa] + [f"- {o}" for o in pa if o not in ch]
    if parent.get("format", "raw") != child.get("format", "raw"):
        parts.append(f"format {parent.get('format', 'raw')} -> {child.get('format', 'raw')}")
    return "; ".join(parts) or "(no change)"


def signature(parent: dict, child: dict) -> list:
    """The structural shape of a change: op types and sources added, removed or re-parameterized (plus format)."""
    def srcs(o):
        return sorted(set(o.get("sources", [])) | ({o["source"]} if "source" in o else set())) or ["*"]

    def keys(g):
        return {f"{o['op']}:{s}" for o in g["ops"] for s in srcs(o)}
    sig = keys(parent) ^ keys(child)
    if parent.get("format", "raw") != child.get("format", "raw"):
        sig.add("format")
    changed = {json.dumps(o, sort_keys=True) for o in child["ops"]} ^ {json.dumps(o, sort_keys=True) for o in parent["ops"]}
    for o in map(json.loads, changed):
        sig |= {f"{o['op']}:{s}" for s in srcs(o)}
    return sorted(sig)


def predicted_change(genome: dict):
    p = genome.get("prediction")
    try:
        return float(p.get("dev_balanced_accuracy_change")) if isinstance(p, dict) else None
    except (TypeError, ValueError):
        return None
