# Sightline demo (click-through)

A standalone, full-screen page for presenting the idea on stage. It shows the evolution spine: **Jev is frozen; the harness evolves how it reads the reports.**

Open `sightline-demo.html` in a browser (it loads React 18 and htm from public CDNs), or use the published version: https://claude.ai/artifact/DDSaEo6nZMeL8NLGVSiXs4

## Seven beats

1. **Calm night.** 1,024 blocks, all quiet. Generation 0 of the harness is deployed; Jev is frozen for the whole demo.
2. **Storm hits.** Reports stream onto the map: 911, 311, drone passes, social posts, a utility feed with swapped coordinates. Suspicious ones are ringed.
3. **Generation 0.** The unevolved harness maps every block. Its top dispatch is a rumor.
4. **The fitness signal.** The official assessment arrives and shows where generation 0 failed.
5. **Evolution, live.** Generation card (hypothesis, prediction, backtest fitness, validation selection, verdict), a `LineageTree`, a supporting score curve, and tonight’s generation 0 map waiting beside it. A trap generation is rejected by the gate; a repeat idea is skipped by memory.
6. **Replay.** The evolved harness on the same night, scored once; each misread is tagged with the generation that fixed it.
7. **What it learned.** The final policy as plain rules (`PolicyRules`), each tagged with its generation; the closing facts; and a city it never saw, with generation 0 in each new city starting further ahead (scenario mode).

Press **Start evolution** in the presenter bar before beat 1; it keeps running in the background. Use the buttons on each screen, the step pills, or the ← → keys.

## Files

- `src/story.js` and `src/story.css`: the click-through story with the Story / Live arena switch, built by `build.sh` into `sightline-demo.html` (example data).
- `src/app.js`: the seven-beat app used by the live-data page (`build_live.sh`, fed by `src/live.js`).
- `src/app.css`: page and layout styles.
- `src/scenario.js`: the example scenario (stylized maps, storms, generations). **All data is illustrative**, except the v4 origin numbers on the gate card (46% → 93% dev, 50% → 45% held-out).
- `src/tokens.css`: the Sightline tokens compiled to CSS variables.
- Components come from `../ds-sightline/project/components/bundle.js` (`window.Sightline`: `DamageMap`, `DamageLegend`, `LineageTree`, `PolicyRules`, `ScoreCurve` and more).

## Rebuild

```bash
bash demo/build.sh
```

Next step for real data: swap `src/scenario.js` for the dashboard API (`dashboard/app/api/*`) so the generations, lineage and rules come from the real loop.
