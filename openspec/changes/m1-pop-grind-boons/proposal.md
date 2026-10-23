# Proposal

## Why

zack chose (2026-10-23) to make the first playable boon set POP + GRIND only: the boons that bend the ollie and
the grind, which the M0 physics can already show. This change turns the M0 street into a first roguelike run:
boons picked between floors, stacking on the skater, and a run that ends when you fall in a gap.

## What Changes

- A boon system: boon definitions (type, name, effect text, max stacks, `when()` filter as in QFS
  `survivor_boons`), a run's held boons, and hooks the skater reads every step.
- The 12 boons of the first set: 6 POP (Triple Threat, Big Pop, Floaty Flip, Late Flip, Pressure Flip,
  Spare Change) and 6 GRIND (Rail Magnet, Grease, Rail Launch, Exit Wax, Feeble Frenzy, Ghost Rail). Some draft
  effects are adapted to one button and to parked-only cars (see design.md).
- A pick-1-of-3 card screen after each floor's exit gate, in QFS card layout, with tap to pick.
- A run: floors 1, 2, 3 and on with boons kept between floors. Falling in a gap ends the run and shows the floor
  reached and the boons held; a tap starts a new run on a new seed. (M0 retried the same floor.)
- A floor validator: a generated floor is re-rolled when a base-stat bot can't clear it, so runs don't end on
  impossible canals.

Out of scope: FLOW, LUCK, COOL and STREET boons, duo boons, curses, Heat and the chase, traffic, forks, shop,
stoke and score, meta progression.

## Capabilities

### New Capabilities

- `boons`: what a boon is, how three are offered and one picked, stacking, and the effect of each of the 12.
- `run-flow`: a run from floor 1 through boon picks to the run-over screen and a new run.
- `floor-validation`: rejecting and re-rolling generated floors a base-stat bot cannot clear.

### Modified Capabilities

(none; M0's specs are not archived yet, so physics hooks are described in `boons`)

## Impact

- New: `src/boons/*` (definitions, offer logic, run state), `src/ui/boon-cards.ts`, `src/gen/validate.ts`.
- Changed: `src/physics/skater.ts` and `src/physics/constants.ts` read boon modifiers; `src/game/game.ts` gets
  run state, the pick screen and the run-over screen; `index.html` and `src/style.css` get card and run-over UI;
  the bot moves from `tests/` to `src/gen/` so the validator can use it.
