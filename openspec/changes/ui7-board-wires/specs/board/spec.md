# Spec Delta

## ADDED Requirements

### Requirement: The board shows what fires what
The shop and the HUD SHALL draw a wire from each trigger to the effects it fires and mark slots that never fire.

#### Scenario: An effect left of every trigger
- **WHEN** the board is SPARKS, ON OLLIE, ×2, KICK, ON LAND
- **THEN** a wire runs from OLLIE to KICK, SPARKS and LAND are crossed out, and the shop reads "OLLIE ▸ ×2 KICK"
