# Jevly: collaboration guide

Welcome, Kishore. This is everything you need to pick up the project. What we're building, where it stands, how to run it, and what's next.

**TL;DR**
- Our hackathon entry is a harness that learns **what context to show Jev**, TypeSafe's fast decision model.
- The testbed is a support-ticket routing puzzle. Correct routing draws a hidden picture, so you can *see* accuracy improve.
- The current version (v4) works like tuning AlphaFold's inputs. A blind curator improved Jev from **46% to 93%** on the dev set over five runs.
- It is **overfitting**: the held-out picture drifted from 50% to 45%. Fixing that is the top open problem.

---

## 1. The idea

Fast "System 1" models like Jev decide in ~150 ms, but they only see a small slice of your data, and what they see decides whether they're right. We built a harness that **teaches itself what to show the model**:

1. A curator (an LLM) proposes a context policy.
2. Jev runs on a labeled dev set.
3. The curator reads the results and traces, forms a hypothesis, and proposes the next policy.
4. The final policy is checked on a held-out set it never saw, which stands in for production.

**Hackathon:** Harness Engineering & Model Wrangling Hackathon (MongoDB NYC, Cerebral Valley), Sat 9/26. Finalists present Wed 9/30 at MongoDB.local NYC. The rules require Atlas, Vector Search and agentic memory tooling; that isn't wired in yet (see §8). The full plan and ranking live on our Notion page, "Harness Engineering Hackathon 09/26/26".

## 2. Where we are (as of Sat 9/26)

**The blind curator run on v4** (curator = a fresh Claude subagent that only sees the `curator/` folder):

| Run | What the curator changed | Dev (watermelon) | Held-out (rocket, never shown) |
|---|---|---|---|
| baseline | own records only | 45.9% | 49.6% |
| iter_01 | glossed each record value with the queue it "usually routes to" in the dev traces | **71.2%** | 50.1% |
| iter_02 | added glosses for account_access vocabulary | **84.6%** | 45.5% |
| iter_03 | added related-ticket context (box radius 1, count profile) | **89.9%** | 48.6% |
| iter_04 | re-glossed three values as "noise" | **93.4%** | 45.2% |
| iter_05 | reworded one gloss to fix one specific dev ticket (A12-W11) | 93.4% | 45.3% |

Scores are balanced accuracy (the mean of per-queue accuracy). Runs used: 5 of 8. The run stopped here when a work session ended, and we're leaving it stopped (see §8).

**The good:** it behaves like real context engineering:
- It tests one hypothesis per run and states what would refute it.
- Its predictions are close (68% predicted vs 71% actual; 92% vs 93%).
- It discovered, from traces alone, that neighbor context fixes tickets with no records.

**The problem:** its glosses are learned from a dev set that only contains **4 of the 12 queues**. The watermelon is red, yellow, green and background. So "payment_page_error usually means billing" is true in dev and wrong in production, and the held-out score went *down*. By iter_05 it was tuning one gloss to fix one dev ticket. That's a real-world lesson (an eval set that doesn't represent production), but for the demo we need held-out to rise too (§8).

