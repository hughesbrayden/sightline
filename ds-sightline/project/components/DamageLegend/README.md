# DamageLegend

Lists the 12 damage states Jev chooses between, with the fill or glyph each one draws on a DamageMap.

**The consumer provides** optionally `states` (a subset, in order), `columns` (1 or 2) and `markCritical` to tag the rescue-critical states: homes flooded, major damage, destroyed and fire.

**Rules**
- Keep the order: severity fills first, then service glyphs. It matches how the map reads.
- Show the legend next to any map a judge will read; thumbnails in a grid can share one legend.
