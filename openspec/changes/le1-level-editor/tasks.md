## 1. Generator

- [x] 1.1 `src/gen/level-edits.ts` + `level-edits.json`: per-floor recipe and dial overrides, read by hills.ts and descent.ts
- [x] 1.2 Tests: no edits = same floor; each override changes the floor; saved edits clear with the bot

## 2. Editor

- [x] 2.1 `?levels`: seed, floor, road; side view with the bot's line; bot result at cruise and gnar speed
- [x] 2.2 Recipe editor and dials for the chosen floor, live redraw
- [x] 2.3 Floors 1-15 at one scale
- [x] 2.4 Save through the dev server, copy edits as text elsewhere, browser drafts, `?leveldrafts` in the game

## 3. Ship

- [x] 3.1 docs/level-editor.md, a test-checklist line, playtest bot green, merge to main
