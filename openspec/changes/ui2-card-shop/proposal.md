# Proposal

## Why

zack (Oct 24, 2026): "skate shop should function like a card game. you drag the cards into the players inventory".
The shop was tap a mod, then tap a slot, with gear in a separate button row. It read like a form, not a shop.

## What Changes

- **The stock is a hand of cards** dealt along the bottom, overlapping like a fanned hand: the 4 mods, a `+1 SLOT`
  card while the board has room, and a `NEW <PART>` card for each worn part. Each card shows its price; a card you
  can't afford is greyed and won't lift.
- **Your setup is the drop zone** across the top: YOUR BOARD (the mod slots) and YOUR GEAR (deck, trucks, wheels,
  shoes with their wear bars).
- **Drag to buy.** Drag a mod card onto a slot to buy it there (it replaces what's in the slot), the slot card onto
  the board to add a slot, and a gear card onto your gear to replace that part. Valid targets light up while you
  drag, the one under your thumb swells, and a drop stamps in. Let go anywhere else and the card flies back.
- **Drag slots to rearrange** your board (swap two mods).
- **Taps still work** (tap a card, then a slot), so a mouse, a fumble or reduce motion is never stuck.
- Prices and shop rules don't change (`src/board/shop.ts`, `src/run/gear.ts`).

## Capabilities

### Modified Capabilities

- `shop`: buying by dragging cards into the setup.

## Impact

`index.html` (#shop markup), `src/ui/shop-drag.ts` (new: pointer drag with a ghost card), `src/main.ts` (shop
render), `src/game/game.ts` (`shopDrop`, shop presses no longer reach the one button), `src/style.css` (shop
section).
