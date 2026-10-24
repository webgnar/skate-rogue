# Design

## Context

The sim is pure and steps at a fixed 60 Hz (`src/game/loop.ts`, with render interpolation), in QFS units (px,
frames, 32 px tiles). QFS's numbers (gravity 0.25, ollie -5, fall cap 10) are decided and stay. The feel layer sits
on top: it changes what landings and slopes do, and gives the renderer a body to animate.

## Decisions

### Impact is measured along the surface normal

`impact = (vsp - hsp * m) / sqrt(1 + m^2)` for a surface of slope m (y down). Landing flat it is the fall speed;
landing on a bank that falls away it is much smaller, which is why real skaters land in transitions. With QFS
gravity, a drop of h px hits at `sqrt(0.5 h)`: 1 tile is 4, 3 tiles about 7, 5.5 tiles 9.5, capped at 10.

| Quality | When | What it costs |
| --- | --- | --- |
| clean | impact under 7 (under 4.5 is a "kiss") | nothing |
| heavy | impact 7 to 9.5, or more into a falling bank | flow speed: 8% per px/frame over 7 (Butter saves it) |
| sketchy | 9.5+ to flat, or a flip landed 60 to 100% through its catch | 40% of flow speed, a heel-toe rock |
| slam | stairs, Speed Wobbles, or a flip landed under 60% through its catch | the usual slam |

A slam from a flip that's barely started is rare in practice: a flip always gives at least a short hop that takes
longer than most catches. It shows up flipping up onto something higher (a bus, a roof), which is exactly when real
skaters land sketchy. On the validator's bot across 240 floors: 55% clean, 29% heavy, 16% sketchy (the descents
have a lot of 5+ tile drops to flat), 0.5% slams.

### Flip catch times come from the clips

`TRICK_CATCH` in `src/physics/tricks.ts` is the first key in each clip of `src/render/poses.ts` where the board's
roll and yaw reach their final values. `tests/feel.test.ts` recomputes it from the clips. The Blender actions are
baked from the code clips at the same timing.

### Slopes use gravity along the slope; flow speed only

Rolling a bank adds `g * sin(angle)` a frame to flow speed (carry) downhill and removes it uphill. Cruising speed
never drops (GDD: no braking). An ollie adds the ground's vertical speed (`slope * hsp` on a bank, `railV * ty` on a
curved rail) to the pop, so momentum is conserved. This makes ollies off down handrails lower than before; the
validator still clears every floor (50 seeds x floors 1-8: 0 failures, 700 generation tries against 703 before).

### Grind friction by material

Flat bars keep QFS's pull up to grind speed (decided), scaled by material: concrete 0.88x the target and 0.6x the
accel. Curved rails lose `g * mu * cos(angle)` a frame: steel mu 0.05, concrete 0.12. The entry wobble scales with
how hard you come in across the rail, less on wide concrete.

### Body springs live in the sim

Squash (knees), lean (torso) and wobble (heel-toe rock) are damped springs stepped at 60 Hz in `Feel`, so they are
deterministic and testable, and the effects can read the same values. Board pitch comes from the ground height
under each truck (17 px wheelbase): level with a truck hanging over an edge, tipping as the front truck rolls onto a
bank. In the air it eases back to level. The rig (models thread) reads these in `absorb()`.

## Out of scope

- Per-biome gravity (GDD), rain grip, gear wear: their own changes.
- Making ledges grindable: a gameplay call (ledges are platforms today). The `concrete` material is ready for it.
- Mirrored switch-stance tricks.
