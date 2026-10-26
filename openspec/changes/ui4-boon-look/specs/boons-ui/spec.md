# Spec Delta

## ADDED Requirements

### Requirement: Boon cards with art
Every boon card SHALL show a picture of what the boon is or does in its type colour, and the cards SHALL stay
readable on an iPhone SE held either way round.

#### Scenario: A duo
- **WHEN** Rocket Grind is offered
- **THEN** the card is tagged DUO, names Rail Launch + Big Pop in full and shows the rocket

#### Scenario: An upright phone
- **WHEN** the pick opens on a 375x667 screen
- **THEN** the three cards wrap to two rows and every name and effect is readable

#### Scenario: Held boons
- **WHEN** the game is paused with boons held
- **THEN** each held boon shows as a badge with its picture, name and stack count
