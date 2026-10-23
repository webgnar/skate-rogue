# Spec Delta

## Purpose

Defines a run in Gnar Run's first boon build: floors in order, a boon pick between floors, and the run ending.

## ADDED Requirements

### Requirement: Floors with picks between them
A run SHALL start on floor 1 with no boons. Reaching a floor's exit gate SHALL pause the street, show the boon
pick, and start the next floor with the picked boon applied. Boons SHALL persist for the whole run.

#### Scenario: Boon carries to later floors
- **WHEN** the player picks Big Pop after floor 1 and reaches floor 3
- **THEN** the skater's ollie on floor 3 still has the Big Pop effect

### Requirement: Run over
Falling into a gap SHALL end the run and show the floor reached and the boons held. A tap SHALL start a new run on
floor 1 with no boons and a new seed, unless the seed was fixed with `?seed=`.

#### Scenario: Fixed seed restarts the same street
- **WHEN** the page was opened with `?seed=42` and the run ends
- **THEN** the next run's floor 1 has the same layout as the first run's floor 1

### Requirement: No accidental picks
Taps in the first 300 ms after the pick screen or the run-over screen appears SHALL be ignored.

#### Scenario: Holding through the gate
- **WHEN** the player is holding the button as the skater reaches the exit gate
- **THEN** no card is picked until the player releases and taps again after 300 ms
