## ADDED Requirements

### Requirement: Floors can be seen and checked in the browser
The game SHALL open a level editor at `?levels` that draws the floor the game builds for a chosen seed, floor and
road as a side view, with the reference bot's line through it and whether the bot reaches the gate at cruising
and at gnar speed.

#### Scenario: Looking at a floor
- **WHEN** the user opens `?levels&seed=2026&floor=3`
- **THEN** floor 3 of seed 2026 is drawn as the game builds it, with the bot's line and its result

### Requirement: Each floor's hill can be shaped
The editor SHALL let the user change a floor's recipe (add, remove, reorder slots and pick each slot's beats) and
its dials, and SHALL redraw the floor and re-run the bot after each change.

#### Scenario: A bigger last stairway
- **WHEN** the user raises floor 1's stair set dial
- **THEN** floor 1 is redrawn with the bigger set and the bot runs it again

### Requirement: Level edits are saved to the repo and used by the game
Saving SHALL write every floor's edits to `src/gen/level-edits.json`, and the generator SHALL use a floor's edits
in place of its code recipe and dials. With no edits a floor SHALL be built exactly as before.

#### Scenario: No edits
- **WHEN** level-edits.json has no entry for a floor
- **THEN** that floor is the same as the generator built without the editor
