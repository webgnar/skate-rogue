# Spec Delta

## Purpose

Defines Gnar Run's time of day and weather.

## ADDED Requirements

### Requirement: The clock advances through a run
Each floor SHALL be lit for a time of day that moves from afternoon on floor 1 through golden hour and dusk to
night by act 5, and stays night after that.

#### Scenario: Late in the run
- **WHEN** the skater reaches floor 13
- **THEN** it is night, with stars and the skyline's neon lit

### Requirement: Rain
Some floors from floor 2 on SHALL be rainy, the same floors for the same run seed, with rain streaks and greyer
light. Floor 1 SHALL never rain.

#### Scenario: Same seed
- **WHEN** a run with the same seed reaches the same floor
- **THEN** it rains or doesn't the same way
