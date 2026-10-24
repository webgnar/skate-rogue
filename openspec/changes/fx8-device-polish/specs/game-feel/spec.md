# Spec Delta

## ADDED Requirements

### Requirement: Quality tiers
When frames stay slow and the resolution is about to drop below 1, the game SHALL step down to a lower effects
tier without the player doing anything, before lowering the resolution further.

#### Scenario: Older phone in a downpour
- **WHEN** frame time stays over 20 ms for 2 s and the next resolution step would go below 1
- **THEN** kit outlines, the lamp and headlight cones, half the rain, half the sparks and the Heat point light are
  turned off; outlines on the skater, cars and pickups stay

### Requirement: Batched street kit
The street kit SHALL merge meshes that share a look into one draw call each.

#### Scenario: A night floor
- **WHEN** a floor is built
- **THEN** its street kit draws as a few dozen meshes, not hundreds

### Requirement: Reduce motion and flashing
Settings (the URL for now, a pause menu later; saved between visits, and reduce motion on when the device asks
for it) SHALL offer reduce motion and reduce flashing, which turn off camera shake, punches, focus lines,
hit-stop, impact flashes and flare flashing.

#### Scenario: Reduce motion on
- **WHEN** the skater slams with reduce motion on
- **THEN** the burst and sound word show but the camera does not shake, punch or freeze
