# Sightline demo (click-through)

A standalone, full-screen page for presenting the idea on stage. It shows the evolution spine: **Jev is frozen; the harness evolves how it reads the reports.**

Open `sightline-demo.html` in a browser (it loads React 18 and htm from public CDNs), or use the published version: https://claude.ai/artifact/DDSaEo6nZMeL8NLGVSiXs4

## Five beats

1. **Generation 0.** Reports stream onto a 32×32 map of Lower Manhattan and the Brooklyn waterfront. "Run generation 0" maps every block with the unevolved harness; its top dispatch is a rumor.
2. **The fitness signal.** The official assessment arrives and shows where generation 0 failed (four misreads).
3. **Evolution, live.** Generation card (hypothesis → prediction → backtest fitness → validation selection → verdict), a `LineageTree`, and a supporting score curve. Generation 2 is the trap: the backtest rises but validation falls, so the gate rejects it. Generation 6 is skipped by memory.
4. **Replay.** The evolved harness on the same night, scored once.
5. **What it learned.** The final policy as plain rules (`PolicyRules`), each tagged with its generation, plus a town it never saw.

Press **Start evolution** in the presenter bar before beat 1; it keeps running in the background. Use the buttons on each screen, the step pills, or the ← → keys.

## Files

- `src/app.js`: the app (React 18 + htm, no build step).
- `src/app.css`: page and layout styles.
- `src/scenario.js`: the example scenario (stylized maps, storms, generations). **All data is illustrative**, except the v4 origin numbers on the gate card (46% → 93% dev, 50% → 45% held-out).
- `src/tokens.css`: the Sightline tokens compiled to CSS variables.
- Components come from `../ds-sightline/project/components/bundle.js` (`window.Sightline`: `DamageMap`, `DamageLegend`, `LineageTree`, `PolicyRules`, `ScoreCurve` and more).

## Rebuild

```bash
bash demo/build.sh
```

Next step for real data: swap `src/scenario.js` for the dashboard API (`dashboard/app/api/*`) so the generations, lineage and rules come from the real loop.
