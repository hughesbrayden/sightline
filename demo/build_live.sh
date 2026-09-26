#!/usr/bin/env bash
# Build the Sightline demo wired to the live dashboard API (the recorded harness run in MongoDB).
#   bash demo/build_live.sh          ->  dashboard/public/sightline.html  (the seven-beat app, src/app.js)
#   bash demo/build_live.sh story    ->  dashboard/public/story.html      (the click-through story + arena, src/story.js)
# Both are pinned to RUN (default live-1) so a new run in MongoDB never switches the demo mid-presentation.
# Query params: ?run=live-1 picks a run; ?api=https://host uses another API; ?scenario=1 shows the illustrative story.
set -euo pipefail
cd "$(dirname "$0")"
DS=../ds-sightline/project/components
APP=${1:-app}
RUN=${RUN:-live-1}
if [ "$APP" = story ]; then OUT=../dashboard/public/story.html; else OUT=../dashboard/public/sightline.html; fi
mkdir -p "$(dirname "$OUT")"
{
cat <<'HEAD'
<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sightline</title>
<meta name="description" content="Sightline: a frozen model, a harness that evolves how it reads hurricane reports. Live data from the recorded run.">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@75..125,500..700&family=IBM+Plex+Sans:wght@400;500;600&family=JetBrains+Mono:wght@300;400;500&display=swap">
<style>
:root { color-scheme: light; }
HEAD
awk '/\[data-theme="dark"\] \{/{skip=1} !skip{print} skip && /^\}/{skip=0}' src/tokens.css | sed 's/^:root, \[data-theme="light"\] {/:root {/'
cat "$DS/bundle.css"
cat src/app.css
[ "$APP" = story ] && cat src/story.css
cat <<'MID'
</style></head><body>
<div id="frame"><div id="wrap"><div id="stage" role="application" aria-label="Sightline demo"></div></div></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/htm@3.1.1/dist/htm.umd.js"></script>
<script>
MID
cat "$DS/bundle.js"; echo '</script><script>'
cat src/scenario.js; echo '</script><script>'
cat src/live.js; echo '</script><script>window.__sightlineApp = function () {'
if [ "$APP" = story ]; then cat src/story.js; else cat src/app.js; fi; echo '};</script>'
echo "<script>window.SIGHTLINE_RUN = '$RUN';</script>"
cat <<'BOOT'
<script>
(function () {
  var q = new URLSearchParams(location.search), stage = document.getElementById('stage');
  if (q.get('scenario')) { window.__sightlineApp(); return; }
  stage.innerHTML = '<div style="padding:48px;font:15px IBM Plex Sans, sans-serif;color:#555">Loading the recorded run from MongoDB…</div>';
  if (q.get('snapshot')) window.SIGHTLINE_FORCE_SNAPSHOT = true;
  SightlineLive.load(q.get('api') || '', q.get('run') || window.SIGHTLINE_RUN || '').then(function () {
    stage.innerHTML = ''; window.__sightlineApp();
  }).catch(function (e) {
    stage.innerHTML = '<div style="padding:48px;font:15px IBM Plex Sans, sans-serif">Could not load live data (' + e.message +
      '). <a href="?scenario=1">Open the illustrative scenario</a>.</div>';
  });
})();
</script></body></html>
BOOT
} > "$OUT"
echo "Built $OUT ($(wc -c < "$OUT") bytes)"
