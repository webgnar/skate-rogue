"""The Hailcaster (Planet Frost, Beacon Row), the one-shot test of the
blender-bot skill: a stilt-legged beetle carrying a crystal sac of hail that it
lobs. The game's model is a stand-in (scenes/frost/hailcaster.tscn: Body and
Mortar), so the bones are Body, Head, Jaw, Abdomen, Mortar and the legs.

  1. block out from one Cube: head (knifed across at the mouth into the head
     capsule and the mandible plate), abdomen, six stilt legs out of the body
     block's sides (each side knifed into three);
  2. knife: the hail sac knifed out of the abdomen's back and extruded up,
     a brow plate over the eyes, a keel down the back;
  3. clay; 4. accents: hail crystals on the sac, eyes, mandibles, foot claws.
Paint: the exoskeleton's plates and joints (back plates, side seam, leg joint
rings, head sutures, the sac's cage), balanced front, side and back.

COLOURS ARE A PLACEHOLDER until zack gives the Hailcaster's palette.

usage: python build_hailcaster.py -- <out dir> [seed]
"""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bb_lib import Creature, Painter, Rig, ease
from mathutils import Vector
import bmesh
import numpy as np

args = sys.argv[sys.argv.index('--') + 1:]
OUT = args[0]
SEED = int(args[1]) if len(args) > 1 else 3
C = Creature(SEED)
J, R = C.J, C.R
JAW = 1

# ---------- 1. block out ----------
BODY0 = Vector((0, 0, 9))
C.start_cube((4.2, 4.0, 2.6), BODY0, round_long=0.7)
front = C.run(C.face_where((0, -1, 0)), [
    ((0, -1, 0.05), 0.9, 0.72, 0.9),    # neck, narrow
], name='neck', region='head')
nc = front.calc_center_median()
hh = max(v.co.z for v in front.verts) - min(v.co.z for v in front.verts)
MOUTH_Z = nc.z - hh * 0.15
low, up = C.split_face(front, (0, 0, MOUTH_Z))
JAW_PIVOT = Vector((0, nc.y, MOUTH_Z))       # the jaw opens about the back of the mouth line
C.run(up, [
    ((0, -1, 0.1), 0.6, 1.45, 1.4),     # head capsule swells
    ((0, -1, 0.0), 1.6, 1.0, 1.0),
    ((0, -1, -0.25), 1.0, 0.72, 0.8),   # face slopes down
], name='head', region='head', keep=(MOUTH_Z, 1, 2))
C.run(low, [
    ((0, -1, -0.15), 0.6, 1.3, 1.2),    # mandible plate under the face
    ((0, -1, -0.2), 1.6, 0.9, 0.85),
    ((0, -1, -0.1), 0.8, 0.7, 0.7),
], name='jaw', region='head', part=JAW, keep=(MOUTH_Z, -1, 2))
abd = C.run(C.face_where((0, 1, 0)), [
    ((0, 1, 0.1), 1.0, 1.15, 1.2),      # waist widens into the abdomen
    ((0, 1, 0.05), 3.2, 1.12, 1.15),
    ((0, 1, -0.1), 2.6, 0.9, 0.95),
    ((0, 1, -0.3), 1.6, 0.6, 0.7),
], name='abdomen', region='abdomen')
C.end_point(abd, abd.calc_center_median() + Vector((0, 0.8, -0.2)))

# six stilt legs out of the body block: each side face knifed into three
LEGS = {}
for side in (-1, 1):
    f = C.face_where((side, 0, 0), lambda f: -abs(f.calc_center_median().y) * 0.1)
    a, rest = C.split_face(f, (0, -0.7, 0), (0, 1, 0))
    b, c = C.split_face(rest, (0, 0.7, 0), (0, 1, 0))
    for k, face in zip((0, 1, 2), (a, b, c)):     # front, middle, back
        fwd = (-0.55, 0.0, 0.55)[k]
        key = f"leg{k}_{'l' if side < 0 else 'r'}"
        C.run(face, [
            ((side, fwd * 0.3, 0.1), 0.5, 0.9, 1.0),             # hip
            ((side, fwd, 0.9), 3.6, 0.8, 1.0),                   # thigh up and out
            ((side * 0.35, fwd * 0.6, -1), 6.0, 0.62, 1.0),      # long stilt down
            ((side * 0.05, fwd * 0.2, -1), 2.4, 0.6, 1.0),       # foot
        ], name=key, region='leg')
        LEGS[key] = side

