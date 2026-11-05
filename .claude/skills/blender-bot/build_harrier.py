"""The Harrier (Planet Dirt, Deep Hold and Convoy): the pad raider, a flyer that
goes straight for the HQ. One-shot from SKILL.md on bb_lib. The game's model was
a stand-in (scenes/models/harrier_body.tscn: the Wasp's boxes at 1.4x), read
for the parts and their sizes: a thorax, a big head with compound eyes,
mandibles and antennae, a thin waist into a banded gaster ending in a sting,
two pairs of wings off the thorax and six legs hanging under it.

  1. block out from one Cube (the thorax): the head out of its front face,
     knifed across at the mouth into the head capsule and the mandible plate;
     the petiole and the gaster out of its back face, the gaster grown in
     overlapping plates (each plate a long ring then a short shrinking one);
     both wing pairs and all six legs extruded out of knifed patches of the
     thorax's corners, so they are one mass with it;
  2. knife: a scutum keel down the thorax's back, a brow plate over each eye;
  3. clay; personality: the right antenna snapped short and a gash across the
     left of the gaster; accents: compound eyes, antennae, mandibles, the
     sting, a claw on each foot; connect.
Paint from the exoskeleton: the gaster's tergite bands, the thorax's sutures
and scutum, the head's face plate and eye rims, leg joints, wing veins,
balanced front, side and back.

PALETTE IS PROVISIONAL: five swatches chosen in the spirit of zack's (vivid,
one scheme colour leading), not taken from any of his models.

A swarm-sized enemy (4 to 9 a wave), so a 512 texture and a few bones a limb.
Bones: Body, Head, Jaw, Abdomen chain, four wings of two bones each, and
Leg/Shin/Foot per leg. Actions: fly (the hover loop it plays always) and
sting (its attack on the pad).

usage: python build_harrier.py -- <out dir> [seed]

Then the paint passes and the game's GLB, as shipped (Honeycomb is Crafting
Conundrums printed p.154, PDF page 177, read with bead_read_page.py; pitch
0.47 = 28 long / 60 on 512; colours ids 0-4 to plum, lime, magenta, gold, teal):
  bead_project.py   -- harrier.blend Cube harrier.png beads.png 0.47 2b1238,b8f02a,e8336d,ffcf3a,3fb3a8 honeycomb.json --top
  skeleton_frame.py -- harrier.blend Cube harrier.png beads.png framed.png 2b1238 2b1238 b8f02a 0.12 0.6
  mouth_paint.py    -- harrier.blend Cube framed.png mouth.png e8336d ffcf3a 2b1238 2b1238 0.4 <bead colours> honeycomb.json 0.47
  sketch_marks.py   -- harrier.blend Cube mouth.png sketched.png
  uv_blackout.py    -- harrier.blend Cube sketched.png final.png
  export_harrier.py -- harrier.blend final.png godot-sandbox/resources/models/characters/harrier/harrier.glb
"""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bb_lib import Creature, Painter, Rig, ease
from mathutils import Vector
import bmesh
import numpy as np

args = sys.argv[sys.argv.index('--') + 1:]
OUT = args[0]
SEED = int(args[1]) if len(args) > 1 else 7
C = Creature(SEED)
J, R = C.J, C.R
JAW = 1

# ---------- 1. block out ----------
BODY0 = Vector((0, 0, 10))
C.start_cube((6.0, 6.0, 5.6), BODY0, round_long=1.2)
bm = C.bm


def patch_pair(pick, y0, y1, x_cut=0.4):
    """a mirror pair of patches on the thorax's corner bevels, between y0 and y1,
    each dissolved to one face (an extrusion root, like leg_patches)"""
    bm.normal_update()
    faces = [f for f in bm.faces if all(v[C.REG] == 0 and v[C.LIMB] == 0 for v in f.verts) and pick(f)
             and min(v.co.y for v in f.verts) < y1 and max(v.co.y for v in f.verts) > y0]
    pats = C.knife_pair(faces, [((0, y1, 0), (0, 1, 0)), ((0, y0, 0), (0, -1, 0))], x_cut)
    for side in (-1, 1):
        fs = pats[side]
        pats[side] = fs[0] if len(fs) == 1 else bmesh.ops.dissolve_faces(bm, faces=fs)['region'][0]
    bm.normal_update()
    return pats


