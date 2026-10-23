# Spec Delta

## Purpose

Defines how Gnar Run makes sure every generated floor can be cleared with no boons.

## ADDED Requirements

### Requirement: Clearable floors
Every floor the game starts SHALL have been cleared by the reference bot with no boons. A floor the bot cannot
clear SHALL be re-rolled from a sub-seed, up to 8 times, and then generated one tier lower. Validation SHALL stay
deterministic for a seed and floor.

#### Scenario: Floors 1 to 8 validate
- **WHEN** floors 1 to 8 are generated for seeds 1 to 50
- **THEN** the reference bot clears every one of them

#### Scenario: Deterministic re-roll
- **WHEN** the same seed and floor are generated twice
- **THEN** both give the same validated layout
