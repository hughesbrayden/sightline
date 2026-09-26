# Sightline

Sightline is the interface for a harness that teaches itself what a fast decision model should see. A hidden pixel picture gets decided one pixel at a time by Jev, which only sees 12 pieces of evidence per pixel. The harness evolves how those 12 slots are filled, and the picture sharpens generation by generation. "Sightline" is a working name.

The look is a lab instrument: quiet, precise chrome with first-class numbers, so the colorful pictures are the only loud thing on screen. Everything here serves three surfaces: the live dashboard, the pitch deck and the demo video.

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

Example data in the previews is illustrative, not measured.