front = C.run(C.face_where((0, -1, 0)), [
    ((0, -1, 0.05), 0.7, 0.68, 0.72),    # neck, a short stalk
], name='neck', region='head')
nc = front.calc_center_median()
hh = max(v.co.z for v in front.verts) - min(v.co.z for v in front.verts)
MOUTH_Z = nc.z - hh * 0.2
low, up = C.split_face(front, (0, 0, MOUTH_Z))
JAW_PIVOT = Vector((0, nc.y, MOUTH_Z))
C.run(up, [
    ((0, -1, 0.08), 0.6, 1.45, 1.6),    # head capsule swells round the eyes
    ((0, -1, 0.0), 3.0, 1.04, 1.02),
    ((0, -1, -0.3), 1.3, 0.78, 0.8),    # the face slopes down to the clypeus
], name='head', region='head', keep=(MOUTH_Z, 1, 2))
C.run(low, [
    ((0, -1, -0.15), 0.6, 1.35, 1.4),  # mandible plate under the face
    ((0, -1, -0.2), 2.0, 0.9, 0.85),
    ((0, -1, -0.1), 0.9, 0.7, 0.7),
], name='jaw', region='head', part=JAW, keep=(MOUTH_Z, -1, 2))

abd = C.run(C.face_where((0, 1, 0)), [
    ((0, 1, -0.1), 0.7, 0.42, 0.42),    # the petiole, the wasp waist
    ((0, 1, -0.15), 1.0, 1.0, 1.0),
    ((0, 1, -0.05), 0.8, 2.5, 2.55),    # gaster opens
    ((0, 1, -0.05), 2.0, 1.1, 1.1),   # plate 1
    ((0, 1, -0.08), 0.35, 0.93, 0.93),
    ((0, 1, -0.1), 1.9, 1.03, 1.03),    # plate 2
    ((0, 1, -0.12), 0.35, 0.9, 0.9),
    ((0, 1, -0.15), 1.8, 0.95, 0.95),   # plate 3
    ((0, 1, -0.2), 0.35, 0.86, 0.86),
    ((0, 1, -0.3), 1.3, 0.7, 0.72),     # plate 4, tapering
    ((0, 1, -0.4), 1.0, 0.45, 0.45),
], name='abdomen', region='abdomen')
TIP = abd.calc_center_median() + Vector((0, 0.7, -0.35))
C.end_point(abd, TIP)

# wings: two pairs out of the thorax's upper corner bevels, flattened into blades
up_corner = lambda side: (lambda f: f.normal.z > 0.35 and abs(f.normal.x) > 0.35)
WINGS = {}
for key, y0, y1, steps in (
        ('wing_f', -2.6, -0.5, [
            ((1, 0.1, 0.45), 0.8, 1.0, 1.0, (1, 1.7, 0.2)),   # root, flattened to a blade
            ((1, 0.15, 0.2), 3.2, 1.45, 1.0),                  # the broad inner wing
            ((1, 0.3, 0.08), 3.4, 1.0, 1.0),
            ((1, 0.45, 0.05), 2.8, 0.75, 1.0),
            ((1, 0.55, 0.0), 1.6, 0.4, 1.0),                   # tip
        ]),
        ('wing_b', 0.6, 2.4, [
            ((1, 0.3, 0.1), 0.7, 1.0, 1.0, (1, 1.6, 0.2)),
            ((1, 0.75, -0.2), 2.6, 1.3, 1.0),
            ((1, 0.85, -0.25), 2.4, 0.8, 1.0),
            ((1, 1.0, -0.25), 1.3, 0.4, 1.0),
        ])):
    pats = patch_pair(lambda f: f.normal.z > 0.35 and abs(f.normal.x) > 0.35, y0, y1)
    for side in (-1, 1):
        k = f"{key}{'l' if side < 0 else 'r'}"
        st = [((d[0] * side, d[1], d[2]),) + tuple(s[1:]) for s in steps for d in (s[0],)]
        tip = C.run(pats[side], st, name=k, region='wing')
        C.end_point(tip, tip.calc_center_median() + Vector((side * 0.6, 0.4, 0)))
        WINGS[k] = side

