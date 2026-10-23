# Design

## Context

M0 (openspec/changes/m0-physics-prototype) gives a fixed-step skater in QFS units, a seeded street generator and
a Three.js view. The GDD's starting boon pool lists 6 POP and 6 GRIND boons. Some were written before the
one-button and parked-car decisions and need adapting. QFS's `survivor_boons` script is the model for card data.

## Goals / Non-Goals

**Goals:** boons that are felt immediately in the physics; a run loop that makes a pick matter; deterministic,
testable boon effects.

**Non-Goals:** balance beyond a first pass, art for the card icons (text and a coloured type label first), the
other four boon types.

## Decisions

- **Modifiers, not subclasses.** The run holds `{ id, stacks }[]`. A pure function `skaterMods(boons)` returns
  one `Mods` object (extra jumps, ollie scale, grind speed scale, magnet range, flags). The skater gets `Mods`
  in its constructor and reads them in `step()`. No boon code runs inside the skater, so tests can build any
  combination directly.
- **Card data like QFS.** Each boon: `id`, `type` (POP or GRIND), `name`, `effect`, optional `note`, `max`,
  and `when(run) => boolean`. An offer draws 3 distinct boons whose `when` is true and that are below `max`,
  using the run's seeded RNG (`seed + floor * 104729`), so a seed replays the same offers.
- **The 12 boons, adapted.** Changes from the GDD draft are marked.

  | Boon | Type | Effect | Max |
  | --- | --- | --- | --- |
  | Triple Threat | POP | +1 jump | 1 |
  | Big Pop | POP | Ollie +20% per stack | 3 |
  | Floaty Flip | POP | Gravity halved for 24 frames after a flip trick | 1 |
  | Late Flip | POP | *Changed:* flip tricks ignore the release cut, so they always reach full height | 1 |
  | Pressure Flip | POP | *Changed:* keep holding for 0.25 s after an ollie and gravity drops 30% until you let go | 1 |
  | Spare Change | POP | Each grind adds 0.25 of a bonus jump; each full 1.0 is one extra air jump until you land | 3 |
  | Rail Magnet | GRIND | Rails catch you from 48 px further away per stack | 2 |
  | Grease | GRIND | *Changed:* grind speed +25% per stack, and you enter grinds at full grind speed | 2 |
  | Rail Launch | GRIND | Ollieing off a rail adds 40% of grind speed to the ollie | 1 |
  | Exit Wax | GRIND | *New, replaces Sparky (needs moving traffic):* speed carried off rails bleeds 4x slower on the ground (M0 already keeps it as carry) | 1 |
  | Feeble Frenzy | GRIND | *Changed (no grind tricks with one button):* +10% grind speed for every 0.5 s on one rail | 1 |
  | Ghost Rail | GRIND | *Changed (behind you is useless in auto-run):* leaving a rail extends it 4 tiles ahead as a ghost rail for 2 s | 1 |

- **Run over on gap only.** Slams stay as in M0 (half speed). Heat is not built yet, so a gap is the only way a
  run ends.
- **Pick screen.** After the exit gate the sim pauses and three cards slide up. Tapping a card picks it; the
  next floor starts with a short rolling-in. The button can't pick by accident: taps in the first 300 ms are
  ignored.
- **Validator.** `validateFloor(seed, floor)` runs the M0 bot with no boons for up to 2 minutes of sim time. If
  it bails, the layout is re-rolled with a sub-seed (up to 8 tries, then the floor drops one tier). It runs in
  well under a frame per floor since the sim is pure; measure in tests.

## Risks / Trade-offs

- [The bot is weaker than a player, so the validator may reject fair floors] → Only costs variety; tune later.
- [Stacked boons can trivialise floors 1 to 6] → Acceptable for a feel test; balance comes with Heat in M2.
