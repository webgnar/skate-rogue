# Spec Delta

## ADDED Requirements

### Requirement: Screen and gate juice
The boon pick SHALL show which card was picked as it closes, the shop SHALL mark what changed and what was spent,
and exit gates SHALL brighten as the skater nears them. Reduce motion SHALL turn the screen animations off.

#### Scenario: Picking a boon
- **WHEN** the player taps the second card
- **THEN** that card pops while the other two drop away, and the screen fades out

#### Scenario: Rolling up to the exit
- **WHEN** the skater is within 12 tiles of the exit
- **THEN** the arch fills with flowing rings that brighten and swell as they get closer
