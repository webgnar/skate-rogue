# Proposal

## Why

zack (2026-10-24) wants slams to feel dramatic. Today a slam is a comic burst, a small camera shake and a HUD
callout, and the run carries on at the same pace, so the hit doesn't land. The GDD's Juice list (landing dust,
grind sparks as GPU particles) isn't built either, and grinds have no feedback at all.

## What Changes

- **Slam drama.** A slam freezes the game for a few frames (hit-stop), then plays back in slow motion that eases
  to full speed in about half a second. The camera punches in and tilts, then settles. Manga focus lines flash
  round the skater for the freeze, and a comic sound word (SLAM!, WHAM!, CRUNCH!, BAM!) pops up in the world
  with an ink outline and floats off. Debris and dust fly from the impact.
- **Particles.** One pooled particle system (a single draw call) for:
  - grind sparks, streaming off the back truck while on a rail (heavy) or a ledge (light), more with speed;
  - landing dust puffs on every landing, bigger on big drops;
  - slam debris and dust.
- The SLAM! HUD callout is replaced by the sound word in the world.

## Capabilities

### New Capabilities

- `game-feel`: hit-stop, slow motion, camera punch, focus lines, sound words and particles.

### Modified Capabilities

(none)

## Impact

New `src/render/particles.ts`, `src/render/focus-lines.ts`, `src/render/sound-word.ts`, `src/game/time-warp.ts`.
`Game` scales its fixed-step time through the time warp and feeds the effects from floor events; `StreetView`
gains a camera punch. Gameplay physics is unchanged: the warp only changes how fast steps are taken.
Budget: at most 256 particles in one `THREE.Points` draw, the focus lines draw only during a slam.
