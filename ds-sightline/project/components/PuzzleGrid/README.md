# PuzzleGrid

Draws one puzzle as square pixel cells, with the model's confidence shown as opacity and wrong cells outlined.

**Use it for** the answer (no `confidence`), a generation's guess (`confidence` set), and the review view (`truth` + `showErrors`).

**The consumer provides** `cells` as `size * size` row-major pixels, either palette names (`"red"`) or indices 0–7 in `Sightline.PALETTE` order: void, paper, red, orange, yellow, green, blue, brown.

**Rules**
- Cells are always square (`radius-cell` is 0) and never have gaps. A gap or a rounded corner changes the picture.
- Opacity is `conf-floor + (1 - conf-floor) × confidence`, so an unsure pixel is faint but never gone.
- Errors are marked with an ink-and-surface outline, never by recoloring. The cell keeps the color the model chose, so the viewer sees what went wrong.
- 16×16 at `cellSize` 12 (the `cell` token) for dashboards; 24 for the demo's showcase grid and slides.
- `caption` takes the generation ("Gen 14"); `meta` takes a count ("231/256 right") or a score.
- Pixel colors come from the `px-*` tokens, which stay the same in both themes. Don't reuse them for UI state.
