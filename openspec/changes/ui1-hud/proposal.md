# Proposal

## Why

zack made a HUD mockup (comic ink, neon pink and cyan, chunky skewed panels) for Gnar Run. The current HUD is plain
text in the corners, the stoke bar sits at the bottom where it fights the ground, there is no Heat readout, no pause,
and the run's gear wear and board mods are hard to read at a glance.

## What Changes

- **Top left:** the GNAR RUN logo, with `ACT a-k · FLOOR n` under it and the road chip (cash, hot, shop...).
- **Top middle:** SCORE in a panel; COMBO ×n with the combo's pending points (`+ 820`) under it while a combo is live.
- **Top right:** cash and Stoken in one panel, and a pause button.
- **Second row:** the STOKE meter (10 segments, yellow to pink) into a GNAR MODE badge that lights in the gnar state
  and drains with it; the HEAT meter (10 segments, red) led by the cruiser, with four stars at 25, 50, 75 and 90.
- **Bottom left:** BOARD MODS, one tile per slot (trigger purple, effect cyan, empty dashed), flashing when a slot fires.
- **Bottom right:** GEAR WEAR, deck, trucks, wheels and shoes, 5 segments each, green / yellow from 50 / red and
  blinking from 15 (the gameplay thread's `Gear`, 0..100).
- **Pause:** the button (or Esc / P) freezes the street and opens a pause card with the boons you hold; the game
  also pauses itself when the tab is hidden. A pause press never counts as an ollie.
- **Cheap:** every HUD write is cached and only touches the DOM when what it shows changes (meters move in
  segment steps). No canvas, no per-frame layout, no backdrop filters. The font is Bangers (OFL), bundled.
- **Safe areas:** every edge panel sits inside `env(safe-area-inset-*)`; sizes scale with the screen's height so it
  fits a landscape iPhone SE and still reads.

## Decided against the GDD

The GDD's UI section says Heat is shown by the world, not a bar. zack's mockup has a Heat bar, so the mockup wins;
the world cues (lights, edge glow, the cruiser) stay too.

## Capabilities

### New Capabilities

- `hud`: the in-run heads-up display and pause.

## Impact

`index.html` (#hud markup), `src/ui/hud.ts` (new: the HUD view), `src/main.ts` (makeHud delegates the in-run parts),
`src/style.css` (HUD section), `src/game/game.ts` (Hud gets `pause`, `score` gets the pending combo points, Game gets
`paused`). The boon pick, shop and run-over screens get their own mockups later.
