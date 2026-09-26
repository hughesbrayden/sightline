# LineageTree

Draws the harness's evolution: kept changes stack on the main line, rejected ideas hang off their parent as dead ends, and changes skipped by memory show as hollow stubs.

**The consumer provides** `gens`, a list of `{ gen, parent, status, label }` where `status` is `baseline`, `kept`, `rejected` or `skipped` and `parent` is the generation the change was tried on. Pass `total` (the generation budget, default the list length) so nodes keep their place as the list grows, and `current` for the generation in progress.

**Rules**
- Only `baseline` and `kept` sit on the main line, joined in `accent`. That line is the policy that ships.
- Rejected ideas branch below in dashed `critical`; skipped ones in dashed `line-strong`. Label them with the reason ("−4.1 val", "memory").
- Main-line labels carry the validation score, never the backtest score: selection happens on validation.
- The in-progress generation is a dashed `series-heldout` ring on the main line; it moves off the line if rejected.
