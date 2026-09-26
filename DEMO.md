# Sightline: hurricane damage map

A harness that teaches itself what context to show **Jev**, TypeSafe's fast decision model, proves the result on
a storm it never saw, and can't cheat because MongoDB locks the answers away.

| | |
|---|---|
| **Start page (share this)** | https://sightline-jev.vercel.app |
| **Stage demo, 7 beats, live data** | https://sightline-jev.vercel.app/sightline.html (`?beat=1..7` jumps to a beat) |
| **Read-only API** | https://sightline-jev.vercel.app/api/state · `/api/map` · `/api/block` · `/api/reports` |
| **Code** | https://github.com/hughesbrayden/sightline |
| **Backend, one command** | `./sightline.sh help` |

- [The pitch](#the-pitch)
- [Architecture](#architecture)
- [Run the backend](#run-the-backend)
- [Score tonight's storm (once)](#score-tonights-storm-once)
- [Dashboard and stage demo](#dashboard-and-stage-demo)
- [Results](#results)
- [Status](#status)
- [What we learned](#what-we-learned)
- [Video and submission](#video-and-submission)

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

### The system

Blue nodes run under one of the three locked MongoDB logins. The answer key (`assessments`) is reachable only by
the scorer.

```mermaid
flowchart LR
  subgraph GEN["Storm world (builder only)"]
    STORM["storm.py<br/>8 simulated storms<br/>12 states, 8 report sources"]
  end

  subgraph ATLAS["MongoDB Atlas · jevly"]
    REPORTS[("reports<br/>blocks")]
    TRUTH[("assessments<br/>answer key")]
    POL[("policies<br/>memory")]
    RUNS[("runs · gate_scores<br/>heldout_scores")]
  end

  subgraph LOOP["Harness loop · driver.py"]
    CUR["Curator LLM<br/>GLM-5.2 via OpenRouter"]
    VAL["Validate genome<br/>leak guard · memory check"]
    COMP["Compile ops to a<br/>$geoNear / $match / $switch pipeline"]
    CTX["Harness: 12 lines per block"]
    JEV["Jev · typesafe/jev-1.13<br/>3,111 blocks per generation"]
    SCORE["Scorer<br/>balanced acc · life-safety · false dispatches"]
    GATE{"Gate<br/>validation +1 pt?"}
  end

  subgraph WEB["Vercel · Next.js"]
    API["Read-only API<br/>/api/state /map /block /reports"]
    UI["Start page +<br/>Sightline stage demo"]
    SNAP["snapshot.json<br/>offline fallback"]
  end

  STORM -- "admin login" --> REPORTS
  STORM -- "admin login" --> TRUTH
  CUR --> VAL --> COMP --> CTX
  REPORTS -- "curator login" --> CTX
  CTX --> JEV --> SCORE
  TRUTH -- "scorer login only" --> SCORE
  SCORE -- "dev digest: scores + 30 traces" --> CUR
  SCORE --> GATE
  GATE -- "pass / fail only" --> CUR
  GATE -- "lineage (curator login)" --> POL
  SCORE -- "scorer login" --> RUNS
  POL -- "dashboard login" --> API
  RUNS -- "dashboard login" --> API
  API --> UI
  SNAP -. "if the API is down" .-> UI
  CUR -. "tripwire probe: DENIED" .-x TRUTH

  classDef locked fill:#ddeff3,stroke:#0a6c86,color:#15191b;
  classDef answer fill:#f6dcd9,stroke:#b0271f,color:#15191b;
  class CTX,SCORE,API,POL locked;
  class TRUTH answer;
```

### One generation, step by step

```mermaid
sequenceDiagram
  autonumber
  participant D as driver.py
  participant C as Curator LLM
  participant H as Harness
  participant J as Jev
  participant S as Scorer (scorer login)
  participant M as MongoDB

  D->>D: Build the prompt: brief + own past genomes + last dev digest
  D->>D: Leak check (no storm ids, cities, truth, validation numbers)
  D->>C: Propose the next genome
  C-->>D: Genome JSON: ops, hypothesis, prediction
  D->>D: Validate + leak guard (no coordinates or storm ids in ops)
  D->>D: Memory check: skip near-duplicates of rejected ideas
  D->>M: policies: status running + compiled pipeline (curator login)
  loop 3,111 blocks: 3 past storms + the validation storm
    H->>M: Reports near the block (curator login)
    H->>J: 12 lines + the 12 states
    J-->>H: Pick + confidence (about 250 ms)
  end
  H->>S: Answers
  S->>M: Read assessments (only this login can)
  S->>M: runs rows, gate_scores (validation number)
  S-->>D: Dev scores + 30 traces, validation balanced accuracy
  D->>D: Gate: keep only if validation beats the best by 1 point
  D->>M: policies: accepted / rejected, dev score, gate pass/fail
  D-->>C: Next prompt sees the digest and pass/fail, never the validation number
```

### Storms and splits

The city outlines match the Sightline design (stylized NYC, Miami, Houston, New Orleans). **The storms are
simulated** and deterministic: `storm_run.py build` regenerates them byte-for-byte.

| Split | Storms | Who sees what |
|---|---|---|
| dev | MIA1, HOU1, NOL1 (past storms) | Curator gets scores and 30 traces per generation |
| val | NYC0 (a past NYC storm) | The gate; the curator only learns pass or fail |
| heldout | NYC1 (tonight) | Scored once, at the end |
| cities | MIA2, HOU2, NOL2 (next season) | Scored once with the frozen policy (beat 7) |

There are 12 states: intact, flooded_street, flooded_homes, roof_damage, collapsed, fire, road_blocked, power_out,
downed_lines, shelter_open, hospital_ok, hospital_down. The life-safety states are collapsed, flooded_homes, fire
and hospital_down.

### Report sources

The storms are simulated, but every source speaks the vocabulary of its real-world counterpart (NYC, Hurricane
Sandy era). Each has a planted habit that a harness op can fix. The model sees one static post-storm snapshot.

| Source | Real-world counterpart | Vocabulary (examples) | Habit |
|---|---|---|---|
| `911-call` | NYPD / FDNY CAD call types | `STRUCTURAL: BUILDING COLLAPSE`, `UTILITY EMERGENCY - ELECTRIC`, `ASSIST CIVILIAN - NON-MEDICAL` | vague codes shared by several states; often filed one block off (FCC Phase II: 50–150 m); repeat calls on severe incidents |
| `311` | NYC 311 (complaint type / descriptor) | `Sewer / Street Flooding (SJ)`, `Damaged Tree / Entire Tree Has Fallen Down` | accurate but low-severity, buried in the everyday background (`HEATING / HEAT`, noise); power outages go to Con Ed, not 311 |
| `social-post` | Twitter/X | hashtags, `verified: yes/no` | viral "verified" (paid-badge) accounts spread false collapse, fire and flood reports |
| `city-survey` | FEMA Preliminary Damage Assessment | `Destroyed`, `Major`, `Minor`, `Affected`, `Inaccessible` | a second damage scale: "Major" means water inside homes, "Affected" means cosmetic only |
| `fire-dept` | NFIRS incident types | `111` building fire, `363` swift water rescue, `444` power line down, `461` collapse, `813` hurricane assessment | numeric codes that need translating |
| `pre-storm-map` | NYC PLUTO, evacuation zones, FEMA flood zones, LiDAR | `02 Multi-Family Walk-Up Buildings`; evacuation zone 1–6; flood zone AE/VE/X | a miscalibrated prior; every school is a designated evacuation center, but only some open |
| `drone-pass` | NOAA / Civil Air Patrol imagery (RescueNet / FloodNet labels) | `Building-Flooded`, `Road-Blocked`, `Building-Total-Destruction` | about 30% coverage in flight strips; overhead imagery can't see power outages |
| `utility-feed` | utility outage management | `energized`, `de-energized` by feeder | accurate but feeder-wide |

Calibration after the real-vocabulary cutover (TypeSafe `jev-latest`): baseline 59.1% dev / 52.5% validation;
builder reference 69.0% / 70.7%; dev false dispatches 207 → 58.

### Harness ops

| Op | Effect | Compiles to |
|---|---|---|
| `exclude_source` | Drop every report from a source | `$match: {source: {$nin: [...]}}` |
| `gloss_value` | Show `value (explanation)` for a source's codes | `$set` with `$switch` |
| `include_own {k}` | The block's own reports | `$match` on the block + `$limit` |
| `include_related {radius, only_values, sources, show}` | Reports from nearby blocks, listed raw or summarized | `$geoNear` + `$match` (+ `$group` for profiles) |
| `format: relative` | "Neighbor 1 block north" instead of coordinates | presentation |

### MongoDB (`jevly` database)

| Collection | Contents | Read by | Written by |
|---|---|---|---|
| `blocks` | town, x, y, `loc` (2d index), land use, elevation | dashboard | admin (loader) |
| `reports` | town, source, x, y, `loc` (2d index), value, text, hour | curator, dashboard | admin |
| `assessments` | **the answer key**: town, x, y, state | **scorer only** | admin |
| `policies` | lineage: gen, parent, status, ops, compiled_pipeline, hypothesis, prediction, dev_score, gate | curator, dashboard | curator |
| `runs` | time-series, one row per block per generation: pick, confidence, probabilities, the exact lines Jev saw, graded truth | scorer, dashboard | scorer |
| `gate_scores` | validation score per generation, plus refs (baseline, ceiling). Kept away from the curator | scorer, dashboard | scorer |
| `heldout_scores` | once-only scores for tonight and the other cities | scorer, dashboard | scorer |
| `memory` | findings and rejected ideas, with a vector index | curator, dashboard | curator |

### Files

| File | Role |
|---|---|
| `sightline.sh` | One entry point for everything below |
| `puzzle_draft/storm.py` | Storm generator: city outlines, damage rules, sources, coverage assertion |
| `puzzle_draft/storm_harness.py` | Genome → the exact text Jev sees; leak guard; ops → Mongo pipeline compiler |
| `puzzle_draft/storm_run.py` | `build`, `truth`, `load`, `preview`, `run` (scorer reads truth through the scorer login), `refs` |
| `puzzle_draft/driver.py` | The automatic loop: curator → validate → memory check → evaluate → gate → lineage |
| `puzzle_draft/storm_curator_brief.md` | Everything the curator is told (nothing about the planted habits) |
| `puzzle_draft/storm_genomes/` | `baseline.json` (12 nearest reports) and each run's best genome |
| `puzzle_draft/storm_reference/` | Builder's hand-written ceiling. **Never shown to the curator** |
| `puzzle_draft/db.py`, `mongo_setup.py`, `mongo_itest.py` | Logins, schema, roles, permission check, tripwire probe, integration test |
| `puzzle_draft/preflight.py`, `backfill_runs.py` | Access check; rebuild older `runs` rows |
| `dashboard/` | Next.js: read-only API, start page, `public/sightline.html`, `public/snapshot.json` |
| `demo/` | Sightline stage demo source (`src/app.js`, `src/live.js`), `build_live.sh`, `snapshot.mjs` |
| `ds-sightline/` | Sightline design system: tokens and components |

## Run the backend

Everything goes through `./sightline.sh`:

| Command | What it does |
|---|---|
| `./sightline.sh setup` | Install Python and dashboard dependencies; create `.env` if it's missing |
| `./sightline.sh preflight` | Check OpenRouter, Jev, the curator LLM and all four MongoDB logins (expect 12/12) |
| `./sightline.sh db local` | Local Atlas container + schema + locked logins, then the permission check, probe and integration test |
| `./sightline.sh db atlas` | Same on cloud Atlas (needs `MONGODB_URI_ADMIN` and `atlas auth login`) |
| `./sightline.sh world` | Generate the 8 storms, render the truth maps, load everything into MongoDB |
| `./sightline.sh calibrate` | Baseline (floor) vs the builder's reference (ceiling) on real Jev; stores the refs |
| `./sightline.sh loop --gens 8 --run live-2` | The automatic loop. Add `--resume` to continue a run, `--fake` for a free rehearsal |
| `./sightline.sh final live-1` | Score tonight's storm and the cities **once** (see below) |
| `./sightline.sh publish` | Record the run (offline fallback + start-page numbers) and rebuild the stage demo |
| `./sightline.sh dashboard` | Run the dashboard locally at http://localhost:3000 |
| `./sightline.sh deploy` | Deploy the dashboard to Vercel |
| `./sightline.sh validate [url]` | 39 contract checks against the API |
| `./sightline.sh all --gens 8 --run live-2` | preflight → world → calibrate → loop → publish (never `final`) |

**Setup (once).** Python 3.12 and Node 20 or newer. Run `./sightline.sh setup`, then fill in `.env`:

- `OPENROUTER_API_KEY`: one key covers Jev and the curator. **Jev calls need purchased OpenRouter credit.**
- `CURATOR_MODEL`: defaults to `z-ai/glm-5.2`.
- `MONGODB_URI_ADMIN`, `MONGODB_URI_CURATOR`, `MONGODB_URI_SCORER`, `MONGODB_URI_DASHBOARD`: ask Kishore privately,
  or run `./sightline.sh db local` to create your own. Never commit them.

**Look before you run.** These cost nothing:

```bash
python puzzle_draft/storm_run.py preview NYC1 12 5            # exact text Jev sees under the baseline
python puzzle_draft/storm_run.py preview NYC1 12 5 --genome puzzle_draft/storm_reference/ref_full.json
open out/storm/truth_sheet.png                                  # the 8 storms (after `world`)
```

**What a loop prints.** One line per generation: gen, status, dev, val, gate, tokens, seconds and the curator's
hypothesis. Maps land in `out/storm/runs/<run>_gXX/`; the lineage goes to Atlas `policies` and
`out/storm/lineage/<run>.jsonl`; the best genome goes to `out/storm/lineage/<run>_best.json`.

**Cost and time.** Each generation is 3,111 Jev calls: about $0.12 and about a minute, plus $0.01–0.04 and
20–90 s for the curator. Replays are free, because every Jev answer is cached in `puzzle_draft/cache/`. `--fake`
costs nothing but ignores glosses, so its numbers prove only that the pipeline runs.

## Score tonight's storm (once)

Run this only once the final genome is chosen. It needs `OPENROUTER_API_KEY` (with credit) and
`MONGODB_URI_SCORER`.

```bash
./sightline.sh final live-1       # baseline (gen 0) on NYC1, then live-1's best genome on NYC1 + MIA2/HOU2/NOL2
./sightline.sh publish && ./sightline.sh deploy
```

- It's about 3,800 Jev calls, roughly $0.15.
- It writes `heldout_scores` plus the map rows the demo shows. It refuses to score a genome twice.
- After `publish`, the start page and the demo switch from the validation storm to tonight's storm, and the
  "city it never saw" panel fills in.
- Never feed these numbers back into the loop.

## Dashboard and stage demo

**Start page:** https://sightline-jev.vercel.app shows the pitch, the held-out results, the learned rules, the
tripwire denial, both architecture diagrams and links to each beat. It's static, so it works even if the database is unreachable. Its
numbers come from `dashboard/lib/headline.json`, written by `./sightline.sh publish`.

**Stage demo:** https://sightline-jev.vercel.app/sightline.html is Brayden's seven-beat Sightline story, fed by
the recorded run through `demo/src/live.js`:

1. Calm night
2. Storm hits
3. Generation 0
4. Fitness signal
5. Evolution
6. Replay
7. What it learned

- The maps, reports, misreads (with the line Jev misread), lineage, scores and rules are all real. Clicking a
  block shows the exact lines Jev saw.
- The demo night is tonight's held-out NYC storm (it fell back to the validation storm until that was scored).
- Query parameters: `?beat=N` jumps to a beat; `?run=<id>` picks a run; `?scenario=1` shows the original
  illustrative story; `?snapshot=1` forces the offline fallback.
- **Offline fallback:** if the API is unreachable, the demo loads `snapshot.json` (a recording of the run) and
  looks the same.
- Engine states are drawn in the design system's palette: flooded_homes → homes flooded, collapsed → destroyed,
  roof_damage → wind or roof, power_out and downed_lines → power out, hospital_down → major damage.

**Brayden's click-through story** with the Story / Live-arena switch (example data) is at
https://sightline-jev.vercel.app/story.html, with a banner marking it illustrative. It's built by `demo/build.sh`
from `demo/src/story.js`.

**API** (read-only `dashboard` login, server-side only; cross-origin GET allowed):

| Endpoint | Returns |
|---|---|
| `GET /api/state?run=live-1` | `run` {id, used, status, cost_usd, best_gen}; `refs` {baseline, ceiling: {dev, val}}; `gens` [{gen, parent, status, gate, dev, val, life_safety_found, false_dispatches, hypothesis, refuted_if, prediction, ops, pipeline, curator}]; `heldout`; `probe` |
| `GET /api/map?run=&gen=&town=` | {w, h, mask, states, colors, split, accuracy, cells: [{x, y, pick, conf, correct, truth}]}. Truth appears only where the scorer published it; tonight is empty until scored |
| `GET /api/block?run=&gen=&town=&x=&y=` | {lines: the exact text Jev saw, jev: {pick, conf, probs}, assessment, correct} |
| `GET /api/reports?town=NYC1&until_hour=6` | The report feed in arrival order: [{hour, source, x, y, value, text, verified}] |

Pass `gen` explicitly: the current policy is `gen = state.run.best_gen`. Without `gen`, `/api/map` shows the
newest generation, which may be a rejected one.

**Deploy.** The Vercel project is `sightline-dashboard`, root `dashboard/`, with `MONGODB_URI_DASHBOARD` as a
secret server-side variable (never add a `NEXT_PUBLIC_` variant). The old address,
https://sightline-dashboard.vercel.app, also works.

## Results

**Calibration on real Jev** (before any curator ran):

| Policy | Dev (pooled) | Validation (NYC0) | False dispatches (dev) |
|---|---|---|---|
| Baseline: the 12 nearest reports | 56.7% | 64.6% | 265 |
| Builder's reference (the ceiling) | 71.5% | 76.6% | 62 |

**The automatic run `live-1`** (real Jev, curator GLM-5.2, gate margin 1 point):

| Gen | Status | Dev | Val | Curator's hypothesis (abridged) |
|---|---|---|---|---|
| 0 | baseline | 56.7% | 64.6% | No harness: the 12 reports nearest the block |
| 1 | **kept** | 60.5% | 70.0% | Jev over-weights dramatic, often inaccurate social posts |
| 2 | rejected | 59.5% | 69.5% | Jev treats 911 dispatch codes as ground truth for the block |
| 3 | **kept** | 61.1% | **72.1%** | Raw neighbor listings make Jev over-weight dramatic life-safety reports |
| 4 | rejected | 62.7% | 72.9% | 911 codes taken at face value (+0.8 on validation, under the 1-point margin) |
| 5 | rejected | 61.8% | 69.3% | A radius-2 neighbor profile bleeds states onto intact blocks |
| 6 | rejected | 62.0% | 67.6% | City-survey letter grades misread |
| 7 | rejected | 59.9% | 71.8% | Fire-department severity values misread |
| 8 | rejected | 60.3% | 72.0% | Dramatic drone values over-weighted |
| 9 | not scored | – | – | Curator returned no valid genome |
| 10 | rejected | 59.3% | 65.2% | Utility status under-used |
| 11 | rejected | 59.4% | 72.0% | Drone observation values mis-mapped |
| 12 | rejected | 58.9% | 64.6% | 911 and fire-dept reports in neighbor profiles bleed life-safety states |
| 13 | not scored | – | – | Stopped: OpenRouter out of credit for Jev |

The final genome is generation 3. It drops social posts, shows the block's own reports, and summarizes
neighbors within 2 blocks instead of listing them. The curator's LLM cost for all 13 generations was $0.18.

**Tonight's storm (NYC1): held out, never trained on, scored once** with `./sightline.sh final live-1`:

| | Generation 0 (baseline) | Generation 3 (evolved) |
|---|---|---|
| Balanced accuracy | 62.7% | **67.0%** |
| False dispatches (life-safety call on an intact block) | 131 | **72** |
| Rescue-critical blocks found | 70 / 101 | **71 / 101** |

**Next season, cities it never saw** (frozen generation 3, scored once): Miami 68.6%, Houston 66.1%,
New Orleans 66.2% balanced accuracy, with 38, 55 and 30 false dispatches.

## Status

| Area | Status |
|---|---|
| Storm world: 8 city-shaped storms, 12 states, 8 sources, coverage assertion | Done |
| MongoDB Atlas: schema, three locked logins, tripwire probe, integration test | Done |
| Harness + ops → pipeline compiler + scorer via the scorer login | Done |
| Automatic loop with gate, leak guard, memory check, lineage | Done; `live-1` ran 13 generations |
| Dashboard API (39/39 checks), start page, stage demo on live data, offline fallback | Done, live at https://sightline-jev.vercel.app |
| One-command backend (`sightline.sh`) | Done |
| Tonight's storm + cities scored once | Done: NYC1 62.7% → 67.0%, false dispatches 131 → 72 |
| Video | To record |
| Vector search in the memory check, LangSmith traces, field-verified spot check | Not done (optional; cut first) |

**Remaining, in order.**

1. Record the video; add its link to `VIDEO_URL` in `dashboard/app/page.tsx`; redeploy.
2. Submit.

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
- **An open model can curate from traces alone.** GLM-5.2 found the rumor problem in its first generation, with
  no hints about the planted habits.
- **The gate does its job, and has a cost.** It rejected 9 of 11 scored proposals. One of them (gen 4) was a real
  +0.8 on validation, just under the 1-point noise margin.
- **Operations matter at hackathon speed.** Curator replies sometimes come back empty (hidden reasoning uses up
  the token budget), and Jev calls need purchased credit. The driver now retries, logs the provider, and the demo
  ships a snapshot so it never depends on a live service.

**Still to try.**

- Validate on several storms at once, to shrink gate noise.
- A deep-agent curator with a `validate_genome` tool and an in-memory file system only.
- Vector search over rejected ideas in the memory check.
- A per-account exclusion op.
- Real data: NYC 311 open data and FEMA damage assessments.
- LangSmith experiments per generation.

## Video and submission

**Video (2–3 minutes).**

1. Screen-record the stage demo through its 7 beats.
2. Cut to a terminal running `./sightline.sh loop` (one line per generation).
3. Show the tripwire probe line.

Every number on screen is from the recorded run.

**Submission.**

- Demo: https://sightline-jev.vercel.app
- Code: https://github.com/hughesbrayden/sightline (start at this file)
- Video: the recording

**Safety.** The dashboard holds only the read-only login, and it can't read the answers. Never share the admin or
scorer credentials.

---

The hurricane storms are simulated; the city outlines are stylized.
