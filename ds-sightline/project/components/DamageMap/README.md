# DamageMap

Draws one area as a grid of city blocks, each filled with Jev's damage call, with streets as thin gaps and water around them.

**The consumer provides** `cells` (row-major, one of the 12 damage states or `water` / `park` scenery), and for review `truth` plus `mode` of `truth` or `diff`. Pass `confidence` to haze unsure blocks and `onSelect` to make blocks clickable.

**Rules**
- On damage maps, color means severity. The fills run from `dmg-intact` through `dmg-minor`, `dmg-street`, `dmg-home` and `dmg-wind` to `dmg-major` and `dmg-destroyed`, so the eye finds the worst blocks first. This is the one place in Sightline where map color carries meaning.
- Services never get their own fill. Road blocked, power out, shelter open and hospital operating are glyphs drawn in `map-glyph` on `dmg-intact`; fire is a `map-fire` dot on `dmg-major`.
- Water (`map-water`) is paler and grayer than `dmg-street`, so standing water on land never reads as the river.
- `diff` mode keeps wrong blocks at full strength with the ink outline and fades the rest; it never recolors a block.
- 32×32 at 16px blocks (544px) for the stage; 20px for the hero; 5px or smaller for thumbnail grids, where streets and glyphs switch off automatically.
