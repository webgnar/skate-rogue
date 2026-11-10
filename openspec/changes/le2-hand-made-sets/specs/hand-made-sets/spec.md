## ADDED Requirements

### Requirement: Sets are drawn in the browser
`?sets` SHALL let a set be made from the game's pieces on the tile grid, and SHALL redraw the reference bot's line
after every change.

#### Scenario: a new set
- **WHEN** a stairway with a handrail and a ledge after it are placed
- **THEN** the bot's line is drawn over them, and the set's result at cruising and gnar speed is shown

#### Scenario: playing a set
- **WHEN** "play it" is pressed
- **THEN** the game opens on a test floor that holds the set, with unsaved changes

### Requirement: The generator lays sets into floors
A set that is turned on SHALL appear on floors of the acts and routes it is tagged with, no more often a floor
than its cap, joined to the line before and after it.

#### Scenario: a tagged set
- **WHEN** act 5 floors are built over a few seeds with a set tagged for the station line
- **THEN** the set appears, never more than its cap a floor, and every floor still passes the validator

#### Scenario: no sets
- **WHEN** no sets are turned on
- **THEN** every floor is built exactly as before

### Requirement: Sets can be saved from a phone
Saving on a device with no dev server SHALL keep the set without the user pasting text anywhere (as decided in
design.md, decision 3).

#### Scenario: saving on the phone
- **WHEN** a set is saved on skate-rogue.vercel.app/?sets
- **THEN** it reaches the repo for review, and the editor says where
