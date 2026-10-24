# Spec Delta

## Purpose

Defines Heat and the enforcer chase that makes slams matter in Gnar Run.

## ADDED Requirements

### Requirement: Heat
Heat SHALL range from 0 to 100, start each floor at 0, rise by 35 per slam and 10 per second below base speed,
and fall by 3 per trick, 4 per second grinding, 8 per car-hop and 6 per second of clean skating (no slam in the
last 3 s).

#### Scenario: Three quick slams
- **WHEN** the skater slams three times within 4 seconds
- **THEN** Heat reaches 100

#### Scenario: One slam is forgiven
- **WHEN** the skater slams once and then skates cleanly for 10 seconds
- **THEN** Heat is back to 0

### Requirement: The cruiser is the meter
Heat SHALL be shown only by an enforcer cruiser behind the skater: off screen at 0, level with the skater at 100.
The cruiser SHALL not move closer during the 36 frames after a slam.

#### Scenario: Remount hold
- **WHEN** the skater slams
- **THEN** the cruiser's position does not change until the remount ends

### Requirement: Caught
Reaching 100 Heat SHALL end the run with a short camera beat on the cruiser and a run-over screen marked CAUGHT.

#### Scenario: Caught ends the run
- **WHEN** Heat reaches 100
- **THEN** the sim stops and the run-over screen shows CAUGHT and the floor reached
