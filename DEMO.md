# Sightline: hurricane damage map demo

A harness that teaches itself what context to show **Jev**, TypeSafe's fast decision model, proves the result
on a storm it never saw, and can't cheat because MongoDB locks the answers away.

- [The pitch](#the-pitch)
- [Architecture](#architecture)
- [Run the demo yourself](#run-the-demo-yourself)
- [Dashboard](#dashboard-dashboard)
- [Status and remaining tasks](#status-and-remaining-tasks)
- [What we learned](#what-we-learned)
- [Video and hosting](#video-and-hosting)

## The pitch

**The problem.** Fast decision models answer in about a quarter of a second, but they see only a sliver of the
data, and that sliver decides whether they're right. Six hours after a hurricane, the evidence contradicts
itself: 911 calls filed at the wrong block, viral "verified" rumors, two agencies with two damage scales, and a
utility feed that says "de-energized" for a whole neighborhood. Shown the 12 nearest reports, Jev maps three past
storms at **56.7%** balanced accuracy and makes **265** false dispatches.

**What we built.** Sightline searches for the context policy, not the prompt or the weights:

1. A blind curator LLM proposes a context policy (a "genome").
2. The policy compiles to a MongoDB aggregation pipeline (`$geoNear`, `$match`, `$switch`) that picks exactly
   what Jev sees for each block.
3. Jev maps every block (3,111 calls per generation).
4. A scorer grades the map against an official assessment that the curator's database login cannot read.
5. A gate on a separate storm keeps or rejects each policy.
6. The final policy is scored once on a storm it never saw: tonight's NYC.

**Why it's different.**

- It optimizes *context*, the part of a fast-model system that decides whether the model can be right.
- It proves transfer: the curator never sees validation traces, and the held-out storm is scored once.
- The answer lock is enforced by MongoDB roles, not by trusting the agent. A tripwire probe shows the refusal live:
  `denied (code 13): not authorized on jevly to find on assessments`.

**Tech stack.** TypeSafe Jev (`typesafe/jev-1.13`, via OpenRouter); an open-model curator (`z-ai/glm-5.2`, via
OpenRouter); MongoDB Atlas (geo queries, time-series `runs`, vector-indexed `memory`, collection-level custom
roles); a Python harness; the Sightline design system; a Next.js dashboard on Vercel.

## Architecture

```
 GENERATE              COMPILE + RUN                     SCORE (locked)            LEARN
 storm.py ──► Atlas    storm_harness.py                  scorer login only         driver.py
 8 city storms         genome ─► 12 lines per block      assessments ─► scores     curator LLM (OpenRouter)
 8 report sources      ops ─► $geoNear/$match/$switch    runs, gate_scores,        ◄─ brief + own history + digest
 truth ─► assessments  Jev ×3,111 blocks                 heldout_scores            ─► genome ─► validate ─► dedupe ─► gate
                                                                                    lineage ─► policies (curator login)
 Dashboard (Vercel) ◄── dashboard login: read-only, everything except assessments
```

### Storms and splits

The city outlines match the Sightline demo (stylized NYC, Miami, Houston, New Orleans). **The storms are
simulated.**

| Split | Storms | Who sees what |
|---|---|---|
| dev | MIA1, HOU1, NOL1 (past storms) | Curator gets scores and 30 traces per generation |
| val | NYC0 (a past NYC storm) | The gate; the curator only learns pass or fail |
| heldout | NYC1 (tonight) | Scored once, at the end |
| cities | MIA2, HOU2, NOL2 (next season) | Scored once with the frozen policy (demo beat 7) |

There are 12 states: intact, flooded_street, flooded_homes, roof_damage, collapsed, fire, road_blocked,
power_out, downed_lines, shelter_open, hospital_ok, hospital_down. The life-safety states are collapsed,
flooded_homes, fire and hospital_down.

### Report sources

Each source has one planted habit, and each habit can be fixed with a harness op:

| Source | Habit |
|---|---|
| `911-call` | often filed one block off (the call is about a neighbor) |
| `311` | low-severity complaints; accurate |
| `social-post` | a few viral `verified: yes` accounts spread false collapse, fire and flood reports |
| `city-survey` | letter scale A–E where **A is the worst** |
| `fire-dept` | Minor / Major / Destroyed (a second agency, a second scale) |
| `pre-storm-map` | stale prior: land use and elevation |
| `drone-pass` | accurate, about 30% coverage; power outages look like "no visible damage" |
| `utility-feed` | accurate but feeder-wide |

### MongoDB (`jevly` database)

The project is now called Sightline, but the database, logins, local container and LangSmith project keep the
original `jevly` name, so existing Atlas setups and `.env` files keep working.

| Collection | Contents | Read by | Written by |
|---|---|---|---|
| `blocks` | town, x, y, `loc` (2d index), land use, elevation | dashboard | admin (loader) |
| `reports` | town, source, x, y, `loc` (2d index), value, text, hour | curator, dashboard | admin |
| `assessments` | **truth**: town, x, y, state | **scorer only** | admin |
| `policies` | lineage: gen, parent, status, ops, compiled_pipeline, rationale, prediction, dev_score, gate | curator, dashboard | curator |
| `runs` | time-series: {meta: {run, gen, town}, x, y, pick, conf, correct} | scorer, dashboard | scorer |
| `gate_scores` | validation score per generation (kept away from the curator) | scorer, dashboard | scorer |
| `heldout_scores` | once-only scores for tonight and the other cities | scorer, dashboard | scorer |
| `memory` | findings and rejected ideas, with a vector index | curator, dashboard | curator |

### Files

| File | Role |
|---|---|
| `puzzle_draft/storm.py` | Storm generator: city masks, damage rules, sources, coverage assertion |
| `puzzle_draft/storm_harness.py` | Genome → the exact text Jev sees; leak guard; ops → Mongo pipeline compiler |
| `puzzle_draft/storm_run.py` | CLI: `build`, `truth`, `load`, `preview`, `run` (the scorer reads truth through the scorer login) |
| `puzzle_draft/driver.py` | The automatic loop: curator → validate → near-duplicate skip → evaluate → gate → lineage |
| `puzzle_draft/storm_curator_brief.md` | Everything the curator is told (nothing about the planted habits) |
| `puzzle_draft/storm_genomes/baseline.json` | The no-harness policy: the 12 nearest reports |
| `puzzle_draft/storm_reference/` | Builder's hand-written ceiling. **Never shown to the curator** |
| `puzzle_draft/db.py`, `mongo_setup.py`, `mongo_itest.py` | Logins, schema, roles, permission check, tripwire probe, integration test |
| `puzzle_draft/preflight.py` | End-to-end access check |
| `puzzle_draft/run.py` + `evidence.py` + `harness.py` | v4 ticket-routing world (fallback and closer) |

## Run the demo yourself

### Setup (once)

```bash
pip install typesafe-sdk pymongo certifi numpy pillow httpx python-dotenv
cp .env.example .env    # then fill in the values below
```

`.env` needs:

- `OPENROUTER_API_KEY`: one key covers Jev and the curator.
- `CURATOR_MODEL`: defaults to `z-ai/glm-5.2`.
- `MONGODB_URI_ADMIN`, `MONGODB_URI_CURATOR`, `MONGODB_URI_SCORER`, `MONGODB_URI_DASHBOARD`: ask Kishore
  privately. Never commit them.
- For a fully local database instead, run `docker compose up -d && python puzzle_draft/mongo_setup.py setup`. It
  creates the same roles and writes the URIs for you.

### The demo, step by step

```bash
python puzzle_draft/preflight.py                                   # 1. everything reachable? expect 12/12
python puzzle_draft/storm_run.py build                             # 2. generate the 8 storms (deterministic)
python puzzle_draft/storm_run.py truth && open out/storm/truth_sheet.png
python puzzle_draft/storm_run.py load                              # 3. push them to Atlas (admin login)
python puzzle_draft/storm_run.py preview NYC1 12 5                 # 4. exact text Jev sees (baseline)
python puzzle_draft/storm_run.py preview NYC1 12 5 --genome puzzle_draft/storm_reference/ref_full.json
python puzzle_draft/storm_run.py run puzzle_draft/storm_genomes/baseline.json   # 5. baseline map + scores
open out/storm/runs/baseline/*.png
python puzzle_draft/driver.py --gens 3 --run my-demo               # 6. the live loop (~4 min, ~$0.50)
python puzzle_draft/mongo_setup.py probe --run my-demo             # 7. tripwire: curator denied on assessments
```

- **Step 6** prints one line per generation: gen, status, dev, val, gate, tokens, seconds, and the curator's
  hypothesis. The maps land in `out/storm/runs/my-demo_gXX/`. The lineage goes to Atlas `policies` and
  `out/storm/lineage/my-demo.jsonl`, and the best genome to `out/storm/lineage/my-demo_best.json`.
- **Free rehearsal:** add `--backend fake` (and `--no-mongo`) to steps 5–6. The fake backend ignores glosses, so
  its numbers prove only that the pipeline runs.
- **Replays are instant:** every Jev answer is cached in `puzzle_draft/cache/`, so rerunning a genome costs
  nothing.

### Score tonight's storm (once, at the very end)

Anyone on the team can do this from `main`. It needs only `OPENROUTER_API_KEY` and `MONGODB_URI_SCORER` in
`.env`; no admin login and no Jev cache.

1. **Wait for the final genome.** The best genome of the finished run is committed at
   `puzzle_draft/storm_genomes/<run>_best.json`; its `id` ends in the generation number, for example `live-1_g03`.
   Agree in chat who runs step 3: it can run only once per genome.
2. `python puzzle_draft/storm_run.py build`: regenerates the storm files locally. They're gitignored, and the
   rebuild is byte-identical to what's in Atlas.
3. Score it:

   ```bash
   python puzzle_draft/storm_run.py run puzzle_draft/storm_genomes/live-1_best.json \
     --split heldout,cities --final --run live-1 --gen 3
   ```

   This scores NYC1 (tonight) and MIA2, HOU2 and NOL2 (next season): 3,111 Jev calls, about $0.12 and 1 minute.
   It writes `heldout_scores` plus the map rows the dashboard shows. It refuses to run if that genome was
   already scored.
4. Paste the printed lines into the status section below. Never feed these numbers back into the loop.

### The v4 fallback (ticket routing)

```bash
python puzzle_draft/run.py run curator/genomes/baseline.json P1 --backend fake --private
```

## Dashboard (`dashboard/`)

A Next.js app that reads MongoDB with the **read-only `dashboard` login**. It can't read `assessments` and can't
write anything. The API is built and tested; the page at `/` is a placeholder until the v0 UI replaces it.

```bash
cd dashboard && npm install
echo "MONGODB_URI_DASHBOARD=<dashboard login URI>" > .env.local   # server-side only, gitignored
npm run dev            # http://localhost:3000
```

**Live:** https://sightline-dashboard.vercel.app (Vercel project `sightline-dashboard`, root `dashboard/`).
It passes all 38 contract checks: `python dashboard/scripts/validate_api.py https://sightline-dashboard.vercel.app`.
To redeploy, run `cd dashboard && vercel deploy --prod`. After v0's UI is merged into `dashboard/app/`, connect the
Git repo in Vercel so every push deploys.

**Deploy to Vercel:**

1. Import the repo.
2. Set **Root Directory** to `dashboard`.
3. Add `MONGODB_URI_DASHBOARD` as an environment variable. Never add a `NEXT_PUBLIC_` variant.

**API contract** (poll `/api/state` every 2 seconds):

| Endpoint | Returns |
|---|---|
| `GET /api/state?run=live-1` | `run` {id, used, status, cost_usd, best_gen}; `refs` {baseline, ceiling: {dev, val}}; `gens` [{gen, parent, status, gate, dev, val, life_safety_found, false_dispatches, hypothesis, refuted_if, prediction, ops, pipeline, curator}]; `heldout` [once-only scores]; `probe` {denied, error} |
| `GET /api/map?run=&gen=&town=` | {w, h, mask, states, colors, sea, split, accuracy, cells: [{x, y, pick, conf, correct}]} |
| `GET /api/block?run=&gen=&town=&x=&y=` | {lines: the exact text Jev saw, jev: {pick, conf, probs}, assessment, correct} |
| `GET /api/reports?town=NYC1&until_hour=6` | the report feed in arrival order: [{hour, source, x, y, value, text, verified}] |

The storm ids are MIA1, HOU1 and NOL1 (dev), NYC0 (val), NYC1 (tonight) and MIA2, HOU2 and NOL2 (cities). The
state names and colors are in `dashboard/lib/storm-meta.json`, generated from `storm.py`.

## Status and remaining tasks

**Done.**

- MongoDB Atlas setup: roles, logins, integration test and tripwire probe.
- Preflight check.
- The hurricane world: 8 storms, coverage assertion passing.
- Harness, pipeline compiler, scorer and driver.
- Real-Jev calibration:

  | Policy | Dev (pooled) | Validation (NYC0) | False dispatches (dev) |
  |---|---|---|---|
  | Baseline: the 12 nearest reports | 56.7% | 64.6% | 265 |
  | Builder reference (the ceiling) | 71.5% | 76.6% | 62 |

**First automatic run (`live-1`, real Jev, curator GLM-5.2), in progress:**

| Gen | Status | Dev | Val | Curator's hypothesis |
|---|---|---|---|---|
| 0 | baseline | 56.7% | 64.6% | the 12 nearest reports |
| 1 | accepted | 60.5% | 70.0% | Jev over-weights dramatic, often inaccurate social posts |
| 2 | rejected | 59.5% | 69.5% | Jev treats 911 dispatch codes as ground truth for the block |
| 3 | accepted | 61.1% | 72.1% | Raw neighbor listings make Jev over-weight dramatic life-safety reports |
| 4 | rejected | 62.7% | 72.9% | 911 codes taken at face value (a gain below the gate's 1-point margin) |

**Checklist by workstream** (checked against `main` at `888a146`).

| # | Workstream | Item | Status | Evidence / what's left |
|---|---|---|---|---|
| 1 | Storm engine | City-shaped maps (NYC and others) | Done | `storm.py`: 32×32, stylized NYC, Miami, Houston, New Orleans water masks |
| | | 12 states + coverage assertion | Done | `LIFE_SAFETY` defined; `build` fails if coverage fails |
| | | Report channels with timestamps | Done | 8 sources; `hour` 0–6 h |
| | | Splits | Done | dev MIA1/HOU1/NOL1 · val NYC0 · held-out NYC1 · cities MIA2/HOU2/NOL2 |
| | | Calibration | Partial | Baseline 56.7% dev → builder ceiling 71.5%: a 15-point gap; baseline is noisy, not near-random |
| 2 | Mongo + compiler | Schema, locked logins, tripwire probe | Done | `mongo_setup.py`, `mongo_itest.py`, verified on Atlas |
| | | Loader | Done | `storm_run.py load` (admin login) |
| | | Ops → pipeline compiler | Done | `compile_pipeline`: `$geoNear`, `$match`, `$switch` |
| | | Scorer via scorer login | Done | Truth read from Mongo; writes `runs`, `gate_scores`, `heldout_scores` |
| 3 | Loop driver | Curator → validate → gate → lineage | Done | `driver.py`; GLM-5.2 via OpenRouter; lineage in `policies` + jsonl |
| | | Leak guard | Done | Curator prompt and genome ops checked for towns and coordinates |
| | | Gate rule | Done | Validation must beat the best by 1 point (`GATE_MARGIN = 0.01`) |
| | | Rejected-idea memory | Partial | Near-duplicate op matching only; the vector-indexed `memory` collection isn't written or searched by the driver yet |
| | | First live run | Partial | `live-1` in progress: 2 accepted, 2 rejected; dev 56.7 → 61.1, val 64.6 → 72.1. **3:30 go/no-go target: 3+ accepted, validation rising** |
| 4 | Scoring + proof | Balanced accuracy, life-safety recall, false dispatches | Done | In `score()` and the digests |
| | | Held-out + cities scored once | Partial | `--final` gate built; not yet run (command above) |
| | | Filmstrip / GIF | Not started | Baseline → accepted generations → truth, then tonight |
| | | "What it learned" card | Not started | The final policy as plain rules, each linked to the generation that found it |
| | | Field-verified check | Not started | Optional: 20 blocks, accuracy vs Jev's confidence |
| 5 | Live app | Dashboard API routes | Not started | Read-only login: `/api/state`, `/api/map`, `/api/block`. Contract additions: storm ids, `gate_scores` for the validation number, refs {baseline, ceiling}, report `hour` for the beat-2 feed |
| | | Sightline connected to real data | Not started | Swap `STATES` to the engine's 12; replace mock numbers and runs with `live-1`; drop the lat/long-swap misread (cut); keep 311 and beat 7 (both real now) |
| | | Evolution re-cut | Not started | Lineage and the hypothesis → prediction → actual → verdict card at center; add the "What it learned" card |
| 6 | Demo + submission | Demo runbook | Done | This file |
| | | README, submission text, Twemoji credit | Partial | README +2 lines; submission text and CC-BY credit still to do |
| | | Merge branches | Partial | Storm work is on `main`; `rename-to-sightline` is still separate |
| | | Video, rehearsal, submit | Not started | Record after a real run so every number is real |
| 7 | Extras (cut first) | LangSmith | Partial | Env vars only; no tracing (free Developer plan: set `LANGSMITH_API_KEY`) |
| | | ElevenLabs, curator swap, misread pins | Not started | Optional |

**Remaining, in priority order.**

1. 3:30 go/no-go: finish `live-1` (3+ accepted generations, validation rising).
2. Score tonight's storm and the other cities once with the final genome.
3. Dashboard API routes, then connect Sightline to real data.
4. Filmstrip/GIF and the "What it learned" card.
5. Merge `rename-to-sightline`; README, submission text and Twemoji credit; record the video; submit.
6. Optional (cut in this order): vector memory in the driver, LangSmith traces, the field-verified check, the
   misread pins.

## What we learned

- **Calibrate the world before you trust the loop.** Our first world was too easy: the baseline reached 62% and
  a hand-written ceiling only 63.8%, which left the curator nothing to find. Sparser, messier sources opened a
  15-point gap.
- **Jev handles neighbor reports better than we expected.** Its real weak spots were unfamiliar scales and
  "verified" viral posts. Filtering the rumors cut false dispatches from 265 to 62 in the builder policy.
- **Well-meant context can hurt.** A cautious gloss on the utility feed dropped `power_out` accuracy from 82% to
  71%. A neighbor flood summary pulled 238 intact blocks to "flooded".
- **Some states are invisible without the right source.** Shelters and operating hospitals were right about 10%
  of the time until the pre-storm map listed facilities.
- **An open model can curate from traces alone.** GLM-5.2 found the rumor problem in its first generation with no
  hints about the planted habits.
- **Cost per generation:** about $0.12 of Jev plus $0.01–0.04 of curator, over 3,111 blocks, at 30–90 seconds.

**Still to try.**

- Validate on several storms at once, to shrink gate noise.
- A deep-agent curator with a `validate_genome` tool and an in-memory file system only.
- A per-account exclusion op.
- Real data: NYC 311 open data and FEMA damage assessments.
- LangSmith experiments per generation.
- A smaller grid, so the on-stage arena shows more iterations.

## Video and hosting

**Video (2–3 minutes).**

1. Screen-record the Sightline app through its 7 beats.
2. Cut to the terminal running `driver.py`, then to the lineage on the dashboard.
3. Show the tripwire probe line.

Record after a real run, so every number on screen is real.

**Hosting for judges to explore on their own time.**

- Deploy the dashboard on Vercel and have it read the recorded run.
  - Put `MONGODB_URI_DASHBOARD` in a **server-side** environment variable only, never in browser code.
  - That login can't read the answers or write anything, so a public URL is safe.
- Judges can run the pipeline without any Jev or Mongo keys: use `--backend fake --truth file --no-mongo`. The
  curator step still needs an OpenRouter key.
- Never share the admin or scorer credentials.

---

Pictures in the v4 ticket world: Twemoji (jdecked/twemoji), CC-BY 4.0. Hurricane storms are simulated; city
outlines are stylized.
