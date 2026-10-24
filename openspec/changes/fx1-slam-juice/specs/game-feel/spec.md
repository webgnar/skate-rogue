# Spec Delta

## Purpose

Defines the moment-to-moment visual feedback in Gnar Run: slams, landings and grinds.

## ADDED Requirements

### Requirement: Slam hit-stop and slow motion
A slam SHALL freeze the game briefly, then resume in slow motion that eases back to full speed within one second.
Physics SHALL still step at a fixed 60 Hz.

#### Scenario: Slamming on a stair set
- **WHEN** the skater slams
- **THEN** no physics steps run for the freeze, then steps run slower than real time and return to full rate

### Requirement: Slam presentation
A slam SHALL show the impact burst, a camera punch, focus lines and a comic sound word at the skater, plus debris.

#### Scenario: Slam
- **WHEN** the skater slams
- **THEN** a sound word appears at the skater and the camera punches in

### Requirement: Grind sparks and landing dust
Grinding SHALL emit sparks, heavier on rails than ledges and more with speed. Landing SHALL puff dust, bigger after
a big drop.

#### Scenario: Boardslide on a handrail
- **WHEN** the skater is on a rail
- **THEN** sparks stream from the board every frame

### Requirement: Effect budget
All particles SHALL draw in a single draw call from a fixed pool of at most 256.

#### Scenario: Full pool
- **WHEN** an effect spawns with the pool full
- **THEN** the oldest particles are reused and the pool does not grow
