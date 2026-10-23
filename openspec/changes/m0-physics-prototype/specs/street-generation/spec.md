# Spec Delta

## Purpose

Turns a seed and a floor number into a street layout built from hand-made 16 x 10 pieces, as Quest For Stoken's
Survivor mode does, so every floor is different but reproducible.

## ADDED Requirements

### Requirement: Deterministic layout
The same seed and floor number SHALL always produce the same layout.

#### Scenario: Regenerating a floor
- **WHEN** a floor is generated twice with seed 1234 and floor 3
- **THEN** both layouts are identical

### Requirement: Piece stitching
A floor SHALL be a start piece, then `clamp(3 + floor, 4, 12)` pieces chosen from the library, then an exit piece.
Every piece SHALL be 16 columns wide and start and end on street.

#### Scenario: Floor 1 length
- **WHEN** floor 1 is generated
- **THEN** it has 6 pieces in total (start, 4 chosen, exit) and is 96 columns wide

### Requirement: Tiers by floor
Pieces SHALL have tiers 1 to 3. A floor SHALL only use tiers up to `min(3, 1 + (floor - 1) div 2)`, the same piece
SHALL NOT appear twice in a row, and the newest allowed tier SHALL be three times as likely as older tiers.

#### Scenario: Early floors are easy
- **WHEN** floors 1 and 2 are generated
- **THEN** they only contain tier 1 pieces (plus start and exit)

### Requirement: Layout contents
A layout SHALL expose the street surface, gaps, one-way platforms, flat rails, curved rails with their end points
and bow, and parked car positions.

#### Scenario: Reading a rail
- **WHEN** a piece containing two `r` marks is used
- **THEN** the layout contains one curved rail between those two points with the piece's bow