# six legs out of the lower corner bevels, hanging and trailing back as it flies
LEGS = {}
for k, (y0, y1) in enumerate(((-2.6, -1.2), (-0.7, 0.7), (1.2, 2.6))):
    pats = patch_pair(lambda f: f.normal.z < -0.35 and abs(f.normal.x) > 0.35, y0, y1)
    fwd = (-0.5, 0.0, 0.45)[k]
    for side in (-1, 1):
        key = f"leg{k}_{'l' if side < 0 else 'r'}"
        C.run(pats[side], [
            (tuple(pats[side].normal), 0.4, 1.0, 1.0, (1.1, 1.0, 1.0)),   # coxa, along the patch, no turn
            ((side, fwd, -0.45), 2.2, 0.72, 1.0),                         # femur out
            ((side * 0.3, fwd * 0.4 + 0.55, -1), 3.0, 0.8, 1.0),          # tibia down and back
            ((side * 0.1, 0.9, -0.55), 1.8, 0.7, 1.0),                    # tarsus trailing
        ], name=key, region='leg')
        LEGS[key] = side

REF = {'head_len': 0.20, 'head_depth': 0.19, 'body_depth': 0.22}   # off the stand-in's boxes: head 5.5, depth 6.5, thorax 8, length 28
OFF = C.proportions(REF)
if os.environ.get('BLOCKOUT_ONLY'):
    C.to_object(); import bpy; bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "harrier_blockout.blend")); sys.exit(0)

# ---------- 2. knife and extrude ----------
keel = [f for f in bm.faces if C.on('body', f) and f.normal.z > 0.8]
keel = C.knife(keel, [((0.9, 0, 0), (1, 0, 0)), ((-0.9, 0, 0), (-1, 0, 0)), ((0, 2.4, 0), (0, 1, 0)), ((0, -2.8, 0), (0, -1, 0))])
if keel: C.pull(keel, (0, 0, 1), 0.45, shrink=0.9)            # the scutum
hd = J['head']
hw = max(p.x for p in R['head'][1])
top = [f for f in bm.faces if C.on('head', f) and f.normal.z > 0.4 and hd[1].y - 1.0 < f.calc_center_median().y < hd[0].y + 0.2]
brows = C.knife_pair(top, [((0, hd[1].y - 0.7, 0), (0, -1, 0)), ((0, hd[0].y - 0.1, 0), (0, 1, 0))], hw * 0.4)
for side in (-1, 1):
    if brows[side]: C.pull(brows[side], (side * 0.35, -0.1, 1), 0.4, shrink=0.85)

assert C.mirror_error() < 1e-3, "the skeleton must be mirror-true before the clay"
C.clay(jitter=0.04, lumps=5, box=((-3, 3), (-8, 12), (6, 13)), lump_r=(1.0, 2.2), lump_amt=(-0.15, 0.2))

# ---------- personality ----------
g = J['abdomen'][5]
C.scar(g + Vector((-10, 0, 0.6)), (1, 0, 0), (0, 1, -0.5), 2.4)   # a gash across the left of the gaster
SNAPPED = 1                                                       # the right antenna snapped short

# ---------- accents ----------
for side in (-1, 1):
    p = C.skin((side * 9, (hd[0].y + hd[1].y) / 2 - 0.3, hd[1].z + 0.1), (-side, 0, 0))
    if p is not None: C.ball(p - Vector((side * 0.65, 0, 0)), 1.35, 'eyes')   # big compound eyes, sunk half
    p = C.skin((side * 0.8, hd[1].y - 0.4, 30), (0, 0, -1))               # antennae out of the brow
    if p is not None:
        ln = 2.0 if side == SNAPPED else 4.6
        C.cone(p - Vector((0, 0, 0.1)), (side * 0.3, -0.8, 0.7), 0.3, ln, 'antennae')
    j = J['jaw'][-1]
    C.cone(j + Vector((side * 0.55, 0.3, 0.0)), (-side * 0.5, -1, -0.15), 0.35, 1.6, 'mandibles', part=JAW)
