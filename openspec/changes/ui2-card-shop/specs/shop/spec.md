# Spec Delta

## ADDED Requirements

### Requirement: Drag cards to buy
The skate shop SHALL show its stock as cards that the player drags onto their board slots or gear to buy, and SHALL
still accept tap then tap.

#### Scenario: Buying a mod by dragging
- **WHEN** the player drags the Speed Kick card onto their second slot with enough cash
- **THEN** Speed Kick is in the second slot, its price comes off the cash, and its card is gone from the hand

#### Scenario: Dropping on nothing
- **WHEN** the player lets go of a card away from any slot or gear
- **THEN** the card flies back to the hand and nothing is bought

#### Scenario: Too poor
- **WHEN** the player tries to drag a card that costs more than their cash
- **THEN** the card shakes and doesn't lift
