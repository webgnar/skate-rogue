# Proposal

## Why

zack (2026-10-24) picked the skate shop and board mods as the next build. Cash already drops everywhere but only
buys boon rerolls; the shop gives it a purpose and the board build (the GDD's Noita part) makes each run play
differently.

## What Changes

- **Board:** 3 slots to start (up to 5). A slot holds a trigger or an effect. A trigger fires the effects to its
  right, left to right, until the next trigger. Effects with no trigger to their left do nothing.
- **Triggers (6):** On Ollie, On Land, On Grind (start), On Grind End, On Trick, On Car-hop.
- **Effects (8):** Spark Trail (+50 style to the combo and a burst of sparks off the back truck), Double Pop (a second small ollie 0.2 s
  later), Speed Kick (+2 px/frame, carried like rail speed), Jump Refill (+1/2 a jump), Cash Burst (+2 cash),
  Slow-mo (0.5 s at half speed), Gravity Flip (0.3 s of upward gravity in the air), Shockwave (cars within 12 tiles
  pull out of the skate lane).
- **Shop road:** from floor 2 a fork can lead to the SKATE SHOP, and the fork at the end of every third floor
  always offers it. The shop has no floor: you shop, then skate a boon street. The other road is a boon street.
- **Shop screen:** the board across the top, 4 mods in stock below (at least one trigger and one effect), plus a
  slot (+1, max 5) and a restock. Tap a mod, then tap a slot to buy it there (replacing what's in it). Tap two
  slots to swap them, free. One thumb, 48 px targets.
- **HUD:** the board as a strip of slots; a slot flashes when it fires.

No modifiers yet (x2, Delay, Only On Combo, Chance): they come later, as the GDD says.

## Capabilities

### New Capabilities

- `board-build`: board slots, mods and their interpreter, the shop.

### Modified Capabilities

- `run-loop`: the fork can lead to the shop.

## Impact

New `src/board/` (mod defs, board runner, shop stock). FloorSim runs the board each step and reports what fired;
the skater gains a gravity flip timer and delayed pops. `roads.ts` gains the shop road; `game.ts` a shop state;
`main.ts`, `index.html` and the CSS a shop screen and board strip.
