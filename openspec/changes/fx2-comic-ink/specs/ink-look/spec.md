# Spec Delta

## Purpose

Defines Gnar Run's comic ink look.

## ADDED Requirements

### Requirement: Toon shading
Lit materials on the skater, traffic, pickups and kit SHALL use toon shading with a few hard bands.

#### Scenario: A building in sunlight
- **WHEN** a building face turns from the sun
- **THEN** it steps to a darker flat band rather than a smooth gradient

### Requirement: Ink outlines
The skater, vehicles, pickups and solid kit pieces SHALL have black outlines of a constant screen width, drawn
per mesh without a full-screen pass. Skinned and instanced meshes SHALL be outlined too.

#### Scenario: A car spawns
- **WHEN** a car enters the street
- **THEN** it is drawn with toon shading and an ink outline
