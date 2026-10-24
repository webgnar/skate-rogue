# Spec Delta

## Purpose

Defines how a floor and the skater are drawn in Gnar Run's 2.5D side view using Quest For Stoken textures and
Lou Gnar sprites.

## ADDED Requirements

### Requirement: 2.5D side view
The street SHALL be drawn as 3D geometry viewed from the side and slightly above, with gameplay on one plane and
depth only for looks. The camera SHALL follow the skater and look further ahead at higher speed.

#### Scenario: Following the skater
- **WHEN** the skater moves right at base speed
- **THEN** the skater stays in the left half of the screen and the street ahead is visible

### Requirement: Stoken textures
Street, buildings, ledges and water SHALL be textured from Quest For Stoken's Chicago tileset at one 32 px tile per
world tile, with crisp (nearest-neighbour) pixels.

#### Scenario: Pixel-crisp textures
- **WHEN** a floor is drawn on a high-density phone screen
- **THEN** the tile art is sharp, not blurred

### Requirement: Placeholder skater from Lou Gnar sprites
The skater SHALL be drawn with Lou Gnar's sprite animations matched to the physics state: push while rolling,
ollie, a random flip trick, grind, landing impact and freefall.

#### Scenario: Flip trick animation
- **WHEN** the skater does a flip trick
- **THEN** one of the kickflip, heelflip or shuvit animations plays

### Requirement: Phone performance
A floor SHALL render at 60 fps on a mid-range phone browser in landscape, lowering resolution when frames are slow.

#### Scenario: Slow device
- **WHEN** the average frame time stays above 20 ms for 2 seconds
- **THEN** the render resolution is lowered
