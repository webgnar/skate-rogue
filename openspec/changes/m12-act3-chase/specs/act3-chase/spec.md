# Spec Delta

## Purpose

Defines act 3's escape: a chaser that punishes slams.

## ADDED Requirements

### Requirement: Slams let the chaser close in
On act 3's escape the chaser SHALL start 7 tiles behind the skater and never drop more than 8 behind. Each slam
SHALL close the gap by 2.5 tiles, and skating without slams SHALL win back 0.6 tiles a second. Forward speed
SHALL not change the gap.

#### Scenario: Three slams close together
- **WHEN** the skater slams three times in quick succession
- **THEN** the chaser catches them and the floor ends as caught
