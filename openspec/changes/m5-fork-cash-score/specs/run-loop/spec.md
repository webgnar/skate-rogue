# Spec Delta

## Purpose

Defines how Gnar Run's floors chain into a run: the fork, where each road leads, pickups, and score.

## ADDED Requirements

### Requirement: Fork at the end of a floor
Every floor SHALL end at a fork with a low road on the street and a high road on an overpass that a plain ollie
cannot reach but an ollie and a flip can. Signs SHALL show each road's reward and danger before the fork.

#### Scenario: Taking the high road
- **WHEN** the skater reaches the gate on the overpass
- **THEN** the next floor is the high road's street

### Requirement: Roads and rewards
The two roads SHALL differ and at least one SHALL be a boon street. A boon street SHALL offer only its boon type;
a cash street SHALL pay cash; a hot street SHALL start Heat at 30 with denser traffic and offer 4 boons; a stash
SHALL be a shorter floor paying Stoken.

#### Scenario: Boon street
- **WHEN** a GRIND boon street is cleared
- **THEN** the offer holds only GRIND boons

### Requirement: Pickups
Each floor SHALL have cash coins along its lines and at least one Stoken. A pickup SHALL be collected once.

#### Scenario: Rolling through a coin
- **WHEN** the skater passes through a coin
- **THEN** cash goes up by one and the coin is gone

### Requirement: Combos and stoke
Landing SHALL bank the combo as points x count x speed multiplier; a slam SHALL lose it. Full stoke SHALL start
the gnar state, in which slams cost no Heat.

#### Scenario: Banking
- **WHEN** five tricks are landed at twice base speed
- **THEN** the score goes up by 5 x 100 x 5 x 2
