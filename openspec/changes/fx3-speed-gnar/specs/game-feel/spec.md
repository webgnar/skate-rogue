# Spec Delta

## ADDED Requirements

### Requirement: Speed lines
Speed lines SHALL appear when the skater goes clearly faster than cruising speed, growing with speed, in one draw
call.

#### Scenario: Fast rail
- **WHEN** the skater rides a rail at twice cruising speed
- **THEN** speed lines stream past the screen

### Requirement: Gnar state look
Entering the gnar state SHALL show a GNAR! word in the world without freezing the game or moving the camera. While gnar lasts the skater
SHALL glow with a colour-cycling outline and shed a sparkle trail, and speed lines SHALL show.

#### Scenario: Stoke fills
- **WHEN** the stoke meter fills
- **THEN** GNAR! pops at the skater and the glow comes on until the gnar state ends
