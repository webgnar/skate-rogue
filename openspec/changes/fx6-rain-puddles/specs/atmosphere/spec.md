# Spec Delta (planned)

## ADDED Requirements

### Requirement: Puddles form in the rain
On a rainy floor, puddles SHALL grow over the first ~20 seconds in low, flat places, never on rails or ledges,
in the same places for the same seed.

#### Scenario: Start of a rainy floor
- **WHEN** a rainy floor starts
- **THEN** there are no full puddles yet, and by 20 seconds in the puddles are full size

### Requirement: Puddle reflections and ripples
Puddles SHALL reflect the sky, the neon skyline and nearby lights, with raindrop ripples, drawn in one draw
call without rendering the scene twice.

#### Scenario: Cruiser behind you in the rain
- **WHEN** the cruiser's lights are on near a puddle
- **THEN** the puddle shows a stretched red and blue reflection

### Requirement: Splashes
Rolling through a puddle SHALL throw spray off the wheels and break its reflection; landing in one SHALL splash.

#### Scenario: Big drop into a puddle
- **WHEN** the skater lands a big drop in a puddle
- **THEN** a splash ring and a SPLSH! word appear
