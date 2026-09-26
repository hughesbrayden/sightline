#!/usr/bin/env bash
# Sightline backend: one entry point for the storm world, the self-tuning harness, scoring, and the dashboard feed.
#
#   ./sightline.sh <command> [options]
#
# Setup
#   setup                      install Python + dashboard deps; create .env from .env.example if missing
#   preflight                  check every access path: OpenRouter, Jev, curator LLM, MongoDB logins
#   db local|atlas             create the jevly schema + locked logins (local Docker, or cloud Atlas via Atlas CLI),
#                              then prove the lock: permission check + tripwire probe
# Data
#   world                      generate the 8 simulated storms (deterministic), render truth maps, load into MongoDB
# Harness
#   calibrate                  baseline vs the builder's reference policy on real Jev (floor and ceiling) -> refs
#   loop [--gens N] [--run ID] [--resume] [--fake | --local]
#                              the automatic loop: curator proposes, Jev maps, scorer grades, gate keeps or rejects
#   final <run>                score tonight's storm + next season's cities ONCE with the run's best genome
#                              (and the baseline on tonight, for the before/after). Never fed back into the loop.
# Dashboard feed
#   publish [api-url]          record DEMO_RUN (default live-2) for the offline fallback + start page; rebuild the demo pages
#   dashboard                  run the dashboard locally (http://localhost:3000)
#   deploy                     deploy the dashboard to Vercel (production)
#   validate [url]             39 contract checks against the dashboard API
# All at once
#   all [--gens N] [--run ID]  preflight -> world -> calibrate -> loop -> publish   (does NOT run `final`)
#
# Cost on real Jev: about $0.12 of Jev + $0.01-0.04 of curator per generation (3,111 blocks). `--fake` costs
# nothing but ignores glosses, so its numbers prove plumbing only.
set -euo pipefail
cd "$(dirname "$0")"
PY=${PYTHON:-python3}
API_URL=${SIGHTLINE_API:-https://sightline-jev.vercel.app}
DEMO_RUN=${DEMO_RUN:-live-2}  # the run the judge demo is pinned to (publish records + builds it)
say() { printf '\n\033[1m== %s\033[0m\n' "$*"; }

cmd_setup() {
  say "Python deps"; $PY -m pip install -q -r requirements.txt
  say "Dashboard deps"; (cd dashboard && npm install --silent)
  if [ ! -f .env ]; then cp .env.example .env; echo "created .env from .env.example: fill in OPENROUTER_API_KEY and MONGODB_URI_*"; fi
}

cmd_preflight() { say "Preflight"; $PY puzzle_draft/preflight.py; }

cmd_db() {
  case "${1:-}" in
    local) say "Local Atlas container"; docker compose up -d
           for _ in $(seq 1 30); do docker inspect -f '{{.State.Health.Status}}' jevly-mongo 2>/dev/null | grep -q healthy && break; sleep 2; done
           $PY puzzle_draft/mongo_setup.py setup ;;
    atlas) say "Cloud Atlas (MONGODB_URI_ADMIN in .env; Atlas CLI logged in)"
           $PY puzzle_draft/mongo_setup.py setup
           $PY puzzle_draft/mongo_setup.py atlas --apply ;;
    *) echo "usage: $0 db local|atlas"; exit 2 ;;
  esac
  say "Prove the lock"; $PY puzzle_draft/mongo_setup.py check; $PY puzzle_draft/mongo_setup.py probe --run setup
  $PY puzzle_draft/mongo_itest.py
}

cmd_world() {
  say "Generate storms (coverage assertion)"; $PY puzzle_draft/storm_run.py build
  say "Truth maps (builder only)"; $PY puzzle_draft/storm_run.py truth
  say "Load into MongoDB (admin login)"; $PY puzzle_draft/storm_run.py load
}

cmd_calibrate() {
  say "Floor: baseline (12 nearest reports)"; $PY puzzle_draft/storm_run.py run puzzle_draft/storm_genomes/baseline.json
  say "Ceiling: builder's reference policy"; $PY puzzle_draft/storm_run.py run puzzle_draft/storm_reference/ref_full.json
  say "Store refs for the dashboard"; $PY puzzle_draft/storm_run.py refs
}

