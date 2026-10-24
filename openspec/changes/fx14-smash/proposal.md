# Proposal

## Why

zack wants lots of things to smash for visual juice (GDD pillar 7, "Smashables"). Gameplay places props and sends
break events; models makes props whole and in pieces; this is the break itself.

## What Changes

- `src/render/smash.ts` (`SmashFx`), driven by `Game.smash(hit)` with `{ prop, index, x, y, how, speed, breakable? }`.
  The sim's `smash` event maps straight onto it.
- **Material from the name**: glass, metal, wood, plastic, stone or paper, each with its own chips, dust, sparks and
  sound words (KRSSH! for glass, TONK!/CLANG! for metal, KRAK!/CRUNCH! for wood and stone, THWAK!/BONK! for plastic,
  FWUMP! for paper).
- **Pieces**: the prop's own break pieces from the models thread (`pieces(prop)`) when they exist, stand-in chunks in
  the material's colour until then. They tumble, bounce once or twice and shrink away in 1.1 s; at most 24 live
  (12 on the low tier), one draw each while they fly.
- **Big smashes** (landed on, slammed, bombed, car-hopped, or rolled through at 1.5x cruising and up) get a word
  and a camera kick scaled by speed (off with reduce motion). A cruising roll-through just bursts.
- **Unbreakable props** (`breakable: false`) ring with sparks or chips and stay.
- Hiding the prop goes through `hide(index)` (the models thread's `hideProp`).

## Capabilities

### Modified Capabilities

- `game-feel`: smashables.

## Impact

Plugs in by prop name; no per-prop code. Waiting on the sim's smash events and the models' pieces and `hideProp`.
