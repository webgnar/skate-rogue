# Spec Delta (planned)

## ADDED Requirements

### Requirement: Quality tiers
When frames stay slow after the resolution has dropped, the game SHALL step down to a lower effects tier
without the player doing anything.

#### Scenario: Older phone in a downpour
- **WHEN** frame time stays over 20 ms at the lowest resolution
- **THEN** kit outlines, half the rain and the Heat point light are turned off

### Requirement: Reduce motion and flashing
The pause menu SHALL offer reduce motion and reduce flashing, which turn off camera shake, punches, focus lines,
hit-stop, impact flashes and flare flashing.

#### Scenario: Reduce motion on
- **WHEN** the skater slams with reduce motion on
- **THEN** the burst and sound word show but the camera does not shake, punch or freeze
