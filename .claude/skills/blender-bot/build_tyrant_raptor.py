"""The Tyrant Raptor, a hatchling that spills out of the Tyrant's eggs three at
a time (scripts/tyrant_raptor.gd). One-shot from SKILL.md and bb_lib, from the
game's blockout (scenes/tyrant_raptor.tscn) and its mockup (34 long, 20 tall at
the head, under the mech's waist).

Reference read: a small fast dromaeosaur hatchling. Long low body carried
level, an S of a neck, a big head for its size with big eyes (a baby), a long
stiff tail held straight out as a counterweight, long digitigrade legs
(thigh, shin back, a long ankle forward, a short foot) with the big sickle
claw raised off the ground, small folded arms with three claws. A swarm-ish
creature, not a boss: lean, no gut.

  1. block out from one Cube: chest, neck, head knifed at the mouth into
     skull and jaw, tail, legs from the hip's underside, arms from the chest;
  2. knife: brows over the eyes, a crest ridge down the back of the skull,
     a back ridge;
  3. clay; personality: a bit of eggshell still stuck on its head, and the
     tail's tip kinked a little left; accents: teeth, eyes, nostrils, toe
     claws with the sickle claw, hand claws, a row of quills on the crest;
     connect.
Paint from the skeleton. Palette: PROVISIONAL, picked to sit beside the
Tyrant's in feel ("kinda colorful", zack 2026-11-04), not taken from any of
zack's models.

usage: python build_tyrant_raptor.py -- <out dir> [seed]
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
HIP = Vector((0, 0, 10.5))
C.start_cube((4.4, 4.4, 5.8), HIP, round_long=1.0)
front = C.run(C.face_where((0, -1, 0)), [
    ((0, -1, 0.05), 2.6, 0.98, 1.0),    # ribcage, level
    ((0, -1, 0.45), 1.8, 0.84, 0.82),   # shoulders, up toward the throat
], name='chest', region='chest')
front = C.run(front, [
    ((0, -0.75, 1), 1.6, 0.86, 0.9),    # the neck rises in an S
    ((0, -0.65, 0.9), 1.4, 0.98, 0.98),
    ((0, -1, 0.6), 1.2, 1.04, 1.03),    # and turns forward under the skull
    ((0, -1, 0.2), 0.6, 1.03, 1.02),
], name='neck', region='neck')

# head: knifed across at the mouth line, skull above, jaw below
nc = front.calc_center_median()
hh = max(v.co.z for v in front.verts) - min(v.co.z for v in front.verts)
MOUTH_Z = nc.z - hh * 0.12
low, up = C.split_face(front, (0, 0, MOUTH_Z))
JAW_PIVOT = Vector((0, nc.y, MOUTH_Z))
C.run(up, [
    ((0, -1, 0.1), 0.7, 1.35, 1.32),    # a baby's big round braincase
    ((0, -1, -0.05), 2.2, 1.0, 1.0),
    ((0, -1, -0.15), 2.1, 0.8, 0.8),    # long low snout
    ((0, -1, -0.1), 1.9, 0.8, 0.82),
    ((0, -1, -0.05), 0.7, 0.72, 0.75),  # nose
], name='head', region='head', keep=(MOUTH_Z, 1, 2))
C.run(low, [
    ((0, -1, -0.25), 0.7, 1.3, 1.25),    # jaw hinge
    ((0, -1, -0.3), 0.6, 0.98, 0.97),   # a short ring behind the hinge so the jaw opens wide
    ((0, -1, -0.22), 1.6, 0.94, 0.93),  # jaw hangs a little open
    ((0, -1, -0.12), 2.1, 0.82, 0.85),
    ((0, -1, -0.04), 1.9, 0.78, 0.8),
    ((0, -1, -0.02), 0.6, 0.7, 0.7),    # chin
], name='jaw', region='head', part=JAW, keep=(MOUTH_Z, -1, 2))

tail = C.run(C.face_where((0, 1, 0)), [
    ((0, 1, 0.12), 2.2, 0.84, 0.8),     # tail root, the back line running straight on
    ((0, 1, 0.04), 2.4, 0.8, 0.84),
    ((0, 1, 0.0), 2.4, 0.78, 0.84),     # a stiff tail, held level as a counterweight
    ((0, 1, 0.0), 2.4, 0.74, 0.84),
    ((0, 1, -0.02), 2.4, 0.7, 0.84),
    ((0, 1, -0.02), 2.2, 0.64, 0.82),
    ((0, 1, 0.0), 2.0, 0.5, 0.8),
], name='tail', region='tail')
C.end_point(tail, tail.calc_center_median() + Vector((0, 1.6, 0)))

# not a boss: lean, no gut. Legs from the hip block's underside, merged in
pats = C.leg_patches(HIP, y_half=1.3, x_cut=0.65, below=1.4)   # a wide belly strip between the thighs takes the run
for side, key in ((-1, 'leg_l'), (1, 'leg_r')):
    C.run(pats[side], [
        (tuple(pats[side].normal), 0.6, 1.0, 1.0, (1.25, 1.05, 1.0), (side * 0.5, 0, 0)),   # haunch
        ((side * 0.3, -0.12, -1), 0.9, 0.94, 1.0),    # thigh root, a short ring so the hip bends
        ((side * 0.05, -0.38, -1), 2.4, 0.85, 1.0),   # thigh, forward and down
        ((side * 0.02, 0.5, -1), 3.6, 0.66, 1.0),     # shin, back
        ((0, -0.3, -1), 3.0, 0.78, 1.0),              # the long ankle, forward
        ((0, -1, -0.2), 1.9, 1.05, 0.55),             # short foot, flat
    ], name=key, region='leg')
    del J[key][1], R[key][1]      # the short thigh-root ring is geometry only: bones and paint use the joints

# small arms out of the low sides of the chest, folded forward so they read
for side, key in ((-1, 'arm_l'), (1, 'arm_r')):
    c0 = J['chest'][0]
    f = max((f for f in C.bm.faces if f.normal.x * side > 0.6 and C.on('chest', f)),
            key=lambda f: -((f.calc_center_median() - Vector((side * 2.4, c0.y - 0.6, c0.z - 1.2))).length))
    bmesh.ops.inset_region(C.bm, faces=[f], thickness=0.3, depth=0)
    C.run(f, [
        ((side, -0.3, 0.0), 0.5, 0.8, 1.0),           # shoulder
        ((side * 0.4, -0.5, -0.7), 1.5, 0.75, 1.0),   # upper arm, down
        ((side * 0.1, -1, 0.1), 1.4, 0.75, 1.0),      # forearm folded forward
        ((0, -1, -0.5), 0.5, 0.85, 0.8),              # hand
    ], name=key, region='arm')

# ratios against the length nose to tail, off the game's mockup (34 long,
# 20 tall at the head) and the reference read: a hatchling's head is big
REF = {'head_len': 0.21, 'head_depth': 0.12, 'body_depth': 0.17, 'height': 0.58}
OFF = C.proportions(REF)
print("OFF", OFF)
if os.environ.get('BLOCKOUT_ONLY'): sys.exit(0)

# ---------- 2. knife and extrude ----------
eye_y = (J['head'][0].y + J['head'][1].y) / 2 - 0.2
skull = J['head'][1]
skull_top = max(p.z for p in R['head'][1])
skull_w = max(p.x for p in R['head'][1])
head = lambda f: C.on('head', f)
top = [f for f in C.bm.faces if head(f) and f.normal.z > 0.35 and eye_y - 1.4 < f.calc_center_median().y < eye_y + 1.0]
brows = C.knife_pair(top, [((0, eye_y - 1.1, 0), (0, -1, 0)), ((0, eye_y + 0.7, 0), (0, 1, 0))], skull_w * 0.4)
for side in (-1, 1):
    if brows[side]: C.pull(brows[side], (side * 0.5, 0, 1), 0.4, shrink=0.85)
crest_faces = [f for f in C.bm.faces if head(f) and f.normal.z > 0.5 and f.calc_center_median().y > eye_y + 0.2]
crest = C.knife(crest_faces, [((0.4, 0, 0), (1, 0, 0)), ((-0.4, 0, 0), (-1, 0, 0))])
if crest: C.pull(crest, (0, 0.3, 1), 0.35, shrink=0.9)
back = [f for f in C.bm.faces if f.normal.z > 0.55 and J['chest'][-1].y < f.calc_center_median().y < J['tail'][3].y
        and not C.on('head', f) and not C.on('neck', f)]
ridge = C.knife(back, [((0.45, 0, 0), (1, 0, 0)), ((-0.45, 0, 0), (-1, 0, 0))])
if ridge: C.pull(ridge, (0, 0, 1), 0.3, shrink=0.9)

assert C.mirror_error() < 1e-3, "the skeleton must be mirror-true before the clay"
ys = [v.co.y for v in C.bm.verts]
C.clay(jitter=0.04, lumps=6, box=((-2.5, 2.5), (min(ys) + 2, max(ys) - 4), (7, 14)), lump_r=(1.2, 2.2), lump_amt=(-0.16, 0.2))

# ---------- personality: once or twice, on purpose ----------
C.lengthen('arm_l', 1.12)          # one arm a touch longer, it reaches when it runs
KINK_TOOTH = 3                     # one upper tooth grown crooked
# a bit of its own eggshell still stuck on its head (a box accent, below)

# ---------- 4. accents, seated with C.skin ----------
def edge(rings, side, pick): return [pick([p for p in ring if p.x * side > 0.12]) for ring in rings]
def along(line, step):
    out = []
    for a, b in zip(line, line[1:]):
        n = max(1, int((b - a).length / step))
        out += [a.lerp(b, i / n) for i in range(n)]
    return out
MOUTH = {}
for side in (-1, 1):
    up_l = edge(R['head'][1:], side, lambda ps: min(ps, key=lambda p: p.z - abs(p.x) * 0.3))
    lo_l = edge(R['jaw'][1:], side, lambda ps: max(ps, key=lambda p: p.z + abs(p.x) * 0.3))
    MOUTH[side] = (up_l, lo_l)
    pts = along(up_l, 0.5)
    for i, p in enumerate(pts):
        t = i / max(1, len(pts) - 1)
        h = 0.35 + 0.3 * math.sin(math.pi * min(1, t * 1.2))
        lean = (side * 0.35, 0.5, -1) if (i == KINK_TOOTH and side < 0) else (side * 0.05, 0.25, -1)
        C.cone(p + Vector((-side * 0.2, 0, 0.12)), lean, 0.16, h + 0.15, 'teeth')
    pts = along(lo_l, 0.6)
    for i, p in enumerate(pts):
        t = i / max(1, len(pts) - 1)
        C.cone(p + Vector((-side * 0.18, 0, -0.08)), (-side * 0.1, 0.2, 1), 0.12, 0.3 + 0.25 * math.sin(math.pi * t), 'teeth', part=JAW)
for side in (-1, 1):
    # big hatchling eyes, in the side of the skull under the brow, sunk half their radius
    p = C.skin((side * 9, eye_y - 0.2, skull_top - 1.1), (-side, 0, 0))
    if p is not None: C.ball(p - Vector((side * 0.27, 0, 0)), 0.55, 'eyes')
    p = C.skin((side * 0.45, J['head'][-1].y + 0.4, 40), (0, 0, -1))
    if p is not None: C.ball(p + Vector((0, 0.2, 0)), 0.18, 'nostrils')
for k in range(5):                 # quills down the crest, shortening back
    y = eye_y + 0.6 + k * 0.7
    p = C.skin((0, y, 40), (0, 0, -1))
    if p is not None: C.cone(p - Vector((0, 0, 0.12)), (0, 0.9, 1), 0.2 - 0.02 * k, 1.0 - 0.13 * k, 'quills')
for key in ('leg_l', 'leg_r'):     # two toe claws forward and the sickle claw raised
    toe = J[key][-1]
    hw = max(abs(p.x - toe.x) for p in R[key][-1])
    for k in (-1, 1):
        d = Vector((k * 0.2, -1, -0.35)).normalized()
        p = C.skin(toe + Vector((k * hw * 0.5, -6, -0.05)), (0, 1, 0))
        if p is not None: C.cone(p - d * 0.2, d, 0.22, 0.8, 'claws')
    side = 1 if key == 'leg_r' else -1
    a3 = J[key][3]
    p = C.skin(a3 + Vector((-side * 0.0, -6, 0.5)), (0, 1, 0))
    if p is not None: C.cone(p - Vector((0, -0.15, 0)), (0, -0.6, 0.8), 0.3, 1.4, 'sickle')
for key in ('arm_l', 'arm_r'):     # three hand claws
    h = J[key][-1]
    for k in (-1, 0, 1):
        d = Vector((k * 0.2, -1, -0.6)).normalized()
        p = C.skin(h + Vector((k * 0.2, -6, -0.05)), (0, 1, 0))
        if p is not None: C.cone(p - d * 0.15, d, 0.12, 0.6, 'claws')
# the eggshell shard, tilted on the braincase a little off centre
from mathutils import Matrix
p = C.skin((1.0, eye_y + 1.9, 40), (0, 0, -1))
if p is not None:
    m = Matrix.Translation(p + Vector((0.1, 0, 0.6))) @ Matrix.Rotation(0.22, 4, 'Y') @ Matrix.Rotation(-0.15, 4, 'X') @ Matrix.Diagonal((1.1, 0.9, 0.16, 1))
    C.box(m, 'shell', at=p)
C.connect()
ob, me = C.to_object()

# ---------- paint: PROVISIONAL palette, colourful like the Tyrant's ----------
TEAL, PLUM, MAGENTA, MOSS, LIME = "#14b8a6", "#2b1659", "#ff2f8e", "#2f3d14", "#c9f23a"
SHELL = "#f3ead2"   # the eggshell: off-white, a sixth swatch on one accent only
BASE, BACK, STRIPE, BELLY, BONE, INK, EYE, MOUTH_C = TEAL, MOSS, PLUM, LIME, LIME, PLUM, MAGENTA, MAGENTA
P = Painter(C, BASE, size=512)     # a smaller enemy paints at 512 (PAINTING.md)
PZ = P.PZ
V = P.V
P.broad(min(V[:, 1]), max(V[:, 1]), BACK, 'above', r=1.0, step=0.35)
P.broad(J['jaw'][-1].y + 0.3, J['tail'][3].y, BELLY, 'below', r=1.0, step=0.3)
BODY = P.region('body', 'chest'); NECK = P.region('neck'); TAILR = P.region('tail'); HEAD = P.region('head')
LEG = P.region('leg'); ARM = P.region('arm')
top_z = lambda y: P.top_z(y, HIP.z + 3); bot_z = lambda y: P.bot_z(y, HIP.z - 3)
for side in (-1, 1):
    y_a, y_b = J['chest'][0].y - 0.3, HIP.y + 1.2          # ribs down the flank
    for i in range(9):
        t = i / 8
        y0 = y_a + (y_b - y_a) * t
        tz, bz = top_z(y0) - 0.5, bot_z(y0)
        reach = 0.8 - 0.35 * t ** 1.5
        P.side_line([(y0 + 0.7 * math.sin(f * math.pi * 0.55), tz - (tz - bz) * reach * f) for f in np.linspace(0, 1, 6)], 0.2, STRIPE, BODY, side)
    P.side_oval(HIP.y + 0.6, top_z(HIP.y + 0.6) - 1.1, 2.0, 0.7, BACK, BODY, side, tilt=0.08)   # hip plate
    for k in range(5):                                     # neck vertebrae
        y = J['chest'][-1].y + (J['neck'][-1].y - J['chest'][-1].y) * (k + 0.5) / 5
        z0 = top_z(y)
        P.side_line([(y, z0 - 0.2), (y + 0.25, z0 - 1.0)], 0.17, STRIPE, NECK, side)
    tp = [HIP + Vector((0, 2.2, 0))] + J['tail']           # tail: spine above, chevron below
    vs = []
    for a, b in zip(tp, tp[1:]): vs += [a.lerp(b, 0.25), a.lerp(b, 0.75)]
    for k, v in enumerate(vs):
        t = k / max(1, len(vs) - 1)
        tz, bz = top_z(v.y), bot_z(v.y); hgt = tz - bz
        P.side_line([(v.y, tz - 0.1), (v.y + 0.35, tz - hgt * 0.45 * (1 - 0.4 * t))], 0.18 * (1 - 0.5 * t), STRIPE, TAILR, side)
        P.side_line([(v.y + 0.15, bz + 0.08), (v.y + 0.45, bz + hgt * 0.25 * (1 - 0.4 * t))], 0.13 * (1 - 0.5 * t), BACK, TAILR, side)
    eye = next((e for e in C.ACC.get('eyes', []) if e.x * side > 0), Vector((0, eye_y, skull_top - 1.1)))
    h2, h3 = J['head'][2], J['head'][3]                    # skull windows
    P.side_oval((h2.y + h3.y) / 2 + 0.2, h2.z + 0.05, 1.0, 0.42, STRIPE, HEAD, side, tilt=-0.12)
    P.side_oval(eye.y, eye.z - 0.05, 0.8, 0.9, INK, HEAD, side)                 # eye socket
    P.side_oval(eye.y + 1.1, eye.z - 0.4, 0.45, 0.6, STRIPE, HEAD, side, tilt=0.3)
    j1 = J['jaw'][1]
    P.side_oval(j1.y + 0.15, j1.z - 0.08, 0.7, 0.26, STRIPE, HEAD & (PZ < j1.z + 0.45), side, tilt=0.35)
    L = J['leg_l' if side < 0 else 'leg_r']                # leg bones
    P.side_line([(L[0].y, L[0].z + 0.4), (L[1].y, L[1].z + 0.2)], 0.3, STRIPE, LEG, side)
    P.side_line([(L[1].y + 0.1, L[1].z - 0.2), (L[2].y, L[2].z + 0.2)], 0.22, STRIPE, LEG, side)
    P.side_line([(L[2].y, L[2].z - 0.1), (L[3].y, L[3].z + 0.2)], 0.18, BACK, LEG, side)
    f0, f1 = L[3], L[4]
    foot = LEG & (PZ < f0.z + 0.4)
    for k in (-1, 1):
        P.top_line([(f0.x + k * 0.4, f0.y + 0.2), (f1.x + k * 0.5, f1.y - 0.4)], 0.12, STRIPE, foot)
    A = J['arm_l' if side < 0 else 'arm_r']
    P.side_line([(A[0].y, A[0].z), (A[1].y, A[1].z)], 0.13, STRIPE, ARM, side)
V3 = lambda x, z: Vector((x, 0, z))
c0 = J['chest'][0]
P.view_line([V3(-1.8, c0.z + 1.0), V3(0, c0.z - 0.6), V3(1.8, c0.z + 1.0)], 0.24, STRIPE, BODY | NECK, 'front')   # wishbone
for k in range(3):                                                                                          # belly ribs
    z = c0.z - 1.2 - k * 0.8
    P.view_line([V3(-1.6 + k * 0.25, z + 0.5), V3(0, z), V3(1.6 - k * 0.25, z + 0.5)], 0.17, STRIPE, BODY, 'front')
for view in ('front', 'back'):
    for lk in ('leg_l', 'leg_r'):
        L = J[lk]
        P.view_line([L[0] + Vector((0, 0, 0.6)), L[1], L[2]], 0.26, STRIPE, LEG, view)
        P.view_line([L[2], L[3]], 0.2, BACK, LEG, view)
    for ak in ('arm_l', 'arm_r'):
        A = J[ak]
        P.view_line([A[0], A[1], A[2]], 0.14, STRIPE, ARM, view)
tzh = top_z(HIP.y + 1.0)
for sd in (-1, 1):                                                                                          # hip plates, shoulder blades
    P.view_line([V3(sd * 0.7, tzh - 0.15), V3(sd * 1.6, HIP.z + 0.1), V3(sd * 2.0, HIP.z - 1.4)], 0.28, STRIPE, BODY, 'back')
    P.view_line([V3(sd * 0.7, top_z(J['chest'][-1].y) - 0.2), V3(sd * 1.9, c0.z + 0.1)], 0.24, STRIPE, BODY | NECK, 'back')
P.spine_bars([J['neck'][-1], J['neck'][0], J['chest'][-1], J['chest'][0], HIP] + J['tail'], STRIPE, BODY | NECK | TAILR,
             every=0.95, width=0.8, taper_from=HIP.y + 2)
def lerp_line(line, y):
    pts = sorted(line, key=lambda p: p.y)
    if y <= pts[0].y: return pts[0].z
    for a, b in zip(pts, pts[1:]):
        if y <= b.y: return a.z + (b.z - a.z) * (y - a.y) / max(b.y - a.y, 1e-6)
    return pts[-1].z
for side in (-1, 1):                                       # the inside of the mouth and the mouth lines
    up_l, lo_l = MOUTH[side]
    y0, y1 = min(p.y for p in up_l + lo_l), max(p.y for p in up_l + lo_l)
    for iy, ix in zip(*np.nonzero(P.mask)):
        q = P.pos[iy, ix]
        if q[0] * side < -0.05 or not (y0 - 0.15 < q[1] < y1): continue
        zt, zb = lerp_line(up_l, q[1]), lerp_line(lo_l, q[1])
        if zb - 0.1 < q[2] < zt + 0.1 and abs(P.nrm[iy, ix][0]) < 0.75:
            P.img[iy, ix] = P.col(MOUTH_C)
    P.stroke(up_l, 0.16, INK, wobble=0.02); P.stroke(lo_l, 0.16, INK, wobble=0.02)
P.accents({'teeth': BONE, 'claws': BONE, 'sickle': MAGENTA, 'eyes': EYE, 'nostrils': INK, 'quills': MAGENTA, 'shell': SHELL})
for e in C.ACC['eyes']:
    P.dab(e + Vector((math.copysign(0.5, e.x), -0.1, 0)), 0.2, INK)   # pupil
for q in C.ACC.get('quills', []):
    P.dab(q, 0.15, PLUM)
P.paint_scars(INK, BELLY)
P.save(OUT, "tyrant_raptor")

# ---------- rig: the game's pivots (Body, Neck, Head, Jaw, Tail, LegLeft/Right, Arms) ----------
G = Rig(C)
G.bone("Body", HIP, J['chest'][0])
G.bone("Chest", J['chest'][0], J['chest'][-1], "Body")
G.chain("Neck", [J['chest'][-1]] + J['neck'], "Chest")
NECK_BONES = len(J['neck'])
G.bone("Head", J['neck'][-1], J['head'][-1], "Neck.%03d" % (NECK_BONES - 1) if NECK_BONES > 1 else "Neck")
G.bone("Jaw", JAW_PIVOT, J['jaw'][-1], "Head")
G.chain("Tail", [HIP + Vector((0, 2.2, 0))] + J['tail'], "Body", limb='tail')
TAIL_BONES = len(J['tail'])
for key, side in (('leg_l', 'Left'), ('leg_r', 'Right')):
    p = J[key]
    sock = Vector((p[0].x * 0.8, p[0].y, HIP.z - 0.8))
    G.bone(f"Leg{side}", sock, p[1], "Body", limb=key)
    G.bone(f"Shin{side}", p[1], p[2], f"Leg{side}", limb=key)
    G.bone(f"Ankle{side}", p[2], p[3], f"Shin{side}", limb=key)
    G.bone(f"Foot{side}", p[3], p[4], f"Ankle{side}", limb=key)
G.bone("Arms", J['chest'][0] + Vector((0, -0.8, -1.0)), J['chest'][0] + Vector((0, -1.5, -1.0)), "Chest")
for key, side in (('arm_l', 'Left'), ('arm_r', 'Right')):
    G.bone(f"Arm{side}", J[key][0], J[key][-1], "Arms", limb=key)
G.skin(part_bones={JAW: "Jaw"}, skip=("Arms",))

def tail_k(n): return 0 if n == "Tail" else int(n.split('.')[1])

def leg_pose(n, w, amp):
    for side in ("Left", "Right"):
        if n.endswith(side) and n[:-len(side)] in ("Leg", "Shin", "Ankle", "Foot"):
            ph_ = w + (0 if side == "Left" else math.pi)
            leg = amp * 19 * math.sin(ph_)
            lift = max(0, math.sin(ph_ + 0.6))
            shin, ankle = -30 * lift * amp, 22 * lift * amp
            foot = -(leg + shin + ankle) * (1 - lift)
            return ({"Leg": leg, "Shin": shin, "Ankle": ankle, "Foot": foot}[n[:-len(side)]], 0, 0)
    return None

def run(n, ph):
    """the sprint: a fast skittering run, body low and level, tail stiff and swaying"""
    w = ph * 2 * math.pi
    lp = leg_pose(n, w, 1.0)
    if lp: return lp, (0, 0, 0)
    if n == "Body": return (1 * math.sin(w * 2), 0, 1 * math.sin(w)), (0, 0, 0.45 * abs(math.sin(w)))
    if n.startswith("Tail"):
        k = tail_k(n)
        return (2 * math.sin(w * 2 - k * 0.5) / TAIL_BONES * 3, 0, 14 * math.sin(w - k * 0.45) / TAIL_BONES), (0, 0, 0)
    if n.startswith("Neck"): return (5 * math.sin(w * 2 + 0.8) / NECK_BONES, 0, -4 * math.sin(w) / NECK_BONES), (0, 0, 0)
    if n == "Head": return (-4 * math.sin(w * 2 + 1.2), 0, 0), (0, 0, 0)
    if n == "Jaw": return (6 + 4 * math.sin(w * 2), 0, 0), (0, 0, 0)
    if n.startswith("Arm"): return (5 * math.sin(w * 2 + (0 if n.endswith("Left") else math.pi)), 0, 0), (0, 0, 0)
    return (0, 0, 0), (0, 0, 0)

def bite(n, ph):
    """the dart in: rears back with the jaw wide, lunges, snaps shut"""
    wind = ease(min(1, ph * 3)) if ph < 0.33 else 1 - ease(min(1, (ph - 0.33) * 6))
    lunge = 0 if ph < 0.33 else ease(min(1, (ph - 0.33) * 6)) * (1 - ease(max(0, (ph - 0.6) * 2.5)))
    snap = 1 if 0.45 < ph < 0.62 else 0
    lp = leg_pose(n, ph * 2 * math.pi, 0.5)
    if lp: return lp, (0, 0, 0)
    # the lunge is a thrust forward along the body, not a nod down: the neck
    # straightens out of the rear-back rather than folding over the chest
    if n == "Body": return (4 * lunge - 6 * wind, 0, 0), (0, -1.6 * lunge, -0.3 * lunge)
    if n == "Chest": return (-5 * wind + 3 * lunge, 0, 0), (0, 0, 0)
    if n.startswith("Neck"): return ((-19 * wind + 10 * lunge) / NECK_BONES, 0, 0), (0, 0, 0)
    if n == "Head": return (-10 * wind - 4 * lunge, 0, 0), (0, 0, 0)   # head up as it strikes, so the open jaw never folds the throat
    if n == "Jaw": return (max(30 * wind, 28 * lunge) * (1 - snap), 0, 0), (0, 0, 0)
    if n.startswith("Tail"): return ((8 * wind - 6 * lunge) / TAIL_BONES, 0, 0), (0, 0, 0)
    if n.startswith("Arm"): return (-20 * lunge, 0, 0), (0, 0, 0)
    return (0, 0, 0), (0, 0, 0)

def idle(n, ph):
    """standing: breathing, the head ticking about, jaw working, tail tip flicking"""
    w = ph * 2 * math.pi
    if n == "Body": return (1.5 * math.sin(w), 0, 0), (0, 0, 0.12 * math.sin(w))
    if n.startswith("Neck"): return (-3 * math.sin(w) / NECK_BONES, 0, 10 * math.sin(w) * (1 if ph < 0.5 else -0.4) / NECK_BONES), (0, 0, 0)
    if n == "Head": return (3 * math.sin(w * 2), 0, 8 * math.sin(w * 2 + 0.5)), (0, 0, 0)
    if n == "Jaw": return (6 * max(0, math.sin(w * 3)), 0, 0), (0, 0, 0)
    if n.startswith("Tail"):
        k = tail_k(n)
        return (0, 0, 10 * math.sin(w - k * 0.6) * (k + 1) / TAIL_BONES / TAIL_BONES * 2), (0, 0, 0)
    if n.startswith("Arm"): return (6 * math.sin(w + 1), 0, 0), (0, 0, 0)
    return (0, 0, 0), (0, 0, 0)

def hatch(n, ph):
    """out of the shell: crouched, it springs up and shakes off its head"""
    rise = ease(min(1, ph * 2))
    shake = math.sin(ph * 60) * max(0, math.sin(ph * math.pi)) * 18
    lp = leg_pose(n, 0, 0)
    for side in ("Left", "Right"):
        if n.endswith(side) and n[:-len(side)] in ("Leg", "Shin", "Ankle", "Foot"):
            crouch = 1 - rise
            return ({"Leg": 18, "Shin": -30, "Ankle": 20, "Foot": -8}[n[:-len(side)]] * crouch, 0, 0), (0, 0, 0)
    if n == "Body": return (10 * (1 - rise), 0, 0), (0, 0, -1.7 * (1 - rise))
    if n.startswith("Neck"): return (14 * (1 - rise) / NECK_BONES, 0, shake * 0.4 / NECK_BONES), (0, 0, 0)
    if n == "Head": return (0, shake * 0.3, shake), (0, 0, 0)
    if n == "Jaw": return (16 * max(0, math.sin(ph * math.pi * 3)), 0, 0), (0, 0, 0)
    if n.startswith("Tail"): return (-6 * (1 - rise) / TAIL_BONES, 0, shake * 0.3 / TAIL_BONES), (0, 0, 0)
    return (0, 0, 0), (0, 0, 0)

G.act("run", 20, run)
G.act("bite", 18, bite)
G.act("idle", 48, idle)
G.act("hatch", 24, hatch)
G.fix_joints()
G.soften()
G.save(OUT, "tyrant_raptor")