# ---------- 2. knife shapes in, extrude them ----------
# the hail sac: a patch of the abdomen's back knifed out, merged, and grown up
ab = J['abdomen']
topf = [f for f in C.bm.faces if C.on('abdomen', f) and f.normal.z > 0.5]
patch = C.knife(topf, [((1.5, 0, 0), (1, 0, 0)), ((-1.5, 0, 0), (-1, 0, 0)),
                      ((0, ab[1].y - 1.4, 0), (0, -1, 0)), ((0, ab[1].y + 1.0, 0), (0, 1, 0))])
sac_face = bmesh.ops.dissolve_faces(C.bm, faces=patch)['region'][0]
C.run(sac_face, [
    ((0, 0.1, 1), 0.5, 1.25, 1.0),      # rim
    ((0, 0.15, 1), 1.5, 1.15, 1.0),     # the sac bulges
    ((0, 0.2, 1), 1.4, 0.9, 1.0),
    ((0, 0.25, 1), 0.8, 0.5, 1.0),      # mouth of the sac, where the hail comes out
], name='sac', region='sac')
# brow plate over the eyes, both sides cut together
hd = J['head']
hw = max(p.x for p in R['head'][1])
top = [f for f in C.bm.faces if C.on('head', f) and f.normal.z > 0.4 and hd[0].y - 0.2 > f.calc_center_median().y > hd[1].y - 0.8]
brows = C.knife_pair(top, [((0, hd[1].y - 0.6, 0), (0, -1, 0)), ((0, hd[0].y, 0), (0, 1, 0))], hw * 0.3)
for side in (-1, 1):
    if brows[side]: C.pull(brows[side], (side * 0.3, -0.2, 1), 0.45, shrink=0.85)
# keel down the back of the body block
keel = [f for f in C.bm.faces if C.on('body', f) and f.normal.z > 0.6]
keel = C.knife(keel, [((0.4, 0, 0), (1, 0, 0)), ((-0.4, 0, 0), (-1, 0, 0))])
if keel: C.pull(keel, (0, 0, 1), 0.4, shrink=0.9)

assert C.mirror_error() < 1e-3, "the skeleton must be mirror-true before the clay"
C.clay(jitter=0.04, lumps=5, box=((-2, 2), (-4, 8), (7, 13)), lump_r=(1.0, 2.0), lump_amt=(-0.15, 0.2))

# ---------- personality: on purpose, once or twice ----------
C.lengthen('leg0_l', 1.12)                                   # one front stilt a little longer: it lists
a1 = J['abdomen'][1]                                          # an old gash down the right of the abdomen
C.scar(a1 + Vector((9, 0.6, 0.2)), (-1, 0, 0), (0, 1, 0.7), 2.6)

# ---------- accents ----------
sac = J['sac']
for i in range(10):                    # hail crystals poking out of the sac, round it
    ang = i / 10 * 2 * math.pi + C.rng.uniform(-0.15, 0.15)
    zc = sac[1].z + C.rng.uniform(-0.4, 0.6)
    d = Vector((math.cos(ang), math.sin(ang), 0.35))
    p = C.skin(Vector((sac[1].x, sac[1].y, zc)) + d * 8, -d)
    if p is not None:
        C.cone(p - d * 0.2, d, C.rng.uniform(0.3, 0.45), C.rng.uniform(0.9, 1.5), 'crystals', sides=5)
for k in range(3):                      # crystals heaped in the sac's mouth
    C.cone(sac[-1] + Vector(((k - 1) * 0.35, 0.1, -0.2)), ((k - 1) * 0.3, 0.1, 1), 0.3, 1.0, 'crystals', sides=5)
for side in (-1, 1):
    p = C.skin((side * 8, hd[1].y - 0.2, hd[1].z + 0.3), (-side, 0, 0))   # eyes
    if p is not None: C.ball(p + Vector((side * 0.12, 0, 0)), 0.42, 'eyes')   # half sunk, never through the skull's corner
    j = J['jaw'][-1]                                                        # mandibles
    C.cone(j + Vector((side * 0.6, 0.2, 0.1)), (-side * 0.45, -1, -0.1), 0.25, 1.4 if side < 0 else 0.7, 'mandibles', part=JAW)   # the right one broken
for key, side in LEGS.items():         # a claw under each foot, seated on the sole, no wider than it
    t = J[key][-1]
    d = Vector((side * 0.15, 0, -1)).normalized()
    p = C.skin(t + Vector((0, 0, -6)), (0, 0, 1))
    hw = min((q - t).length for q in R[key][-1])
    if p is not None: C.cone(p - d * 0.15, d, min(0.28, hw * 0.6), 0.9, 'claws')
