# Spec Delta

## ADDED Requirements

### Requirement: Mockup HUD
The HUD SHALL show the logo with act and floor, score, combo with pending points, cash and Stoken, a pause button,
the Stoke meter into GNAR MODE, the Heat meter with the cruiser and four stars, board mod slots bottom left and gear
wear bottom right, inside the screen's safe areas, leaving the middle of the screen clear.

#### Scenario: Building a combo
- **WHEN** the skater lands a kickflip into a grind
- **THEN** the combo panel shows `COMBO x2` and the combo's points, and both clear when the combo banks or is lost

#### Scenario: Heat climbing
- **WHEN** Heat reaches 50
- **THEN** the Heat meter shows 5 of 10 segments lit and two of the four stars are lit

#### Scenario: Worn shoes
- **WHEN** the shoes' condition drops below 15
- **THEN** the shoes bar shows one red segment and blinks

### Requirement: Cheap HUD updates
The HUD SHALL only write to the DOM when a shown value changes, with meters moving in whole segments.

#### Scenario: A quiet frame
- **WHEN** nothing shown on the HUD changed since the last frame
- **THEN** the HUD makes no DOM writes

### Requirement: Pause
The game SHALL pause from the pause button, Esc or P, and when the page is hidden. While paused the street is frozen
and presses are dropped; resuming never counts as an ollie.

#### Scenario: Pausing mid-air
- **WHEN** the player taps pause while the skater is in the air
- **THEN** the skater stays frozen in the air until they tap resume, and no ollie fires from either tap
