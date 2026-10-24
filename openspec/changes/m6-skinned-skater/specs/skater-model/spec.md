# Spec Delta

## Purpose

Defines the authored skater model and how it is bound to the pose rig.

## ADDED Requirements

### Requirement: Skinned model follows the rig
The skater model SHALL be a skinned GLB whose bones follow the pose rig's joints every frame, so every clip poses it
the same way it poses the rig.

#### Scenario: Ollie pop
- **WHEN** the ollie clip reaches its pop
- **THEN** the model's feet are on the board where the rig's feet are

### Requirement: Fallback body
If the model fails to load the game SHALL show the procedural body instead.

#### Scenario: Missing file
- **WHEN** `models/lou-gnar.glb` returns an error
- **THEN** the run starts with the capsule astronaut
