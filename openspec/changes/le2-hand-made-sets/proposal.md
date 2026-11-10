# le2-hand-made-sets (SCOPE ONLY: nothing here is built yet)

## Why

zack (2026-11-10): "i MIGHT need a level editor... it might be the only way to make these levels super fun."

What exists: `?levels` (le1, PR #117 and after) shows any floor to scale with the bot's line, and turns the
generator's dials (recipe slots, heights, grades, cloud and sewer mixes). Its save file,
`src/gen/level-edits.json`, is still empty: dials shape a floor, but they can't draw a line. The fun bits that do
work (act 3's hubba, S-rail, launch; act 5's stair sets, double sets, gap rails) were each written as code by
Claude from a description, then tuned by trial. A hand-made line is what zack can't make today.

## What changes

The unit of hand-making is a **set**: a short line zack draws (a stair set into a handrail into a gap onto a
ledge, say), 5-40 tiles long, with a start and an end height. The generator keeps building the floor (hills,
streets, traffic, dressing, the clouds and the station) and drops hand-made sets in as beats, the way it already
drops the code sets. A floor can also be fully hand-made (an act's signature floor, an escape) where that's
wanted; the generator still adds traffic, props, coins and dressing on top.

- **Set editor** (`?sets`, grown out of `?levels`'s side view): a palette of the pieces the game already has
  (street, ledge, roof, stairs, handrail, flat / sloped / curved rail, I-beam, gap, kicker, launch quarterpipe,
  parked car, cloud, drone, glass, coins, Stoken), placed on the tile grid, dragged and stretched, with the bot's
  line redrawn on every change and a "play it" button that drops you into the real game on that set.
- **Sets in the generator**: a `set` beat in the hill recipe, the cloud line and the station line. Each set is
  tagged with which acts and routes it may appear on, a weight and a cap a floor, and the generator joins its ends
  to whatever is around it.
- **Hand-made floors** (later phase): a floor whose whole line is a list of sets, laid end to end.
- **Saving** that works from the phone (see design.md, decision 3).

## Phases (size = rough PR count of Claude work)

| Phase | What | Size |
| --- | --- | --- |
| 0 | Play from here: tap any point on a `?levels` floor and play from it; retry in one tap | S, 1 PR |
| 1 | Set editor: palette, grid, drag and stretch, bot line, play it, save sets to `src/gen/sets/*.json` | L, 2-3 PRs |
| 2 | Sets in floors: the `set` beat, tags, weights, caps, joining heights; drawn in `?levels` | M, 1-2 PRs |
| 3 | Save from the phone without pasting to Claude | S-M, 1 PR |
| 4 | Hand-made floors: a floor as a list of sets, for signature floors and escapes | M, 1-2 PRs |
| 5 | Moving pieces in sets (blimp, swinging beam, rig, drone bridge) and turning code sets into editable ones | L, 2-3 PRs |

0-2 is the useful core (about 4-6 PRs). 3 can go any time. 4-5 only if 1-2 prove themselves.

## Out of scope

- Editing the 3D look piece by piece (buildings, storefronts, props): dressing stays generated from the act.
- Editing traffic, Heat or the chasers.
- Sharing levels with players (a player-facing editor).

## Capabilities

### New Capabilities
- `hand-made-sets`: drawing sets in the browser and the generator laying them into floors.

### Modified Capabilities
- `level-editor` (le1): `?levels` gains play from here and draws hand-made sets.
