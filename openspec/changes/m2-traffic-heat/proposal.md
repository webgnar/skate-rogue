# Proposal

## Why

The run now has boons and validated floors, but the only way to lose is a canal and slams just cost speed. The GDD
makes moving traffic the main hazard and the Heat chase the tension: an enforcer cruiser you can see behind you,
which catches you after a few slams close together. zack likes being chased, and every slam and boon pick should
matter. (Drafted ahead of zack's pick on the "what next" card; recommended option.)

## What Changes

- Moving traffic in the skate lane: robotaxis (same direction, slower than you, brake when you close in) and
  oncoming cars (fast closing speed), with roofs you car-hop and sides that slam, plus background lanes for life.
- A seeded traffic director that spawns cars over time on generator-marked spots, scales density with the floor,
  and never spawns a car the base-stat skater can't get over or onto.
- Heat from 0 to 100 with the GDD's starting numbers (slam +35, slow skating +10/s, trick -3, grind -4/s,
  car-hop -8, clean skating -6/s, reset per floor), shown only by the enforcer cruiser's distance behind you.
- Escalation cues at 50, 75 and 90 (lights, a drone, a pulsing screen edge and vibration where supported).
- Caught at 100 ends the run with a short camera beat, then the run-over screen.
- Telegraphing: headlights and an edge-of-screen marker for oncoming cars at least 0.75 s before contact.
- The floor validator's bot skates with traffic on, so validated floors stay clearable.

Out of scope: cross traffic, buses, trucks, door hazards, drones as hazards, near-miss scoring, audio, COOL and
STREET boons (next change).

## Capabilities

### New Capabilities

- `traffic`: vehicles in the skate lane, how they move, how the skater interacts with them, and how the director
  spawns them fairly.
- `heat-chase`: Heat, what moves it, how the cruiser shows it, escalation, and being caught.

### Modified Capabilities

(none yet; earlier changes are not archived)

## Impact

- New: `src/traffic/*` (vehicles, director), `src/heat/*`, render meshes for moving cars and the cruiser.
- Changed: `src/physics/skater.ts` (moving car roofs and sides), `src/physics/level.ts` (spawn marks),
  `src/gen/validate.ts` (bot with traffic), `src/game/game.ts` (Heat, caught), HUD for warnings.
