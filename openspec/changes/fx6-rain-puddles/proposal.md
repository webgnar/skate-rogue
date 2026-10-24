# Proposal (built: see tasks for what is deferred)

## Why

Rain (fx5) is streaks and grey light only. zack (2026-10-24): "rain creates puddles". Water on the ground is what
sells a wet city: neon smeared across the asphalt, splashes under the wheels, a rooftop that shines.

## What Changes

- **Puddles that form.** On a rainy floor, puddles grow over the first ~20 s from small dark spots to full pools,
  so a floor visibly gets wetter. They sit in low spots the generator already knows: the street along the curb,
  the bottom of stair sets and banks, flat rooftops. Never on rails or ledges (grind surfaces stay readable).
- **Reflections, cheaply.** Each puddle mirrors the sky gradient and the skyline's neon as vertical smeared
  streaks, plus a stretched glow under each nearby light (cruiser bar, headlights, lamps), drawn in the puddle's
  own shader. No second render of the scene.
- **Ripples.** Raindrops ring the puddle surface (animated rings in the shader, denser in heavy rain).
- **Splashes.** Rolling through a puddle throws a fan of drops off the wheels and leaves a short wake that
  breaks the reflection; landing in one is a big splash with a comic SPLSH! word on big drops.
- **Wet surfaces.** Everything outdoors gets a darker toon band and a thin specular streak along top edges, so
  ledges and rails glint.
- **Rain intensity.** Each rainy floor rolls drizzle, rain or downpour; downpours also get a slow, single
  lightning glow in the sky (a soft fade, never a strobe).
- **Drips** off ledges and awnings, and small splashes on Lou's helmet in a downpour.

## Capabilities

### Modified Capabilities

- `atmosphere`: puddles, wet surfaces, rain intensity.
- `game-feel`: splashes.

## Impact

New `src/render/puddles.ts` (one instanced mesh of puddle quads, one shader), puddle spots from the level's
surfaces, splash emitters in `particles.ts`, a `wet` uniform shared by toon materials. Budget: one extra draw
call for every puddle together; reflections are faked in the shader.

## Open questions (decision cards when this starts)

- Should puddles change gameplay (a little slide, like the GDD's "rain slightly lowers grip"), or stay visual?
  That one is the gameplay thread's call too.