C.connect()                             # final pass: floating accents get a socket extruded from the body
ob, me = C.to_object()

# ---------- paint (PLACEHOLDER palette until zack gives one) ----------
BASE, BACK, MARK, BELLY, ICE, EYE = "#8a8f99", "#5c616b", "#2b2e35", "#c4c7cc", "#e3edf5", "#f2f2f2"
P = Painter(C, BASE)
V = P.V
P.broad(min(V[:, 1]), max(V[:, 1]), BACK, 'above', r=1.3, step=0.5)
P.broad(J['jaw'][-1].y + 0.4, J['abdomen'][-1].y, BELLY, 'below', r=1.2, step=0.45)
BODY = P.region('body'); HEAD = P.region('head'); ABD = P.region('abdomen'); LEG = P.region('leg'); SAC = P.region('sac')
P.img[SAC & P.mask] = P.col(ICE)                       # the sac is ice
PZ = P.PZ
# back plates: a bar across the back at every segment, head to tail tip
P.spine_bars([J['head'][-1], J['head'][0], BODY0 + Vector((0, -2, 0)), BODY0, BODY0 + Vector((0, 2, 0))] + J['abdomen'],
             MARK, BODY | HEAD | ABD, every=1.0, width=1.6)
for side in (-1, 1):
    # the side seam where the back plates meet the belly plates
    path = [(J['head'][1].y, J['head'][1].z - 0.2), (J['neck'][0].y, BODY0.z - 0.2), (BODY0.y, BODY0.z - 0.3)] + \
           [(p.y, p.z - 0.2) for p in J['abdomen']]
    P.side_line(path, 0.22, MARK, BODY | HEAD | ABD, side)
    # a plate edge dropping from each back plate to the seam, on the abdomen
    for k in range(5):
        y = J['abdomen'][0].y + (J['abdomen'][-2].y - J['abdomen'][0].y) * (k + 0.5) / 5
        tz = P.top_z(y, BODY0.z + 2)
        P.side_line([(y, tz - 0.2), (y + 0.3, (tz + BODY0.z) / 2)], 0.18, MARK, ABD, side)
    # head: an eye ring, the cheek suture, the mandible plate's edge
    eye = next((e for e in C.ACC.get('eyes', []) if e.x * side > 0), None)
    if eye is not None:
        P.side_oval(eye.y, eye.z, 0.7, 0.7, MARK, HEAD, side)
        P.side_line([(eye.y + 0.6, eye.z - 0.3), (J['head'][0].y + 0.2, J['head'][0].z - 0.9)], 0.17, MARK, HEAD, side)
    j = J['jaw']
    P.side_line([(p.y, p.z + 0.35) for p in j], 0.15, MARK, HEAD & (PZ < J['jaw'][0].z + 0.6), side)
    # the sac's cage: struts from the rim to the mouth
    for dy in (-0.9, 0.0, 0.9):
        P.side_line([(sac[0].y + dy, sac[0].z), (sac[1].y + dy * 1.1, sac[1].z), (sac[-1].y + dy * 0.4, sac[-1].z)], 0.2, MARK, SAC, side)
# head from above: the Y suture
P.top_line([(0, J['head'][-1].y), (0, J['head'][1].y), (-0.8, J['head'][0].y)], 0.15, MARK, HEAD)
P.top_line([(0, J['head'][1].y), (0.8, J['head'][0].y)], 0.15, MARK, HEAD)
# front and back: the sac's cage, the face plate, the abdomen's rear plates
for view in ('front', 'back'):
    for dx in (-1.0, 0.0, 1.0):
        P.view_line([Vector((dx * 1.3, 0, sac[0].z)), Vector((dx * 1.4, 0, sac[1].z)), Vector((dx * 0.5, 0, sac[-1].z))], 0.2, MARK, SAC, view)
P.view_line([Vector((-1.0, 0, hd[1].z + 0.6)), Vector((0, 0, hd[-1].z - 0.2)), Vector((1.0, 0, hd[1].z + 0.6))], 0.18, MARK, HEAD, 'front')
for k in range(3):
    z = BODY0.z + 0.8 - k * 0.7
    P.view_line([Vector((-1.6 + k * 0.4, 0, z)), Vector((1.6 - k * 0.4, 0, z))], 0.16, MARK, ABD, 'back')
