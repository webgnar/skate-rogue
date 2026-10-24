# Design

## Context

Cars in M0 and M1 are static `Car` boxes in the level. Heat does not exist. The GDD's Traffic and Getting hit
sections hold the agreed rules and the starting numbers.

## Goals / Non-Goals

**Goals:** traffic that is readable and fair on a phone; a chase that is always visible; all of it deterministic
from the floor seed so the validator and daily seeds work.

**Non-Goals:** final car models, audio, every vehicle type in the GDD.

## Decisions

- **Vehicles are simulated in the same fixed step and px units as the skater.** A `Vehicle` has x, speed, kind,
  width, roof height and a `brake` state. The skater collides with vehicles the same way it does with parked
  cars today; parked cars become vehicles with speed 0.
- **Robotaxi:** speed 0.55 to 0.75 of base speed. It brakes to 0.3 when the skater is within 3 tiles behind it,
  so riding up to one gives you time to ollie onto the trunk.
- **Oncoming car:** speed -4 px/frame (closing speed about 7.5). Its spawn x is chosen so it is on screen with a
  marker at least 45 frames before it reaches the skater.
- **Director:** each floor gets a spawn plan from the floor seed: a list of `{ frameOrX, kind }` triggered when
  the skater passes x positions (not by time, so a slower skater sees the same street). Density by floor:
  floor 1 robotaxis only, from floor 3 oncoming cars, up to 1 vehicle per 1.5 pieces by floor 8. A spawn is
  skipped if it would put a vehicle over a canal edge or within 2 tiles of another hazard.
- **Heat is a number in the game, not the physics.** `Heat.update(events, skaterState)` applies the table per
  step. The cruiser's screen x is `lerp(offscreenLeft, skaterX - 1 tile, heat / 100)`, eased so it moves smoothly.
  After a slam the cruiser holds still for the 36-frame remount (GDD fairness rule).
- **Caught:** at 100 the sim stops, the camera eases to the cruiser for 0.8 s, then the run-over screen says
  "CAUGHT" instead of "BAILED".
- **Validator with traffic:** the reference bot already ollies at cars in its look-ahead; it now looks at moving
  vehicles' predicted x. A floor passes when the bot clears it without being caught.

## Risks / Trade-offs

- [Oncoming cars feel unfair at phone frame rates] → Markers and a minimum 0.75 s warning; tune speed in playtests.
- [Heat numbers are a first guess] → All in one constants table; zack tunes from the preview.
