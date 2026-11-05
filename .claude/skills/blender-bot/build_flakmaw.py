"""The Flakmaw (Planet Dirt, Meridian: Sirens, Convoy, Last Train Out), built in
one pass from the blender-bot skill. It is ground anti-air: a low six-legged
armoured walker whose only weapon is a maw on its back that points straight
up and spits flak at the player's fighters (scripts/flakmaw.gd). It never
shoots the mech, so it reads as a pack animal with a cannon throat, not a
predator: a broad shell, a low blunt head with tusks, stubby crab legs, and
the dorsal maw as the thing the eye goes to.

The reference is the blockout it replaces (scenes/models/flakmaw_body.tscn,
measured): a shell 21 wide, 28 long and 9 deep over a 16 x 22 hull, a low head
11 x 6.5 x 8 out front with two tusks, six stubby legs at the hull's sides, a
glowing vent at the rear, and four lip plates round a glowing core on top,
reaching 21 to 23 units up. The game's front is +Z, which is this model's -Y.

  1. block out from one Cube: the shell, the head knifed at the mouth into a
     skull and a mandible plate, the rear tapering to a vent, a light belly
     sag, six legs out of the shell's sides (each side knifed into three);
  2. knife: the maw knifed out of the back and extruded up, its cap inset into
     a rim and a throat, the rim's four faces pulled out into the lips (each
     its own part, so it opens on its own bone); brows; the shell's two
     edge ridges;
  3. clay; personality: a snapped left tusk, a scar raked across the right of
     the shell, the left hind leg a little longer (it limps);
  4. accents: tusks, eyes, back spines, foot claws; connect.

Paint from the exoskeleton: a plate bar across the back at every segment, the
side seam, leg joint rings, the throat's cartilage rings (a windpipe), head
sutures. Palette: chosen here, zack asked for one "kinda colorful", in the
feel of his own without his colours. PROVISIONAL until zack picks.

usage: python build_flakmaw.py -- <out dir> [seed]
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
LIPS = {'front': 2, 'back': 3, 'left': 4, 'right': 5}

# ---------- 1. block out ----------
BODY0 = Vector((0, 0, 7.1))
C.start_cube((17.0, 18.0, 9.0), BODY0, round_long=2.2)
front = C.run(C.face_where((0, -1, 0)), [
    ((0, -1, -0.2), 1.4, 0.78, 0.86),    # short thick neck, dipping
], name='neck', region='head')
nc = front.calc_center_median()
hh = max(v.co.z for v in front.verts) - min(v.co.z for v in front.verts)
MOUTH_Z = nc.z - hh * 0.2
low, up = C.split_face(front, (0, 0, MOUTH_Z))
JAW_PIVOT = Vector((0, nc.y, MOUTH_Z))
C.run(up, [
    ((0, -1, 0.1), 0.8, 1.12, 1.25),     # skull swells over the jaw hinge
    ((0, -1, -0.05), 4.6, 0.98, 0.92),   # the low broad skull
    ((0, -1, -0.2), 1.8, 0.8, 0.78),     # blunt snout
], name='head', region='head', keep=(MOUTH_Z, 1, 2))
C.run(low, [
    ((0, -1, -0.1), 0.8, 1.12, 1.15),    # mandible plate under the skull
    ((0, -1, -0.03), 3.2, 0.98, 0.9),
    ((0, -1, 0.0), 1.6, 0.82, 0.8),
], name='jaw', region='head', part=JAW, keep=(MOUTH_Z, -1, 2))

rear = C.run(C.face_where((0, 1, 0)), [
    ((0, 1, 0.05), 2.6, 0.94, 0.96),     # the shell carries on back
    ((0, 1, 0.0), 2.6, 0.82, 0.86),
    ((0, 1, 0.15), 1.8, 0.62, 0.66),     # tapering to the vent
], name='rear', region='rear')
VENT = rear.calc_center_median()

C.gut(1.6, BODY0, half=5.0, front=6.0, back=7.0, below=-1.0, fade=2.5, swell=0.06)

# six stubby legs out of the shell's sides: each side face knifed into three
LEGS = {}
for side in (-1, 1):
    f = C.face_where((side, 0, 0), lambda f: -abs(f.calc_center_median().y) * 0.1)
    a, rest = C.split_face(f, (0, -3.0, 0), (0, 1, 0))
    b, c = C.split_face(rest, (0, 3.0, 0), (0, 1, 0))
    for k, face in zip((0, 1, 2), (a, b, c)):      # front, middle, hind
        fwd = (-0.45, 0.0, 0.45)[k]
        key = f"leg{k}_{'l' if side < 0 else 'r'}"
        C.run(face, [
            ((side, fwd * 0.3, 0.0), 0.7, 0.92, 1.0),          # hip socket out of the shell
            ((side, fwd * 0.6, 0.1), 2.0, 0.84, 0.95),         # thigh out, under the shell's lip
            ((side, fwd * 0.5, -0.45), 1.9, 0.9, 1.0),         # knee rolling over
            ((side * 0.5, fwd * 0.35, -1), 3.0, 0.9, 1.0),     # shin down
            ((side * 0.2, fwd * 0.2, -1), 2.4, 0.92, 1.0),
            ((side * 0.05, fwd * 0.1, -1), 1.2, 1.05, 1.0),    # foot, splayed a little
        ], name=key, region='leg')
        LEGS[key] = side

# ---------- 2. knife shapes in, extrude them ----------
# THE MAW: a patch of the back knifed out, made one face, grown straight up
top = [f for f in C.bm.faces if C.on('body', f) and f.normal.z > 0.5]
patch = C.knife(top, [((3.4, 0, 0), (1, 0, 0)), ((-3.4, 0, 0), (-1, 0, 0)),
                      ((0, -2.4, 0), (0, -1, 0)), ((0, 4.4, 0), (0, 1, 0))])
maw = patch[0] if len(patch) == 1 else bmesh.ops.dissolve_faces(C.bm, faces=patch)['region'][0]
maw = C.run(maw, [
    ((0, 0, 1), 0.7, 1.12, 1.0),         # a collar where it leaves the shell
    ((0, -0.05, 1), 1.8, 0.84, 1.0),     # the throat rises
    ((0, 0, 1), 1.4, 1.0, 1.0),
    ((0, 0, 1), 1.4, 1.45, 1.0),         # and flares into the bell
    ((0, 0, 1), 0.6, 1.1, 1.0),          # the rim
], name='maw', region='maw')
MAW_TOP = maw.calc_center_median()
# the cap inset into a rim and a throat; the throat pulled down into the bell
ins = bmesh.ops.inset_region(C.bm, faces=[maw], thickness=2.1, depth=0)
rim = ins['faces']
C.bm.normal_update()
THROAT_TOP = maw.calc_center_median()
throat = C.pull([maw], (0, 0, -1), 1.5, shrink=0.7)   # shallow and narrow: deeper, its walls met the bell's as the maw bent
# the rim and the throat ride the maw's last bone, not the body: untagged they
# were skinned to Body and tore off the bell whenever the maw moved
MAW_LIMB = C.limbs['maw']
for f in rim:
    for v in f.verts: v[C.LIMB] = MAW_LIMB; v[C.REG] = C.region_id('maw')
for v in throat: v[C.LIMB] = MAW_LIMB; v[C.REG] = C.region_id('maw')
# the four rim faces pulled out and up into the lips, each its own part
for f in rim:
    c = f.calc_center_median() - THROAT_TOP
    if abs(c.y) > abs(c.x): nm = 'front' if c.y < 0 else 'back'
    else: nm = 'left' if c.x < 0 else 'right'
    out = Vector((c.x, c.y, 0)).normalized()
    nv = C.pull([f], out * 1.1 + Vector((0, 0, 1)), 2.4, shrink=0.95)
    for v in nv: v[C.PART] = LIPS[nm]; v[C.REG] = C.region_id('maw'); v[C.LIMB] = MAW_LIMB
# brows over the eyes, both sides cut together
hd = J['head']
hw = max(p.x for p in R['head'][1])
brow_y = hd[1].y - 0.4
topf = [f for f in C.bm.faces if C.on('head', f) and f.normal.z > 0.4 and hd[0].y > f.calc_center_median().y > hd[2].y]
brows = C.knife_pair(topf, [((0, brow_y - 1.2, 0), (0, -1, 0)), ((0, brow_y + 0.9, 0), (0, 1, 0))], hw * 0.32)
for side in (-1, 1):
    if brows[side]: C.pull(brows[side], (side * 0.3, -0.1, 1), 0.5, shrink=0.85)
# the shell's two edge ridges, where the back plates meet the flanks
edge = [f for f in C.bm.faces if C.on('body', f) and 0.35 < f.normal.z < 0.9]
ridges = C.knife_pair(edge, [((0, 7.5, 0), (0, 1, 0)), ((0, -7.5, 0), (0, -1, 0))], 5.0)
for side in (-1, 1):
    if ridges[side]: C.pull(ridges[side], (side * 0.5, 0, 1), 0.45, shrink=0.94)

# the blockout, measured, each against the whole length nose to vent
REF = {'head_len': 0.24, 'head_depth': 0.19, 'height': 0.62}
OFF = C.proportions(REF)
if os.environ.get('BLOCKOUT_ONLY'):
    print("FEET z", [round(J[k][-1].z, 2) for k in LEGS], "LEN", round(max(v.co.y for v in C.bm.verts) - min(v.co.y for v in C.bm.verts), 1), "MAW", MAW_TOP)
    ob, me = C.to_object()
    import bpy; bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "blockout.blend")); sys.exit(0)

bmesh.ops.dissolve_degenerate(C.bm, dist=0.02, edges=list(C.bm.edges))   # knife crumbs (a sliver where the maw's cut met the shell's corner)
assert C.mirror_error() < 1e-3, "the skeleton must be mirror-true before the clay"
C.clay(jitter=0.05, lumps=6, box=((-8, 8), (-12, 14), (4, 13)), lump_r=(2.0, 3.5), lump_amt=(-0.25, 0.3))

# ---------- personality: on purpose, once or twice ----------
C.lengthen('leg2_l', 1.1)                     # the left hind leg a little long: it limps
sh = J['rear'][0]                             # an old gash raked across the right of the shell
C.scar(Vector((20, sh.y - 6.0, BODY0.z + 3.6)), (-1, 0, 0), (0, 1, 0.3), 3.6)   # high on the flank, clear of the hind hip
BROKEN = -1                                   # and the left tusk snapped short
bmesh.ops.dissolve_degenerate(C.bm, dist=0.02, edges=list(C.bm.edges))   # the scar's knife left a crumb where it met the maw's cut
from mathutils.bvhtree import BVHTree; C._bvh = BVHTree.FromBMesh(C.bm)

# ---------- 4. accents, seated with C.skin ----------
jw = J['jaw']
jaw_w = max(p.x for p in R['jaw'][-1])
jaw_h = max(p.z for p in R['jaw'][-1]) - min(p.z for p in R['jaw'][-1])
for side in (-1, 1):                          # tusks out of the mandible plate's front corners
    p = C.skin((side * jaw_w * 0.55, jw[-1].y - 8, jw[-1].z + 0.2), (0, 1, 0))
    if p is not None:
        d = Vector((side * 0.35, -1, 0.55)).normalized()
        C.cone(p - d * 1.0, d, min(1.05, jaw_h * 0.32), 2.8 if side == BROKEN else 5.8, 'tusks', sides=5, part=JAW)
eye_y = (hd[1].y + hd[2].y) / 2
for side in (-1, 1):                          # eyes in the skull's sides, under the brow
    p = C.skin((side * 12, eye_y, hd[1].z + 0.6), (-side, 0, 0))
    if p is not None: C.ball(p - Vector((side * 0.45, 0, 0)), 0.9, 'eyes')
for side in (-1, 1):                          # spines along the shell's ridges, three a side
    for k, y in enumerate((-5.0, 0.0, 5.0)):
        o = Vector((side * 5.6, y, BODY0.z + 7.5))   # under the lips, onto the shell
        p = C.skin(o, (0, 0, -1))
        if p is not None:
            d = Vector((side * 0.45, 0.25, 1)).normalized()
            C.cone(p - d * 0.8, d, 0.85, 3.0 + 0.6 * (k == 1), 'spines', sides=4)
for y in (J['rear'][0].y + 0.5, J['rear'][1].y):   # two more down the rear plate
    p = C.skin((0, y, BODY0.z + 7.5), (0, 0, -1))
    if p is not None:
        d = Vector((0, 0.5, 1)).normalized()
        C.cone(p - d * 0.7, d, 0.75, 2.6, 'spines', sides=4)
for key, side in LEGS.items():                # two claws on the front of each foot
    t = J[key][-1]
    hw = min((q - t).length for q in R[key][-1])
    for k in (-1, 1):
        d = Vector((k * 0.25 + side * 0.15, -1, -0.12)).normalized()
        p = C.skin(t + Vector((k * hw * 0.4, 0, hw * 0.45)), (0, -1, 0))   # from inside the foot out through its front
        if p is not None: C.cone(p - d * 0.6, d, min(0.36, hw * 0.25), 1.6, 'claws')
C.connect()
ob, me = C.to_object()

# ---------- paint: pass 1, the sprayed base and the exoskeleton's marks ----------
# PROVISIONAL palette (zack, 2026-11-04: "choose a pallete similar to the one i
# have, ya know kinda colorful"); chosen here, none of it from his models
VIOLET, INDIGO, TEAL, GOLD, EMBER = "#9b2fae", "#2a0f4a", "#14c7b5", "#ffd93b", "#ff5a1f"
BASE, BACK, MARK, BELLY, BONE, GLOW, INK = VIOLET, INDIGO, TEAL, GOLD, GOLD, EMBER, INDIGO
P = Painter(C, BASE)
V = P.V; PX, PY, PZ = P.PX, P.PY, P.PZ
BODY = P.region('body'); HEAD = P.region('head'); REAR = P.region('rear'); LEG = P.region('leg'); MAW = P.region('maw')
P.broad(min(V[:, 1]), max(V[:, 1]), BACK, 'above', r=1.8, step=0.6)
P.broad(J['jaw'][-1].y + 0.6, J['rear'][-1].y, BELLY, 'below', r=1.8, step=0.6)
P.img[MAW & P.mask] = P.col(BASE)                              # the maw is its own form, not the back
top_z = lambda y: P.top_z(y, BODY0.z + 4)
# back plates: a bar across the shell at every segment, head to vent
P.spine_bars([J['head'][-1], J['head'][0], BODY0 + Vector((0, -8, 0)), BODY0 + Vector((0, 8, 0))] + J['rear'],
             MARK, BODY | HEAD | REAR, every=1.6, width=3.4)
for side in (-1, 1):
    # the side seam where the shell meets the hull, nose to vent
    path = [(J['head'][1].y, J['head'][1].z - 0.4), (J['neck'][0].y, BODY0.z - 0.8), (BODY0.y, BODY0.z - 1.2)] + \
           [(p.y, p.z - 0.6) for p in J['rear']]
    P.side_line(path, 0.32, MARK, BODY | HEAD | REAR, side)
    # a plate edge dropping from each back plate to the seam
    for k in range(6):
        y = -8 + 16 * (k + 0.5) / 6
        tz = top_z(y)
        P.side_line([(y, tz - 0.5), (y + 0.4, BODY0.z - 1.0)], 0.22, BACK, BODY, side)
    # head: an eye ring, the cheek suture, the mandible plate's edge
    eye = next((e for e in C.ACC.get('eyes', []) if e.x * side > 0), None)
    if eye is not None:
        P.side_oval(eye.y, eye.z, 1.1, 1.0, INK, HEAD, side)
        P.side_line([(eye.y + 1.0, eye.z - 0.4), (J['head'][0].y + 0.3, J['head'][0].z - 1.2)], 0.24, MARK, HEAD, side)
    P.side_line([(p.y, p.z + 0.5) for p in jw], 0.22, MARK, HEAD & (PZ < jw[0].z + 0.9), side)
    # the throat's cartilage rings: a windpipe, round the maw at each ring
    for p in J['maw'][1:-1]:
        P.side_line([(p.y - 5, p.z), (p.y + 5, p.z)], 0.3, MARK, MAW, side)
for view in ('front', 'back'):
    for p in J['maw'][1:-1]:
        P.view_line([Vector((-5, 0, p.z)), Vector((5, 0, p.z))], 0.3, MARK, MAW, view)
# the throat glows; the lips' tips are gold
P.img[MAW & P.mask & (np.abs(PX) < 2.6) & (np.abs(PY - THROAT_TOP.y) < 2.6) & (PZ < THROAT_TOP.z + 0.2)] = P.col(GLOW)
P.img[MAW & P.mask & (PZ > MAW_TOP.z + 2.0)] = P.col(GOLD)
# the vent at the back glows
P.img[REAR & P.mask & (PY > VENT.y - 0.15)] = P.col(GLOW)
# head from above: the Y suture; the face from the front: a brow plate line
P.top_line([(0, J['head'][-1].y), (0, J['head'][1].y), (-1.2, J['head'][0].y)], 0.22, MARK, HEAD)
P.top_line([(0, J['head'][1].y), (1.2, J['head'][0].y)], 0.22, MARK, HEAD)
hz = J['head'][-1].z
P.view_line([Vector((-3.2, 0, hz + 1.2)), Vector((0, 0, hz + 0.2)), Vector((3.2, 0, hz + 1.2))], 0.26, MARK, HEAD, 'front')
# the vent's rear plates from the back
for k in range(3):
    z = J['rear'][-1].z + 1.6 - k * 0.9
    P.view_line([Vector((-3.5 + k * 0.6, 0, z)), Vector((3.5 - k * 0.6, 0, z))], 0.22, MARK, REAR, 'back')
# legs: a ring at every joint and a line down each limb, side and front/back
for key, side in LEGS.items():
    L = J[key]
    for p in (L[0], L[2], L[4]):
        P.dab(p, 0.8, GOLD)
    P.side_line([(L[2].y, L[2].z), (L[3].y, L[3].z), (L[4].y, L[4].z)], 0.26, MARK, LEG, side)
    for view in ('front', 'back'):
        P.view_line([L[1], L[2], L[3], L[4]], 0.26, MARK, LEG, view)
P.accents({'tusks': BONE, 'eyes': GLOW, 'spines': BONE, 'claws': INK})
for e in C.ACC['eyes']:
    P.dab(e + Vector((math.copysign(0.55, e.x), -0.15, 0)), 0.24, INK)      # pupils
P.paint_scars(INK, GOLD)
P.save(OUT, "flakmaw")
if os.environ.get('NO_RIG'):                  # look at the rest pose before the rig and its fix
    from bb_lib import rest_pokes
    inv = {v: k for k, v in C.acc_codes.items()}; A = me.attributes['acc'].data
    from collections import Counter
    for f in me.polygons:
        if f.area < 1e-4: print("  SLIVER at", tuple(round(x, 2) for x in f.center), len(f.vertices))
    pk = rest_pokes(me)
    print("POKES", Counter(inv[A[me.edges[e].vertices[0]].value] for e in pk))
    for e in pk:
        c = (me.vertices[me.edges[e].vertices[0]].co + me.vertices[me.edges[e].vertices[1]].co) / 2
        print("  POKE at", tuple(round(x, 1) for x in c), inv[A[me.edges[e].vertices[0]].value])
    import bpy; bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "flakmaw.blend")); sys.exit(0)

# ---------- rig: Body, Head, Jaw, the rear, the maw and its four lips, the legs ----------
G = Rig(C)
G.bone("Body", BODY0 + Vector((0, 5, 0)), BODY0 + Vector((0, -5, 0)))
G.bone("Head", J['neck'][0], J['head'][-1], "Body")
G.bone("Jaw", JAW_PIVOT, J['jaw'][-1], "Head")
G.chain("Rear", [BODY0 + Vector((0, 6, 0))] + J['rear'], "Body", limb='rear')
MAW0 = Vector((0, J['maw'][0].y, BODY0.z + 2.0))
MAW_LAST = G.chain("Maw", [MAW0] + J['maw'], "Body", limb='maw')
LIP_BONES = {}
for nm, part in LIPS.items():
    vs = [v.co for v in me.vertices if me.attributes["part"].data[v.index].value == part]
    tip = sum(vs, Vector()) / len(vs)
    out = Vector((tip.x - MAW_TOP.x, tip.y - MAW_TOP.y, 0)).normalized()
    base = MAW_TOP + out * 2.4
    LIP_BONES[nm] = G.bone("Lip" + nm.capitalize(), base, tip + out * 0.5, MAW_LAST)
for key in LEGS:
    L = J[key]; nm = key.replace('leg', 'Leg').replace('_l', 'Left').replace('_r', 'Right')
    G.bone(nm, L[0] - Vector((LEGS[key] * 1.2, 0, 0)), L[2], "Body", limb=key)
    G.bone(nm.replace('Leg', 'Shin'), L[2], L[4], nm, limb=key)
    G.bone(nm.replace('Leg', 'Foot'), L[4], L[5], nm.replace('Leg', 'Shin'), limb=key)
G.skin(part_bones={JAW: "Jaw", **{p: "Lip" + n.capitalize() for n, p in LIPS.items()}})

# which way each bone turns, measured, not guessed: the axis and sign that move
# its tip the way a pose wants (up, forward, out)
import bpy
def probe(bone, want):
    pb = G.ao.pose.bones[bone]
    bpy.context.view_layer.update()
    t0 = G.ao.matrix_world @ pb.tail
    best = None
    for ax in range(3):
        r = [0.0, 0.0, 0.0]; r[ax] = math.radians(10); pb.rotation_euler = r
        bpy.context.view_layer.update()
        d = (G.ao.matrix_world @ pb.tail - t0).dot(Vector(want))
        if best is None or abs(d) > abs(best[1]): best = (ax, d)
    pb.rotation_euler = (0, 0, 0); bpy.context.view_layer.update()
    return best[0], (1 if best[1] > 0 else -1)
def turn(spec, deg):
    r = [0.0, 0.0, 0.0]; r[spec[0]] += spec[1] * deg; return r
LIP_OPEN = {}
for nm, b in LIP_BONES.items():
    pb = G.ao.pose.bones[b]
    out = Vector((pb.tail.x - MAW_TOP.x, pb.tail.y - MAW_TOP.y, 0)).normalized()
    LIP_OPEN[b] = probe(b, out - Vector((0, 0, 0.6)))           # open: out and down, the bell widens
LIFT, SWING = {}, {}
for key in LEGS:
    nm = key.replace('leg', 'Leg').replace('_l', 'Left').replace('_r', 'Right')
    SWING[nm] = probe(nm, (0, -1, 0))                           # forward
    LIFT[nm] = probe(nm, (0, 0, 1))                             # up
    for b in (nm.replace('Leg', 'Shin'), nm.replace('Leg', 'Foot')):
        LIFT[b] = probe(b, (0, -0.3, 1))                        # the shin and foot tuck up
HEAD_UP = probe("Head", (0, 0, 1)); JAW_OPEN = probe("Jaw", (0, 0, -1))
BODY_PITCH = probe("Body", (0, 0, -1))                          # nose down
MAW_BACK = {b.name: probe(b.name, (0, 1, 0)) for b in G.ao.pose.bones if b.name.startswith("Maw")}
MAW_SIDE = {b.name: probe(b.name, (1, 0, 0)) for b in G.ao.pose.bones if b.name.startswith("Maw")}
REAR_UP = {b.name: probe(b.name, (0, 0, 1)) for b in G.ao.pose.bones if b.name.startswith("Rear")}
NMAW = len(MAW_BACK); NREAR = len(REAR_UP)
print("PROBE lips", LIP_OPEN, "jaw", JAW_OPEN, "head", HEAD_UP)
Z = ((0, 0, 0), (0, 0, 0))

def walk(n, ph):
    """a tripod gait: front and hind of one side with the middle of the other"""
    w = ph * 2 * math.pi
    if n == "Body": return turn(BODY_PITCH, 1.5 * math.sin(w * 2)), (0, 0, 0.35 * math.sin(w * 2))
    if n[:3] in ("Leg", "Shi", "Foo"):
        k = int(next(ch for ch in n if ch.isdigit()))
        grp = (k % 2 == 0) != n.endswith("Right")
        a = w + (0 if grp else math.pi)
        lift = max(0.0, math.sin(a))
        if n.startswith("Leg"):
            r = turn(SWING[n], (8 if k == 0 else 11) * math.cos(a))   # the front pair swings shorter: it meets the shell's corner
            r2 = turn(LIFT[n], 8 * lift); return [x + y for x, y in zip(r, r2)], (0, 0, 0)
        if n.startswith("Shin"): return turn(LIFT[n], 14 * lift), (0, 0, 0)
        return turn(LIFT[n], 8 * lift), (0, 0, 0)
    if n.startswith("Maw"): return turn(MAW_SIDE[n], 5 * math.sin(w + 0.8) / NMAW), (0, 0, 0)
    if n.startswith("Lip"): return turn(LIP_OPEN[n], 2 + 3 * math.sin(w * 2 + 1)), (0, 0, 0)
    if n.startswith("Rear"): return turn(REAR_UP[n], 3 * math.sin(w * 2 + 1.5) / NREAR), (0, 0, 0)
    if n == "Head": return turn(HEAD_UP, 3 * math.sin(w * 2 + 0.5)), (0, 0, 0)
    if n == "Jaw": return turn(JAW_OPEN, 3 + 2 * math.sin(w * 2)), (0, 0, 0)
    return Z

def idle(n, ph):
    """parked under the fighters' ring: breathes, the maw gapes slowly, the jaw chews"""
    w = ph * 2 * math.pi
    br = 0.5 - 0.5 * math.cos(w)
    if n == "Body": return (0, 0, 0), (0, 0, -0.25 * br)
    if n.startswith("Maw"): return turn(MAW_BACK[n], -4 * br / NMAW), (0, 0, 0)
    if n.startswith("Lip"): return turn(LIP_OPEN[n], 8 * br), (0, 0, 0)
    if n == "Head": return turn(HEAD_UP, -3 * br), (0, 0, 0)
    if n == "Jaw": return turn(JAW_OPEN, 5 * abs(math.sin(w * 2))), (0, 0, 0)
    if n.startswith("Rear"): return turn(REAR_UP[n], 2 * br / NREAR), (0, 0, 0)
    return Z

