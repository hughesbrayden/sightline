# StatusBadge

Names what happened to a proposed mutation: gate passed, rejected, skipped because memory says it failed before, database read denied, or still running.

**Kinds**
- `passed`: `good` on `good-soft`, solid marker.
- `rejected`: `critical` on `critical-soft`, solid marker.
- `denied`: `critical` on `critical-soft`, hollow marker. Use it only for the database refusing a read of the answers; it's the demo's trust moment.
- `skipped`: `ink-muted` on `surface-sunken`, hollow marker. A skip isn't a failure; it's memory doing its job.
- `running`: `accent` on `accent-soft`. Put progress in the text ("Scoring 7/12").

**Rules**
- The marker's shape (solid or hollow) carries the state too, so the badges read without color.
- Keep the default text unless you're adding a number. No exclamation marks.
