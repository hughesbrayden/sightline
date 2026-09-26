# ScoreCurve

Plots balanced accuracy by generation: training in `series-train`, held-out in `series-heldout`, baseline dashed.

**The consumer provides** `train` and optionally `heldout` as arrays of 0–1 scores, one per generation, plus `baseline`. The y-axis defaults to 40–100; set `min` and `max` to zoom.

**Rules**
- Every line is drawn to one scale; grid lines sit at each 10 points and are labeled.
- The last value of each series is printed at its endpoint, so the headline number needs no legend lookup.
- The held-out line is shown every generation, but it is never what the gate uses. Say so in the caption when it's on a slide.
- Use it up to three series. More series means a different chart.