d = Vector((0, 0.8, -0.6)).normalized()
C.cone(TIP - d * 0.2, d, 0.45, 2.6, 'sting')
for key, side in LEGS.items():
    t = J[key][-1]
    dd = Vector((side * 0.1, 0.6, -1)).normalized()
    p = C.skin(t + Vector((0, 0, -6)), (0, 0, 1))
    hw_ = min((q - t).length for q in R[key][-1])
    if p is not None: C.cone(p - dd * 0.12, dd, min(0.25, hw_ * 0.6), 0.8, 'claws')
C.connect()
ob, me = C.to_object()

# ---------- paint (PROVISIONAL palette, vivid, after zack's feel) ----------
TEAL, MAGENTA, PLUM, LIME, GOLD = "#0f7a8a", "#e8336d", "#2b1238", "#b8f02a", "#ffcf3a"
BASE, BACK, BAND, INK, EYE, WING, WINGV, BELLY = TEAL, "#0a4f63", MAGENTA, PLUM, LIME, GOLD, PLUM, "#3fb3a8"
P = Painter(C, BASE, size=512)
V = P.V; PZ = P.PZ; PY = P.PY
P.broad(min(V[:, 1]), max(V[:, 1]), BACK, 'above', r=1.0, step=0.4)
P.broad(J['jaw'][-1].y + 0.3, TIP.y, BELLY, 'below', r=1.0, step=0.4)
BODY = P.region('body'); HEAD = P.region('head'); ABD = P.region('abdomen'); LEG = P.region('leg'); WNG = P.region('wing')
# the wings are membranes: gold, with plum veins from root to tip
P.img[WNG & P.mask] = P.col(WING)
for k, side in WINGS.items():
    js = J[k]
    for off in (-1.0, 0.0, 1.0):
        line = [p + Vector((0, off * (0.6 + 0.25 * i), 0)) for i, p in enumerate(js)]
        P.top_line([(p.x, p.y) for p in line], 0.16, WINGV, WNG)
    for p in js[1:-1]:                                    # a cross vein at each wing joint
        P.top_line([(p.x, p.y - 1.4), (p.x, p.y + 1.6)], 0.12, WINGV, WNG)
    P.top_line([(p.x, p.y - 0.9) for p in js], 0.26, INK, WNG)   # the thick leading edge
# the gaster's tergites: a magenta band on each plate, an ink rim where the plates overlap
A = J['abdomen']
for i in (3, 5, 7, 9):
    y0, y1 = A[i - 1].y + 0.1, A[i].y - 0.25
    sel = ABD & (PY > y0) & (PY < y1)
    P.img[sel & P.mask] = P.col(BAND)
for i in (4, 6, 8):
    sel = ABD & (np.abs(PY - A[i].y) < 0.3)
    P.img[sel & P.mask] = P.col(INK)
P.img[ABD & (PY < A[1].y + 0.3) & P.mask] = P.col(INK)            # the petiole, dark
# the thorax: the scutum outlined, the sutures between the segments, a collar
P.top_line([(-1.0, -2.8), (-1.0, 2.4), (1.0, 2.4), (1.0, -2.8), (-1.0, -2.8)], 0.2, INK, BODY)
P.top_line([(-0.9, 0.0), (0.9, 0.0)], 0.18, BAND, BODY)
for side in (-1, 1):
    for y in (-1.0, 0.95):                                 # pro / meso / meta sutures down the flank
        P.side_line([(y, BODY0.z + 2.4), (y + 0.3, BODY0.z), (y, BODY0.z - 2.2)], 0.2, INK, BODY, side)
    P.side_oval(-2.6, BODY0.z + 1.6, 0.9, 0.5, BAND, BODY, side)   # the shoulder plate
    eye = next((e for e in C.ACC.get('eyes', []) if e.x * side > 0), None)
    if eye is not None:
        P.side_oval(eye.y, eye.z, 1.75, 1.75, INK, HEAD, side)       # eye rim
        P.side_line([(eye.y - 1.6, eye.z - 0.6), (hd[-1].y + 0.2, MOUTH_Z + 0.3)], 0.18, INK, HEAD, side)   # cheek suture
    P.side_line([(p.y, p.z + 0.35) for p in J['jaw']], 0.15, INK, HEAD & (PZ < MOUTH_Z + 0.5), side)
    for i in (3, 5, 7):                                    # a spiracle on each plate's flank
        y = (A[i - 1].y + A[i].y) / 2
        P.side_oval(y, A[i].z - 0.3, 0.35, 0.35, INK, ABD, side)
