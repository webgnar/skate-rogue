---
name: blender-bot
description: Build a creature, character or prop in Blender in zack's style from one prompt ("make me a <animal>" plus reference images), headless bpy in a cloud session; block out from one primitive, rig, animate, slop check and paint in one pass, then export a .glb. Use when zack asks for a new model "in my style", a "blender bot" model, or a creature built from references.
---

## In skate-rogue

Copied from RubenTipparach/godot-sandbox (branch `claude/project-thread-04dvj3`,
commit 0ac88715, 2026-11-04), where it was written for Mining Mike's enemies.
Everything below is that skill as it stands; read its paths this way here:

- `tools/blender_bot/` is this folder, `.claude/skills/blender-bot/`
  (`T=.claude/skills/blender-bot`). `bb_lib.py` is here too.
- `blender files/bot/<name>.blend` and its `.png` go in `art/bot/` (skate-rogue
  keeps its Blender sources in `art/`).
- The `build_*.py` files are Mining Mike creatures, kept as worked examples:
  copy their structure, never their numbers.
- Section 6 ("Into the game") is Godot. Here the game is Three.js: export with
  `export_glb.py` to `public/models/bot/<name>.glb` and load it with
  GLTFLoader the way the other models in `public/models/` are loaded. Its
  Godot wrapper-scene and `godot --import` steps do not apply.
- `bb_render.py`'s texture SEARCH paths point at the godot-sandbox checkout;
  point them at `art/bot/` when rendering here.


# Blender bot: a model in zack's style, in one shot

Use this for any new or unfinished Mining Mike creature, boss or prop that
zack wants modelled the way he models. The aim is to reach, in one pass, the
state the Tyrant reached after review (2026-11-04): mirror-true skeleton,
knifed features, a personality pass, primitive accents seated on the body,
skeleton-derived paint balanced in all three views, a rig named after the
game's pivots, GIFs, and zero slop at rest and in every frame. `build_hailcaster.py` is the proof: it was built in
one pass from this skill.

Everything lives in the godot-sandbox repo at `tools/blender_bot/`:
`bb_lib.py` (the machinery), `build_rex.py` (the newest one-shot, read it
first and copy its shape), `build_tyrant.py` (the reviewed Tyrant), `STYLE_GUIDE.md` (the rules and why),
`turnaround.py`, `closeup.py`, `anim_gif.py`. Models go to
`blender files/bot/<name>.blend` with its `<name>.png` texture. If
`bb_lib.py` is missing, it is on the `zack` branch (or
`claude/project-thread-nl72ri`).

## From one prompt: "make me a <animal>" plus references

This is how zack uses the skill (2026-11-04): one prompt and some attached
reference images, and the finished model comes back. Run it end to end
without stopping to ask; say what you assumed in the reply.

1. **Read the references** (section 1): the animal's skeleton, whether it is
   a boss (fat, a bone per leg segment) or a swarm creature, and the ratios
   for `REF` measured off the side view (step 1b).
2. **Palette:** zack's if he gave one, else choose a colourful one in the
   feel of his, never his exact colours (`PAINTING.md`). Do not wait for it.
3. **Write `build_<name>.py`**, copying the STRUCTURE (the order of the
   steps and the lib calls), never the numbers, of `build_rex.py` (the newest
   one-shot) or `build_hailcaster.py` (a many-legged bug): block out,
   `BLOCKOUT_ONLY=1` until `C.proportions(REF)` returns nothing, knife,
   clay, personality, accents, connect.
4. **Rig and animate** (section 4): walk plus the creature's attacks,
   `fix_joints` to `JOINTS left 0`.
5. **Paint** (section 3, `PAINTING.md`): UV, sprayed base with the skeleton
   marks, a bead pattern searched from the bead book for this animal, sketch
   marks.
6. **Check and deliver** (section 5): `slop_check.py` at zero, then the
   front, side and back sheet, the slop sheet and a GIF per action.
7. **Into the game** (section 6): export the .glb, wrap it in the scene the
   enemy already loads, play its clips from the enemy's script, import and
   run that enemy's harness.

