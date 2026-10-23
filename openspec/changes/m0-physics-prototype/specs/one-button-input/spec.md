# Spec Delta

## Purpose

Defines how the single button is read from touch, mouse and keyboard so the game plays the same everywhere.

## ADDED Requirements

### Requirement: Single button from any source
A touch anywhere on the game, a primary mouse button, Space or Up SHALL all act as the one button, with press and
release events.

#### Scenario: Touch on a phone
- **WHEN** the player touches the screen and lifts the finger
- **THEN** the game receives a press and then a release

### Requirement: Input buffering
A press up to 100 ms before the skater can act on it (for example just before landing) SHALL still be applied.

#### Scenario: Early press before landing
- **WHEN** the player presses 4 steps before the skater lands with no jumps left
- **THEN** the skater ollies on landing

### Requirement: No browser gestures
Touching the game SHALL NOT scroll, zoom, select text or open a context menu.

#### Scenario: Long press
- **WHEN** the player holds a finger on the screen for 2 seconds
- **THEN** no browser menu or text selection appears and the hold counts as holding the button
