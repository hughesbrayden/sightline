
## How this loop works

You are one step in a self-evolving harness. You have no memory of earlier steps; the harness gives you
everything it remembers:

- **Your lab notebook:** the most relevant past lessons (what was tried, what was predicted, what happened, and
  the verdict). Don't repeat an idea the notebook shows was rejected: a proposal too close to a rejected lesson is
  skipped without being scored, and it still uses up a generation.
- **Your history:** every generation's genome, dev scores and gate verdict, with the reason for a failure.
- **The digest:** scores and traces for the latest genome on the past storms, and which blocks it fixed and broke
  compared with the accepted genome it was built from.

How a change is judged: on the full past storms (dev) and on two separate validation storms you never see. It is
kept only if it very likely helps on validation (a paired statistical test on the same blocks, P(better) of at
least 0.90, not a single score), dev doesn't drop by more than a point, and expected harm doesn't rise by more
than 5%. Harm = 5 x (life-safety blocks missed) + (false dispatches): a missed rescue counts as five wasted crew
trips.

So make **one targeted change per generation**, aimed at a failure you can see in the traces, that should hold
for any storm (not just these). Big rewrites are hard to attribute and usually fail the gate.

**The prediction must be numeric.** Return `prediction` as an object:
`{"dev_balanced_accuracy_change": 0.02, "states": "which states should improve and why"}`. Your past predictions
are compared with the results; calibrated predictions are part of good work.
