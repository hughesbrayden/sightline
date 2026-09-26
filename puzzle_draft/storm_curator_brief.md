# Curator brief: what should Jev see?

Jev is a fast decision model. For every city block after a hurricane it picks one of 12 damage states and
reports a confidence. Jev only knows what is in the text it is shown: a one-line header and up to 12 records.
You write the **context policy** (a genome) that decides which reports Jev sees and how they read. You never
change Jev or its instructions, and the harness never computes an answer for Jev.

Each generation, the harness runs your genome on several past storms and sends you a digest: scores, accuracy
per true state, and 30 traces (the exact text Jev saw, what it answered, and the right answer). A separate
check on another storm decides whether your genome is kept; you only learn whether it passed.

## The 12 states

intact, flooded_street, flooded_homes, roof_damage, collapsed, fire, road_blocked, power_out, downed_lines,
shelter_open, hospital_ok, hospital_down.

Life-safety states: collapsed, flooded_homes, fire, hospital_down. A "false dispatch" is a life-safety call on
a block that was actually intact.

## Report sources

`911-call`, `311`, `social-post`, `city-survey`, `fire-dept`, `pre-storm-map`, `drone-pass`, `utility-feed`.
Every report is filed at one block and has a `value` (the source's own code or label, shown in the traces).
Learn what each source's values mean, and how reliable each source is, from the traces.

## Ops

Source ops apply first; selection ops then fill the 12-line budget in the order you list them.

| Op | Fields | Effect |
|---|---|---|
| `exclude_source` | `source` or `sources` | Drop every report from those sources |
| `gloss_value` | `source` or `sources`, `map: {value: explanation}` | Show `value (explanation)` wherever that value appears |
| `include_own` | `k`, optional `sources` | Reports filed at this block |
| `include_related` | `radius` 1-3, optional `only_values` (list of values), optional `sources`, `show: raw\|profile`, `k` | Reports filed at nearby blocks. `raw` lists them; `profile` summarizes counts per source and value |

Genome-level `format`: `raw` (locations as block coordinates) or `relative` ("This block", "Neighbor 1 block
north").

Rules: ops must not mention specific blocks, coordinates or storms; a genome that does is rejected. Glosses
must describe what a value means in general, never the answer for a particular block.

## What to return

Return **only** one JSON object:

```json
{
  "id": "short_slug",
  "rationale": {"hypothesis": "what you think Jev is misreading, from the traces", "refuted_if": "what result would show you were wrong"},
  "prediction": "the change you expect in balanced accuracy and in the states you target",
  "ops": [ ... ],
  "format": "raw | relative"
}
```

Change one idea at a time when you can, so the result tells you whether the idea worked. Keep what worked in
the accepted genome and build on it.
