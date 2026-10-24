# Spec Delta

## Purpose

Defines the authored car models and how they map to car hitboxes.

## ADDED Requirements

### Requirement: Roofs line up with the hitbox
A car model's roof SHALL sit at its hitbox roof, so a skater landing on a car stands on the drawn roof.

#### Scenario: Landing on a parked car
- **WHEN** the skater lands on a parked car's roof
- **THEN** the board's wheels touch the model's roof

### Requirement: Fallback cars
If the car models fail to load the game SHALL draw the box cars.

#### Scenario: Missing file
- **WHEN** `models/cars.glb` returns an error
- **THEN** the floor builds with the box cars
