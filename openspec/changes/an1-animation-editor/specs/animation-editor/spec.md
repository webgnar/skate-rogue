## ADDED Requirements

### Requirement: Clips can be keyframed in the browser
The game SHALL open a keyframe editor at `?editor` that plays any clip on the game's rig and lets the user add,
delete, retime and pose keys, by dragging the hips, feet and board or by setting each pose value.

#### Scenario: Editing between keys
- **WHEN** the user changes a pose value with the playhead between two keys
- **THEN** a key is added at the playhead holding the pose shown there with that change

### Requirement: Edited clips are saved to the repo and played by the game
Saving SHALL write every edited clip to `src/render/clip-edits.json`, and the game SHALL play a clip from that file
in place of the code clip and the baked Blender action of the same name.

#### Scenario: Save and play
- **WHEN** the user saves an edited kickflip from the editor on the dev server
- **THEN** clip-edits.json holds the new kickflip and the game plays it
