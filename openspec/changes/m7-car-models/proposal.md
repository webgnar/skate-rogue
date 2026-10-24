# Proposal

## Why

zack (2026-10-24) wants the game's models built in Blender. After the skater and board, the cars are the most
visible models: traffic is the main hazard and the enforcer cruiser is the Heat meter.

## What Changes

- `public/models/cars.glb` (`art/cars.py`): a Prius-style hatchback (traffic and parked cars, repainted per car), a
  white robotaxi on the same body (lidar puck, fender sensors, cyan strip) and the enforcer cruiser, a Tahoe-style
  sheriff SUV (black, gold swoosh and star, grille guard), which only chases so it keeps its own bigger size, each about 750 tris,
  with wheel arches, windows, B pillar, mirrors, door seams, handles, bumpers, grille, lamps and rims.
- Sized to the car hitbox: 2.3 long, 1.6 wide, the flat roof exactly at the hitbox roof so landing on it still
  lines up. `makeCar` stretches a model to other hitbox sizes and falls back to the box car if the GLB is missing.
- `public/models/drone.glb` (`art/drone.py`): the high-Heat enforcer drone, with four rotors the game spins.
- `src/render/models.ts` loads the GLBs at startup; the cruiser's flashing light bar stays code-built on the roof.
- A CTA-style bus (`Bus`) and a box truck (`BoxTruck`, roll-up door open, box in the truck's paint) in `cars.glb`, at their hitbox sizes (6 x 2.25 and 4 x 2 tiles). The truck's tailgate ramp stays code-built because its length comes from the level.

## Capabilities

### New Capabilities

- `car-models`: the authored car models and how they map to car hitboxes.

### Modified Capabilities

(none)

## Impact

`kit.ts` `makeCar` takes a model name; `traffic-view.ts` asks for the robotaxi and cruiser; `main.ts` loads the
models before building the first floor. No physics changes.
