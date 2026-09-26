# Curator brief: support ticket routing

You are the context engineer for **Jev**, a fast decision model that routes support tickets to one of 12 queues. For each ticket, a harness assembles a short context (at most **12 lines**) from company systems, and Jev picks a queue. Your job is to design the **context policy** (the "genome") that makes Jev route accurately.

Your policy will later run, unchanged, in production on tickets you will never see. Aim for something that works because of how the data and Jev behave, not because of this particular dev set.

## What you have

- **This README:** the data catalog, the eval harness and the ops you can use.
- `puzzles/P1/puzzle.json`: dev-set size and record counts per system.
- `puzzles/P1/palette.json`: the 12 queues in the order Jev sees them, their descriptions (these are the options Jev chooses between), and the color each queue is drawn in on the routing map.
- `genomes/baseline.json`: the current production policy.
- `results/P1/<genome id>/`: one folder per eval run.

**You have no direct access to the underlying records.** As in most real systems, the data lives behind the harness. You only see records through the **traces** in each eval run.

## The dev set

- 256 labeled tickets: accounts A00–A15 × weeks 0–15.
- Accounts are numbered so that neighboring numbers are similar customers (same segment).
- Customers' issues often persist from week to week, but they also change.

## Data catalog

Descriptions come from the teams that own each system. There are no guarantees about accuracy or completeness.

| System | What the owning team says it contains |
|---|---|
| `analytics-export` | The topic cluster assigned to the ticket by the analytics team's clustering job. |
| `customer-form` | The topic the customer picked from the contact-form dropdown. |
| `event-log` | The most relevant product event recorded around the ticket. |

Each system has a record for somewhere around half to two-thirds of tickets, and records are sometimes wrong.

## Eval harness

Each eval run routes all 256 dev tickets with your genome and writes `results/P1/<genome id>/`:

- `digest.md` contains:
  - the scores
  - per-queue accuracy
  - region grids (4 accounts × 4 weeks per cell) for accuracy and for **Jev's own confidence**
  - **30 traces:** the 10 worst-routed tickets and 20 random ones, each showing exactly what Jev saw, its answer and confidence, and the right queue
- `render.png`: the routing map. Accounts are rows and weeks are columns; each ticket is drawn in the probability-weighted mix of its queues' colors.
- `scores.json`: the same numbers, machine-readable.

**Scores:**
- **Headline: balanced accuracy**, the mean of per-queue accuracy.
- Also: plain accuracy, confident-but-wrong count, token cost, and **Jev's mean confidence**. Confidence needs no labels, like a model's self-reported confidence score.

## Run budget

You have **up to 8 eval runs** after the baseline. Treat each run as an experiment:
- State the hypothesis it tests.
- Say what result would confirm or refute it.
- Changing many things at once makes a result hard to read.
- A run may be purely exploratory, for example to see what a system's records look like.

## Rules

1. **Stay inside this folder.** Don't open, list or search anything outside it.
2. **One genome per iteration.** Save it as `genomes/iter_01.json`, `iter_02.json`, and so on, with a matching `"id"`. Include:
   - `"rationale"`: what you learned, the hypothesis, and what result would confirm or refute it
   - `"prediction"`: the balanced accuracy you expect
3. You may keep notes or write analysis scripts in an `analysis/` subfolder. They can only use files in this folder.
4. When a genome is ready, say so and stop. Someone else runs it and tells you when the results are in.

## Genome format

```json
{
  "id": "iter_01",
  "rationale": "...",
  "prediction": "balanced accuracy ~X%",
  "ops": [
    {"op": "include_own", "k": 3},
    {"op": "include_related", "scope": "same_account", "radius": 1, "show": "raw", "k": 4}
  ],
  "format": "relative"
}
```

## Ops

### Source ops
These apply everywhere, before any lines are chosen.

| Op | Parameters | Effect |
|---|---|---|
| `exclude_source` | `source` or `sources` | Removes a system's records entirely. |
| `gloss_value` | `source`, `map` of value → explanation | Adds your explanation in parentheses wherever that value appears (own records, related records and profiles). Example: `{"op": "gloss_value", "source": "event-log", "map": {"some_event": "usually means X"}}` |

### Selection ops
These fill the **12-line budget** in the order listed.

| Op | Parameters | Effect |
|---|---|---|
| `include_own` | `k` | Up to `k` of the ticket's own records. |
| `include_related` | `scope`, `radius` (1–8), `filter`, `show`, `max_tickets`, `k` | Records from related tickets (details below). |

`include_related` parameters:

- `scope`:
  - `same_account`: same account, weeks within `radius`
  - `same_week`: same week, accounts within `radius`
  - `both`: the union of the two
  - `box`: every ticket within `radius` in both directions
- `filter`:
  - `all`: every related ticket
  - `lookalike`: only related tickets that share at least one record value with this ticket's own records
- `show`:
  - `raw`: one line per related record, nearest tickets first, up to `k` lines
  - `profile`: one summary line per system counting values across the selected related tickets, up to `k` lines
- `max_tickets`: caps how many related tickets are used, nearest first.

### Presentation
- `format`:
  - `raw`: records named by ticket ID
  - `relative`: "This ticket ...", "Related ticket (same account, 1 week earlier) ..."