cmd_loop() {
  local gens=8 run="" extra=()
  while [ $# -gt 0 ]; do
    case "$1" in
      --gens) gens=$2; shift 2 ;;
      --run) run=$2; shift 2 ;;
      --resume) extra+=(--resume); shift ;;
      --fake) extra+=(--backend fake --no-mongo --truth file); shift ;;
      --local) extra+=(--no-mongo); shift ;;  # real Jev + curator, lineage kept local (dashboard untouched)
      *) echo "unknown option $1"; exit 2 ;;
    esac
  done
  [ -n "$run" ] && extra+=(--run "$run")
  say "Harness loop: $gens generations"
  $PY -u puzzle_draft/driver.py --gens "$gens" ${extra[@]+"${extra[@]}"}
}

cmd_final() {
  local run=${1:?usage: $0 final <run>}
  local best="out/storm/lineage/${run}_best.json"
  [ -f "$best" ] || { echo "no $best: finish a loop for $run first"; exit 1; }
  local gen; gen=$($PY -c "import json,re;print(int(re.search(r'_g(\d+)$', json.load(open('$best'))['id']).group(1)))")
  cp "$best" "puzzle_draft/storm_genomes/${run}_best.json"
  say "Once-only: baseline on tonight's storm (the 'before')"
  $PY puzzle_draft/storm_run.py run puzzle_draft/storm_genomes/baseline.json --split heldout --final --run "$run" --gen 0 || true
  say "Once-only: gen $gen of $run on tonight's storm + next season's cities"
  $PY puzzle_draft/storm_run.py run "puzzle_draft/storm_genomes/${run}_best.json" --split heldout,cities --final --run "$run" --gen "$gen"
  echo "Now run: $0 publish && $0 deploy"
}

cmd_publish() {
  local url=${1:-$API_URL}
  say "Record the run for the offline fallback + start page ($url)"; node demo/snapshot.mjs "$url" "$DEMO_RUN"
  say "Build the stage demo on live data ($DEMO_RUN)"; RUN=$DEMO_RUN bash demo/build_live.sh
  say "Build the click-through story + arena on live data (the default demo) -> /story.html"; RUN=$DEMO_RUN bash demo/build_live.sh story
  say "Build the example-data story (bannered) -> /story-example.html"; bash demo/build.sh
  $PY - <<'PYEOF'
import pathlib
src = pathlib.Path("demo/sightline-demo.html").read_text()
banner = ('<div style="position:fixed;top:0;left:0;right:0;z-index:9999;background:#a44a14;color:#fff;'
          'font:13px IBM Plex Sans,sans-serif;padding:6px 12px;text-align:center">Illustrative walkthrough with example data. '
          'The recorded run is at <a href="/story.html" style="color:#fff;font-weight:600">/sightline.html</a>.</div>')
pathlib.Path("dashboard/public/story-example.html").write_text(src.replace('<div id="frame">', banner + '<div id="frame">', 1))
PYEOF
}

cmd_dashboard() {
  [ -f dashboard/.env.local ] || grep -h "^MONGODB_URI_DASHBOARD=" .env > dashboard/.env.local
  (cd dashboard && npm run dev)
}

cmd_deploy() { say "Vercel production deploy"; (cd dashboard && vercel deploy --prod --yes); }

cmd_validate() { say "API contract"; $PY dashboard/scripts/validate_api.py "${1:-$API_URL}"; }

cmd_all() {
  local gens=8 run=""
  while [ $# -gt 0 ]; do case "$1" in --gens) gens=$2; shift 2 ;; --run) run=$2; shift 2 ;; *) shift ;; esac; done
  cmd_preflight; cmd_world; cmd_calibrate
  if [ -n "$run" ]; then cmd_loop --gens "$gens" --run "$run"; else cmd_loop --gens "$gens"; fi
  cmd_publish
  echo; echo "Done. Next: '$0 deploy' to publish; '$0 final <run>' once, at the very end."
}

usage() { sed -n '2,/^set -euo/p' "$0" | sed '$d' | sed 's/^# \{0,1\}//'; }

c=${1:-help}; shift || true
case "$c" in
  setup|preflight|db|world|calibrate|loop|final|publish|dashboard|deploy|validate|all) "cmd_$c" "$@" ;;
  help|-h|--help) usage ;;
  *) echo "unknown command: $c"; usage; exit 2 ;;
esac
