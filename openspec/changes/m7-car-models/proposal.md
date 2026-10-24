# Proposal

## Why

zack (2026-10-24) wants the game's models built in Blender. After the skater and board, the cars are the most
visible models: traffic is the main hazard and the enforcer cruiser is the Heat meter.

## What Changes

- `public/models/cars.glb` (`art/cars.py`): a sedan (traffic and parked cars, repainted per car), a white robotaxi
  (lidar puck, fender sensors, cyan strip) and the black and white enforcer cruiser (push bar), each about 750 tris,
  with wheel arches, windows, B pillar, mirrors, door seams, handles, bumpers, grille, lamps and rims.
- Sized to the car hitbox: 2.3 long, 1.6 wide, the flat roof exactly at the hitbox roof so landing on it still
  lines up. `makeCar` stretches a model to other hitbox sizes and falls back to the box car if the GLB is missing.
- `src/render/models.ts` loads the GLB at startup; the cruiser's flashing light bar stays code-built on the roof.

## Capabilities

### New Capabilities

- `car-models`: the authored car models and how they map to car hitboxes.

### Modified Capabilities

(none)

## Impact

`kit.ts` `makeCar` takes a model name; `traffic-view.ts` asks for the robotaxi and cruiser; `main.ts` loads the
models before building the first floor. No physics changes.
