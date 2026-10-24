# Proposal

## Why

The GDD says Heat is shown by the world (sirens, light), not a bar, and that at 50 the cruiser's lights reach
the screen. The cruiser's light bar only blinked two tiny boxes. zack (2026-10-24) said to go ahead.

## What Changes

- The cruiser's light bar throws real light: a point light over the bar lights the street, buildings and skater,
  growing from Heat 25 to full at 90 (and full when caught). Since the cruiser closes in as Heat rises, the light
  reaches the skater on its own.
- A red-blue wash over the whole scene grows with Heat, so it reads even when the cruiser is down on the street
  below the rooftops.
- Additive glow flares with a comic star cross on the light bar, alternating red and blue.
- Photosensitivity: only the small flares alternate hard; the light on the scene sweeps smoothly between red and
  blue at 0.9 cycles per second, so the screen never strobes.

## Capabilities

### Modified Capabilities

- `game-feel`: Heat lighting.

## Impact

New `src/render/heat-light.ts`; `TrafficView` owns it and updates it from `chase`. One point light and one
hemisphere light in each pass, created once (materials compile once; only intensity and colour change).
