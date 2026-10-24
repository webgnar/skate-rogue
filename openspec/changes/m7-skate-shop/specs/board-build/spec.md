# Spec Delta

## Purpose

Defines the board build: slots, triggers and effects, and the skate shop where mods are bought.

## ADDED Requirements

### Requirement: Board slots
A board SHALL start with 3 slots and hold at most 5. Each slot SHALL hold one mod or nothing.

#### Scenario: Buying a slot
- **WHEN** the skater buys a slot with 3 slots
- **THEN** the board has 4 slots, the new one empty

### Requirement: Triggers fire the effects to their right
When a trigger's event happens, the effects after it SHALL fire left to right until the next trigger. Effects
with no trigger before them SHALL not fire.

#### Scenario: Grind end speed kick
- **WHEN** the board is [On Grind End] [Speed Kick] [Cash Burst] and the skater leaves a rail
- **THEN** the skater gets the speed kick and the run gets the cash, in that order

### Requirement: The skate shop
The shop SHALL sell 4 mods with at least one trigger and one effect, a slot and a restock, for run cash. Buying a
mod SHALL place it in the slot the skater picks, replacing what was there. Swapping two slots SHALL be free.

#### Scenario: Not enough cash
- **WHEN** a mod costs more than the skater's cash
- **THEN** it can't be bought

### Requirement: Shop road
From floor 2 a fork MAY lead to the shop, and the fork at the end of every third floor SHALL. The other road
SHALL be a boon street. After the shop the skater SHALL skate a boon street.

#### Scenario: Third floor
- **WHEN** floor 3 ends
- **THEN** one of its fork's roads is the skate shop
