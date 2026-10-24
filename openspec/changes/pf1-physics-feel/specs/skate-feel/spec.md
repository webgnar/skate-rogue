# Spec Delta

## Purpose

Defines how landings, slopes and grinds feel in Gnar Run, and the body and board response the renderer animates.

## ADDED Requirements

### Requirement: Landing impact
Every landing SHALL report its impact as the skater's speed into the surface along the surface's normal, in px per
frame.

#### Scenario: A bank soaks up a drop
- **WHEN** the skater lands with the same velocity on flat ground and on a bank that falls away
- **THEN** the bank landing's impact is smaller

### Requirement: Landing quality
A landing SHALL be `clean` below 7 px/frame, `heavy` from 7, and `sketchy` from 9.5 onto ground that doesn't fall
away. A flip landed after 60% but before 100% of its catch SHALL be sketchy, and before 60% SHALL be a slam. Heavy
and sketchy landings SHALL cost only flow speed, never cruising speed.

#### Scenario: Drops by height
- **WHEN** the skater rolls off a roof 1, 4 and 8 tiles above the street
- **THEN** the landings are clean, heavy and sketchy

#### Scenario: Mid-flip
- **WHEN** the skater touches down 25% of the way through a flip's catch
- **THEN** it is a slam

### Requirement: Flip catch matches the rig
Each trick's catch time SHALL equal the time of the first key in its clip where the board stops turning.

#### Scenario: Clip timing changes
- **WHEN** a trick clip's catch key moves and the sim's catch time does not
- **THEN** the test suite fails

### Requirement: Slopes
Rolling a bank SHALL add gravity along the slope to flow speed downhill and take it away uphill, with cruising speed
held. An ollie SHALL add the vertical speed the ground was giving the skater to the pop.

#### Scenario: Up bank launch
- **WHEN** the skater ollies with the same hold on flat ground and on an up bank
- **THEN** the ollie off the bank goes higher

### Requirement: Grind materials
Surfaces and rails SHALL have a material, steel or concrete. Curved rails SHALL lose speed to friction in proportion
to the material's friction and the cosine of the rail's angle.

#### Scenario: Concrete bites harder
- **WHEN** the skater rides the same flat curved rail in steel and in concrete
- **THEN** both lose speed, and the concrete one loses more

### Requirement: Body and board response
The skater SHALL expose squash, lean, wobble and board pitch, stepped with the sim. Board pitch SHALL follow the
ground under both trucks and ease to level in the air.

#### Scenario: Over a lip
- **WHEN** the skater rolls from a roof onto a bank
- **THEN** the board's pitch passes between level and the bank's angle while one truck is on each