**The private calibration** (my reference policies, not the curator's) shows what's reachable. It uses glosses that describe *all* queues, not just the dev ones:

| Policy | Dev | Held-out |
|---|---|---|
| Own records only | 46% | 50% |
| + raw related tickets (a trap: Jev gets confused) | 41% | – |
| + value glosses, worded around Jev's bias against no_action | 71% | 59% |
| + related tickets, both directions, radius 1 | 81% | 73% |

![v4 calibration](docs/images/v4_calibration.png)

## 3. How we got here (4 puzzle versions in one night)

Each version failed in an instructive way:

| Version | Setup | What happened | Lesson |
|---|---|---|---|
| v1 | Colorful pixel art; sensors with hidden faults (flipped scan, shifted colors, overconfident sensors) | The curator solved it in **one pass** (69% → 98%), and it generalized (99% held-out) | The pool contained exact clues, so it could audit every source offline without running Jev |
| v2 | "The majority is wrong": a camera fleet sharing a calibration fault, honest minority | Solved offline again, 95% in one pass | A strong analyst weighs *independent* agreement. It also decoded the per-pixel heatmap into an answer key |
| v3 | Support-ticket framing, 10 realistic systems, realistic bugs (old queue numbering, reversed join, stale export, swapped CSV columns) | Data fixes gave ~90%; presentation tweaks added only 1–5 points | **Jev is a very good reader.** Forensics puzzles don't need Jev in the loop |
| **v4** | AlphaFold-style signal integration + trace-only access | The curator needs runs, learns Jev's quirks from traces, and improves step by step | ✓ The current design |

We also found some Jev behaviors that matter for context design, measured by a probe:
- With no evidence, Jev answers background/no_action about 90% of the time.
- It is overconfident on proportions ("75% red" → 93%).
- It trusts stated reliability almost completely.
- It treats a record about *another* item as if it were about this one.
- It is reluctant to choose no_action even when the hints point there.

## 4. How v4 works

- **The grid:** 16 accounts × 16 weeks = 256 tickets. Each ticket's correct queue comes from a hidden picture. Each queue has a color, so correct routing draws the picture.
- **12 queues**, each a unique (domain, intent) pair: billing, refunds, shipping, returns, account_access, security, technical, integrations, sales, feedback, legal, no_action.
- **Hints, not answers.** Each system reveals only part of a ticket:
  - `analytics-export` gives the domain (e.g. "payments" = billing or refunds).
  - `customer-form` gives the intent (e.g. "Something isn't working").
  - `event-log` gives an event shared by 2 queues.

  Each system covers about 60% of tickets and is right 90% of the time, so most tickets can't be settled alone.
- **Related tickets play the role of AlphaFold's MSA:** the same account in nearby weeks, and neighboring accounts in the same week. They help inside stable regions and blur thin edges.
- **The curator's knobs:**
  - `gloss_value`: explain what a value means
  - `include_own`
  - `include_related`: scope, radius, a look-alike filter, raw lines vs a count profile
  - `exclude_source`
  - `format`

  The harness never computes an answer; Jev integrates the hints.
- **Trace-only access:** the curator never sees the record pool. Each eval run gives it:
  - scores and per-queue accuracy
  - accuracy and confidence region grids
  - Jev's routing map
  - 30 traces: 10 worst + 20 random, each showing exactly what Jev saw, its answer and the right queue

  The first run is effectively blind.
- **Jev's confidence** is reported like AlphaFold's pLDDT: a label-free signal.

## 5. Repo tour

```
jev_smoke_test.py          one Jev call + latency benchmark (start here to check your key)
.env.example               copy to .env and add your own TypeSafe key (never commit .env)
puzzle_spec.md             the original v0 spec (black-and-white, superseded but useful history)
puzzle_draft/              the harness (the curator must never read this folder)
  jevlib.py                Jev client, retry, response cache, fake backend, thread pool
  palette.py               queue/color palette, OKLab color math, Twemoji fetch, image -> grid
  evidence.py              v4 ticket world: hint systems and generation (truth goes to secret/)
  harness.py               genome (context policy) -> exact text Jev sees per ticket
  render.py                routing-map renders, filmstrip, GIF/WebP
  run.py                   CLI: build | publish | preview | run | film | truth | leakcheck
  curator_brief.md         the curator's README (published into curator/)
  probe.py                 Jev behavior probe (Phase 1)
  sweep.py                 private calibration sweeps (input depth/scope/gloss variants)
  analyze_hints.py         accuracy split by which hints a ticket has
  show_cases.py            print example tickets for a hint combination
  reference_genomes/       private calibration policies (sw_*, sw2_*)
  puzzles/P1, P2           built puzzles (P1 = watermelon dev set, P2 = rocket held-out)
  secret/P1, P2            true queues per ticket  <- ANSWER KEYS
  data/twemoji/            source pictures (Twemoji, CC-BY 4.0)
curator/                   the only folder a blind curator may see
  README.md                its brief: catalog, eval harness, ops, rules
  genomes/                 baseline + the curator's iter_01..05
  results/P1/<run>/        digest.md (scores + 30 traces), render.png, scores.json
  analysis/                the curator's own scripts and notes
ds-sightline/project/      "Sightline" design system for the dashboard/deck/video
                           (tokens, 5 React components: PuzzleGrid, StatusBadge, LineageNode,
                           ScoreCurve, DiffCard). A few files show mojibake (e.g. "Â·"): harmless
                           encoding noise
docs/images/               reference renders used in this doc
```

## 6. Setup

You need Python 3.12 and your own TypeSafe key (console.typesafe.ai). OpenRouter's `typesafe/jev-1.13` also works.

```bash
pip install typesafe-sdk numpy pillow
```
```bash
cp .env.example .env
```

Then put your key in `.env` (`TYPESAFE_API_KEY=...`) and check it works:

```bash
python jev_smoke_test.py --bench 20
```

Reference numbers from the direct TypeSafe API: p50 ≈ 165 ms sequential; about 70 calls/s with 16 parallel workers. A full eval run is 256 calls, about 5 s and about 160k input tokens (under a cent). Responses are cached in `puzzle_draft/cache/`, so re-runs are free.

## 7. Everyday commands

Run an eval of a genome on the dev set (results go to `curator/results/`):
```bash
python puzzle_draft/run.py run curator/genomes/iter_05.json P1
```
Score the same genome on the held-out set (results go to `out/`, never to `curator/`):
```bash
python puzzle_draft/run.py run curator/genomes/iter_05.json P2 --private
```
See exactly what Jev reads for a ticket (account 6, week 5):
```bash
python puzzle_draft/run.py preview P1 --ticket 6 5 --genome curator/genomes/iter_02.json
```
Build the before/after filmstrip and animation (after the runs exist locally):
```bash
python puzzle_draft/run.py film P1 baseline iter_01 iter_03 iter_04 --then P2:iter_04
```
Try it for free without calling Jev:
```bash
python puzzle_draft/run.py run curator/genomes/baseline.json P1 --backend fake --private
```
Check that nothing revealing leaked into `curator/`:
```bash
python puzzle_draft/run.py leakcheck
```

## 8. Open problems and next steps

These are in priority order, and none are assigned yet. Let's split them on our first call.

1. **Make the dev set represent production.** This is the overfitting fix. Use a dev set of several pictures that together cover all 12 queues, keep a separate held-out set, and rerun the blind curator. Expected result: glosses become general, and held-out rises with dev.
2. **Keep the current run as the "before" story.** iter_01–05 show exactly how a context loop overfits an unrepresentative eval set. The remaining 3 runs would only overfit further, so the next curator should start fresh on the fixed dev set.
3. **Automate the loop.** Replace the manual relay with a script that runs the genome, hands the digest to an LLM curator and gates on the score, so it becomes the self-evolving harness in the pitch.
4. **MongoDB (required by the rules):**
   - records and traces in Atlas
   - Vector Search for retrieving related tickets
   - rejected-mutation memory (agentic memory)
   - a database role that hides the answer keys from the curator (the demo's "trust" moment)
5. **Dashboard, deck and demo video** using the Sightline design system: routing map by generation, ScoreCurve for dev vs held-out, lineage and diff cards.
6. **Confirm the hackathon rules:** the real submission cutoff, whether Kiro is required, video length, and any new-code rule.

## 9. How we work together

- **Branches and PRs:** `main` stays runnable. Work on a branch, open a PR, and the other person reviews.
- **Never commit `.env`.** Each of us uses our own key, and `.gitignore` covers it.
- **This repo is public, so the answer keys are public.** `puzzle_draft/secret/` holds the truth for every ticket, and anyone, or any agent, that can browse the repo can read it.
- **Keeping a curator blind:**
  - Only ever give a blind curator a **copy of `curator/`**, never the repo.
  - Tell it to stay inside that folder, and have it list every file it opened in each report.
  - Run `leakcheck` after every build and run.
  - Don't share what you know about the puzzle with a curator.
- **Results:** runs are cheap, so log every one. Keep curator results in `curator/results/` and private checks in `out/` (gitignored).

## 10. Credits

- Pictures: Twemoji by Twitter / jdecked (github.com/jdecked/twemoji), licensed CC-BY 4.0.
- Jev: TypeSafe (typesafe.ai). Accessed through the `typesafe-sdk` Python package.
