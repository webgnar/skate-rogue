# Spec Delta

## ADDED Requirements

### Requirement: Acts and escapes
A run SHALL be 5 acts of 3 floors. After each act's third floor the skater SHALL skate that act's escape before the
next road. Clearing act 5's escape SHALL win the run.

#### Scenario: End of act 1
- **WHEN** floor 3 is cleared and its boon picked
- **THEN** the act 1 escape (the roadblock) starts, and after it the road taken at floor 3's fork

### Requirement: Roadblock
The roadblock SHALL be clearable with no boons by car-hopping from a car onto a bus too tall for a plain ollie;
hitting a vehicle's side SHALL be a slam.

#### Scenario: Validated escapes
- **WHEN** an escape floor is generated
- **THEN** the reference bot reaches its gate
