# Tasks

## 1. Model (Blender)

- [x] 1.1 Lou Gnar astronaut mesh in the bind pose, checked against the idle sprite
- [x] 1.2 Skeleton with Mixamo-style names, skin weights, export `public/models/lou-gnar.glb`; save the .blend in `art/`

## 2. Game

- [x] 2.1 Load the GLB in `SkaterRig.create`, bind bones to the rig joints, Lambert materials, fallback body
- [x] 2.2 Screenshots of every clip with the model; tests and build pass

Built with Blender 5.2 in the cloud (`blender -b -P art/lou_gnar.py`), 1.5k triangles, 19 bones.

## 3. Board (zack, 2026-10-24)

- [x] 3.1 Board in Blender to the `BOARD` measurements (8.25" x 32" popsicle proportions), export `public/models/board.glb`
- [x] 3.2 The rig shows it in place of the code-built board, with the same toon materials; screenshots of the tricks
