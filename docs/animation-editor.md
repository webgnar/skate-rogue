# Animation editor

Keyframe the skater's clips in the browser, on the same rig, model and leg IK as the game. No Blender needed.

```sh
npm run dev
# open http://localhost:5173/?editor          (or ?editor&clip=kickflip, ?editor&skater=roxy)
```

## Posing

- **Pick a clip** at the top left. Space plays it (0.5× by default; the speed menu goes down to 0.1×). The **roll**
  box scrolls the ground so pushes and rides read like they do in the game.
- **Scrub** by dragging on the timeline. The arrow keys step one frame (1/30 s), `,` and `.` jump between keys.
- **Drag in the view.** Click a dot, then drag it or its arrows:
  - yellow: the hips (the legs follow with IK);
  - cyan: the front (left) foot; pink: the back (right) foot. A foot standing on the board slides along the deck.
    Set its **on board** to 0 to take it off, and it goes anywhere (flips, the push foot, slams);
  - orange: the board's position. Its pitch, flip, spin and pivot are on the right.
- **Every value is on the right**, in degrees for angles. Double-click a name to put it back to the standing pose.
- **Auto-key:** changing anything between keys adds a key at the playhead. `k` adds one, delete removes one (the
  first key stays at 0). Drag a key's diamond to retime it, or type a new **length** to stretch the whole clip.
- On a looping clip whose last key matches its first, editing either one edits both, so the loop doesn't jump.
- **copy pose / paste pose** (ctrl+c / ctrl+v) copies the pose at the playhead to another time.
- **ghost** shows the previous key see-through. **ref photo** (or drop an image on the view) lays a reference photo
  over the view, with a fade slider and a mirror button. The side view is the game's camera.
- ctrl+z / ctrl+shift+z undo and redo. Unsaved clips survive a reload (they're kept in this browser).

## Saving and trying it in the game

- **save** (ctrl+s) writes every edited clip to `src/render/clip-edits.json` through the dev server. Clips there win
  over the ones in `src/render/poses.ts`, and an open game tab reloads to play them. Commit that file to keep them.
- **try in game** opens the game with your unsaved clips (`?drafts`), without saving.
- **revert clip** puts a clip back to the code version; save to drop it from clip-edits.json.
- On the deployed site there's no dev server, so save downloads `clip-edits.json` instead: put it in `src/render/`.

## How it fits the Blender pipeline

The game plays Blender actions from `lou-gnar.glb`, baked from the code clips. A clip in `clip-edits.json` plays
from its keys instead (`EDITED` in poses.ts), so an edit shows up straight away. `node art/bake_clips.cjs` bakes
the merged clips, edits included, and `art/lou_gnar.py` turns them into Blender actions as before.
