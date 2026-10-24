# Spec Delta

## ADDED Requirements

### Requirement: Heat lighting
The cruiser's lights SHALL light the scene and the skater with red and blue light that grows with Heat. The light
on the scene SHALL change colour smoothly, never strobing the whole screen.

#### Scenario: Heat climbs
- **WHEN** Heat rises from 25 to 90
- **THEN** the siren light on the street and the skater grows from nothing to full

#### Scenario: No strobe
- **WHEN** the siren light is at full
- **THEN** the scene's light colour sweeps red to blue under once per second, with only the small flares flashing
