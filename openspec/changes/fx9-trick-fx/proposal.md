# Proposal

## Why

Tricks scored and called out, but they looked the same as an ollie: the board spun and nothing else. Grinds threw
the same sparks on a metal rail as on a concrete ledge, and every landing kicked up the same dust.

## What Changes

- **Flip trails**: pixels in the trick's colour hang where the board spun, for 0.35 s after the trick
  (kickflip cyan, heelflip magenta, shove-its yellow, 180s white).
- **Grind sparks by surface**: rails throw hot white sparks, faster; ledges, roof edges and banks throw duller orange
  sparks with grey chips of concrete.
- **Clean vs sketchy landings** (visual only, scoring is unchanged): a trick landed more than 0.3 s after it was
  thrown is clean, with a flat ring of white sparkle and a few gold sparks. One caught at the last moment is sketchy,
  with a lopsided scuff of dust and a tiny shake (none with reduce motion).

## Capabilities

### Modified Capabilities

- `game-feel`: trick effects.

## Impact

`src/render/particles.ts` (new emitters, all in the one particle pool), `src/game/game.ts` (wiring). No new draws.
