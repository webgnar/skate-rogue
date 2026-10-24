# Proposal

## Why

The GDD's acts move through QFS's worlds (Clemente Park, Ancient Greece, Atlantis, the Art Museum, High-Tech City,
Outer Space, the Hive), but every floor still looks like Chicago. The tilesets and kits per biome are a bigger job;
the effects layer can give each district its own air now.

## What Changes

- **A look per biome** (`src/render/biomes.ts`): a colour grade laid over the time of day (sky, fog, light,
  skyline) and a drift of ambient pixels through the air:

| Biome | Grade | Air |
| --- | --- | --- |
| Clemente Park | greener light, pale green horizon | falling leaves |
| Ancient Greece | bleached sky, sand haze | gold dust |
| Atlantis | teal water for sky, close blue fog | bubbles rising |
| Art Museum | dim warm hall, no sky | dust in the gallery light |
| High-Tech City | cold blue, neon up | cyan and magenta data streaming up |
| Outer Space | black sky, all the stars, long sight lines | slow cosmic dust |
| The Hive | red-amber glow | embers rising |

- `Game.setBiome(id)` applies one (gameplay picks the biome per act); `?biome=<id>` previews it.
- One extra draw call (the ambient points, 96 max, halved on the low tier).

## Capabilities

### Modified Capabilities

- `game-feel`: biome looks.

## Impact

Until biome tilesets and kits exist, the grade is subtle: the Chicago facades dominate the frame. The table above
is the colour target for those kits when they are built.
