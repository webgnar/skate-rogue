# Tasks

## 1. Boon data

- [ ] 1.1 Boon definitions for the 12 boons, the run's held boons, and `skaterMods()`; verify tests for stacking and max
- [ ] 1.2 Seeded offer of 3 distinct eligible boons; verify tests for determinism and that maxed boons are never offered

## 2. Physics hooks

- [ ] 2.1 Skater reads `Mods` for POP boons (jumps, ollie scale, Floaty Flip, Late Flip, Pressure Flip, Spare Change); verify a test per boon against the no-boon skater
- [ ] 2.2 Skater reads `Mods` for GRIND boons (Rail Magnet, Grease, Rail Launch, Exit Wax, Feeble Frenzy, Ghost Rail); verify a test per boon

## 3. Floor validation

- [ ] 3.1 Move the bot into `src/gen/validate.ts` and re-roll floors it can't clear; verify floors 1-8 on 50 seeds all validate and time per floor is logged

## 4. Run flow and UI

- [ ] 4.1 Run state in `Game`: boons kept across floors, gap ends the run, tap starts a new seed; verify in a headless run
- [ ] 4.2 Pick-1-of-3 card screen with QFS-style cards (type colour, name, effect, stacks) and the run-over screen; verify with phone-landscape screenshots

## 5. Integration

- [ ] 5.1 Republish the playable build and send zack the link
