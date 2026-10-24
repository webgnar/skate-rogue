# Proposal

## Why

zack (2026-10-24) wants the player model built in Blender. The astronaut in `skater-rig.ts` is rigid capsules and
spheres; a single skinned mesh with a real skeleton bends at the knees, elbows and waist, looks like Lou Gnar's
puffy suit, and can later carry Blender-keyed clips and be retargeted to the QFS skaters.

## What Changes

- `public/models/lou-gnar.glb`: Lou Gnar's astronaut authored in Blender (one skinned suit mesh, helmet with a
  black visor, backpack, gloves, black shoes, flag patch on the lead arm, belt line from the sprite) on a
  humanoid skeleton with Mixamo-style bone names.
- The existing clips and leg IK keep posing the joint hierarchy; each frame the GLB's bones copy those joints, so
  every trick and the feet-on-board rule work unchanged. The board stays procedural for now.
- The rigid capsule body stays as the fallback if the GLB fails to load.

## Capabilities

### New Capabilities

- `skater-model`: how the authored skater model is built, exported and bound to the pose rig.

### Modified Capabilities

(none)

## Impact

New `public/models/lou-gnar.glb` and the Blender source under `art/`. `skater-rig.ts` loads the GLB in
`SkaterRig.create` (GLTFLoader from three/examples). No physics or clip changes.
