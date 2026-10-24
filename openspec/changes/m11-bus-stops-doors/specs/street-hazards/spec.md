# Spec Delta

## Purpose

Defines street hazards that wait for the skater: bus stops and parked car doors.

## ADDED Requirements

### Requirement: Bus stops
From floor 4 a floor MAY have one bus stop on street clear of parked cars, glass, canals and cross streets. When
the skater comes within range, a bus SHALL pull from the back lane into the skate lane at the stop, signalling
while it does. It SHALL not be touchable until it is in the lane. It SHALL wait at the stop, then drive on.

#### Scenario: Rolling into the stopped bus
- **WHEN** the bus has stopped and the skater rolls into its back
- **THEN** the skater slams

### Requirement: Car doors
From floor 2 some plain parked cars SHALL have a door that opens when the skater comes within range and stays
open. An open door SHALL stand out behind the car below roof height.

#### Scenario: Landing on the door
- **WHEN** the skater lands on an open door's top edge
- **THEN** it pops them up like a car hop
