## Why

The GDD's acts move through QFS's worlds, and its art pipeline says each biome's kit comes from that world's
tileset, read through QFS's survivor skins. Until now every floor was built from Chicago's tiles, and only the
effects grade (fx13) told the districts apart.

## What Changes

- **Skins** (`src/render/skins.ts`): QFS's `survivor_skins()` (QFSHIVE `scripts/survivor_worlds`) ported for
  Clemente Park, Ancient Greece, Atlantis, the Art Museum, High-Tech City and Outer Space. For each world they give
  the ground's top and fill tiles, the water, block fill and cap, ledges, decor stamps and props. They add a painted
  street top (path, grass, sand, sea floor, gallery floor, metal) and a side colour for the faces QFS never drew. The
  Hive uses High-Tech City's tiles under its own grade.
- **Kit** (`buildKit(level, biome, sheet)`): the street front, canal water, back wall, background blocks, the blocks
  under roofs and the ledges draw from the biome's tiles (ledges keep their depth, as in PR #61). The decor (trees,
  temples, arches, signs, paintings) and props stand as pixel-art cards along the sidewalk, all in one mesh with no
  outline. Chicago is unchanged.
- **Loading:** each biome's sheet is `public/tex/<biome>_tiles.png`, loaded the first time the biome is used.
  `StreetView.setBiome(id)` rebuilds the floor's kit once the sheet is in, and `Game.setBiome` calls it. `?biome=`
  previews a biome.

- **Smashables per world** (`art/props.py`, `WORLD_PROPS` in `src/render/props.ts`): a small, medium and large
  breakable for each world, with break pieces. Each one stands in for the Chicago smashable the sim placed, by size,
  so the hit boxes still fit. The AI's things stay in every world. Chicago's street furniture shows only in Chicago,
  and other worlds show their scenery as cards. Smash effects use the shown prop (`Game.smash`).

## Impact

- `src/render/{skins,kit,textures,scene}.ts`, `src/game/game.ts`, `public/tex/*_tiles.png` (QFS's own sheets).
- The skyline and far city are still Chicago's. QFS's backdrops per world come next.
