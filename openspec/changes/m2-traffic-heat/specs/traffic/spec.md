# Spec Delta

## Purpose

Defines moving traffic in Gnar Run's skate lane and how the traffic director spawns it fairly.

## ADDED Requirements

### Requirement: Vehicles in the skate lane
Robotaxis SHALL drive the same way as the skater, slower than base speed, and brake when the skater is within 3
tiles behind them. Oncoming cars SHALL drive toward the skater. Landing on any vehicle roof SHALL car-hop, and
touching a vehicle's side SHALL slam, as with parked cars.

#### Scenario: Catching a robotaxi
- **WHEN** the skater rolls up behind a robotaxi without pressing
- **THEN** the robotaxi brakes before contact, and the skater slams into it only if it does not ollie

### Requirement: Readable warning
Every oncoming car SHALL be shown on screen or by an edge marker at least 45 frames before it can reach the
skater.

#### Scenario: Oncoming warning
- **WHEN** an oncoming car is spawned
- **THEN** at least 45 frames pass between its marker appearing and the earliest possible contact

### Requirement: Fair, seeded director
The director SHALL spawn vehicles from the floor seed at skater x positions, so the same seed gives the same
traffic, and SHALL not place a vehicle where the reference bot with no boons cannot clear it.

#### Scenario: Same seed, same traffic
- **WHEN** a floor is played twice with the same seed and the same inputs
- **THEN** the same vehicles spawn at the same places
