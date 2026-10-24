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

- [ ] 3.1 Merge to main and tell zack

## 4. Round 2

- [x] 4.1 Swept landings (path crossing plus end point) for surfaces, the street and car roofs; rising onto climbing rails; fuzz test
- [x] 4.2 `Level.gravity` and `BIOME_GRAVITY`; the skater's gravity scales by it
- [x] 4.3 Worn trucks and wheels rock you more

