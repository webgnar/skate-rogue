# Design

## Where puddles go

`puddleSpots(level, seed, floor)` (pure, tested): flat walkable surfaces at least 2 tiles long, weighted toward
the street curb, the foot of stairs and banks, and roof middles; none within 1 tile of a rail, ledge, gap edge or
car. Fixed by the seed, like the rain roll.

## Growth

Each puddle has a target radius and a start delay; its radius eases from 0 to target between `delay` and
`delay + 8 s`, all puddles full by ~20 s into the floor. Drizzle floors reach 50% size, downpours 120%.

## Puddle shader

One `InstancedMesh` of flat quads just above the surface (z-fighting avoided with polygon offset). Per instance:
centre, size, growth, seed. Fragment:

- shape: a noisy blob (two octaves of value noise thresholded by growth), with a dark ink rim to match the look;
- reflection: the sky gradient flipped (top colour at the near edge), plus vertical streaks sampled from a 1D
  "skyline neon" strip baked at mood change (a 64 px row of the skyline's average neon colour per column);
- light pools: up to 4 light positions as uniforms (cruiser bar, nearest headlights/lamps), each a vertically
  stretched soft ellipse in the reflection;
- ripples: rings from a hashed grid of drop times, `sin` falloff, a few per puddle per second;
- wake: a uniform with the skater's x and the time they passed, cutting a widening V through the reflection.

## Splashes

`Particles.splash(x, y, speed)`: blue-white pixels thrown back and up off both wheels while rolling in a puddle
(rate by speed), plus a ring of drops on landing. A SPLSH! sound word only on BIG_LANDING drops into water.

## Wet look

Toon materials share a `uWet` uniform (0..1) patched in with `onBeforeCompile`: darken diffuse by 15%, and add a
hard-edged specular band from the sun on top-facing faces (cheap N·H step). One recompile per material, once.
