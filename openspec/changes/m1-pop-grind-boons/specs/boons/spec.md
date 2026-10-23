# Spec Delta

## Purpose

Defines boons in Gnar Run's first playable set: how they are offered, picked and stacked, and what each of the 6
POP and 6 GRIND boons does to the skater.

## ADDED Requirements

### Requirement: Pick one of three
After each floor the game SHALL offer 3 distinct boons, drawn from those whose `when` filter passes and that are
below their max stacks, and the player SHALL pick exactly one. Offers SHALL be deterministic for a run seed and
floor.

#### Scenario: Same seed, same offer
- **WHEN** two runs with the same seed reach the end of floor 2 holding the same boons
- **THEN** both are offered the same 3 boons

#### Scenario: Maxed boons are not offered
- **WHEN** the run holds Triple Threat (max 1)
- **THEN** no later offer contains Triple Threat

### Requirement: Stacking
Picking a boon the run already holds SHALL add a stack, up to that boon's max, and each stack SHALL apply its
effect again.

#### Scenario: Big Pop stacks
- **WHEN** the run holds 2 stacks of Big Pop
- **THEN** a held ollie peaks at least 1.4 times as high as with no boons

### Requirement: POP boons
POP boons SHALL change the ollie and air jumps as follows: Triple Threat gives one more jump; Big Pop raises
ollie speed 20% per stack; Floaty Flip halves gravity for 24 frames after a flip trick; Late Flip makes flip
tricks ignore the release cut; Pressure Flip lowers gravity 30% while the button stays held more than 30 frames
after an ollie; Spare Change adds 0.25 of a bonus jump per grind per stack, spent as extra air jumps until
landing.

#### Scenario: Triple Threat
- **WHEN** the run holds Triple Threat and the skater ollies, then presses three times in the air
- **THEN** the first two air presses perform flip tricks and the third does nothing

#### Scenario: Late Flip
- **WHEN** the run holds Late Flip and the skater flips, releasing the button after 2 frames
- **THEN** the flip rises as high as a flip with the button held

### Requirement: GRIND boons
GRIND boons SHALL change grinding as follows: Rail Magnet widens rail catch range by 48 px per stack; Grease
raises grind speed 25% per stack and doubles minimum grind speed; Rail Launch adds 40% of grind speed to an ollie
off a rail; Exit Wax keeps all grind speed as carry when leaving a rail; Feeble Frenzy adds 10% grind speed for
every 30 frames on one rail; Ghost Rail extends a rail 4 tiles past its end for 2 s after the skater leaves it.

#### Scenario: Rail Magnet
- **WHEN** the run holds Rail Magnet and the skater falls past a rail end 40 px out of the no-boon catch range
- **THEN** the skater lands in a grind

#### Scenario: Grease
- **WHEN** the run holds Grease and the skater grinds a long flat rail
- **THEN** the skater's speed settles 25% above the no-boon grind speed
