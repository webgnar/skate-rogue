# Proposal

## Why

The GDD's Juice list has speed lines at flow speed, and the gnar state (full stoke: faster, slams cost no Heat)
only showed as a HUD callout and a green stoke bar. zack (2026-10-24) said to go ahead with both.

## What Changes

- Speed lines: tapered comic streaks between the skater and the camera, rushing past, fading in from 1.3x
  cruising speed (rails and drops) and full at 2.2x. One draw call.
- Gnar state:
  - entering it: a short freeze and slow-mo beat, a camera punch, a small burst and a GNAR! sound word in the
    world (replaces the HUD callout);
  - while it lasts: a pulsing colour-cycling glow outline round the skater (gold, magenta, cyan), a rainbow
    sparkle trail, and the speed lines forced on in gold and magenta.

## Capabilities

### Modified Capabilities

- `game-feel`: speed lines and the gnar state's look.

## Impact

New `src/render/speed-lines.ts`; `Aura` in `src/render/toon.ts` (a second, wider hull with its own material);
`Particles.trail`. The aura doubles the skater's draw calls only while gnar is on.