def fire(n, ph):
    """one burst: braces on its legs, the maw draws down and back, then kicks up
    with the lips thrown wide, and settles"""
    settle = 1 - ease(max(0, (ph - 0.55) / 0.45))
    load = ease(min(1, ph / 0.3)) * settle
    kick = ease(min(1, max(0, (ph - 0.3) / 0.1))) * settle
    if n == "Body": return turn(BODY_PITCH, -3 * load * (1 - kick) + 2 * kick), (0, 0, -0.8 * load)
    if n.startswith("Maw"): return turn(MAW_BACK[n], (12 * load * (1 - kick) - 10 * kick) / NMAW), (0, 0, 0)
    if n.startswith("Lip"): return turn(LIP_OPEN[n], -4 * load * (1 - kick) + 13 * kick), (0, 0, 0)
    if n.startswith("Shin"): return turn(LIFT[n], -8 * load), (0, 0, 0)
    if n == "Jaw": return turn(JAW_OPEN, 16 * kick), (0, 0, 0)
    if n == "Head": return turn(HEAD_UP, 6 * kick - 3 * load * (1 - kick)), (0, 0, 0)
    if n.startswith("Rear"): return turn(REAR_UP[n], 4 * kick / NREAR), (0, 0, 0)
    return Z

G.act("walk", 32, walk)
G.act("idle", 48, idle)
G.act("fire", 24, fire)
if os.environ.get('NO_FIX'):                  # look at the motion's slop before the joint fix
    G.save(OUT, "flakmaw"); sys.exit(0)
G.fix_joints()
G.soften()
G.save(OUT, "flakmaw")
