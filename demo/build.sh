#!/usr/bin/env bash
# Builds demo/sightline-demo.html, the click-through story with the Live arena (src/story.js, example data).
# One self-contained page (inline CSS and JS; React 18 and htm from CDNs). The live-data page is build_live.sh.
# Usage: bash demo/build.sh
set -euo pipefail
cd "$(dirname "$0")"
DS=../ds-sightline/project/components
{
cat <<'HEAD'
<title>Sightline Demo</title>
<meta name="description" content="Click-through demo of Sightline: a frozen model, a harness that evolves how it reads hurricane reports.">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@75..125,500..700&family=IBM+Plex+Sans:wght@400;500;600&family=JetBrains+Mono:wght@300;400;500&display=swap">
<style>
:root { color-scheme: light; }
HEAD
# Light theme only: drop the dark block from the compiled tokens.
awk '/\[data-theme="dark"\] \{/{skip=1} !skip{print} skip && /^\}/{skip=0}' src/tokens.css | sed 's/^:root, \[data-theme="light"\] {/:root {/'
cat "$DS/bundle.css"
cat src/app.css
cat src/story.css
cat <<'MID'
</style>
<div id="frame"><div id="wrap"><div id="stage" role="application" aria-label="Sightline demo"></div></div></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/htm@3.1.1/dist/htm.umd.js"></script>
<script>
MID
cat "$DS/bundle.js"; echo '</script>'; echo '<script>'
cat src/scenario.js; echo '</script>'; echo '<script>'
cat src/story.js; echo '</script>'
} > sightline-demo.html
echo "Built demo/sightline-demo.html ($(wc -c < sightline-demo.html) bytes)"
