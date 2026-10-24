# Spec Delta

## Purpose

Defines Gnar Run's downhill floors: a descent from high up to the street through stair sets, handrails, drop-offs,
gaps and a few banks, then a street finale.

## ADDED Requirements

### Requirement: Descent shape
Each floor SHALL start at least 12 tiles above the street, end on the street, and contain at least one stair set
and one handrail. It SHALL contain at least one bank on floors with 8 or more sections. Floors SHALL grow longer and
higher with depth.

#### Scenario: Floor 1 shape
- **WHEN** floor 1 is generated for any seed
- **THEN** it starts at least 12 tiles above the street and contains a stair set and a handrail

### Requirement: Stair slams
Touching a stair set's steps, from the air or by rolling off the top, SHALL slam the skater, who then rolls down
to the bottom of the stairs.

#### Scenario: Rolling off the top
- **WHEN** the skater rolls off the top of a stair set without pressing
- **THEN** the skater slams and ends up rolling on the terrace below

### Requirement: Banks launch
Rolling up a bank SHALL carry the skater up to the higher terrace or into the air off its top edge.

#### Scenario: Bank kick
- **WHEN** the skater rolls up a bank that ends in open air
- **THEN** the skater leaves the top edge moving upward

### Requirement: Clearable with base physics
Every floor SHALL be cleared by the reference bot with no boons.

#### Scenario: Validated descents
- **WHEN** floors 1 to 8 are generated for seeds 1 to 50
- **THEN** the reference bot clears every one
