## ADDED Requirements

### Requirement: Act 3's cloud line has sets
Act 3's cloud layer SHALL lay rainbow hubbas, S-rails, S I-beams, drone bridges and launch quarterpipes between its
clouds, never the same set twice running and no more of each than its cap a floor.

#### Scenario: a few act 3 floors
- **WHEN** floors 7-9 are built over a few seeds
- **THEN** every set appears, and none more often on a floor than its cap

#### Scenario: a launch
- **WHEN** the skater rolls up a launch quarterpipe
- **THEN** it throws them up more than 5 tiles at its own speed, over a gap no bridging deck is laid in

### Requirement: Act 3 is only passed in the clouds
On act 3's floors (not its escape), touching anything that isn't up in the cloud layer before the layer ends near the
gate SHALL mark the floor fallen, once, and the next floor SHALL be the act's first, laid fresh.

#### Scenario: rolling off the first cloud
- **WHEN** the skater rolls off the clouds onto the street
- **THEN** the floor is fallen and one 'grounded' event fires

#### Scenario: the run-up
- **WHEN** the skater is on the street before the first cloud, never having been up
- **THEN** the floor is not fallen

#### Scenario: a good player
- **WHEN** the sky bot skates act 3's floors
- **THEN** it clears most of them without a fall
