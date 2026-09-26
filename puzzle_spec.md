Draft v0 (Fri 9/25). Everything here is a starting value to tune on Saturday morning, not a commitment. Decisions to confirm are at the bottom.

## 1. The puzzle in one paragraph

A hidden 16×16 black-and-white image. Jev decides each pixel (on or off) one at a time, seeing only 12 pieces of evidence per pixel. The evidence pool per puzzle is about 2,000 documents in Atlas: some exact, some noisy, some deliberately wrong. The harness evolves how those 12 slots get filled. Ground truth is known per pixel, so scoring is exact and needs no judge.

## 2. Images

- **Size:** 16×16, 2 classes (on/off). Stretch: 32×32, then 4 colors.
- **Source:** generated, not hand-drawn, so we can make as many as we need. Render glyphs from a pixel font and simple shapes into 16×16 bitmaps.
- **Families:** digits, uppercase letters, geometric shapes (circle, cross, arrow, heart, star), and simple icons.
- **Fill rate:** keep images between 25% and 50% on pixels. Reject blank or near-full renders.
- **Seeded:** every puzzle comes from a fixed seed, so any run can be reproduced.

## 3. Evidence types

Each document is one short line of text plus metadata. Counts are per puzzle.

- **Row and column run clues (32 docs, always true).** Nonogram style: "Row 3 runs: 2 4 2". Exact but needs counting, which is Jev's known weak spot. That makes these the natural target for harness-written derived features (for example "row 3 has 8 on pixels; cells 5–8 are inside a run of 4").
- **Sensor reads (about 1,000 docs, noisy).** 8 named sensors each read a random subset of pixels: "[sensor S3, stated reliability 0.90] Pixel (3,5) reads ON." Each sensor has a true reliability between 0.55 and 0.95 that sits only in the truth collection. Two sensors are miscalibrated on purpose: they state 0.90 but perform at about 0.60. Learning to distrust them is a clear, explainable harness win.
- **Neighbor relations (about 450 docs, always true).** "Pixel (3,5) matches pixel (3,6)" or "Pixel (3,5) differs from pixel (4,5)". Useful only once some neighbors are known, which rewards policies that order or derive evidence well.
- **Region hints (about 40 docs, always true).** "Rows 2–6, columns 4–7: 14 of 20 pixels are on." Coarse but reliable.
- **Decoys (about 20% of the pool, false).** Same formats as the true types, but from low-quality sources such as "source: forum-guess" or "source: stale-scan". The source is visible in the text, so a policy can learn to suppress by source.

## 4. What Jev sees per pixel

- **Context budget:** 12 evidence items plus the target line ("Target: pixel at row 3, column 5 of a 16×16 image").
- **Question:** one Choice, "Is the target pixel ON or OFF?", with criteria on and off. Record choice, both probabilities and confidence.
- **One call per pixel** in v1, because every pixel gets its own 12 items. Batching several pixels into one call only helps if they share evidence; revisit after the first run.
- **Cost of one pass:** 256 calls per puzzle. At the measured 70 calls/s, that's about 4 s per puzzle.

## 5. Baseline context policy

Deliberately naive, so the loop has room to improve:

- Vector search on "pixel (r, c)", top 12 by similarity, all evidence types, no source filtering, no derived features, rendered in similarity order.

This should pull in other pixels' clues, decoys and unreliable sensors. If the baseline lands outside the target range in section 7, adjust the difficulty knobs, not the baseline.

## 6. What the harness can change (the genome)

The four knobs from the plan, made concrete:

- **Retrieve:** evidence types to include, how many slots each gets, query templates, and filters (for example exact cell match before vector search).
- **Derive:** harness-written MongoDB aggregation pipelines that produce new evidence lines, such as row fill counts, neighbor majority, or a reliability-weighted sensor vote.
- **Suppress:** drop sources or sensors, or retire derived features that don't help.
- **Represent:** the order and wording of the 12 lines, for example strongest evidence first or grouped by type.

## 7. Scoring

- **Main metric: balanced accuracy** (average of accuracy on on-pixels and on off-pixels). Plain accuracy is a trap here: images are mostly off, so "always off" scores 50–75% and looks like progress.
- **Second metric: confident-wrong count,** pixels answered wrong with confidence above 0.8. This feeds the failure digest and makes the "trust" story.
- **Generation score:** mean balanced accuracy over the training set. A change is kept only if this rises and no training puzzle drops by more than 2 points.
- **Baseline target:** 55–65% balanced accuracy on training. Ceiling should be above 90% with a good policy.

## 8. Splits

- **Training (12 puzzles):** digits and shapes. Used for selection.
- **Held-out (12 puzzles):** letters and icons. Scored every generation for display, never used for selection.
- **Transfer (stretch, 6 puzzles):** 32×32 versions. Scored once at the end.

Families are split so held-out gains can't come from memorizing shapes. One training generation costs about 3,100 Jev calls (about 45 s); held-out adds the same again.

## 9. Difficulty knobs

Tune these at 11:30 on Saturday until the baseline sits in range:

- decoy share (default 20%)
- sensor count per pixel (default 4) and true reliability range
- number of miscalibrated sensors (default 2)
- context budget (default 12 items)
- share of neighbor relations vs sensor reads

## 10. Atlas collections

- **puzzles:** puzzle_id, split, family, size, seed.
- **evidence:** puzzle_id, doc_id, type, source, text, cells (list of [row, col] the line mentions), stated_reliability, embedding. Vector index on embedding. The cells field allows exact-match filters before vector search.
- **truth:** puzzle_id, grid, decoy doc_ids, each sensor's true reliability. Readable only by the scorer's database role (the "verifier outside the loop" demo moment).
- **policies, runs, rejects:** as in the architecture section of the game plan.

## 11. Generator deliverable

- One Python script: seed in, one puzzle out (grid, evidence documents, truth record), written as JSON ready to load into Atlas.
- A preview mode that prints the grid as text and shows sample evidence of each type, so the product owner can sanity-check puzzles without Atlas.

## 12. Decisions to confirm

- 16×16 with 2 classes for v1? (recommended)
- Families split as above: digits and shapes for training, letters and icons for held-out?
- Balanced accuracy as the headline metric?
- Include the two miscalibrated sensors? They give the clearest "the harness learned something" story.
