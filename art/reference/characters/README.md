# Character concept art (DBZ-style redesign)

zack's turnaround sheets for the five skaters, in a Dragon Ball Z / anime line style. These are the redesign
targets for the next pass on the player models. Added 2026-11-01.

| File | Character | Views |
| --- | --- | --- |
| `lou-gnar.png` | Lou Gnar | front, side, back, side (1536 × 1024) |
| `keanu.png` | Keanu | front, side, back, side (1536 × 1024) |
| `webster.png` | Webster | front, side, back (1225 × 1024) |
| `goldie.png` | Goldie | turnaround (1199 × 1312) |
| `roxy.png` | Roxy | turnaround (1199 × 1312) |

## Pipeline plan

1. Feed each sheet to Meshy to get a first 3D pass of the redesign.
2. Rebuild it low-poly in Blender on the existing rig in the skater's `.blend` (`art/lou-gnar.blend`,
   `art/keanu.blend`, `art/webster.blend`, `art/goldie.blend`, `art/roxy.blend`), keeping the bones, the single
   mesh and the one texture per skater as described in `docs/painting-models.md`.
3. Export the GLB as usual, so the existing clips keep playing on the new body.

These sheets are reference only. Nothing in the game reads them.
