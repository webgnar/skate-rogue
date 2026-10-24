# Proposal

## Why

Heat showed as the cruiser closing in and its light bar. At high Heat the hunt should look like a hunt.

## What Changes

- **Cruiser searchlight** (from Heat 45): a pillar spotlight on the cruiser's roof throws a white beam and a pool
  at the skater. At low Heat it wanders round them, hunting; by Heat 85 it holds on them. It aims at the skater's
  height, so it follows them onto roofs.
- **Drone scan beam** (whenever the drone is down, Heat 75+): a thin red wedge sweeps the street below the drone,
  about 0.8 sweeps a second, with a red spot where it touches the ground.
- Both are additive fakes (4 draws, no real lights), at 45% strength in daylight and full at night. They sweep
  smoothly; nothing flashes.

## Capabilities

### Modified Capabilities

- `game-feel`: Heat visuals.

## Impact

`src/render/heat-beams.ts`, owned by `TrafficView`; `chase()` takes the skater's height (optional).
