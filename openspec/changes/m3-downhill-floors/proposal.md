# Proposal

## Why

zack (2026-10-24): the level design needs work. Floors should be much bigger, with big stair sets to jump down and
big handrails, shaped as a downhill descent with a few minor uphill routes. The QFS 16 x 10 pieces on one flat
street are too small for that.

## What Changes

- Each floor becomes a descent generated from sections: terraces, stair sets, big handrails, drop-offs, rooftop gaps
  and banks (the uphill bits), ending in a street finale built from the existing QFS pieces with traffic and the
  exit gate.
- Physics: sloped one-way surfaces (stairs and banks). Landing on stairs or rolling off onto them is a slam that
  rolls you to the bottom. Banks carry you up and launch you at the top.
- Straight handrails reuse the rail physics (gravity along the rail, launch carry).
- Render: stair sets, banks and taller buildings under terraces; the camera looks further down on drops.
- The validator's bot learns stairs and handrails; every floor is still checked with base physics.

## Capabilities

### New Capabilities

- `descent`: how a floor's descent is generated and what each section does to the skater.

### Modified Capabilities

(none; earlier changes are not archived)

## Impact

- New: `src/gen/descent.ts`. Changed: `src/physics/level.ts` (sloped surfaces, floor builder), `src/physics/skater.ts`,
  `src/render/kit.ts`, `src/render/scene.ts`, `src/gen/validate.ts`, `src/traffic/traffic.ts` (street only).
