## ADDED Requirements

### Requirement: Drag preview of the board
While a card or slot is dragged over a board slot, the shop SHALL draw the wires and words of the board that drop would make.

#### Scenario: Card over a slot
- **WHEN** a trigger card is held over the empty slot left of an effect
- **THEN** a pulsing wire runs from that slot to the effect and the words read "IF YOU DROP IT: <TRIGGER> ▸ <EFFECT>"

#### Scenario: Leaving the slot
- **WHEN** the card moves off the slots or is dropped elsewhere
- **THEN** the wires and words show the real board again
