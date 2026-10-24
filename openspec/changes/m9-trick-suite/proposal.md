# Proposal

## Why

zack (2026-10-24): "we want to build out the whole trick suite". The GDD names the 360 flip and hardflip as air
tricks and the 5-0 as a grind, and zack pointed out that a 180 leaves you riding with the other foot forward.
The rig had four flips, three ledge grinds and a boardslide.

## What Changes

- New air clips in `src/render/poses.ts`: 360 flip (keyed from zack's slow-mo clip, mirrored), hardflip, varial
  kickflip, varial heelflip, frontside pop shove-it, backside 180, frontside 180.
- New grind and roll clips: 5-0, backside feeble, manual and nose manual (the manuals wait for gameplay to use them).
- Backside smith fixed: the nose dips toward the camera, down the face of the ledge on the side skated from (zack's
  photo). The old pose, nose over the far side, was really a feeble and is kept as one.
- Shove-its land with the feet where they were. The board turned half round under them, and the feet used to follow
  the board's ends and cross the legs.
- Fakie: the rig turns Lou and the board half round about vertical when the sim says `fakie`. A 180 clip turns
  the rig itself and hands over to the fakie stance at its end, or on landing if cut short.
- `src/physics/tricks.ts` rolls the new air tricks; ledge grinds rotate 50-50, crooked, 5-0, smith, feeble.

## Capabilities

### New Capabilities

- `trick-animation`: how each trick moves the skater and board.

### Modified Capabilities

(none)

## Impact

`src/render/poses.ts`, `src/render/skater-rig.ts`, `src/physics/tricks.ts`, `tests/poses.test.ts`. Next: bake these
clips into Blender actions on the skinned model so they can be refined in Blender.