## 0. Setup (cloud container)

download.blender.org is blocked. Use bpy from PyPI:

```bash
python3.11 -m venv /opt/bpyenv && /opt/bpyenv/bin/pip install -q bpy pillow scipy
/opt/bpyenv/bin/python tools/blender_bot/build_<name>.py -- <out dir> [seed] [scheme]
```

## 1. Before building: read, don't guess

- **Colours: zack's palette when he gives one**, and then only those colours
  (the Tyrant uses exactly five). Without one, choose a colourful palette in
  the feel of his but never his exact colours (`PAINTING.md`, Colours), name
  it with its hex values in the reply, and never stop the build for it.
- Read what the game needs: the enemy's script (its pivot names, which become
  bone names), its size, and any design notes (`godot-sandbox/docs/mockups/`).
- Gather anatomy: what the real or imagined skeleton is. The paint is drawn
  from it, so know the ribs, skull openings, vertebrae and limb bones.

## 2. Build: one script, `tools/blender_bot/build_<name>.py`, on bb_lib

Conventions: faces -Y, Z up, X is left (-1) / right (+1). One mesh named
after its primitive ("Cube").

1. **Block out from ONE primitive** (`C.start_cube(size, at)`; it rounds the
   long edges so tubes have eight sides). Grow everything with
   `C.run(face, steps, name=, region=, part=)`: each step is
   `(direction, distance, scale, squash_z[, (sx, sy, sz)[, slide]])`. Legs and
   arms come OUT OF THE MAIN BODY block, never as separate parts, and they
   MERGE into it (zack: "the legs should merge we shouldnt have segmented
   body parts"): no box of a thigh hung under a box of a body.
   - **A boss is fat** (zack: "bosses are fat"). After the chest and tail
     runs, `C.gut(depth, HIP, half=)` sags the underside into a gut: depth about
     the hip block's own height (Rex: 6.0 on a 5.6 block), `half` a little past
     the leg patches (Rex: 3.0) so the gut is level where the thighs swing,
     level under the hips, fading up into the chest and the tail root.
   - **Legs from the gut's flanks.** `pats = C.leg_patches(HIP)` gives one
     face a side (the underside plus the bevel above it). Each leg's run
     starts with a haunch along that face's own normal, widened and slid
     out: `(tuple(pats[side].normal), 0.6, 1, 1, (1.3, 1.05, 1), (side * 0.4, 0, 0))`,
     then the thigh turns down by under 30 degrees. No turn at the root means
     nothing folds, and the thigh wall carries on up the flank.
   - Never shrink a limb to make it fit; widen the ring, the way zack scales
     verts out. `build_tyrant.py` has it.
   - **A flat creature** (a ray, a flyer, anything the overhead camera sees
     mostly from above): `C.start_cube(..., round_plan=r)` bevels the upright
     corners too, so the disc reads round from above and not as a box with
     wings bolted on (the Manta's body did). Grow each wing out of the WHOLE
     flank, `C.side_patch(side)` (every flank face dissolved into one), so the
     disc flows into the wing. The root is then as tall as the flank, so
     squash the wing's first step flat (`squash_z` well under 1) or the root
     stands up like a wall in the front view.
   - **A fin is a paddle, not a horn.** Squash it across its own plane with
     `sxyz` at every step, curl it, and end it blunt or rolled. A round tube
     tapering to a point reads as a horn: the Manta's cephalic fins did.
   Give every limb a `region` (the paint uses it) and a `name` (its joint log
   becomes the bones).
1b. **Hold the block-out to the reference** (the Rex one-shot came out with
   half the reference's head because nothing measured it). Measure ratios
   off zack's drawing, each against the length nose to tail: `head_len`,
   `head_depth`, `body_depth` (at the hips, gut included), `height`. Put them
   in the script as `REF` and call `C.proportions(REF)` after the legs: it
   prints model against reference and returns what is off by more than 15
   percent. Fix the runs until it returns nothing (`BLOCKOUT_ONLY=1` exits
   there, about 20 seconds a try). The tail's length moves every ratio.
2. **Model the head properly.** Knife the end of the neck across at the
   mouth line (`C.split_face`) and extrude the two halves as the skull/upper
   jaw and the lower jaw (`part=` so it skins to the Jaw bone). Open the jaw
   a little in the rest pose so teeth and mouth read.
3. **Knife features in and extrude them** (`C.knife` + `C.pull`, and
   `C.inset` for a rim or a socket): brows, cheeks, ridges, plates. Use these
   rather than raw `bmesh.ops`: the new verts carry the limb, region, part and
   ring of the faces they came from, so a lip pulled off a maw skins to the
   maw's bone. Name `limb=`, `region=`, `part=` to give them others. Untagged
   verts went to the nearest BODY bone and tore away when the part moved
   (the Flakmaw's maw rim, 2026-11-04). A feature on both sides uses `C.knife_pair` (one
   strip cut at -x and +x together); knifing each side alone breaks the
   mirror. Limit a feature's faces to its region (`C.on('head', f)`), or it
   catches a nearby limb.
4. **The skeleton is mirror-true, and one seed builds one model.** No jitter
   in steps 1 to 3. Never hand a bmesh op a `set` of verts, edges or faces,
   and never loop over one: a set's order follows memory addresses, which
   change from run to run, and bmesh cuts in the order it is handed geometry.
   The Skimmer built with 3 bad faces one run and 0 the next from the same
   seed. Use `_u(...)` from bb_lib (unique, in first-seen order). To check,
   build twice with different `PYTHONHASHSEED` and compare `TRIS` and `JOINTS`.
   `assert C.mirror_error() < 1e-3` before the clay. Every step mirrors by
   `side`, and nothing reads a random number before this check.
5. **Clay, the only random unevenness** (`C.clay()`): light vertex jitter and a few
   soft lumps. Subtle. zack: "uneven is ok but dont over use it".
6. **Personality pass, a second geometry pass after the clay** (zack: "bring
   out more attention to the forms by adding a personality to the creature..
   maybe one arms slightly longer than the other... maybe it has a battle scar
   somewhere odd on its body"). Break the symmetry ON PURPOSE, once or twice:
   `C.lengthen('arm_l', 1.18)` stretches one limb and its joint log, so the
   bone follows; `C.scar(origin, toward, direction, length)` knifes a slash
   into the surface somewhere unexpected and pushes it in (the paint marks it
   with `P.paint_scars(dark, pale)`). A broken spike, tooth or mandible also
   counts. Keep it to one or two things that tell a story, and put them where
   they read in the sheet.
7. **Accents last, as primitives** (`C.cone`, `C.ball`, `C.box`, each with a
   key): teeth along the mouth edges (from the ring logs `C.R`), eyes under
   the brows, claws, spikes, tongue. Place them with `C.skin(origin, dir)`.
   An eye sits IN the skull, not on its corner: aim the ray at the side of the
   skull below the brow and a third of the way along it, and sink the ball by
   half its radius, so it reads as an eye under a brow and not a peg (the
   one-shot Tyrant's eyes stuck out of the skull corners).
8. **Final pass: everything visually connected** (zack: "look for seperate
   meshes for accents that should be seated within the body of it. instead of
   moving them into the body to extrude out from the body to meet them").
   `C.connect()` finds every accent whose base floats off the body, knifes a
   patch on the body under it and extrudes that patch out to the accent. The
   accent never moves. It prints how many sockets it made; look at the feet,
   hands and mouth in close-ups afterwards. A socket that would run through
   the body's own skin is taken back out (`SOCKET dropped`): two claws on a
   narrow foot tip did that on the Skimmer. Move that accent onto the skin.
9. **Every part reads from the front, side and back.** Hold arms wide and
   forward; no limb hidden behind the body or head in any view.
10. **No slop before the paint** (zack: "fix Slop. huge red to see these").
    Build so it cannot happen: legs from `C.leg_patches` with a haunch along
    the patch's own normal (step 1), so no limb starts with a sharp turn; split
    skull and jaw with `keep=(MOUTH_Z, +1/-1, 2)` so they never touch; knife
    features only on part-0 faces (`C.on` does this); seat every accent with
    `C.skin`. bb_lib adds a knee ring past a 70 degree turn, clamps a ring
    that would fold back (prints `HINGE`), puts back clay verts that fold the
    skin (`CLAY put back`), refuses a pillar socket for a misplaced accent
    (`MISPLACED`), and prints `SKIN CROSSES ITSELF` at the mirror check.
    Any of those lines means fix the spec, not the library.

## 3. UV and paint (`PAINTING.md`)

The whole process is in `PAINTING.md`, owned by the painting work. In short:
Smart UV 80, Average Island Scale, Pack Islands, blank space black; bosses at
1024. Pass 1 is the sprayed base with the skeleton marks (`Painter`, below).
Pass 2 is a bead pattern searched from the bead book for this animal
(`bead_catalog.py`, read by `bead_read_page.py`), sprayed from front, back,
left and right at 50% (`bead_project.py`). Pass 3 is the 20% sketch marks
(`sketch_marks.py`), darks in the crevices and light on every accent
except a glowing one (`--glow`), which stays clean.

`Painter` (pass 1):

- Closest sampling, hard edges. Base colour, a darker back
  (`P.broad(..., 'above')`), a belly (`'below'`, starting behind the chin).
- **Patterns come from the skeleton.** Each mark sits over a bone: ribs down
  the flanks, shoulder blade, hip plates, neck vertebrae, tail spines and
  chevrons, skull openings (eye socket, the openings in front of and behind
  the eye, nostril, jaw window), limb and foot bones. Use `side_line` /
  `side_oval` for the side, `view_line` for front and back, `top_line` /
  `spine_bars` from above.
- **Balanced in all three directions.** Front gets the wishbone and belly
  ribs and the limb bones, the back gets hip plates, shoulder blades and limb
  bones, the top gets a bar per vertebra. Check the sheet: front and back
  should carry as much paint as the side.
- Accents take one colour whole (`P.accents({key: colour})`), then small dabs
  (pupils, spike tips).

## 4. Rig and animate (`Rig`)

Bones named after the pivots the game's script drives, from the joint logs
(`G.bone`, `G.chain` for tails). **Enough bones for the size on screen**
(zack, 2026-11-04): a boss is big on screen, so every segment of a limb gets
its own bone, thigh, shin, ankle and foot (`Leg`, `Shin`, `Ankle`, `Foot`
from `J[leg][0..4]`); a segment with no bone of its own is split between its
neighbours and reads as rubber. Toes are not needed. A small swarm creature
can merge segments. In the walk the ankle folds as the foot lifts and the
foot stays flat while it carries weight. Give every limb bone `limb=<run name>` so a
limb binds only to its own bones. The Jaw bone starts at the BACK of the mouth
line (`Vector((0, neck_end.y, MOUTH_Z))`), a leg bone at a socket inside the
hip. `G.skin(part_bones={JAW: "Jaw"})` shares each joint ring, each limb's
root ring and the skin beside the jaw between the two bones. Actions keyed on
every frame (`G.act(name, frames, pose)`), dense with overlap: walk plus the
creature's attacks. **+X tips a bone's far end down: +X opens the jaw, -X
lifts a neck.** An attack winds up (rears back) before it lunges.

**A wing, fin or flap swings on a hinge: `G.bone(..., hinge=True)`.** A
grown limb (a leg out of the hip) shares its root ring half and half with
the body bone, so the body bends with it. A hinged one must not: on the
Harrier every wingbeat dragged the thorax's flank up and down with it and
creased it. `hinge=True` on the limb's first bone keeps its root ring wholly
on the parent; put that bone's head a little out past the root ring, so the
beat turns about the stalk, not the body. **A wing beats about the bone's
local X** (a bone running out along +-X: its local X lies fore and aft), and
+ is up on both sides on the Harrier. A turn about local Z sweeps the wing
forward and back instead, which is what the Harrier's first flap did. Check
the sign in one pose render before keying the whole loop.

**A chain shares its bend.** The neck and the tail are chains (`G.chain`,
a bone per ring). A pose gives the chain a TOTAL angle and each bone its
share (`total / len(chain)`), never the full angle on every bone: the
one-shot Tyrant gave every neck and tail bone the whole angle, the bend
added up down the chain and left 143 creases. A wave down a chain is the
same share with a phase lag per bone.

Then `G.fix_joints()` before `G.save` (zack: "loop cutting body parts and
scaling bigger just enough to make sure there are none of these slop sections
... WHEN ANIMATIONS PLAY"): it plays every action, and at each joint still
crossing, flipping or creasing it loop cuts the band either side and swells
the joint ring the least that helps. It must print `JOINTS left 0`.

**Keep the motion full** (zack: "turn down the slop detector to let the
animations be more free", and 2026-11-06: "loosen the slop detection, its
making all our animations weak"). A big swing that reads is the point of the
animation; never tone a pose down to pass the check. The posed check lets a
joint fold hard: a crease only counts past 120 degrees sharper than rest
(`SLOP_CREASE_DEG`), skin pinching into skin within two edges of itself is a
fold, not a hole (`SLOP_NEAR`: the back of a knee, an armpit), and a face is
only inside out once it turns more than 120 degrees off its bone
(`SLOP_FLIP_DEG`). It stays strict on real holes: skin through skin further
off (a leg through the belly, an ear through the skull) and faces turned
right round. The rest pose is checked as strictly as ever. In order: share the bend along the chain, give the joint
more rings (more, shorter steps in that run), let `fix_joints` cut and
swell. Anything left is a geometry problem in the block-out, fixed there.
`G.soften()` exists but is not part of a build: use it only if zack asks.

## 5. Check and deliver

```bash
B=/opt/bpyenv/bin/python; T=tools/blender_bot
$B $T/build_<name>.py -- $OUT            # prints MIRROR 0.0, TRIS, SAVED
$B $T/turnaround.py -- $OUT/<name>.blend $OUT/sheet.png 768   # a flat creature also gets TOP and BELOW
$B $T/closeup.py -- $OUT/<name>.blend $OUT/head.png <ymax of the head>
$B $T/closeup.py -- $OUT/<name>.blend $OUT/scar.png 0 512 x0,x1,y0,y1,z0,z1   # any box: a scar, a foot
$B $T/anim_gif.py -- $OUT/<name>.blend $OUT/<name>          # one GIF per action
$B $T/slop_check.py -- $OUT/<name>.blend $OUT/slop 480     # HUGE RED slop sheet, must say none
```

`slop_check.py` paints every bad face red on plain matte clay: skin through
skin, an accent in and out of the body, a face inside out (in Godot that is a
hole you see the far wall through), for the rest pose from three views and
for the worst frame of every action, plus creases a pose folds more than 120
degrees sharper than rest (`SLOP_CREASE_DEG`; `SLOP_NEAR` and `SLOP_FLIP_DEG`
in section 4). It exits 1 until every count is zero. Ship nothing red.

Look at every image before sending, the slop sheet first. Then:
- Copy the sheet, the slop sheet, the head close-up and the GIFs to
  `/mnt/project-files/blender-bot/` and attach them. zack judges a model by
  its **front, side and back sheet** (plus top and below for a flat
  creature, which `turnaround.py` adds itself), and motion only from **GIFs**.
- Copy `<name>.blend` and `<name>.png` to `blender files/bot/`, commit the
  build script with them, push.

## 6. Into the game: GLB, wrapper scene, clips

Done twice the same way: the Tyrant (PR #379) and the Locust (PR #380).

**Export.** `export_glb.py` writes one clip per `G.act` track, adds an
`idle` rest clip if there is none, and embeds the texture:

```bash
M=godot-sandbox/resources/models/characters/<name>
mkdir -p $M && $B $T/export_glb.py -- "blender files/bot/<name>.blend" $M/<name>.glb
```

Godot extracts the texture on import as `<name>_<image>.png` beside the
.glb. Commit the .glb, that .png and both `.import` files.

**Wrap it in the scene the game already loads.** Find the enemy's current
model scene (its blockout, or `scenes/models/<name>_body.tscn`) and the
script that reads it. Keep that scene's root and its name, so every caller
still finds it, and put the .glb in as an instance:

- **Scale and facing go on that instance's transform**, never into the
  export. `Transform3D(-s, 0, 0, 0, s, 0, 0, 0, -s, 0, 0, 0)` is scale `s`
  and a half turn about Y. With it, Blender (x, y, z) lands at
  (-x, z, y) times `s`, so a model built facing -Y faces -Z, as the
  Tyrant's blockout did. Without the turn it faces +Z. Use whichever the old
  scene faced, and measure the old size (`tools/probe_sizes.gd`) so the new
  one matches: the Tyrant is 10x (406 long against the blockout's 404), the
  Locust 0.5x.
- The half turn swaps sides. The bone `LegLeft` (the animal's own left)
  lands at +X, which is the game's `LegRight`.

**Play the clips from the enemy's script.** Find the `AnimationPlayer` under
the instance (search the children; the .glb buries it). Set `idle` to
loop and play it at `_ready`. Play an action clip where the act happens,
with `speed_scale` set so it fills the act's time (the Locust stretches
`bite` over `bite_interval`), and go back to `idle` on `animation_finished`.
Guard every call, because a model with no player has to keep working.

**A boss posed by pivots** (plain Node3D pivots the script turns: Body,
LegLeft, Head, Jaw ...) keeps those pivots and adds a `PivotBoneBridge`
(`scripts/pivot_bone_bridge.gd`) on the Skeleton3D, as
`scripts/tyrant_model.gd` does. Map each bone name prefix to a pivot in
`pivot_for_bone`, sides swapped as above, and put each pivot at its bone's
head mapped the same way. The bridge lays each pivot's turn on top of the
playing clip, so moves with no clip (the Tyrant's charge, pounce, stamps)
still pose the mesh.

**Import headless.** Godot 4.7 `--headless --import` gives up on every
scene import when it meets a .blend (no Blender path in headless mode), so
no `.glb.import` gets written. `override.cfg` does not help. Move the
.blend files aside for the import, then put them back:

```bash
cd godot-sandbox
find . -name "*.blend" -not -path "./.godot/*" > /tmp/blends; tar cf /tmp/blends.tar -T /tmp/blends
xargs -d '\n' rm -f < /tmp/blends; godot --headless --import; tar xf /tmp/blends.tar
git status --short | grep blend    # must print nothing
```

**Check it.** Run the enemy's own harnesses (`tools/feature_test_<name>*`)
and any harness that counts its meshes (the boss visuals harness counted
`MeshInstance3D` boxes and had to learn the skinned mesh). Render it in game
with a `tools/shot_<name>.gd` (`shot_tyrant_skinned.gd`, `shot_locust.gd`).

## Traps already hit

- `bmesh.ops.extrude_face_region` keeps the old face: `C.run` deletes it.
  Without that the caps stay inside and a later `face_where` picks a buried
  face (both legs once grew from one hip).
- Face normals go stale after moving verts: `bm.normal_update()` before
  selecting faces by normal.
- A ray from below forward of the chin finds the nose: start the belly
  behind the chin.
- Never copy a feature, a colour pair or a pattern from zack's own models;
  copy HOW he builds.
- A glossy material mirrors the grey sky as grey patches: `Painter.save` is
  matte (roughness 1, no specular). Keep it.
- connect() once built pillars from the skull down to the lower teeth across
  the open mouth ("gray boxes on the front"): an accent seats on its own part
  only, and a gap over 4x its radius is a misplaced accent, not a socket.
- A brow knife on "head" faces caught the jaw's top inside the mouth and
  lifted it up through the skull: `C.on(region, f)` takes part-0 faces only.
- Adding a bmesh layer drops every BMVert handle you hold: add layers first.
