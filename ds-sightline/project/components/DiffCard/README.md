# DiffCard

Shows what one mutation changed in the context policy, what the mutator predicted, and what the gate measured.

**The consumer provides** `gen`, optional `parent`, `changes` (each with a `knob` of retrieve, derive, suppress or represent, an `op` of add, remove or change, and one plain sentence), `predicted` and `actual` on a 0–1 scale, and a `status` badge kind.

**Rules**
- One sentence per change, written for a judge, not a log: "Drop sensors S4 and S7: they state 0.90 reliability but score 0.61."
- The four knobs always appear in the genome's order: retrieve, derive, suppress, represent.
- Predicted vs actual sits in the footer in `num` type. Only the actual is colored, because only it is a result.
- Put harness-written aggregation pipelines in a code block below the card, not inside the change text.
