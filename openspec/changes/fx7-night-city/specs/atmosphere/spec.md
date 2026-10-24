# Spec Delta (planned)

## ADDED Requirements

### Requirement: The city lights itself at night
From dusk, building windows, street lamps and car headlights SHALL light up, using fake lights (no real lights
added per lamp).

#### Scenario: An oncoming car at night
- **WHEN** an oncoming car is about to enter the screen at night
- **THEN** its headlight pool reaches the screen first

### Requirement: Things that watch you
Billboards and Flock cameras SHALL turn to track the skater when near, and billboards SHALL brighten with Heat.

#### Scenario: Passing a billboard
- **WHEN** the skater passes within 10 tiles of a billboard
- **THEN** its screen turns toward them
