# Design

## Units and axes

The model is authored in the rig's own units (1 Blender metre = 1 rig unit; the game scales the rig by 1.15), so it
stands about 1.93 tall to the top of the helmet. glTF export converts Blender's Z-up to Y-up: three.js +x (the way
you skate, the lead foot) is Blender +X, three.js +z (toward the camera, the toes) is Blender -Y, so Blender's
front view is the game camera.

## Bind pose

The bind pose is the rig with every joint at zero: pelvis at y 0.9, legs hanging straight down from hips at
x ±0.11, arms hanging straight down from shoulders at x ±0.25, y 1.42, toes toward the camera. Modelling in that
pose means bone rest matrices equal the rig joints' zero transforms.

## Skeleton

Mixamo-style names so clips can be retargeted later: Hips, Spine, Spine1, Neck, Head, LeftArm, LeftForeArm,
LeftHand, RightArm, RightForeArm, RightHand, LeftUpLeg, LeftLeg, LeftFoot, LeftToeBase, and the Right leg bones.
Left is the lead side (+x, front foot).

## Binding to the rig

The capsule rig's groups become invisible drivers. At load, each bone stores `offset = driverWorld⁻¹ · boneWorld`
in the bind pose; each frame `boneWorld = driverWorld · offset`, converted to the bone's local transform through
its parent. Driver map: Hips ← pelvis, Spine/Spine1 ← spine, Head ← head, Arm ← shoulder, ForeArm ← elbow,
UpLeg ← thigh, Leg ← shin, Foot ← shoe.

## Look

From the sprites: cream-white suit, puffy, with a dark belt line at the waist; round helmet with a large black
visor facing the camera; backpack; US flag patch on the outside of the lead upper arm; white gloves; black shoes
with white soles. Flat-shaded low-poly in the same style as the levels; materials are swapped to Lambert at load
so the slam blink and lighting match the rest of the scene. Target under 3k triangles.
