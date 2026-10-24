# Proposal

## Why

zack (2026-10-24): "we are probably going to have to build some kind of editor for me to keyframe the animations".
The clips are keyed as numbers in `src/render/poses.ts`, so every tweak goes through a code change, and Blender runs
only in the cloud.

## What Changes

- `?editor` opens an in-browser keyframe editor (`src/editor/`): the real rig and model, a timeline with keys,
  drag handles for the hips, feet and board, every pose value as a slider, auto-key, undo, a ghost of the previous
  key and a reference-photo overlay.
- Saving writes `src/render/clip-edits.json` through a Vite dev-server endpoint (`vite.config.ts`). `poses.ts`
  merges it over the code clips; edited clips play from their keys rather than the baked Blender action.
- `?drafts` plays the editor's unsaved clips in the game.

## Capabilities

### New Capabilities

- `animation-editor`: keyframing the skater's clips in the browser.

### Modified Capabilities

(none)
