# Sightline: hurricane damage map

A harness that teaches itself what context to show **Jev**, TypeSafe's fast decision model, proves the result on
a storm it never saw, and can't cheat because MongoDB locks the answers away.

| | |
|---|---|
| **Start page (share this)** | https://sightline-jev.vercel.app |
| **Demo (default): story + live arena, recorded data** | https://sightline-jev.vercel.app/story.html (`?beat=1..7`, `?view=arena&autostart=1`) |
| **Seven-beat version** | https://sightline-jev.vercel.app/sightline.html |
| **Read-only API** | https://sightline-jev.vercel.app/api/state · `/api/map` · `/api/block` · `/api/reports` |
| **Code** | https://github.com/hughesbrayden/sightline |
| **Backend, one command** | `./sightline.sh help` |

- [The pitch](#the-pitch)
- [Architecture](#architecture)
- [Data model](#data-model)
- [The harness loop](#the-harness-loop)
- [Run the backend](#run-the-backend)
- [Score tonight's storm (once)](#score-tonights-storm-once)
- [Dashboard and stage demo](#dashboard-and-stage-demo)
- [LangSmith tracing](#langsmith-tracing)
- [Results](#results)
- [Robust loop vs naive loop vs random](#robust-loop-vs-naive-loop-vs-random)
- [Status](#status)
- [What we learned](#what-we-learned)
- [Video and submission](#video-and-submission)

## The pitch

**The problem.** Fast decision models answer in about a quarter of a second, but they see only a sliver of the
data, and that sliver decides whether they're right. Six hours after a hurricane, the evidence contradicts
itself: 911 calls filed at the wrong block, viral "verified" rumors, two agencies with two damage scales, and a
utility feed that says "de-energized" for a whole neighborhood. Shown the 12 nearest reports, Jev maps three past
storms at **59.5%** balanced accuracy and makes **210** false dispatches.

**What we built.** Sightline searches for the context policy, not the prompt or the weights:

1. A blind, stateless curator LLM proposes one change to the context policy (a "genome"). Everything it
   remembers comes from the harness: a lab notebook in Atlas Vector Search and a digest of what the last change
   fixed and broke.
2. The policy compiles to a MongoDB aggregation pipeline (`$geoNear`, `$match`, `$switch`) that picks exactly
   what Jev sees for each block.
3. Jev maps every block. A scorer grades the map against an official assessment that the curator's database
   login cannot read.
4. A statistical gate keeps a change only if it very likely helps on storms the curator never sees, without
   raising expected harm.
5. The final policy is scored once on a storm it never saw: tonight's NYC.

**Why it's different.**

- It optimizes *context*, the part of a fast-model system that decides whether the model can be right.
- It proves transfer: the curator never sees validation traces, and the held-out storm is scored once.
- It's tested against the obvious alternative. On four fresh storms, the robust loop beat a naive
  "keep whatever scores higher" loop and random mutation, block for block (see
  [the comparison](#robust-loop-vs-naive-loop-vs-random)).
- The answer lock is enforced by MongoDB roles, not by trusting the agent. A tripwire probe shows the refusal live:
  `denied (code 13): not authorized on jevly to find on assessments`.

**Tech stack.** TypeSafe Jev (`jev-latest` on a TypeSafe key, or `typesafe/jev-1.13` via OpenRouter); a curator
LLM (a blind Claude subagent for `live-2` and the harness lab; `z-ai/glm-5.2` via OpenRouter for `live-1`); MongoDB Atlas (geo queries,
time-series `runs`, Vector Search over the `memory` notebook with `voyage-4` embeddings from the Atlas model API,
collection-level custom roles); a Python harness; the Sightline design system; a Next.js dashboard on Vercel.

## Architecture

### The system

Four parts, three locked database logins. The answer key is readable only by the scorer; the curator's login is
refused (the tripwire probe shows it live).

```mermaid
flowchart LR
  WORLD["Storm world<br/>9 simulated storms"] -- admin --> ATLAS
  subgraph ATLAS["MongoDB Atlas"]
    REP[("reports · blocks")]
    KEY[("assessments<br/>answer key")]
    MEM[("policies · memory<br/>runs · scores")]
  end
  REP -- curator login --> LOOP["Harness loop<br/>curator → Jev → scorer → gate"]
  KEY -- scorer login only --> LOOP
  LOOP --> MEM
  MEM -- read-only login --> APP["Dashboard + stage demo<br/>(Vercel)"]
  LOOP -. "curator reads answers: DENIED" .-x KEY

  classDef answer fill:#f6dcd9,stroke:#b0271f,color:#15191b;
  class KEY answer;
```

### Data model

Everything lives in one MongoDB Atlas database, `jevly`, in three layers joined by **natural keys**. There are no
ObjectId references, so any collection can be read on its own and joined with a plain `$match` or `$lookup`:

- **World** (one per world version, written once by the loader): `blocks`, `reports` and `assessments`, keyed by
  `(town, x, y)`. A *town* is one storm on one city map (for example `NYC1` is tonight's storm in New York).
- **Experiment** (one per run, written as the loop goes): `policies`, `runs`, `gate_scores` and `memory`, keyed by
  `(run, gen)`. A *run* is one lineage (`live-2`); a *generation* is one proposed policy (a genome) and its evaluation.
- **Evaluation** (once only): `heldout_scores`, keyed by `(genome_id, town, world)`. The final policy's score on
  storms it never saw, plus the baseline's score from the same world.

```mermaid
erDiagram
  BLOCKS ||--o{ REPORTS : "filed at (town, x, y)"
  BLOCKS ||--|| ASSESSMENTS : "answer key (town, x, y)"
  POLICIES ||--o{ POLICIES : "parent gen"
  POLICIES ||--o{ RUNS : "one row per block per storm (run, gen)"
  RUNS }o--|| BLOCKS : "(town, x, y)"
  POLICIES ||--o{ GATE_SCORES : "validation score per storm (run, gen)"
  POLICIES ||--o| MEMORY : "lesson (run, gen)"
  POLICIES ||--o{ HELDOUT_SCORES : "genome_id, once per world"
  HELDOUT_SCORES }o--|| BLOCKS : "scored on a held-out town"

  BLOCKS {
    string town PK "storm id, e.g. NYC1"
    int x PK
    int y PK
    array loc "2d index, for $geoNear"
    string land_use
    float elev
  }
  REPORTS {
    string doc_id PK
    string town FK
    int x FK
    int y FK
    string source "911-call, 311, social-post, ..."
    string value "the source's own code"
    string text "what Jev reads"
    float hour "0-6 h after landfall"
  }
  ASSESSMENTS {
    string town PK
    int x PK
    int y PK
    string state "one of 12 states: scorer login only"
  }
  POLICIES {
    string run PK
    int gen PK
    int parent FK "gen it was proposed from"
    string genome_id "run_gNN"
    string status "running, accepted, rejected, invalid"
    array ops "the genome"
    array compiled_pipeline "ops as a MongoDB pipeline"
    object rationale "hypothesis, refuted_if"
    object prediction
    object dev_score
    string gate "pass / fail, never the number"
    object gate_detail "robust gate checks"
    string trace_url "LangSmith"
  }
  RUNS {
    object meta "run, gen, town (time-series metaField)"
    date ts
    int x
    int y
    string pick "Jev's answer"
    float conf
    object probs
    array lines "exactly what Jev saw"
    string truth "graded map, published by the scorer"
    bool correct
  }
  GATE_SCORES {
    string run FK
    int gen FK
    string town "validation storm"
    float val_score "kept away from the curator"
    string gate
  }
  MEMORY {
    string run FK
    int gen FK
    string kind "accepted, rejected, screened_out, skipped"
    string text "the lesson"
    array signature "structural change, for repeat detection"
    array embedding "1024-d, $vectorSearch index memory_vec"
  }
  HELDOUT_SCORES {
    string genome_id PK
    string town PK "NYC1, MIA2, HOU2, NOL2"
    string world PK "world version"
    float score
    int life_safety_found
    int false_dispatches
  }
```

**Lifecycle, and which login touches what:**

1. **Load a world** (`./sightline.sh world`, *admin* login): generate the storms, then write `blocks`, `reports` and
   `assessments`. The answer key is written once and never updated.
2. **Each generation** (`driver.py`):
   - The *curator* login writes the proposal to `policies` (`status: running`).
   - It reads `memory` with `$vectorSearch` for relevant lessons.
   - The harness reads `reports` through the genome's compiled `$geoNear` pipeline.
   - The *scorer* login is the only one that reads `assessments`. It writes 3,111 `runs` rows (Jev's pick, its
     probabilities, the exact lines it saw and the graded truth) and a `gate_scores` row per validation storm.
   - The verdict goes back to `policies` (`accepted` / `rejected`, with `gate` and `gate_detail`), and a lesson goes to
     `memory`.
3. **Score once** (`./sightline.sh final <run>`, *scorer* login): the best genome and the baseline on tonight's storm
   and the cities go to `heldout_scores`, plus their `runs` rows. A second scoring of the same genome in the same
   world is refused.
4. **Serve** (`dashboard` login, read-only): `/api/state` joins `policies` + `gate_scores` + `heldout_scores` by run;
   `/api/map` and `/api/block` read `runs` by `(run, gen, town)`. `./sightline.sh publish` freezes those responses
   into `snapshot.json`, the offline fallback.

**Collections** (document counts as of the `live-2` recording):

| Collection | Layer | Key | Indexes | Docs | Read by | Written by |
|---|---|---|---|---|---|---|
| `blocks` | World | town, x, y | `loc` 2d; town+x+y | 7,175 | dashboard | admin |
| `reports` | World | doc_id (at town, x, y) | `loc` 2d; town+source | 19,868 | curator, dashboard | admin |
| `assessments` | World | town, x, y | town+x+y | 7,175 | **scorer only** | admin |
| `policies` | Experiment | run, gen | run+gen | 28 (+ probe events) | curator, dashboard | curator |
| `runs` | Experiment | meta.run, meta.gen, meta.town, x, y | time-series (`meta`, `ts`) | 93,990 | scorer, dashboard | scorer |
| `gate_scores` | Experiment | run, gen, town (+ one `refs` doc) | run+gen | 28 | scorer, dashboard | scorer (insert-only) |
| `memory` | Experiment | run, gen | run+kind; **vector** `memory_vec` | 46 | curator, dashboard | curator |
| `heldout_scores` | Evaluation | genome_id, town, world | – | 10 | scorer, dashboard | scorer (insert-only) |

**Design choices:**

- **The lock sits at collection granularity.** Three custom roles (curator, scorer, dashboard) grant `find` and
  `insert` per collection, so "the curator can't read the answers" is enforced by Atlas, not by application code. The
  scorer's writes are insert-only, so scores can't be edited after the fact; the newest `refs` document wins.
- **`runs` is a time-series collection.** It gets one row per block per storm per generation, grouped by its
  `meta` (run, gen, town), so reading one map is one bucketed scan. It compresses well: about 119 MB of documents take
  about 11 MB on disk (the whole database: 128 MB in 18 MB).
- **Truth appears outside `assessments` only as a published, graded result.** The scorer copies it into `runs` rows
  for the storms it has graded, and into tonight's rows only at the once-only scoring. That's what lets the dashboard
  show "Assessment: …" without ever holding the answer-key login.
- **World versions keep comparisons honest.** A new vocabulary regenerates `reports` but leaves `assessments`
  byte-identical, and `heldout_scores.world` pairs each run's "after" with the baseline from the same world.
- **Geo and vector search are native.** `$geoNear` on the 2d `loc` indexes is how the harness finds neighbor
  reports; `$vectorSearch` on `memory_vec` (1,024 dimensions, cosine, filtered by run and kind) is the curator's
  notebook.

## The harness loop

The loop follows the standard self-evolving pattern (execute → trace → propose → gate → keep, with lineage),
hardened against the failure modes that pattern is known for: overfitting to the storms it tunes on, noisy
feedback, bloat, and a curator with no memory.

```mermaid
flowchart LR
  P["Curator proposes<br/>one change + numeric prediction"] --> S{"Screen<br/>~600 dev blocks"}
  S -- clearly worse --> N
  S --> E["Jev maps dev +<br/>2 validation storms"]
  E --> G{"Gate<br/>P(better) ≥ 0.9 on validation<br/>dev not down > 1 pt<br/>harm not up > 5%"}
  G -- keep --> K["New parent"]
  G -- reject --> N["Lesson → Atlas notebook"]
  K --> N
  N -- "top lessons ($vectorSearch)<br/>+ fixed / broken digest" --> P
```

| Weakness of a simple loop | What the robust loop does |
|---|---|
| **The gate is noise.** A 1-point margin on one validation storm, when hospital states are 4 blocks per storm and one block flip moves balanced accuracy about 2 points | A **paired, stratified bootstrap** on two validation storms (NYC0 + HOU0): child and parent compared on the same blocks, resampled within each true state. Keep only if P(better) ≥ 0.9 |
| One number decides everything | **Guardrails:** dev may not drop more than 1 point, and expected harm (5 × missed life-safety blocks + false dispatches) may not rise more than 5% |
| The curator only hears "fail" | A **diff digest**: which blocks the change fixed and broke, by state, with before/after traces. Predictions are numeric and scored against the result |
| No memory between stateless curator calls | A **vector lab notebook**: every generation writes a lesson (hypothesis, change, predicted vs actual, verdict) to Atlas `memory`, and the prompt retrieves the most relevant ones with `$vectorSearch`. A proposal close in meaning to a rejected lesson *and* making the same structural change is skipped unscored |
| Every idea costs a full evaluation | A **screen** on a stratified dev sample rejects clearly bad ideas at a fraction of the calls (harness lab only) |
| Accepted rules pile up | A **prune pass** at the end removes each rule in turn and keeps only those that measurably help. The survivors are "what it learned" (harness lab only) |

The robust loop was first built and proven in the harness lab (`evolve.py`, branch `curator-inbox`; see
[the comparison](#robust-loop-vs-naive-loop-vs-random)), then ported into `driver.py`: the bootstrap gate, the
guardrails, the Atlas notebook and the fixed/broken digest. The screen and the prune pass stayed in the lab.
`live-2` ran on the ported loop. `live-1` ran on the earlier simple loop: one validation storm and a 1-point margin.

### Storms and splits

The city outlines match the Sightline design (stylized NYC, Miami, Houston, New Orleans). **The storms are
simulated** and deterministic: `storm_run.py build` regenerates them byte-for-byte.

| Split | Storms | Who sees what |
|---|---|---|
| dev | MIA1, HOU1, NOL1 (past storms) | Curator gets scores and 30 traces per generation |
| val | NYC0 (a past NYC storm) | The gate, with val2; the curator learns the verdict, the pooled P(better) and which check failed, never traces |
| val2 | HOU0 (a past Houston storm) | The gate's second validation storm (added for `live-2`; its own seed, so no other storm changed) |
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

Calibration on the real-vocabulary world in Atlas (TypeSafe `jev-latest`, stored as the dashboard's refs):
baseline 59.5% dev / 50.3% validation; builder reference 69.7% / 69.7%; dev false dispatches 210 → 59.

### Harness ops

| Op | Effect | Compiles to |
|---|---|---|
| `exclude_source` | Drop every report from a source | `$match: {source: {$nin: [...]}}` |
| `gloss_value` | Show `value (explanation)` for a source's codes | `$set` with `$switch` |
| `include_own {k}` | The block's own reports | `$match` on the block + `$limit` |
| `include_related {radius, only_values, sources, show}` | Reports from nearby blocks, listed raw or summarized | `$geoNear` + `$match` (+ `$group` for profiles) |
| `format: relative` | "Neighbor 1 block north" instead of coordinates | presentation |

### MongoDB (`jevly` database)

See [Data model](#data-model): the entity-relationship diagram, the lifecycle, and every collection with its
keys, indexes, logins and size.

### Files

| File | Role |
|---|---|
| `sightline.sh` | One entry point for everything below |
| `puzzle_draft/storm.py` | Storm generator: city outlines, damage rules, sources, coverage assertion |
| `puzzle_draft/storm_harness.py` | Genome → the exact text Jev sees; leak guard; ops → Mongo pipeline compiler |
| `puzzle_draft/storm_run.py` | `build`, `truth`, `load`, `preview`, `run` (scorer reads truth through the scorer login), `refs` |
| `puzzle_draft/driver.py` | The automatic loop: curator → validate → memory check (notebook) → evaluate → robust gate → lineage. `--curator inbox` runs it with an external curator (e.g. a Claude subagent) |
| `puzzle_draft/gatestats.py`, `notebook.py` | The robust gate's paired bootstrap and harm score; the Atlas vector lab notebook |
| `puzzle_draft/evolve.py`, `loopstats.py`, `mutate.py`, `abtest.py` | Harness lab (branch `curator-inbox`): robust, naive and random-mutation arms, arm comparison on fresh storms |
| `puzzle_draft/storm_curator_brief.md`, `storm_curator_brief_gate.md` | Everything the curator is told (nothing about the planted habits), plus how the gate judges a change |
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
| `./sightline.sh world` | Generate the 9 storms, render the truth maps, load everything into MongoDB |
| `./sightline.sh calibrate` | Baseline (floor) vs the builder's reference (ceiling) on real Jev; stores the refs |
| `./sightline.sh loop --gens 8 --run live-2` | The automatic loop. Add `--resume` to continue a run, `--fake` for a free rehearsal |
| `./sightline.sh final <run>` | Score tonight's storm and the cities **once** (see below) |
| `./sightline.sh publish` | Record the demo run (`DEMO_RUN`, default `live-2`) for the offline fallback and start page, and rebuild both demo pages pinned to it |
| `./sightline.sh dashboard` | Run the dashboard locally at http://localhost:3000 |
| `./sightline.sh deploy` | Deploy the dashboard to Vercel |
| `./sightline.sh validate [url]` | 39 contract checks against the API |
| `./sightline.sh all --gens 8 --run live-2` | preflight → world → calibrate → loop → publish (never `final`) |

**Setup (once).** Python 3.12 and Node 20 or newer. Run `./sightline.sh setup`, then fill in `.env`:

- `TYPESAFE_API_KEY`: Jev (`jev-latest`); preferred when set. Otherwise `OPENROUTER_API_KEY` covers Jev and the
  curator, and **Jev calls need purchased OpenRouter credit.**
- `CURATOR_MODEL`: the OpenRouter curator, defaults to `z-ai/glm-5.2`. `live-2` used `--curator inbox` instead: the
  loop writes `gNN_prompt.md` to a folder outside the repo and exits; a fresh Claude subagent reads only that file
  and writes `gNN_reply.json`; `--resume` scores it.
- `MONGODB_MODEL_API_KEY`: Atlas model API key for the notebook's `voyage-4` embeddings (`--notebook local` works
  without it).
- `MONGODB_URI_ADMIN`, `MONGODB_URI_CURATOR`, `MONGODB_URI_SCORER`, `MONGODB_URI_DASHBOARD`: ask Kishore privately,
  or run `./sightline.sh db local` to create your own. Never commit them.

**Look before you run.** These cost nothing:

```bash
python puzzle_draft/storm_run.py preview NYC1 12 5            # exact text Jev sees under the baseline
python puzzle_draft/storm_run.py preview NYC1 12 5 --genome puzzle_draft/storm_reference/ref_full.json
open out/storm/truth_sheet.png                                  # the 9 storms (after `world`)
```

**What a loop prints.** One line per generation: gen, status, dev, val, gate, tokens, seconds and the curator's
hypothesis. Maps land in `out/storm/runs/<run>_gXX/`; the lineage goes to Atlas `policies` and
`out/storm/lineage/<run>.jsonl`; the best genome goes to `out/storm/lineage/<run>_best.json`.

**Cost and time.** Each generation is 3,111 Jev calls: about $0.12 and about a minute, plus $0.01–0.04 and
20–90 s for the curator. Replays are free, because every Jev answer is cached in `puzzle_draft/cache/`. `--fake`
costs nothing but ignores glosses, so its numbers prove only that the pipeline runs.

### Running your own live runs (several people, one database)

Everyone's local backend writes to the same Atlas database with the logins in their own `.env`; the dashboard
reads it live. A run shows up within seconds, identified by its run id.

- **Use a unique `--run` name** (`kishore-3`, `brayden-4`). Lineage is keyed by run and generation, so a shared name
  overwrites the other person's generations.
- **See it:** `story.html?run=<id>` (add `&view=arena` for the replay; refresh for new generations) or
  `/api/state?run=<id>`. The judge demo stays pinned to `DEMO_RUN`, and the start page changes only on `publish`.
  `/api/state` without `?run=` returns the newest run.
- **Same machine for `--resume` and `final`:** the Jev cache, digests, local lineage and best genome live in `out/`.
- **Same storm files:** after pulling, run `python puzzle_draft/storm_run.py build` (deterministic). Don't rerun
  `./sightline.sh world` unless the world version changes: it reloads the shared `reports`.
- **Once-only scoring is shared:** `final` writes to the shared `heldout_scores`, once per genome and world version.
  Agree before running it.
- **Make a run the demo:** `DEMO_RUN=<run> ./sightline.sh publish && ./sightline.sh deploy`, after its `final`.

## Score tonight's storm (once)

Run this only once the final genome is chosen. It needs a Jev key and `MONGODB_URI_SCORER`.

```bash
./sightline.sh final live-2       # baseline (gen 0) on NYC1, then live-2's best genome on NYC1 + MIA2/HOU2/NOL2
./sightline.sh publish && ./sightline.sh deploy        # DEMO_RUN=<run> ./sightline.sh publish for another run
```

`live-2` has been scored (gen 7); `live-1` was scored on the earlier world. The baseline is scored once per world
version, and each run is shown next to the baseline from its own world.

- It's about 3,800 Jev calls, roughly $0.15.
- It writes `heldout_scores` plus the map rows the demo shows. It refuses to score a genome twice.
- After `publish`, the start page and the demo switch from the validation storm to tonight's storm, and the
  "city it never saw" panel fills in.
- Never feed these numbers back into the loop.

## Dashboard and stage demo

**Start page:** https://sightline-jev.vercel.app shows the pitch, the held-out results, the learned rules, the
tripwire denial, both architecture diagrams and links to each beat. It's static, so it works even if the database is unreachable. Its
numbers come from `dashboard/lib/headline.json`, written by `./sightline.sh publish`.

**Default demo:** https://sightline-jev.vercel.app/story.html is Brayden's click-through story with the
**Story / Live arena** switch, fed by the recorded run `live-2` through `demo/src/live.js`:

- **Story tab** (Calm night, Storm hits, Generation 0, Fitness signal, Evolution, Replay, Any city): real maps,
  reports, the exact lines Jev read ("Now reading block…"), real misreads, the recorded lineage, tonight's
  once-only score and the three cities.
- **Live arena:** replays the recorded run generation by generation: the real hypotheses, backtest maps, gate
  verdicts and validation scores, labeled as a replay. A new run is started from the backend
  (`./sightline.sh loop`), not from the browser, so judges can't spend credit and the scorer login never sits on
  a public service.
- `?beat=N` jumps to a step; `?view=arena&autostart=1` opens the arena already playing. Both pages are pinned to
  `live-2` (`DEMO_RUN=<run> ./sightline.sh publish` to pin another run; `?run=live-1` shows the earlier run).
- The example-data version stays at `/story-example.html`, with a banner.
- **← Home** in the presenter bar (both demo pages) returns to the start page.
- For a traced run, the arena links each generation to its LangSmith trace.

**Seven-beat version:** https://sightline-jev.vercel.app/sightline.html is the same story as seven beats, fed by
the same recorded run:

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

**API** (read-only `dashboard` login, server-side only; cross-origin GET allowed):

| Endpoint | Returns |
|---|---|
| `GET /api/state?run=live-2` | `run` {id, used, status, cost_usd, best_gen}; `refs` {baseline, ceiling: {dev, val}}; `gens` [{gen, parent, status, gate, dev, val, life_safety_found, false_dispatches, hypothesis, refuted_if, prediction, ops, pipeline, curator, trace_url}]; `heldout`; `probe` |
| `GET /api/map?run=&gen=&town=` | {w, h, mask, states, colors, split, accuracy, cells: [{x, y, pick, conf, correct, truth}]}. Truth appears only where the scorer published it; tonight is empty until scored |
| `GET /api/block?run=&gen=&town=&x=&y=` | {lines: the exact text Jev saw, jev: {pick, conf, probs}, assessment, correct} |
| `GET /api/reports?town=NYC1&until_hour=6` | The report feed in arrival order: [{hour, source, x, y, value, text, verified}] |

Pass `gen` explicitly: the current policy is `gen = state.run.best_gen`. Without `gen`, `/api/map` shows the
newest generation, which may be a rejected one.

**Deploy.** The Vercel project is `sightline-dashboard`, root `dashboard/`, with `MONGODB_URI_DASHBOARD` as a
secret server-side variable (never add a `NEXT_PUBLIC_` variant). The old address,
https://sightline-dashboard.vercel.app, also works.

## LangSmith tracing

Set `LANGSMITH_API_KEY` and `LANGSMITH_TRACING=true` in `.env` (free Developer plan; project `jevly`). Then every
`./sightline.sh loop` generation becomes one trace (`puzzle_draft/tracing.py`):

- **Spans:** prompt + leak check → curator (model, tokens, cost, raw genome or the validation error, per retry) →
  memory check → evaluation (Jev over 3,111 blocks, dev and validation scores, the curator's 30-trace digest) → gate.
- **Feedback on each trace:** dev and validation balanced accuracy, life-safety recall, false dispatches, Brier,
  gate pass.
- **Links:** each generation's `policies.trace_url`, exposed by `/api/state` and shown in the Live arena
  ("Open this generation's LangSmith trace").
- **Blind by design:** the curator never reads LangSmith, and no answer key is sent.
- The first traced run is `live-traced`: https://sightline-jev.vercel.app/story.html?run=live-traced&view=arena
  It uses the real-vocabulary storms, so its numbers aren't comparable with `live-1`. `live-2` ran without a
  LangSmith key, so it has no traces.

**Atlas holds the real-vocabulary world** (loaded for `live-2`, with the new validation storm HOU0). `live-1`'s
recorded lineage, maps and scores are unchanged, but its report feed (`/api/reports`) now shows the new
vocabulary. The answer key is byte-identical in both worlds.

## Results

### `live-2`: the robust loop on the real-vocabulary world (the recorded run the demo shows)

Real Jev (`jev-latest`), a blind Claude curator (a fresh subagent per generation that reads only its prompt), and
the robust gate: paired bootstrap over two validation storms (NYC0 + HOU0), P(better) ≥ 0.90, dev may not drop
more than 1 point, harm may not rise more than 5%. Lessons go to the Atlas `memory` collection and come back via
`$vectorSearch`.

| Gen | Status | Dev | Val (NYC0) | P(better) | Harm Δ | Curator's hypothesis (abridged) |
|---|---|---|---|---|---|---|
| 0 | baseline | 59.5% | 50.3% | – | – | No harness: the 12 reports nearest the block |
| 1 | **kept** | 59.8% | 55.5% | 1.00 | −136 | Social-post hashtags taken as ground truth |
| 2 | **kept** | 63.9% | 63.2% | 1.00 | −75 | Jev can't decode the coded sources (NFIRS fire codes, FEMA damage levels) |
| 3 | rejected | 58.9% | 60.8% | 0.04 | +104 | Relative format so Jev can tell its own block from neighbors |
| 4 | **kept** | 64.8% | 67.0% | 1.00 | −2 | Neighbors' pre-storm-map lines crowd out post-storm evidence |
| 5 | rejected | 64.4% | 66.2% | 0.03 | +98 | Mark 911 collapse / water-rescue calls as unverified |
| 6 | rejected | 65.7% | 64.2% | 0.02 | +70 | Summarize neighbor utility-feed lines as a profile |
| 7 | **kept** | **69.3%** | **69.1%** | 1.00 | −1 | The block's own facility land use (hospital, school shelter) goes unread |
| 8 | rejected | 67.2% | 62.8% | 0.00 | +10 | Hospitals run on backup power |

Builder's hand-written ceiling on this world: dev 69.7%, validation 69.7%. The evolved policy reached it.

**Tonight's storm (NYC1): held out, scored once:** balanced accuracy **57.9% → 67.1%**, false dispatches
**93 → 29**, rescue-critical blocks found **77 → 83 of 101**. **Next season's cities** (frozen gen 7, scored
once): Miami 77.6%, Houston 67.3%, New Orleans 62.5%.

### `live-1`: the simple loop on the first world (kept for comparison)

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

## Robust loop vs naive loop vs random

Does the robust loop matter, or would any loop do? Three arms, the same starting policy, the same Jev,
8 generations each (three runs for robust and naive, two for random):

- **Robust:** everything in [the harness loop](#the-harness-loop). The curator is a blind Claude subagent that
  reads only its prompt file.
- **Naive:** the same curator and the same dev traces, with a generic brief. It keeps any change that raises the
  dev score. No validation gate, guardrails, notebook or diff digest.
- **Random:** no LLM. Random valid edits to the policy, kept on any dev gain. This separates "a smart curator"
  from "8 more tries".

Each run's final policy was then scored **once** on four fresh storms that no arm ever saw (MIA9, HOU9, NOL9,
NYC9). Tonight's NYC1 was not touched.

| Run | Test balanced accuracy (90% CI) | vs baseline | Kept / tried | New Jev calls |
|---|---|---|---|---|
| Baseline | 61.1% (57.7–64.2) | | | |
| **Robust 1** | **70.0%** (67.0–73.1) | +9.0, P 1.00 | 3 / 8 | 5.4k |
| **Robust 2** | **74.9%** (72.4–77.2) | +13.8, P 1.00 | 2 / 8 | 8.4k |
| **Robust 3** (harm cap +5%) | **74.2%** (71.4–76.7) | +13.1, P 1.00 | 2 / 8 | |
| Naive 1 | 67.4% (64.1–70.6) | +6.3, P 0.99 | 5 / 8 | 21.6k |
| Naive 2 | 62.9% (59.6–66.3) | +1.9, P 0.78 | 3 / 8 | 28.5k |
| Naive 3 (clean rerun) | 60.4% (57.1–63.7) | −0.7 | 3 / 8 | |
| Random 1 | 62.1% (58.9–65.4) | +1.1, P 0.69 | 2 / 8 | 13.8k |
| Random 2 | 64.5% (61.3–67.7) | +3.5, P 0.96 | 1 / 8 | |

- **Accuracy.** Compared block for block on the test storms, each robust run beats each naive and random run.
  The smallest margin is Robust 1 over Naive 1: +2.7 points, P 0.99; Robust 3 beats Naive 3 by +13.8, P 1.00.
- **Overfitting.** The naive rule kept changes that looked slightly better on dev but were probably worse on
  validation (Naive 2: dev +0.4, validation −2.5, P 0.13; Naive 3: dev +1.1, validation −0.5, P 0.40). Naive 3,
  run after the prompt bug below was fixed, ended *below* the untouched baseline. The robust gate turned down the
  same kind of change (dev +2.1, validation −0.1).
- **Cost.** The robust loop used 3–4× fewer new Jev calls than the naive loop: the screen and the notebook stop
  weak and repeated ideas before a full evaluation.
- **What it learned** (rules that survived the prune pass): drop social posts; read the city-survey letters as
  damage types; treat a utility "line fault" as downed lines; narrow which neighbor reports Jev sees.
- **Harm.** Every evolved policy cuts false dispatches sharply (298 → 11–135; baseline expected harm 728). With
  the first, strict guardrail the robust runs were slightly worse on harm than naive (505–615 vs 477–496), because
  life-safety recall dipped 1–3 points. With the 5% cap, Robust 3 is level with Naive 3 (about 564 vs 576) while
  scoring 13.8 points higher.

**Caveats.** The lab ran on the world version from before the real-vocabulary cutover, so its numbers aren't
comparable with `live-1`'s. Two harness bugs were found and fixed during the runs: the naive prompt mislabeled a
rejected candidate's traces for three generations of Naive 2 (Naive 3 is the clean rerun), and one robust
generation was wrongly skipped as a repeat and then re-scored. The first harm guardrail (no rise at all) rejected
a +5.9-point, P 1.00 validation win over two extra false dispatches; it now allows a 5% rise (Robust 3).

## Status

| Area | Status |
|---|---|
| Storm world: 9 city-shaped storms, 12 states, 8 sources, coverage assertion | Done; real-vocabulary world loaded in Atlas |
| MongoDB Atlas: schema, three locked logins, tripwire probe, integration test | Done |
| Harness + ops → pipeline compiler + scorer via the scorer login | Done |
| Automatic loop with gate, leak guard, memory check, lineage | Done; `live-1` (13 generations, simple gate) and `live-2` (8 generations, robust gate) |
| Robust loop: bootstrap gate on 2 validation storms, harm guardrail, Atlas vector notebook, diff digest | Done in `driver.py`; `live-2` ran 8 generations on it (the lab's prune pass is not ported) |
| Dashboard API (39/39 checks for `live-2` and `live-1`), start page, story + arena on live data, offline fallback | Done, live at https://sightline-jev.vercel.app, pinned to `live-2` |
| One-command backend (`sightline.sh`) | Done |
| Tonight's storm + cities scored once | Done: `live-2` NYC1 57.9% → 67.1%, false dispatches 93 → 29 (`live-1`: 62.7% → 67.0%, 131 → 72) |
| Video | To record |
| LangSmith traces | Done (`live-traced`; `live-2` ran without a LangSmith key) |
| Field-verified spot check | Not done (optional; cut first) |

**Remaining, in order.**

1. Record the video; add its link to `VIDEO_URL` in `dashboard/app/page.tsx`; `./sightline.sh deploy`.
2. Submit.

The `live-2` build is deployed and validated (39/39 API checks for `live-2` and `live-1`).

## What we learned

- **Calibrate the world before you trust the loop.** Our first world was too easy: the baseline reached 62% and
  a hand-written ceiling only 63.8%, which left the curator nothing to find. Sparser, messier sources opened a
  15-point gap.
- **Jev handles neighbor reports better than we expected.** Its real weak spots were unfamiliar scales and
  "verified" viral posts. On the first world, filtering the rumors cut false dispatches from 265 to 62 in the
  builder policy.
- **Well-meant context can hurt.** A cautious gloss on the utility feed dropped `power_out` accuracy from 82% to
  71%. A neighbor flood summary pulled 238 intact blocks to "flooded".
- **Some states are invisible without the right source.** Shelters and operating hospitals were right about 10%
  of the time until the pre-storm map listed facilities.
- **An open model can curate from traces alone.** GLM-5.2 found the rumor problem in its first generation, with
  no hints about the planted habits.
- **The gate does its job, and has a cost.** It rejected 9 of 11 scored proposals. One of them (gen 4) was a real
  +0.8 on validation, just under the 1-point noise margin, and validation then stayed at 72.1% for ten
  generations. A fixed margin on one storm is the wrong tool: the bootstrap gate on two storms asks how likely a
  change is to help, not whether it cleared a line.
- **Keeping whatever scores higher overfits.** The naive loop kept 11 of 24 changes and still finished below every
  robust run on fresh storms; its clean rerun ended below the untouched baseline.
- **A harder world makes a better demo.** On the real-vocabulary world the baseline starts hazier (50.3% on
  validation), and `live-2` climbed in steps (social posts, then the coded sources, then neighbor noise, then
  facility land use) to the builder's ceiling.
- **A guardrail that is too strict costs twice.** It rejects the win, and then the notebook records the idea as a
  failure and blocks similar ones.
- **Operations matter at hackathon speed.** Curator replies sometimes come back empty (hidden reasoning uses up
  the token budget), and Jev calls need purchased credit. The driver now retries, logs the provider, and the demo
  ships a snapshot so it never depends on a live service.

**Still to try.**

- Port the lab's screen and prune pass into `driver.py`.
- A deep-agent curator with a `validate_genome` tool and an in-memory file system only.
- A per-account exclusion op.
- Real data: NYC 311 open data and FEMA damage assessments.
- LangSmith experiments per generation.

## Video and submission

**Video (2–3 minutes).**

1. Screen-record https://sightline-jev.vercel.app/story.html through its seven Story steps.
2. Switch to **Live arena** (or open `story.html?view=arena&autostart=1`) to show the recorded generations replay.
3. Cut to a terminal running `./sightline.sh loop` (one line per generation) and, if traced, one LangSmith trace.
4. Show the tripwire probe line.

Every number on screen is from the recorded run.

**Submission.**

- Demo: https://sightline-jev.vercel.app
- Code: https://github.com/hughesbrayden/sightline (start at this file)
- Video: the recording

**Safety.** The dashboard holds only the read-only login, and it can't read the answers. Never share the admin or
scorer credentials.

---

The hurricane storms are simulated; the city outlines are stylized.
