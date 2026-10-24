## 1. Clips

- [x] 1.1 360 flip, hardflip, varial kickflip, varial heelflip, frontside shove-it
- [x] 1.2 Backside and frontside 180, with the rig handing over to fakie
- [x] 1.3 5-0, feeble, manual, nose manual; smith fixed
- [x] 1.4 Feet land in place after shove-its
- [x] 1.5 Tests for each trick's board motion and the 180 stance

## 2. Blender

- [x] 2.1 Bake every clip into Blender actions on the skinned rig with a Board bone (`art/bake_clips.cjs` → `art/anim/clips.json` → `art/lou_gnar.py`)
- [x] 2.2 Game plays the Blender clips (GLB animations, sampled onto the bones, crossfaded bone by bone), falling back to the code clips
- [ ] 2.3 Refine key poses in Blender from the reference library
- [x] 2.4 Idle (under menus, from Lou's idle sprite) and busted (hands up) clips, held by the game (`SkaterRig.hold`)
