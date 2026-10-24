# Chicago level design: hills, foreground and the L

zack, 2026-10-24: focus on one biome and polish how its levels are designed as they progress, build out the
foreground so the camera never sees empty space in front, and make the downhill sections look like the hills of
San Francisco. Then finish the elevated L tracks: grindable, with train cars that loop like the cross traffic.

A run is now all one district (PR #112), so this covers all 15 Chicago floors plus Endless.

## Floor shape

Each floor is still a downhill descent into a street finale, but in Chicago the descent is a hillside you skate
down rather than floating rooftops (`src/gen/hills.ts`, used when `FloorOptions.hills` is set, which
`src/run/floor-level.ts` does for the Chicago district).

| Beat | What it is | How you skate it |
| --- | --- | --- |
| Hill | A block of street falling away, 8–22 tiles, at the floor's grade | Bomb it: speed builds on the way down |
| Rail hill | A hill with the sidewalk handrail down it | Ollie onto the rail at the crest |
| Crest | The flat intersection at the top of each block, 5–8 tiles, with a cross street running back | Breathe, set up |
| Stairs | A public stairway with a handrail (always one on floor 1 and on any set over 8) | Ollie it, flip it, or grind the rail |
| Drop | A retaining wall down to the next street, 1.5–4 tiles | Roll off or ollie for style |
| Gap | A crest jump over a cross street onto the next block falling away under you | Ollie or flip it; falling in is a bail |
| Kicker | A short climb to the next corner that throws you into the air | Roll up; the Stoken is often over the lip |

The physics did not change: hills are banks that fall away (`Surface.hill` only changes how they're drawn),
crests are roofs and gaps are gaps, so the validator, the playtest bot and every boon treat them as before.

## Progression

Each floor is a phrase with a shape: it opens on a block to bomb, builds, peaks on its biggest stairway (always the
last beat, always with a handrail), and runs out down a last short block and 10 flat tiles into the street, so the
hill's speed is spent before the traffic. The height is planned up front: the last stairway gets its set, and the
beats before it share the rest by weight, so no beat is left with nothing to drop.

| Act | Floors | Signature |
| --- | --- | --- |
| 1 | 1–3 | Learn the hill: a block, a small stairway, a rail down a block, a drop. Floor 2 adds the crest jump and the kicker; floor 3 is the act's big one |
| 2 | 4–6 | Rails: handrails down most blocks |
| 3 | 7–9 | The steps: stairways back to back, landing to landing |
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
| Floor length (tiles, average) | 190 | 275 | 320 | 325 |

All 15 floors pass the validator at cruising speed and in the gnar state; about as often first time as the
rooftop descents did (1.0 tries a floor on floor 1, up to about 3 on floor 12), and a floor takes 20–30 ms to
generate and validate.

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
- **Draw budget**: the hillside and foreground are four meshes (road, sidewalk, concrete, and the houses off one
  painted atlas), plus their share of the kit's merged outline. The descent's rooftop slabs they replace cost more.

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

## How to see it

- `npm run dev`, then `localhost:5173/?seed=5&floor=1` (any floor 1–15). Add `&bot` to watch it skated.
- The L is about 12 tiles into the street on every floor. `?escape=2` shows the helicopter escape's L.
