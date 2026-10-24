# Proposal

## Why

The GDD's Immersion section has time of day and weather (dusk, neon night, rain). zack (2026-10-24) chose that
the clock advances through a run, since a run is one escape: afternoon early, neon night by the late acts, with
rain rolling per floor.

## What Changes

- Four moods, blended by how far through the run a floor is (`clockFor(floor)`: floor 1 afternoon, golden hour
  around floor 5, dusk around floor 9, night from floor 13; Endless stays night). Each sets the sun and sky light,
  fog, a gradient sky (pixel stars at dusk and night) and a tint over the skyline card that leaves its neon lit, so
  the city glows at night.
- Rain on about one floor in four from floor 2, fixed by the run seed: greyer, closer fog, a weaker sun, and
  slanted streaks over the screen. Visual only for now (the GDD's lower grip in rain is the gameplay thread's call).

## Capabilities

### New Capabilities

- `atmosphere`: time of day and rain.

## Impact

New `src/render/atmosphere.ts`; `StreetView.setMood`, a shader sky instead of the sky texture, a shader skyline;
`Game.startFloor` sets the floor's mood. Rain is one draw call of 160 quads; no other extra draws.
