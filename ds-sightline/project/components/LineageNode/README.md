# LineageNode

One generation in the lineage tree: its number, training score, change against its parent, and outcome.

**The consumer provides** `gen`, `status` (`accepted`, `rejected`, `pending`, `skipped`), and for finished generations `score` and `delta` on a 0–1 scale (0.038 renders "+3.8"). Pass `onClick` to make it a button; `active` marks the generation on screen.

**Rules**
- Accepted nodes are solid; rejected and skipped nodes are dashed on `surface`, so the surviving line reads at a glance.
- Only one node is `active` at a time. It gets the `accent` outline.
- Scores are training scores. Held-out numbers belong in ScoreCurve, never in a node, so no one mistakes them for what the gate selected on.
- Draw connectors between nodes with 1px `line`; the component doesn't draw them.
