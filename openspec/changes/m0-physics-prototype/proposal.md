# Proposal

## Why

The GDD (docs/GDD.md) bets the game on Quest For Stoken's skate physics feeling good with one button, auto-run,
in 3D, on a phone. That is the biggest unknown, and boons, Heat numbers and level pieces all depend on it, so
milestone M0 builds the smallest playable slice that answers it.

## What Changes

- New Three.js + Vite + TypeScript web project in this repo (the first game code).
- A fixed 60 Hz skate controller ported from QFS: auto-run, hold-to-ollie with release-to-cut, a second jump
  that is a flip trick, flat grind rails, curved rails with gravity along the curve and launch carry, one-way
  platforms, pits that end the attempt, and parked cars you can car-hop or slam into.
- A seeded street generator that stitches QFS Survivor's 16 x 10 ASCII pieces (plus a few new skate pieces with
  flat rails and parked cars) into a floor, with start and exit pieces and tier-by-floor selection.
- A 2.5D Three.js view of one Chicago street textured from QFS's `s_tile_city_textures` tileset, with a
  placeholder skater drawn from Lou Gnar's sprite sheets.
- One-button input: touch anywhere, mouse, Space or Up.
- A playable build that runs in a phone browser.

Out of scope for M0: boons, Heat and the chase, the traffic director (cars only parked), forks, shop, meta
progression, the rigged 3D skater, audio, multiple biomes.

## Capabilities

### New Capabilities

- `skate-physics`: how the skater moves: auto-run speed, ollie, flip tricks, landing, grinding flat and curved
  rails, car-hops, slams and bails, stepped at a fixed rate.
- `street-generation`: turning a seed and a floor number into a street layout from hand-made pieces.
- `one-button-input`: how tap, hold and release from touch, mouse and keyboard reach the game.
- `street-rendering`: how the street, skater and background are drawn in the 2.5D view.

### Modified Capabilities

(none)

## Impact

- New files: `package.json`, `index.html`, `vite.config.ts`, `tsconfig.json`, `src/**`, `public/**`
  (textures copied from QFSHIVE and sprite sheets copied from excaliburSkate).
- New dependencies: `three`, `vite`, `typescript`, `vitest`, `@types/three`.
