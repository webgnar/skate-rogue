# Design

## The set format

A set is JSON in `src/gen/sets/<name>.json`, in tiles, measured from its start (x 0, y 0 = where you roll in).
It holds the same primitives a floor is made of (`src/physics/level.ts`), so the physics, the bot and the
renderers need nothing new for the pieces that exist:

```json
{
  "name": "kinked hubba",
  "acts": [3, 5], "routes": ["clouds", "station"], "weight": 2, "most": 1,
  "length": 24, "endY": -6,
  "parts": [
    { "kind": "stairs", "x0": 2, "x1": 8, "y": 0, "y1": -4, "rail": true },
    { "kind": "rail", "x0": 10, "x1": 16, "y": -3, "y1": -6 },
    { "kind": "ledge", "x0": 18, "x1": 24, "y": -6 },
    { "kind": "coins", "x": 13, "y": -4, "n": 5 }
  ]
}
```

The generator places a set by offsetting it to where the line is, then makes the next beat start at `endY`.
A set that would leave the floor too low or too high is skipped for that slot, the same way a code beat is.

## The editor

- A 2D side view on a canvas, from `src/levels/draw.ts` (same colours: white rolling, yellow air, green grind,
  red slam). The game's physics is 2D, so this is the real shape, not a sketch of it.
- Every change re-runs the floor validator's bot (`src/gen/validate.ts`) at cruising and gnar speed. A set the bot
  can't clear is marked and can't be turned on in floors until it does (see decision 4).
- "Play it" opens the game on a test floor: street, the set, street, a gate (as `?leveldrafts` does for floors).
- Undo, copy, mirror height, snap to tiles. Unsaved sets stay in the browser (localStorage), like the clip
  editor's drafts.

## Phone and desktop

The game's input is one button, so the editor is the only place with real controls.

| On the phone (small iPhone, Brave) | On the desktop |
| --- | --- |
| Look at any floor or set, play from any point | All of that |
| Nudge what's there: drag an end, stretch a rail, move a gap, change a height with +/- | Draw new sets: palette, multi-select, box select |
| Turn sets on and off, change a weight or cap | Keyboard: arrows, delete, ctrl+z, ctrl+d |
| Save (decision 3) | Save straight to the repo on the dev server |

Handles are 44 px or bigger on touch, one finger pans, two pinch to zoom, and long press picks a piece.

## Decisions for zack

1. **What's hand-made?** DECIDED (zack, 2026-11-10): sets dropped into generated floors. Whole hand-made
   floors stay a later phase (4).
2. **Where do you build?** Phone first (every tool sized for touch), desktop first with phone for nudging and
   playing (recommended), or desktop only.
3. **Saving from the phone.** Keep pasting to Claude (as `?levels` does now), a save button that commits to a
   branch and opens a PR for Claude to check and merge (recommended), or sets saved online and live in the game
   at once with no PR.
4. **Bot gate.** A set ships only if the plain bot clears it (recommended), or hard sets may need boons or skill
   and are marked as such.
5. **Where do sets go first?** Act 3's cloud line and act 5's station line, which are already built from sets
   (recommended), act 1's hills, or everywhere at once.
