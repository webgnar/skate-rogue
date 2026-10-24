## ADDED Requirements

### Requirement: Flip tricks move the board the way the real tricks do
Each flip trick SHALL roll and spin the board the way the trick works: kickflip rolls toe edge up (negative roll),
heelflip the other way, backside shove-its spin the tail behind the heels (negative yaw), frontside ones the other
way. A 360 flip is a full backside spin and a full kickflip roll together; a hardflip is a frontside half spin and a
kickflip roll with the board up on end between the legs; varials are a half shove-it and a flip.

#### Scenario: 360 flip
- **WHEN** the 360 flip clip finishes
- **THEN** the board has turned a full backside spin and a full kickflip roll

#### Scenario: Feet after a shove-it
- **WHEN** a trick that turns the board half round under the skater lands
- **THEN** the front foot lands toward the direction of travel and the back foot behind, without crossing the legs

### Requirement: 180s leave the skater riding fakie
A backside or frontside 180 SHALL turn the skater and board together, feet on the board, and the rig SHALL show the
skater fakie (turned half round, back foot leading) while the sim's `fakie` is set.

#### Scenario: Backside 180
- **WHEN** the backside 180 clip finishes
- **THEN** the skater has turned half a turn with the board, the front foot trailing

### Requirement: Grinds show the right truck on the rail
5-0 SHALL grind the back truck with the nose up; backside smith SHALL lock the back truck with the nose dipped
toward the camera; feeble SHALL lock the back truck with the front truck over the far side.

#### Scenario: Smith
- **WHEN** the smith clip plays
- **THEN** the back truck is on the rail and the nose is lower and toward the camera
