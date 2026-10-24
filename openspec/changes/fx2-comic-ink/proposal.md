# Proposal

## Why

zack (2026-10-24) picked a "comic ink, per-mesh" look: the slam burst is comic-book style but the skater, cars
and kit were plain soft-shaded low-poly, so the world and the effects didn't match.

## What Changes

- Toon shading: Lambert and Phong materials become `MeshToonMaterial` with a three-band ramp. The sun is stronger
  and the sky light weaker so the bands read.
- Ink outlines on the skater, cars, the cruiser and drone, coins and gems, and the kit (buildings, rooftops,
  stairs, rails, posts): an inverted hull per mesh, a constant 2.2 CSS px wide, fogged with the scene.
- The GDD's art style line records the decision.

## Capabilities

### New Capabilities

- `ink-look`: toon shading and outlines.

### Modified Capabilities

(none)

## Impact

New `src/render/toon.ts` (`toon()`, `inkify()`, `setInkResolution()`). `StreetView` inks the kit, the traffic
view inks cars as they spawn, pickups ink their instanced coins and gems, the game inks the skater (outlines
only; the rig builds its own toon materials so its hit flash keeps working). Draw calls roughly double for
outlined meshes (about 40 to 75 in the scene on floor 1); no full-screen pass.
