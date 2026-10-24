# Design

## Toon

`toon(params)` is a `MeshToonMaterial` with a shared 3-texel ramp (0.42, 0.72, 1.0) and nearest filtering.
`inkify(root)` swaps Lambert/Phong materials for toon copies (colour, map, emissive, transparency kept), unless
`toon: false`. Basic materials (lamps, signs, gates) are left alone.

## Outlines

One shared `ShaderMaterial` (back faces, fog) for every outline, so they share a program. Each outlined mesh gets
a child mesh on the same geometry. The vertex shader pushes each vertex out along an `inkNormal` attribute (the
normals averaged per position, so box corners don't split) in clip space, by `uWidth` pixels, so the line has the
same width near and far. Instanced meshes get an instanced hull sharing the instance matrices; skinned meshes get a
skinned hull bound to the same skeleton. Transparent meshes without alpha test are not outlined.

`setInkResolution` keeps the width in pixels as the canvas resizes or the adaptive resolution drops.
