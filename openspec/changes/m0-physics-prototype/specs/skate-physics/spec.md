# Spec Delta

## Purpose

Defines how the skater moves in Gnar Run: auto-run, the one-button ollie and flip tricks, landings, grinds,
curved rails, car-hops, slams and bails, using Quest For Stoken's physics rules.

## ADDED Requirements

### Requirement: Fixed-step simulation
Skater physics SHALL advance in fixed steps of 1/60 s regardless of display refresh rate, so the same inputs give
the same motion on 60 Hz and 120 Hz screens.

#### Scenario: Same result at different frame rates
- **WHEN** the same input sequence is played back with frames of 1/60 s and with frames of 1/120 s
- **THEN** the skater's position after one second is the same in both runs

### Requirement: Auto-run
The skater SHALL always roll forward (to the right) and never below the floor's base speed while on the ground,
with no input to steer, push or brake.

#### Scenario: Rolling with no input
- **WHEN** a floor starts and the player presses nothing
- **THEN** the skater rolls right and reaches base speed within one second

### Requirement: Ollie with variable height
Pressing the button while grounded or grinding SHALL ollie. Releasing it while rising SHALL cut the upward speed to
at most 40% of the ollie speed, so a tap gives a short hop and a hold gives a full ollie.

#### Scenario: Hold versus tap
- **WHEN** the player ollies and holds the button until the peak, and separately ollies and releases after 2 frames
- **THEN** the held ollie peaks at least twice as high as the tapped one

### Requirement: Flip trick as second jump
Pressing while airborne with a jump left SHALL perform a flip trick that spends a jump and gives a new upward
impulse. The skater SHALL start with 2 jumps, refilled on landing, on any grind, and on a car-hop.

#### Scenario: Double jump then no third
- **WHEN** the skater ollies, then presses twice more in the air
- **THEN** the first air press performs a flip trick and the second does nothing

### Requirement: One-way platforms
Rooftops, ledges and flat rails SHALL be passable from below and solid from above.

#### Scenario: Landing on a rooftop from below
- **WHEN** the skater ollies up through a rooftop and falls back onto it
- **THEN** the skater lands on the rooftop's top surface

### Requirement: Flat grind
Landing on a flat rail SHALL start a grind that raises the speed cap, keeps at least the minimum grind speed,
refills jumps, and ends when the rail ends or the player ollies.

#### Scenario: Grinding a rail
- **WHEN** the skater lands on a flat rail
- **THEN** the skater is grinding, has 2 jumps, and moves at least at the minimum grind speed

### Requirement: Curved rails
Landing on a curved rail SHALL ride it with gravity acting along the curve (speeding up downhill, slowing uphill
but never below the minimum), and riding off an end SHALL launch along the rail's angle while keeping the speed.

#### Scenario: Launch off a downhill rail
- **WHEN** the skater rides a downhill curved rail to its far end
- **THEN** the skater leaves the rail moving faster than base speed, and that extra speed bleeds off only after
  landing

### Requirement: Car-hop
Landing on a car roof SHALL bounce the skater up and refill all jumps.

#### Scenario: Bouncing off a parked car
- **WHEN** the skater falls onto a parked car's roof
- **THEN** the skater is moving upward on the next step and has 2 jumps

### Requirement: Slam
Running into the side of a car SHALL slam the skater: speed drops to half of base speed and recovers over about
0.6 s, and the combo is lost. A slam SHALL NOT end the attempt.

#### Scenario: Clipping a car
- **WHEN** the skater runs into a parked car's side
- **THEN** the skater keeps going at reduced speed and the attempt continues

### Requirement: Bail
Falling below the street surface into a gap SHALL end the attempt.

#### Scenario: Missing a gap
- **WHEN** the skater falls into a canal
- **THEN** the attempt ends and the player can restart the same floor with one press
