# Chicago level design: hills, foreground and the L

zack, 2026-10-24: focus on one biome and polish how its levels are designed as they progress, build out the
foreground so the camera never sees empty space in front, and make the downhill sections look like the hills of
San Francisco. Then finish the elevated L tracks: grindable, with train cars that loop like the cross traffic.

A run is now all one district (PR #112), so this covers all 15 Chicago floors plus Endless.

## Floor shape

A floor is a hillside you skate down rather than floating rooftops (`src/gen/hills.ts`, used when
`FloorOptions.hills` is set, which `src/run/floor-level.ts` does for every floor). zack, 2026-10-24: the floors were
too short and all felt like "descent to flat", so a floor is now two or three stretches of hill with a flat street
chase between each:

**hill → street chase → cable car up → hill → (street chase → cable car up → hill) → street finale**

- **Street chase** (the recipe's `chase` beat): `HILLS.chasePieces` street pieces (2 on floors 1–3, 3 on 4–7, 4 from
  8 on) with the full street: traffic, cross streets, parked cars, canals, the cruiser on your tail.
- **Cable car**: at the end of a chase the street runs into the foot of the next hill, and a San Francisco cable car
  waits in its slot. Roll onto the slot (`Surface.tow`) and the cable takes you up at 2.2 times cruising speed,
  whatever the slope. The car runs just ahead of you in the next lane (`src/render/cable-view.ts`). It climbs
  `HILLS.climbTop` tiles (11 on floor 1, up to 22) at a grade of 0.45, with a stepped sidewalk beside it. A crest at
  the top lets you set up, then the next stretch of hill goes down to the next street.
- **Power lines to grind** (zack: "the player should be able to grind these at times"): about 45% of the plain blocks
  of hill 10 tiles or longer get a power line strung low over the lane from pole to pole. It hangs 2 tiles over the
  road at the poles and sags 0.45 tiles between them, with coins along it. Ollie and flip up to grind it, or ride
  under it.
- In the code, each later stretch is a run of `HILL_PIECE`s (no street) followed by a `RUNWAY_PIECE` in the
  street layout (`makeLayout`'s `breaks`), with the hill built over it by `buildClimb`. `Level.hillSpans` lists every
  stretch, and `inHill()` tells the street systems (traffic, twists, the L, the kit) where the hill is.

| Beat | What it is | How you skate it |
| --- | --- | --- |
| Hill | A block of street falling away, 8–22 tiles, at the floor's grade | Bomb it: speed builds on the way down |
| Rail hill | A hill with the sidewalk handrail down it | Ollie onto the rail at the crest |
| Crest | The flat intersection at the top of each block, 5–8 tiles, with a cross street running back | Breathe, set up |
| Stairs | A public stairway with a handrail (always one on floor 1 and on any set over 8) | Ollie it, flip it, or grind the rail |
| Drop | A retaining wall down to the next street, 1.5–4 tiles | Roll off or ollie for style |
| Gap | A crest jump over a cross street onto the next block falling away under you | Ollie or flip it. Its far side is a solid wall up to the lip: come up short and you slam into it and drop straight down to bail on the cross street 3.5 tiles under the lower lip (`pits()` in src/physics/level.ts). Up to 8 px short of the lip you still get up onto it |
| Kicker | A short climb to the next corner that throws you into the air | Roll up; the Stoken is often over the lip |

The physics did not change: hills are banks that fall away (`Surface.hill` only changes how they're drawn),
crests are roofs and gaps are gaps, so the validator, the playtest bot and every boon treat them as before.

## Progression

Each stretch of hill is a phrase with a shape: it opens on a block to bomb, builds, peaks on its biggest stairway
(always the last beat, always with a handrail), and runs out down a last short block and 10 flat tiles into the street, so the
hill's speed is spent before the traffic. The height is planned up front: the last stairway gets its set, and the
beats before it share the rest by weight, so no beat is left with nothing to drop.

| Act | Floors | Signature |
| --- | --- | --- |
| 1 | 1–3 | Learn the hill: a block, a small stairway, a rail down a block, a drop. Floor 2 adds the crest jump and the kicker; floor 3 is the act's big one. Two stretches of hill |
| 2 | 4–6 | Rails: handrails down most blocks. Floor 6 has three stretches |
| 3 | 7–9 | The steps: stairways back to back, landing to landing. Three stretches from here |
| 4 | 10–12 | Bombing: crest jumps and kickers into them, the steepest blocks |
| 5 | 13–15 | Everything, the longest floors |

Every slot of a recipe can list more than one beat, and the seed picks, so two runs of the same floor differ.
Endless cycles the act 4 and 5 recipes.

What grows with depth:

| | Floor 1 | Floor 5 | Floor 10 | Floor 15 |
| --- | --- | --- | --- | --- |
| Start height (tiles) | 18 | 34 | 44 | 44 |
| Grade (tiles down per tile) | 0.22 | 0.29 | 0.38 | 0.42 |
| Crest jump (tiles) | 2–3 | 3–4 | 3–4 | 3–4 |
| Stairway before the last | 5–7 | 9–11 | 10–14 | 10–14 |
| Last stairway, at most | 8 | 15 | 16 | 16 |
| Floor length (tiles) | 350 | 450 | 730 | 760 |
| Floor time for the reference bot (s) | 33 | 46 | 76 | 77 |

All 15 floors pass the validator at cruising speed and in the gnar state, usually in 1–3 tries; floor 13 can take
more. A floor takes 150–750 ms to generate and validate in Node, because the bot skates floors twice as long.
Gear wear was halved to keep about 4 floors to half-worn gear. The balance test's Heat bound went from 60 to 80,
because with two or three street chases a floor, slams get more chances to bunch up.

## The look (`src/render/hillside.ts`)

- **The hill**: every piece of the descent is solid ground down out of sight. Road with a double yellow down the
  skate lane, sidewalks on both sides following the slope, stairways the width of the street, retaining walls at
  the drops. Each crest gets a cross street running back up into the city; each crest jump clears one, and you see
  it down in the cut.
- **Row houses**: painted ladies (8 paints, bay windows, cornices, garage doors) stepping down the hill behind the
  back sidewalk, and a second row further up the hill behind them.
- **The foreground**, on every Chicago floor including escapes: the near sidewalk with a low wall, then two rows of
  houses below the lane stepping down toward the camera, so the bottom of the screen is always rooftops and
  facades. Everything stays under the camera's line to the skater's feet, so nothing hides the lane.
- **From zack's photos** (2026-10-24): the houses mix four styles. Painted-lady Victorians have three-sided bay
  windows, dentil cornices and some brick ground floors. White stucco houses have arched windows, iron balconies,
  wood garages and hipped red tile roofs (in front of the lane they only get a tile eave, so they stay under the
  camera's line). Cedar shingle houses have white trim, and flat modern stucco houses have balconies. Power poles run
  along the back sidewalk with three wires sagging between them, plus a lower pair, and some poles carry
  transformers. Street trees stand between the poles, cypresses rise over the back row, and shrubs and
  bougainvillea grow by the doors. Steep blocks (grade 0.3 or more) get steps for a back sidewalk, and crests have
  crosswalk lines.
- **Draw budget**: the hillside and foreground are four meshes (road, sidewalk, concrete, and the houses off one
  painted atlas), plus their share of the kit's merged outline, and one more for the wires (flat ink, no outline). The descent's rooftop slabs they replace cost more.

## The L (`src/traffic/el.ts`, `src/render/el-view.ts`)

- Every Chicago street finale opens with a block of plain street (`EL_PIECE`), and the L runs over it: 14–20 tiles
  of track, its underside 2.6 tiles up (a bus fits under). From floor 4 a second stretch goes wherever the street
  is clear under it.
- **Grinding it**: the running rails are a flat rail 3 tiles up. A parked car stands just before each stretch: ollie
  onto its roof, hold through the car hop and flip at the top, and you land on the rails. Grind the stretch and
  drop back to the street at the end.
- **Trains**: at each end the track bends back into the city (the back wall and buildings are cut away there, like
  a cross street). Two-car trains (ElCar and ElCarFront from art/street.py) come round the near bend, run along
  the stretch your way at 0.75 of your speed, and bend off at the far end, then the next one comes after 12 s. The
  first is timed from the floor seed against your arrival, the way cross traffic is: sometimes it's on the stretch
  ahead of you (catch it and hop its roof, or slam into its back), sometimes it pulls in as you arrive, sometimes
  it's gone. You always see it coming round the bend first.
- **Escapes**: the helicopter escapes' L covers (3.5 tiles up, for hiding from the spotlight) are grindable too, from
  a bus roof.

## Chinatown (`CHINATOWN` in `src/gen/hills.ts`)

Once an act (floors 5, 8, 11, 14; Endless every third floor) the stretch of hill up the first cable car is a Chinatown
block, for a change of pace. Its intersections have cross traffic driving straight across (`src/traffic/hill-cross.ts`):
ollie it, hop it or skate the gap. One long flat has a cab (`src/traffic/cab.ts`): roll into its back bumper to skitch
it up to 2.5x speed; it lets go at the corner before a kicker. At the cab's speed an ollie on the kicker and a flip at
the top reach the top route's power line (`wireOverLip`, `wireHold`); at your own you fall short and bomb the block
below through more cross traffic. Greybox art in `src/render/chinatown-view.ts`; the Chinatown look comes from zack's
Walled City photos.

## How to see it

- `npm run dev`, then `localhost:5173/?seed=5&floor=1` (any floor 1–15). Add `&bot` to watch it skated.
- The L is about 12 tiles into the street on every floor. `?escape=2` shows the helicopter escape's L.

## One city: every world's art (`src/render/quarters.ts`)

zack, 2026-10-24: no separate biomes; fuse the art from all of them into one richer city. Every floor is now this
city. Along the street it passes through quarters, each leaning on one of QFS's worlds, with plain Chicago between
them, so it reads as one place with neighbourhoods:

| Quarter | World | What you see |
| --- | --- | --- |
| The park | Clemente | Park trees, the ROBERTO CLEMENTE and SKATEHIVE signs, the Light Tower |
| Old town | Greece | Little temples, ruined arches, red palace pillars, the Temple; amphoras and urns to smash |
| The waterfront | Atlantis | Coral and sea grass, the Sunken Arch; shells and chests |
| Museum block | Museum | Paintings hung on the wall like murals, the statue of David, the Giant Bust; vases and busts |
| Tech block | High-Tech | Panelled walls and window-grid towers, the Data Spire; batteries, holocubes, server racks |
| Space port | Space | Its blocks and props, the Rocket; crystals and fuel cells |

- Each floor deals the six worlds in its own order, starting after about 26 plain tiles round the L. A quarter runs
  22–34 tiles, with 8–16 plain tiles between quarters. The hill above the street stays all San Francisco.
- A quarter's world shows in its stretch of the back wall (its block tiles), in half of its buildings, in its
  scenery cards (all in one mesh off one atlas, each stamp drawn from its own sheet), in its landmark (placed in the
  middle of the quarter) and in its smashables. Scenery such as hydrants, benches and meters stays Chicago street
  furniture.
- **The sky**: three backdrop layers. The planets sit high up, Chicago's skyline is in the middle, and the museum's
  sculptures stand in front of the skyline as the city's public art. There is no biome colour grade; the time of day
  and the rain apply everywhere.
- **Twists**: currents blow as gusts of wind, with white streaks and chalk arrows. A low ceiling is the underside of
  a concrete overpass, with girders and a sodium lamp. Crumbling ledges stay old-town marble.
- **Cost**: a quarter adds its wall piece, and its landmark when it's on screen. The scenery cards are one draw for
  the whole floor, and the backdrop is 2 more draws than Chicago's skyline alone.