# head from the front: the face plate, a gold blaze, the brows
P.view_line([Vector((-1.6, 0, hd[1].z + 1.0)), Vector((0, 0, hd[-1].z - 0.4)), Vector((1.6, 0, hd[1].z + 1.0))], 0.24, INK, HEAD, 'front')
P.view_line([Vector((0, 0, hd[1].z + 1.4)), Vector((0, 0, hd[-1].z))], 0.3, GOLD, HEAD, 'front')
P.view_line([Vector((-1.8, 0, BODY0.z + 1.0)), Vector((0, 0, BODY0.z - 0.4)), Vector((1.8, 0, BODY0.z + 1.0))], 0.22, BAND, BODY, 'front')
# from behind: the last plates' rims and a gold sting socket
P.view_line([Vector((-1.4, 0, A[8].z + 0.6)), Vector((0, 0, A[8].z - 0.4)), Vector((1.4, 0, A[8].z + 0.6))], 0.22, INK, ABD, 'back')
P.view_line([Vector((-2.4, 0, BODY0.z + 1.6)), Vector((2.4, 0, BODY0.z + 1.6))], 0.22, INK, BODY, 'back')
P.spine_bars([hd[-1], hd[0], BODY0 + Vector((0, -2.5, 0)), BODY0 + Vector((0, 2.5, 0))], INK, HEAD, every=1.0, width=0.6)
# legs: a ring at every joint and the long bones in magenta
for key, side in LEGS.items():
    L = J[key]
    for p in L[1:-1]: P.dab(p, 0.55, INK)
    P.side_line([(L[1].y, L[1].z), (L[2].y, L[2].z)], 0.22, BAND, LEG, side)
    for view in ('front', 'back'):
        P.view_line([L[1], L[2], L[3]], 0.2, BAND, LEG, view)
P.accents({'eyes': EYE, 'antennae': INK, 'mandibles': GOLD, 'sting': GOLD, 'claws': INK})
for e in C.ACC['eyes']:
    for dy, dz in ((-0.5, 0.4), (0.3, -0.3), (0.6, 0.6)):          # facets catching the light
        P.dab(e + Vector((math.copysign(1.2, e.x), dy, dz)), 0.18, GOLD)
P.paint_scars(INK, GOLD)
P.save(OUT, "harrier")

# ---------- rig ----------
G = Rig(C)
G.bone("Body", BODY0 + Vector((0, 2.6, 0)), BODY0 + Vector((0, -2.6, 0)))
G.bone("Head", J['neck'][0], J['head'][-1], "Body")
G.bone("Jaw", JAW_PIVOT, J['jaw'][-1], "Head")
G.chain("Abdomen", [BODY0 + Vector((0, 3.0, 0))] + A[1:][::2] + [TIP], "Body", limb='abdomen')
ABD_BONES = sum(1 for b in G.arm.edit_bones if b.name.startswith("Abdomen"))
for k, side in WINGS.items():
    js = J[k]; nm = ("WingFront" if k.startswith('wing_f') else "WingBack") + ("Left" if side < 0 else "Right")
    mid = len(js) // 2
    G.bone(nm, js[1] - (js[1] - js[0]) * 0.3, js[mid], "Body", limb=k, hinge=True)   # hinged out past the root stalk, root ring on the thorax
    G.bone(nm + "Tip", js[mid], js[-1] + Vector((side * 0.6, 0.4, 0)), nm, limb=k)
for key, side in LEGS.items():
    L = J[key]; nm = key.replace('leg', 'Leg').replace('_l', 'Left').replace('_r', 'Right')
    G.bone(nm, L[0], L[1], "Body", limb=key)
    G.bone(nm.replace('Leg', 'Shin'), L[1], L[2], nm, limb=key)
    G.bone(nm.replace('Leg', 'Foot'), L[2], L[3], nm.replace('Leg', 'Shin'), limb=key)
