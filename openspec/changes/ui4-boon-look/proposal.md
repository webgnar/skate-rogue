# Boon cards in the shop's look

## Why
zack (2026-10-26): "upgrade the UI, and use art like you did with the shop". The boon pick, the underground spot and
the boons you hold were still plain text cards next to the restyled skate shop (ui3-shop-look).

## What changes
- Every boon card shows a picture rendered from the game's own models (board, trucks, wheels, cruiser, robotaxi, bus,
  box truck, drone, chopper, wanted board, traffic signal, rocket, Stoken) with an inked glyph for what it does,
  over a burst in its type colour. `src/ui/boon-art.ts` maps all 39 boons; anything new falls back to its type's art.
- The cards get the shop's comic frame, graffiti title, segmented stack pips, dashed purple curses and pink
  double-edged duos. A duo shows "DUO" with its two halves on their own line, so nothing is cut off.
- The underground spot's choices (Lay Low, Swap a Boon, Remove a Curse) get art too.
- Held boons (top left, pause card, run over) are inked badges with the boon's picture.
- An upright phone sizes the cards off the screen's width and wraps them, so they stay big.
- `art/cards/render.ts` renders the nine new pictures into `public/sprites/cards/`.

## Out of scope
Checking each boon's effect works; the design thread owns that.
