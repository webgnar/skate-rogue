# Spec Delta

## Purpose

Defines how Gnar Run's rigged skater is posed and how its tricks move.

## ADDED Requirements

### Requirement: Feet drive the board
While a foot is on the board it SHALL stay on the deck surface wherever the board pitches, lifts or spins. Flips and
shove-its SHALL turn the board with both feet off it.

#### Scenario: Ollie pop
- **WHEN** the ollie reaches its pop
- **THEN** the tail touches the ground, the back wheels are not below it, and the back foot is on the tail

### Requirement: Trick directions
For a regular skater facing the camera, a kickflip SHALL roll the board negative about its long axis, a heelflip
positive, and shove-its SHALL spin it flat with the tail swinging behind the heels.

#### Scenario: Kickflip mid-air
- **WHEN** a kickflip is a quarter through its rotation
- **THEN** the board's underside faces the camera

### Requirement: Clean blends
Blends between clips SHALL take board rotations the short way round (a full flip, or half a flat spin).

#### Scenario: Landing a flip
- **WHEN** a kickflip ends at -2π and the landing clip starts at 0
- **THEN** the board does not rotate during the blend

### Requirement: Reachable legs
Every foot target in the riding and trick clips SHALL be within the legs' reach.

#### Scenario: Pushing
- **WHEN** the push kicks the back foot furthest back
- **THEN** the leg reaches the ground without stretching
