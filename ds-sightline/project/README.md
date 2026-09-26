# Sightline

Sightline is the interface for a harness that teaches itself what a fast decision model should see. After a hurricane, Jev classifies every city block into one of 12 damage states from messy reports (911 calls, social posts, drone passes, utility feeds, agency surveys), seeing only 12 lines per block. The harness evolves how those lines are chosen, storm after storm, and the damage map sharpens. "Sightline" is a working name.

The look is a lab instrument: quiet, precise chrome with first-class numbers, so the map is the loudest thing on screen. Everything here serves two surfaces: the live demo and the backup video.

## The spine: the harness evolves, not the model

Jev is frozen and the data doesn't change. The storm is only the environment where fitness is measured. Screens name each part of the loop the same way:

| Evolution | In the harness | On screen |
| --- | --- | --- |
| Variation | The curator proposes one change, with a hypothesis and a prediction | Generation card |
| Fitness | A backtest on past storms, scored against finished assessments | Backtest score and map |
| Selection | The gate keeps a change only if the validation town improves | Kept / rejected verdict |
| Heredity | Kept changes stack into the lineage | `LineageTree` main line |
| Memory | Rejected ideas are remembered and never retried | "Skipped: too close to gen 2" |
| Adaptation | The frozen policy on tonight's storm, scored once | Before/after replay |

- Say "generation", never "run" or "epoch". Generation 0 is the unevolved harness.
- The final policy is shown as plain rules (`PolicyRules`), each tagged with the generation that found it. That card is the product.
- Why there's a gate, in one line: an ungated loop climbed from 46% to 93% on its own storms while held-out fell from 50% to 45%.

## Damage maps

