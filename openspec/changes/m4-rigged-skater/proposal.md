# Proposal

## Why

zack (2026-10-24) chose a rigged 3D skater to replace the sprite placeholder, standing regular and facing the camera,
and asked for attention to detail: the tricks have to move the way real tricks do.

## What Changes

- A low-poly astronaut (Lou Gnar's look: white suit, black visor, flag patch, black shoes, red deck, cream wheels) on
  a joint hierarchy, drawn in its own pass over the level.
- Pose clips for push, ride, ollie, kickflip, heelflip, pop shove-it, 360 shove-it, 50-50, boardslide, landing,
  air, slam and bail. The board is driven by the feet: while a foot is on the deck it stays on the deck.
- Two-bone leg IK to the feet; crossfades between clips that take spun boards the short way round.
- Grinds on ledges show a 50-50, handrails a backside boardslide, matching the HUD callouts.

## Capabilities

### New Capabilities

- `skater-rig`: how the skater is posed and how each trick moves the board and body.

### Modified Capabilities

(none)

## Impact

New `src/render/poses.ts` and `src/render/skater-rig.ts`; `skater-sprite.ts` is removed. `StreetView` renders a
second scene after clearing depth. No physics changes.
