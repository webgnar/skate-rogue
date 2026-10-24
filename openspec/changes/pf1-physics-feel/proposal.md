# Proposal

## Why

zack (2026-10-24): "we need to develop a physics framework if we haven't already to really sell the feel of this
game". The QFS port already gives a fixed 60 Hz step, the ollie, grinds, curved rails and rail speed that fades.
What it doesn't have is the feel layer: every landing is the same, slopes are just a height, the board snaps to the
ground's angle, and the rig has nothing to react to. zack is strict about real skate mechanics, so the layer is
built from how skating really works, not from arcade fudge.

## What Changes

- **Landing impact and quality.** Every landing measures its impact (speed into the surface along its normal) and
  is `clean`, `heavy`, `sketchy` or `slam`. Drops read by height: about 1 tile is a kiss, 3 tiles heavy, 5.5 tiles
  or more to flat is sketchy. A bank that falls away soaks up any drop. Landing a flip before it is caught is
  sketchy late in the catch and a slam early (the GDD's "landing mid-flip"). Heavy and sketchy landings cost flow
  speed, never cruising speed.
- **Flip catch in sync with the rig.** Each trick's catch time is the key in its clip where the board stops turning;
  a test fails if the clip and the sim drift apart.
- **Slopes.** Gravity along a bank adds flow speed downhill and takes it away uphill. Landing on a slope keeps the
  speed along it. An ollie keeps the vertical speed the ground was giving you: up banks launch higher, popping off a
  down handrail still carries you down.
- **Grind materials.** Surfaces and rails carry a material (steel or concrete). Curved rails lose a little speed to
  friction; concrete bites harder than steel and rocks you less.
- **Body and board response.** `skater.feel` holds springs the rig reads: knee squash, torso lean, heel-toe wobble,
  and the board's pitch from where its two trucks touch the ground (it tips over a bank's lip).
- **The lip.** An ollie at the very edge of the ground is flagged as popped off the lip, for style and effects.

## Capabilities

### New Capabilities

- `skate-feel`: landing impact and quality, slopes, grind materials, and the body and board response.

### Modified Capabilities

(none; earlier changes are not archived)

## Impact

- `src/physics/feel.ts` (new), `skater.ts`, `level.ts`, `tricks.ts`; `src/game/game.ts` passes `feel.pitch` to the rig.
- The models thread owns the rig side (`absorb()` in `skater-rig.ts`, PR #62), the effects thread scales landing
  effects by `impact` and `quality`, and the gameplay thread can score them. No change to floor generation; the
  validator still clears every floor.
