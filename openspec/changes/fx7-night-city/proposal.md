# Proposal (planned, not built)

## Why

Night (fx5) darkens the world and lights the skyline's neon, but the near city goes dark: no windows, no lamps,
no headlights. The GDD's late acts and its "living street" (headlights that telegraph cars, AI billboards and
Flock cameras that track you) need a city that lights itself.

## What Changes

- **Lit windows.** Facade windows glow warm or cold at dusk and night, a random share lit per building, a few
  flickering or switching off as you pass. Done with an emissive mask cut from the same QFS facade tiles.
- **Street lamps.** Lamp posts along the sidewalk and on rooftops, each with a fake light: an additive cone and a
  soft pool on the ground (no real lights), plus a halo sprite. Moths at a few.
- **Headlights that telegraph.** At dusk and night every car throws a headlight cone and a pool of light ahead of
  it, so an oncoming car is seen before it arrives (the GDD's telegraphing). Brake lights glow red trails.
- **Neon signs and AI billboards.** Kit pieces for neon signs on building fronts (QFS shop names, Stoken logo) and
  propaganda billboards whose screens turn to face Lou and flicker "SKATING IS A CRIME" style slogans; Flock
  cameras with a red eye that tracks the skater. Billboards brighten with Heat.
- **Night skater.** Lou's visor reflects passing lights (a moving highlight), and the suit picks up neon rim light
  from the nearest sign.

## Capabilities

### Modified Capabilities

- `atmosphere`: night lights.

## Impact

`kit.ts` gains lamp posts and sign/billboard pieces (shared with the gameplay thread, which owns the generator;
props only, no collision). New `src/render/night.ts` for window masks, light cones and pools. All lights are fake
(additive meshes), so no extra real lights or recompiles: a few draw calls, batched per type.