G.skin(part_bones={JAW: "Jaw"})

FLAP = 26      # degrees each way of a wingbeat, about LIFT
LIFT = 14      # a wasp beats mostly above the level: down to -12, up to +40


def wing_rot(n, ang):
    """a wing bone runs out along +-X: its local X is fore and aft, so a turn
    about it beats the wing up (+, on both sides, checked in pose renders) and
    down. A turn about local Z swept the wings into the gaster instead."""
    return (ang, 0, 0)


def fly(n, ph):
    """the hover loop: four wingbeats, the body bobbing once, the gaster pumping
    and the legs trailing loose"""
    w = ph * 2 * math.pi
    beat = math.sin(w * 4)
    if n == "Body": return (2 * math.sin(w), 0, 0), (0, 0, 0.5 * math.sin(w))
    if n.startswith("Wing"):
        tip = n.endswith("Tip")
        lag = 0.5 if tip else 0.0
        a = FLAP * math.sin(w * 4 - lag) * (0.45 if tip else 1.0) + (LIFT if not tip else 0)
        if "Back" in n: a = FLAP * 0.9 * math.sin(w * 4 - lag - 0.6) * (0.45 if tip else 1.0) + (LIFT if not tip else 0)
        return wing_rot(n, a), (0, 0, 0)
    if n.startswith("Abdomen"):
        k = 0 if n == "Abdomen" else int(n.split('.')[1])
        return (3 * math.sin(w * 2 - k * 0.5) / ABD_BONES * 2, 0, 1.5 * math.sin(w - k * 0.4)), (0, 0, 0)
    if n.startswith(("Leg", "Shin", "Foot")):
        k = int(next(ch for ch in n if ch.isdigit()))
        s = math.sin(w + k * 0.9 + (0 if n.endswith("Left") else 0.5))
        return ((-6 if n.startswith("Shin") else 4) * s, 0, 0), (0, 0, 0)
    if n == "Head": return (2 * math.sin(w * 2 + 0.5), 0, 2 * math.sin(w)), (0, 0, 0)
    if n == "Jaw": return (3 + 3 * math.sin(w * 4), 0, 0), (0, 0, 0)
    return (0, 0, 0), (0, 0, 0)


def sting(n, ph):
    """it rears the gaster back, then drives the sting forward and down under
    its own body at the pad, and settles back to the hover"""
    settle = 1 - ease(max(0, (ph - 0.65) / 0.35))
    wind = ease(min(1, ph / 0.35)) * settle
    stab = ease(min(1, max(0, (ph - 0.35) / 0.15))) * settle
    w = ph * 2 * math.pi
    if n == "Body": return (-8 * wind * (1 - stab) + 14 * stab, 0, 0), (0, 0, 0.8 * wind * (1 - stab) - 0.6 * stab)
    if n.startswith("Abdomen"):
        return ((-24 * wind * (1 - stab) + 75 * stab) / ABD_BONES, 0, 0), (0, 0, 0)
    if n.startswith("Wing"):
        tip = n.endswith("Tip")
        a = FLAP * math.sin(w * 6 - (0.5 if tip else 0)) * (0.45 if tip else 1.0) + (LIFT if not tip else 0)
        return wing_rot(n, a), (0, 0, 0)
    if n == "Head": return (-6 * stab, 0, 0), (0, 0, 0)          # the head lifts clear as the body tips
    if n == "Jaw": return (6 + 18 * wind, 0, 0), (0, 0, 0)
    if n.startswith("Shin"): return (-14 * stab, 0, 0), (0, 0, 0)
    if n.startswith("Leg"): return ((0 if n.startswith("Leg0") else -10) * stab, 0, 0), (0, 0, 0)   # the front pair stays off the throat
    return (0, 0, 0), (0, 0, 0)


G.act("fly", 32, fly)
G.act("sting", 36, sting)
if not os.environ.get('NO_FIX'):
    G.fix_joints()
G.save(OUT, "harrier")
