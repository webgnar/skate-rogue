# Painting and editing the skaters in Blender

Lou (`art/lou-gnar.blend`) and the QFS skaters (`art/webster.blend`, `keanu`, `roxy`, `goldie`) each have a Blender
file. That file is the source of truth for the model. The export writes the game's GLB (`public/models/<name>.glb`)
from it exactly as it is.

## Where the models come from

Since Nov 1, 2026 all five skaters are zack's Meshy models of the DBZ-style concept sheets
(`art/reference/characters/`), put on the game's rig by `art/meshy_skater.py`:

    blender -b -P art/meshy_skater.py -- webster --src <folder with the Meshy .glb files>

It reduces the model to 6,000 triangles and bakes its colours onto `art/tex/<name>.png` (`art/game_ready.py`, the
pass from underground-LA), fits the mesh to the rig's bind pose (arms straight down, each limb stretched or squashed
to the rig's bone lengths, the head, hands and feet kept their size), skins it with automatic weights, hangs the hair
spikes, Keanu's drawstrings and Lou's scarf tail on Spring chains, and writes the `.blend` and the GLB. Lou keeps his
clips and the neon glint over his visor. The Meshy files (20-40 MB each) are not in git: they
are in the project's shared files, under `meshy/`.

Running it again replaces the skater's mesh, texture and Spring bones in the `.blend`, so paint and mesh edits made
since are lost. After the first run the `.blend` is the source, as below.

## Paint

1. Open the skater's `.blend` file and switch to the **Texture Paint** workspace.
2. Paint on the model. The model reads one texture, `art/tex/<name>.png` (Lou's is `lou-gnar.png`).
3. Choose **Image > Save**. It writes over that PNG.

You can also paint the PNG in any image app. Lou's visor glint and the shoe-wear decals are not on the
texture, because the game shades them itself.

## Edit the mesh

Make shape changes in **Edit Mode**, then save the `.blend`. Keep these intact, or the game breaks:

- **The rig.** Don't rename, add, delete or move bones. The game plays its clips on those bones by name, from the
  bind pose, so a moved bone throws the animation off.
- **One mesh.** Keep the model's mesh object, with its name (`LouGnar`, `Keanu`, ...), parented to the rig with
  its Armature modifier. If you model a new part as a separate object, join it in with Ctrl+J. For Lou, anything
  that isn't joined is left out of the export.
- **Weights.** Faces you extrude keep their source's weights. A brand-new part needs weights: Weight Paint it, or
  select it and the rig and press Ctrl+P > With Automatic Weights. A vertex weighted to no bone gets left behind at
  the skater's feet. The export warns about these.
- **Scale and placement.** Don't move, rotate or scale the objects in Object Mode. Keep their transforms at zero
  and 1, and do everything in Edit Mode. The model is in rig units, about 1.9 tall.
- **UVs.** Moved faces keep their paint. New faces need a spot on the texture (UV Editing > unwrap them into a
  free corner), or they show one smeared colour.

### Hair and cloth

Hair spikes and locks, Keanu's drawstrings and Lou's scarf tail swing on the `Spring...` bone chains
(`src/render/springs.ts`). The Meshy models' hood, hoodie and crop tops are fitted, so they have none. Each strand or strip of cloth is weighted to its chain. You can reshape them freely
as long as they keep those weights. The chains stay where they are, so a spike you move far from its bone swings
around that bone. To move, lengthen or add chains, ask for the change in the script.

## Into the game

Push the changed `.blend` and PNG files, or send them in chat. Then run the export, which doesn't rebuild anything:

    blender -b -P art/lou_gnar.py          # Lou
    blender -b -P art/skaters.py           # all four QFS skaters (or: -- keanu)

`--rebuild` remakes a model from its script and overwrites the `.blend`, which loses hand edits. After a skater
has been edited by hand, script changes go into the `.blend` instead, the way `--add-scarf` added Lou's scarf.
