# zack's creature style: a guide for the Blender bot

Draft 1, 2026-11-03. Read off the seven models zack made in `blender files/`
(Hydralisk, Scorpbug, snake, Spider Queen and her tower, Egg Clutch, tank).
This is the draft the Claude skill grows from; zack corrects it as we go.

Reference renders: `/mnt/project-files/blender-bot/reference_*.png` (the
project's shared files), rebuilt with `bb_render.py`.

## The first principle: copy HOW zack builds, not what he built

zack, 2026-11-04: "we dont want to Copy Features from mine. your
interpreting me too literally. it should derive an essense of HOW i make
the models." (Before that, on pass 2: "it just got more generic across the
board.") A new model borrows no parts, colours or patterns from zack's. It
is built the way zack builds, and the look follows from the process.

What the files say about how zack works (`bb_how.py` reads it):

- **Grown from one primitive.** The Hydralisk is a single connected mesh
  still named `Cube`; the Queen is `Icosphere.007`, the tower `Torus.005`,
  the clutch `Cylinder`. He starts from a default primitive and extrudes the
  whole creature out of it, without renaming.
- **Freehand, not mirrored.** No Mirror modifier on any creature, and only
  0 to 4 percent of the Hydralisk's, Scorpbug's or snake's vertices have a
  mirror twin. Each side is pulled by hand and they come out different.
- **Exaggerated stretch.** Edge lengths on one mesh run from 0.04 to 5.2
  (Hydralisk): long pulled-out faces next to tiny ones. Proportions are
  pushed, not even.
- **Hard facets.** The median angle between neighbouring faces is 38 to 65
  degrees on the creatures: few faces, each turning sharply.
- **Duplicate, place, join.** A big model repeats a piece (eight identical
  128 vertex legs and identical eggs on the Queen, five rings on the tower)
  and joins the copies into one object.
- **Painted by hand on the model.** The `Paint Hard` brush, 256px, in
  Blender's Texture Paint workspace: hard edged strokes laid straight onto
  the surface, so bands and marks follow the form and wobble with the hand.
- **Animated by hand, densely.** 300 to 1,250 keyframes an action, so the
  motion is full of in-betweens and overlap, not a few poses.

## zack's process, in his words (2026-11-04)

> "you extrude out from a primitive, scaling the verts as needed to make the
> basic structure, then you use the Knife tool to cut shapes into that mesh
> and extrude those out for shaping the features. then, you can add
> primitives as accents after that."

1. **Block out:** extrude out from one primitive, scaling the verts as needed
   for the basic structure.
2. **Knife and extrude:** cut shapes into that mesh with the Knife tool and
   extrude those shapes out to form the features (a crest, a lip, a plate).
3. **Accents:** add separate primitives last, as accents.
4. **Freehand,** yes. **Uneven** is fine but not overused: keep the jitter and
   the stretch modest.
5. **Paint in two passes:** one at 100 percent opacity, then one at 20
   percent, which takes longer. The 20 percent pass is still to be worked out
   with zack separately; for now only the 100 percent pass is built.
6. **Colour comes from zack, not from his models** (2026-11-04: "the colors
   should not come from my models. the colors should come from me. ill tell
   you what they should be and ill give you references to pull from"). Ask
   for the palette and references for each model; until they arrive, use a
   placeholder palette and say it is one.
7. **The skeleton is symmetric; only the clay is uneven** (2026-11-04: "body
   skeleton should not try to be asymetrical. only the \"clay\" around those
   bones can be asymentrical"). Block out and knife mirror-true (the build
   prints the mirror error before the clay pass and it should read 0), then
   add the hand: vertex jitter and a few soft lumps, on the mesh only. Bones
   and joints stay mirrored.
8. **Paint patterns come from the skeleton** (2026-11-04: "i want the texture
   paint to take patterns from the skeletons"). Lay each mark over a real
   bone: ribs as flank stripes, the shoulder blade, the hip, the vertebrae's
   spines and the tail's chevrons, the skull's windows (eye socket, the
   openings in front of and behind it, the nostril, the jaw window), the leg
   and foot bones. Not tiger stripes placed by eye.
9. **Legs are extruded out of the main body block** and the head is modelled
   properly: knife the end of the neck across at the mouth line and extrude
   the upper skull and the lower jaw as two halves.
9b. **One mass, and a boss is fat** (2026-11-04: "the legs should merge we
    shouldnt have segmented body parts", "bosses are fat, so since this is a
    boss, the belly should be fatter"). A thigh grows out of the flank so its
    outline runs on up to the back; no part reads as a box stuck to another
    box. A boss's belly sags into a gut that sweeps up into the chest and the
    tail (`C.gut`, `C.leg_patches`).
10. **Readable and balanced from all three views** (2026-11-04: "all body
    parts should be visible from all three directions. easy to read", "the
    texture should be balanced in all three directions"). Check the front,
    side and back sheet: every limb shows its own silhouette in each (the
    Tyrant's arms are held out wide and forward), and the paint is spread
    over the front and back as well as the flanks.
11. **Bead patterns are next** for the pattern style. zack will give
    references from a bead weaving book; do not take anything from the book
    until he names the pages.
12. **A personality pass after the clay** (2026-11-04: "bring out more
    attention to the forms by adding a personality to the creature.. maybe
    one arms slightly longer than the other... maybe it has a battle scar
    somewhere odd on its body"). One or two deliberate breaks of the
    symmetry: a longer limb (the bone follows), a knifed scar, a broken spike
    or tooth. `Creature.lengthen`, `Creature.scar`.
13. **The final pass connects everything** (2026-11-04: "look for seperate
    meshes for accents that should be seated within the body of it. instead
    of moving them into the body to extrude out from the body to meet
    them"). `Creature.connect` extrudes a socket from the body to each
    floating accent; the accent stays where it is.
14. **Show the animations as moving images** (a GIF), not stills: zack cannot
   judge motion from frames.
15. **No slop, at rest or in motion** (2026-11-04: "fix Slop. huge red to see
   these", "loop cutting body parts and scaling bigger just enough to make sure
   there are none of these slop sections of holes in the geometry... WHEN
   ANIMATIONS PLAY"). Slop is skin passing through skin, an accent going in
   and out of the body, a face turned inside out (in Godot you see the far
   wall through it: the "gray through the back"), and a crease a pose folds
   much sharper than the rest pose. `slop_check.py` paints every one huge red
   on plain clay, for the rest pose from three views and for the worst frame
   of every action, and the model ships at zero. The fixes, in order:
   - **Build so it cannot happen.** A sharp turn in an extrusion gets a knee
     ring (bb_lib does this past 70 degrees) and a hinge clamp, so walls never
     fold back; a leg grows out of the gut's lower flank along that patch's own
     facing, widened, and only then turns down (no side face that has to turn
     90 degrees, no thin bevel strip that starves the thigh, no thigh box
     hung under a body box); skull and jaw keep a gap at the mouth line
     (`keep=`); a brow or ridge knife never catches the jaw (`C.on` skips
     parts); the clay puts back any vert that folds the skin; accents sit on
     the skin where a ray meets it (`C.skin`), never at a guessed offset.
   - **Rig so joints can bend.** Each limb binds only to its own bones; a
     ring on a joint, a limb's root ring, and the skin next to the jaw are
     shared between the two bones. A jaw opens about the back of the mouth
     line, a leg swings about a socket inside the hip, and +X opens a jaw
     (-X once slammed the Tyrant's shut through its own skull).
   - **Then loop cut.** `G.fix_joints()` plays every action and, at each joint
     still creasing, loop cuts the band either side of it and swells the joint
     ring a step at a time (1.0, 1.06, 1.12, 1.2), keeping the least that
     helps. On the Hailcaster it cut the abdomen joints and the sac's root
     (the ridge zack pointed at in the walk).
   - **Never by thinning a part.** A fix that makes a limb skinnier is not a
     fix (the Tyrant's legs lost their bulk once that way, zack: "you made
     the legs too skinny"). Keep the volume
     the block-out gave it and fix the turn, the rig or the pose instead.
   - **Last, the animation.** If a pose still drives a limb through the body,
     the pose is wrong: the Tyrant's bite now rears back before it lunges.

In a script: block out with extrusions and per-step vertex scaling; emulate
the knife by cutting a drawn outline into the body's faces (a polygon
projected onto the surface and split in) and extruding that region; join a
few primitives on as accents; jitter lightly. Never lift a part, a colour
pair or a pattern from one of zack's models.

## Measured

| Model | Tris | Texture | Bones | Actions |
| --- | ---: | --- | ---: | --- |
| snake | 232 | 256 | 12 | walk, death |
| Scorpbug | 456 | 256 | 29 (IK legs) | walk, attack, death |
| Hydralisk | 508 | 256 | 23 (IK arms) | walk, ring_attack, death |
| tank | 1,170 (3 parts) | 512 body, 256 gun and tracks | none | none |
| Egg Clutch | 4,548 | 512 | none | none |
| Spider Queen | 5,232 | 512 | 46 (IK legs) | 9: idle, walk, attack_burst, hit_react, shield_raise, shield_break, spawn_minions, enrage_final, death |
| Queen's tower | 6,012 | 256 | none | none |

## The rules

1. **Low poly and faceted.** A swarm or regular enemy is 200 to 600
   triangles; a boss or a set piece can run to 5,000 or 6,000. Every face is
   flat shaded (no smooth groups at all on the creatures). Mostly quads, with
   n-gon caps left on the ends of tubes.
2. **Simple primitives pulled into long tapers.** 5 to 8 sided cylinders
   extruded into bodies, limbs, tails, necks and claws that taper to a
   point. For a scripted build, rounded 8 sided body tubes beat stepped
   plates (zack picked pass 1 over pass 2).
3. **One painted texture, one material.** 256px for an enemy, 512 for a boss
   or something big. Image Texture set to **Closest**, into a default
   Principled BSDF (roughness 0.5, metallic 0, no emission map, no normal
   map in the .blend).
4. **The paint carries the detail.** Loose, visible brush strokes; stripes and
   bands across limbs; scales outlined in a darker tone; zigzags; big cartoon
   eyes (white with a dark pupil) and rows of bone coloured teeth. Islands
   are small and many (Smart UV Project style, no hand seams), covering
   30 to 50 percent of the sheet on a black ground.
5. **(Superseded: colour comes from zack, see his process above.)** Bold, saturated colour on a dark base. Each creature has one loud pair
   and an accent: orange and pink (Hydralisk), yellow and maroon with a lime
   accent (Scorpbug), lime and tan (snake), navy with red and bone (Queen).
6. **Rigged for the game.** One armature, bones named in chains
   (`main.001`...), IK controls on legs and arms, rigid or near rigid weights
   (low poly bends at the joints). Every enemy has at least walk, attack and
   death; a boss gets an idle, a hit react and one action per phase move.
7. **Faces -Y.** The creatures are built head towards -Y, Z up, Blender units
   un-scaled (the game scales them on import).

## Open questions for zack

- Is the colour pairing per creature deliberate (one loud pair each), or
  should a new enemy match its planet or sector?
- How are the textures painted: Blender texture paint, an external painter,
  or Crocotile (there is a `crocotile/miner game.crocotile` beside them)?
- Should new models export a `.glb` for the game here, or stay as `.blend`
  for zack to finish by hand?

## First attempt: the Tunnel Beetle

`build_tunnel_beetle.py` builds it from nothing: 482 triangles, one 256px
Closest texture painted by script from each part's 3D position, a 21 bone
armature, walk (tripod gait), attack (mandible snap) and death (flips over).
Output: `blender files/bot/tunnel_beetle.blend`.

Pass 1 got these wrong against zack's models (zack, 2026-11-03: "honestly
im loving it"):

- Its body is 8 sided tubes, so it reads rounder and smoother than zack's
  blockier, plated shapes.
- Its paint is procedural and clean (hard stripes, even bands). zack's has
  loose strokes and hand wobble.
- Smart UV split the legs face by face, so each face got its own outline.

Pass 2 (422 tris) tried a 6 sided plated body, 4 sided legs, pattern wobble,
brush dabs and no island outline. **zack preferred pass 1** (2026-11-04:
"first pass is better"), so pass 1 is the build again and its choices are
the style: 8 sided rounded body tubes, 5 sided legs, clean bold bands and
stripes, and a dark outline round each UV island.

## Tools

Run with the `bpy` module (`pip install bpy` under Python 3.11; 5.0.1 reads
zack's Blender 5.2 files with a version warning). Blender's own download
site is blocked from the cloud, PyPI is not.

- `bb_inspect.py -- file.blend`: mesh, material, texture, rig and action stats.
- `bb_render.py -- file.blend out_prefix [hidden,objects]`: four ortho views in Cycles.
- `pose_render.py -- file.blend out_prefix`: the beetle's actions, a frame each.
- `sheet.py out.png name,name`: contact sheet of `renders/<name>_<view>.png`.
- `slop_check.py -- file.blend out_prefix [px]`: the slop sheet, every bad face
  huge red, rest and animation; exits 1 while anything is left.