# legs: a ring at every joint (a dab reads from every side) and a line down each stilt
for key, side in LEGS.items():
    L = J[key]
    for p in L[:-1]:
        P.dab(p, 0.5, MARK)
    P.side_line([(L[1].y, L[1].z), (L[2].y, L[2].z)], 0.16, MARK, LEG, side)
    for view in ('front', 'back'):
        P.view_line([L[1], L[2], L[3]], 0.16, MARK, LEG, view)
P.accents({'crystals': ICE, 'eyes': EYE, 'mandibles': MARK, 'claws': MARK})
for e in C.ACC['eyes']:
    P.dab(e + Vector((math.copysign(0.38, e.x), -0.1, 0)), 0.18, MARK)
P.paint_scars(MARK, BELLY)
P.save(OUT, "hailcaster")

# ---------- rig ----------
G = Rig(C)
G.bone("Body", BODY0 + Vector((0, 1.8, 0)), BODY0 + Vector((0, -1.8, 0)))
G.bone("Head", J['neck'][0], J['head'][-1], "Body")
G.bone("Jaw", JAW_PIVOT, J['jaw'][-1], "Head")
G.chain("Abdomen", [BODY0 + Vector((0, 2.0, 0))] + J['abdomen'], "Body", limb='abdomen')
G.bone("Mortar", J['sac'][0] - Vector((0, 0.1, 0.9)), J['sac'][-1], "Abdomen.001", limb='sac')   # pivots at its root in the abdomen
for key in LEGS:
    L = J[key]; nm = key.replace('leg', 'Leg').replace('_l', 'Left').replace('_r', 'Right')
    G.bone(nm, L[0], L[1], "Body", limb=key)
    G.bone(nm.replace('Leg', 'Stilt'), L[1], L[2], nm, limb=key)
    G.bone(nm.replace('Leg', 'Foot'), L[2], L[3], nm.replace('Leg', 'Stilt'), limb=key)
G.skin(part_bones={JAW: "Jaw"})

# ---------- actions ----------
def walk(n, ph):
    """a tripod gait: front and back legs of one side with the middle of the other"""
    w = ph * 2 * math.pi
    if n == "Body": return (0, 0, 2 * math.sin(w)), (0, 0, 0.15 * math.sin(w * 2))
    if n.startswith(("Leg", "Stilt", "Foot")):
        k = int(next(ch for ch in n if ch.isdigit()))
        right = n.endswith("Right")
        grp = (k % 2 == 0) != right
        s = math.sin(w + (0 if grp else math.pi))
        lift = max(0, s)
        if n.startswith("Leg"): return (0, 0, (14 * math.cos(w + (0 if grp else math.pi))) * (1 if right else -1)), (0, 0, 0)
        if n.startswith("Stilt"): return (-12 * lift, 0, 0), (0, 0, 0)
        return (8 * lift, 0, 0), (0, 0, 0)
    if n.startswith("Abdomen"): return (0, 0, 3 * math.sin(w + 1)), (0, 0, 0)
    if n == "Mortar": return (4 * math.sin(w * 2), 0, 0), (0, 0, 0)
    if n == "Jaw": return (1.5 + 1.5 * math.sin(w * 3), 0, 0), (0, 0, 0)
    return (0, 0, 0), (0, 0, 0)

def throw(n, ph):
    """the sac pumps back, then flings the hail forward over the head"""
    settle = 1 - ease(max(0, (ph - 0.6) / 0.4))     # everything back to rest by the last frame, so it loops
    load = ease(min(1, ph / 0.45)) * settle
    fling = ease(min(1, max(0, (ph - 0.45) / 0.15))) * settle
    if n == "Mortar": return (-14 * load * (1 - fling) + 26 * fling, 0, 0), (0, 0, 0)
    if n.startswith("Abdomen"): return (7 * load * (1 - fling) - 8 * fling, 0, 0), (0, 0, 0)
    if n == "Body": return (-4 * load + 6 * fling, 0, 0), (0, 0, -0.5 * load * (1 - fling))
    if n.startswith("Stilt"): return (10 * load * (1 - fling), 0, 0), (0, 0, 0)
    if n == "Jaw": return (20 * fling, 0, 0), (0, 0, 0)            # + opens
    return (0, 0, 0), (0, 0, 0)

G.act("walk", 32, walk)
G.act("throw", 40, throw)
G.fix_joints()                          # loop cut and swell every joint a pose creases
G.save(OUT, "hailcaster")
