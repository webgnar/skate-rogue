# Proposal

## Why

zack (2026-10-24): "we need to figure out how we can design the levels, so i can see samples of them so i know how
they progress". He picked an in-game level editor on a card. Floors are generated from dials in `src/gen/hills.ts`
and per-floor recipes, so today every change to a floor's shape goes through a code change, and nobody can see a
floor without skating it.

## What Changes

- `?levels` opens a level editor (`src/levels/`): the floor the game builds for a seed, floor and road, drawn as a
  side view to scale, with the reference bot's line, its result at cruising and gnar speed, and floors 1-15 side
  by side at one scale.
- Each floor's hill can be shaped there: its recipe (slots of beats: hill, rail hill, stairs, drop, crest jump,
  kicker) and its dials (start height, grade, block length, crest length, crest jump width, stair sets, street
  pieces). Every change redraws the floor and re-runs the bot.
- Edits live in `src/gen/level-edits.json`, which `hills.ts` and `descent.ts` read over the code values. Saving
  writes it through a Vite dev-server endpoint; without a dev server (the phone, Vercel) the editor copies the edits
  as text to paste to Claude. Unsaved edits are kept in the browser, and `?leveldrafts` plays them in the game.

## Capabilities

### New Capabilities

- `level-editor`: shaping the generated floors in the browser.

### Modified Capabilities

(none)