- A map is a 32×32 grid of blocks (`DamageMap`), with streets as 1px gaps, `map-water` for rivers and harbor, and `map-park` for open land. Scenery is never scored.
- **On damage maps, color means severity.** Fills run `dmg-intact` → `dmg-minor` → `dmg-street` → `dmg-home` / `dmg-wind` → `dmg-major` → `dmg-destroyed`. Flood blues and wind orange stay separable for color-blind viewers.
- Services are glyphs in `map-glyph` on `dmg-intact`, never extra fills: plus = hospital operating, triangle = shelter open, cross = road blocked, bolt = power out. Fire is a `map-fire` dot on `dmg-major`.
- Rescue-critical states are homes flooded, major damage, destroyed and fire. Lead with how many of those Jev found ("148 of 171") before overall accuracy.
- Scores are always "blind first look" (the policy before this storm's assessment arrived) or "after tuning". Label which.
- The `px-*` palette belongs to the earlier pixel-puzzle mockups; don't use it on maps.

## Voice

Write like an instrument readout with a person behind it: short, plain, specific, numbers first.

- Do: "Gen 14 · +3.8 pts held-out", "Dropped sensors S4 and S7", "Read denied: the mutator can't see the answers."
- Do: name the thing people recognize: *picture*, *pixel*, *generation*, *held-out puzzles*, *evidence*.
- Don't: hype ("revolutionary", "magic"), exclamation marks, emoji, or internal names on screen (`genome_v3.json`, collection names) unless the slide is about architecture.
- Numbers: one decimal for scores in points ("71.9"), signed deltas with a real minus ("−1.2"), latencies in whole ms ("165 ms"), counts as "231/256 right".

## Visual foundations

### Two palettes that never mix
- **UI colors** (`surface`, `ink`, `accent`, `good`, `warn`, `critical` and friends) change with the theme and carry meaning: selection, outcomes, series.
- **Puzzle colors** (`px-void`, `px-paper`, `px-red`, `px-orange`, `px-yellow`, `px-green`, `px-blue`, `px-brown`) are picture content. They are identical in both themes and never mean "good" or "bad". A green pixel is grass, not success.

Keep them apart and the viewer never has to ask whether a color is data or status.

### Color roles
- `surface` for the page, `surface-raised` for panels and cards, `surface-sunken` as the well behind puzzle grids and charts.
- `ink` for text and numbers; `ink-muted` for labels and axes. Both pass 4.5:1 on every surface in both themes.
- `accent` (signal teal) marks the one thing in focus: the active generation, the selected puzzle, focus rings. It is also the training series, because training is what the gate optimizes.
- `series-heldout` (burnt orange) is the held-out line. Teal against orange stays separable for color-blind viewers and in grayscale.
- `good`, `warn` and `critical` are for outcomes only (gate passed, deadline, rejected or denied), each with a `-soft` ground for badges.

### Confidence and errors
- Confidence is opacity: `conf-floor + (1 − conf-floor) × confidence`, with `conf-floor` at 0.15. An unsure pixel is faint, never gone.
- A wrong pixel keeps its (wrong) color and gets an outline of `ink` inside `surface-raised`. Never recolor errors red; the red pixels in the picture would hide them.

### Type
- **Archivo** (`--font-display`) for the product name, screen titles and headline numbers on slides. At most one `display` per screen.
- **IBM Plex Sans** (`--font-sans`) for everything people read: `h2`, `body`, `small`, and `label` (11px, uppercase, tracked 0.08em) for knob names, axis titles and node headers.
- **JetBrains Mono** (`--font-mono`) for every number: `num` and `num-lg`, always with `font-variant-numeric: tabular-nums`, so columns of scores line up and ticking numbers don't jitter.

Load the fonts from Google Fonts on each surface:

```html
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@75..125,500..700&family=IBM+Plex+Sans:wght@400;600&family=JetBrains+Mono:wght@400;500;600&display=swap">
```

### Space, radius and the cell
- Spacing steps: `space-1` 4px, `space-2` 8px, `space-4` 16px, `space-6` 24px. Panel padding is `space-4`; gaps between panels are `space-6`.
- `cell` is 12px, so a 16×16 puzzle is 192px square. Showcase grids use 24px cells.
- Radii: `radius-cell` 0 (pixels are square, always), `radius-sm` 2px for badges, `radius-md` 6px for nodes and buttons, `radius-lg` 10px for panels and cards.
- Borders do the separating: 1px `line`. No drop shadows.

### Charts
- Plot on `surface-raised` or `surface-sunken`, with grid lines in `line` and axis text in `ink-muted` mono at 10px.
- Print each series' last value at its endpoint.
- Baselines are dashed `series-baseline`.
- Scores are balanced accuracy in points (0–100). Plain accuracy is misleading here because pictures are mostly background.

### Motion
One kind of motion: pixels settling. When a new generation lands, cells ease their opacity and color over 240ms. Nothing else animates, and nothing animates under `prefers-reduced-motion`.

### Iconography and logo
There is no logo yet; set "Sightline" in Archivo 600 where a mark would go. Markers are small squares, solid for a state that happened and hollow for one that didn't (rejected, skipped, denied), echoing the pixel cell. No icon set, no emoji.

## Components

`window.Sightline`, React 18:
- `PuzzleGrid`: the picture, with confidence as opacity and wrong cells outlined.
- `StatusBadge`: gate passed, rejected, skipped (seen before), read denied or running.
- `LineageNode`: one generation's chip in the lineage tree.
- `ScoreCurve`: training vs held-out by generation, with the baseline.
- `DiffCard`: one mutation's changes to the four knobs, predicted vs actual.
- `DamageMap`: a 32×32 block map with severity fills, service glyphs and guess, assessment or difference modes.
- `DamageLegend`: the 12 damage states and how each is drawn.
- `LineageTree`: the harness's evolution; kept changes on the main line, rejected and memory-skipped ideas as dead ends.
- `PolicyRules`: the evolved policy as plain rules, each tagged with the generation that found it.

Example data in the previews is illustrative, not measured.
