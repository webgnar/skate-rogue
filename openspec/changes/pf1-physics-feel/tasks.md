# Tasks

## 1. Sim

- [x] 1.1 `Feel`: springs, impact along the normal, landing quality; verify tests
- [x] 1.2 Flip catch times from the clips, mid-flip landings; verify the sync test
- [x] 1.3 Slopes: gravity along banks, landing along the slope, ollie keeps ground momentum; verify tests
- [x] 1.4 Grind materials and curved-rail friction; verify tests
- [x] 1.5 Board pitch from the trucks and the lip flag; verify tests

## 2. Wiring

- [x] 2.1 game.ts passes `feel.pitch` to the rig; the rig's `absorb()` (models thread, PR #62) reads `feel`
- [x] 2.2 Validator: 50 seeds x floors 1-8 still clear

## 3. Ship

- [x] 3.1 Merge to main and tell zack

## 4. Round 2

- [x] 4.1 Swept landings (path crossing plus end point) for surfaces, the street and car roofs; rising onto climbing rails; fuzz test
- [x] 4.2 `Level.gravity` and `BIOME_GRAVITY`; the skater's gravity scales by it
- [x] 4.3 Worn trucks and wheels rock you more

## 5. Rounds 3 and 4

- [x] 5.1 Car hops, doors, buses and kickers load the knees; a hop mid-flip rocks you
- [x] 5.2 Collision fuzz in every district's gravity and twist, with moving vehicles
- [x] 5.3 Ceiling bumps fold the knees


## 6. Momentum on slopes (exploring, zack 2026-10-25)

zack: landing in line with an incline after a kicker should be favored; a fast early ollie that lands on the face of an
up ramp and loses all its speed "feels like shit". Explored as `MOMENTUM` in src/physics/feel.ts, picked with
`?momentum=real|soften|transfer|both`; the default stays `real` until zack picks.

- [x] 6.1 Soften: an up-ramp landing keeps at least 90% of your speed; the climb still slows you
- [x] 6.2 Transfer: a landing lined up with a falling slope adds up to 25%; the land event carries `lined` (0..1)
- [ ] 6.3 zack picks a default after trying the flags
- [ ] 6.4 If Transfer stays: a "Transfer!" call-out, effect and score (gameplay and effects threads)
- [ ] 6.5 Pumping on transitions, once there's an input for it that doesn't fight the held ollie
