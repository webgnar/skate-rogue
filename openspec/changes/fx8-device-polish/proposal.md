# Proposal (planned, not built)

## Why

Everything so far was checked on headless screenshots, not on zack's older iPhone. Effects need tuning on the
real device, a way down when frames drop, and settings for players they don't suit.

## What Changes

- **On-device tuning pass** with zack: ink width, gnar glow, speed line amount, rain density, Heat light
  strength, slam timing (the gnar freeze was already cut for being jarring, 2026-10-24).
- **Quality tiers** chosen automatically from frame time (the renderer already drops resolution): low tier drops
  kit outlines (keeps skater, cars and pickups), halves rain and particles, turns the Heat point light off (wash
  only), and simplifies puddles to flat reflections.
- **Accessibility settings** in pause: reduce motion (no camera shake, punch, focus lines or hit-stop), reduce
  flashing (no impact flash, flares steady), and a Heat cue that isn't only red/blue colour (pulsing edge pattern).
- **Performance overlay** behind `?debug`: draw calls, triangles, frame time graph, tier.

## Capabilities

### Modified Capabilities

- `game-feel`: quality tiers and accessibility options.

## Impact

`StreetView.adapt` grows into a tier manager; effect classes take a tier; a small settings store saved with the
run save. No new art.
