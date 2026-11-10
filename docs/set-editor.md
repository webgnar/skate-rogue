# Set editor

Draw short lines ("sets") out of the game's own pieces, check the plain sky bot can skate them, and drop them into act
3's cloud line and act 5's station line. Scope and decisions: openspec/changes/le2-hand-made-sets.

```sh
npm run dev
# open http://localhost:5173/?sets
```

It also opens on the deployed site (skate-rogue.vercel.app/?sets) and on a phone. Build new sets on a desktop; on a
phone you can nudge pieces with the +/- steppers and play the set.

## Drawing a set

- The grid is in tiles. The pink **in** flag at (0, 0) is where you roll in; **on →** marks where the line carries on
  from (the set's last deck, stair or kicker).
- The tray adds a piece: **deck** (a flat you land on), **rail**, **ledge**, **stairs** (always down, a handrail over
  them), **kicker** (a ramp, you fly off at your own speed), **coins**, **Stoken**. A gap is just space between decks.
- Drag a piece to move it, drag its dots to stretch it. Pick a piece to get its steppers (x0, y0, x1, y1, curve:
  + sags a rail, - arches it), copy or delete it. Snap is 1, ½ or ¼ tile. Undo/redo: ctrl+z / ctrl+y.
- More piece types get added as you need them (ask Claude).

## The bot gate

Every change re-runs the plain sky bot (no boons) through the set on a test floor, at cruising speed and in the gnar
state. The yellow line is the bot's path through it. A set passes when the bot meets it up on the line a few times and
clears it at least 3 times in 4 at both speeds; the result line says why it didn't. **in floors** can only be turned on
once it passes for every act it's tagged with. `tests/hand-sets.test.ts` checks every set that's on still passes.

**play it** opens the game on the test floor (act 3: floor 8, act 5: floor 14) with the set laid every other beat.

## In floors

Each set has acts (3 and/or 5), **how often** (against the code sets: a stair set is 5, a hubba 2.5) and **most a
floor**. The cloud layer lays it as its own `set` beat, joined at the height the line is at; act 5 grows it with the
lighter gravity so it asks the same jumps. In act 3, stairs and handrails use the station's look for now.

## Saving

- **save** on the dev server writes `src/gen/hand-sets.json` and open game tabs reload. Commit that file to keep it.
- Anywhere else, save copies the sets as text: **paste them to Claude** in the project and they get merged.
- Unsaved sets stay in this browser; `?setdrafts` plays them in the game.

## Play from here (?levels)

In `?levels`, tap a spot on the floor and press **▶ play from here**: the game opens on that seed and floor (with
your unsaved edits) and drops you in at that spot. In act 3, coming down off the clouds on a test start doesn't
restart the act. `?from=x,y` (px) does the same by hand.
