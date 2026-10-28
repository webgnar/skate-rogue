# Board wires: show how mods chain

## Why
zack (2026-10-28): "what does it matter what Slot the item is in?" then "we need visualization for this in desktop
AND mobile because thats not clear". The board reads left to right: a trigger fires the effects to its right up to
the next trigger, and a modifier changes the next effect. Nothing on screen said so.

## What changes
- `chain()` and `chainText()` in src/board/mods.ts say which trigger each slot answers to, whether it ever fires,
  and the board in words ("OLLIE ▸ ×2 KICK").
- src/ui/board-wires.ts draws a purple wire under the slots from each trigger to the last effect it fires, with a
  drop into every slot it feeds, and crosses out and dims slots nothing fires. The shop's board and the in-run HUD
  board both use it, at every screen size.
- The shop's YOUR BOARD panel shows the board in words under the slots, or how to start when nothing fires.
