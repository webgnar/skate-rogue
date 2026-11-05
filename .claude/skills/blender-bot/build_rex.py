"""A fresh one-shot of the Tyrant from zack's T-rex reference (2026-11-04), written
from SKILL.md and bb_lib only, not from build_tyrant.py: the test of the skill.

Reference read: a huge boxy head about a quarter of the body, a short thick
neck, a fat sagging gut, massive thighs that are one mass with the flank,
shorter shins, big three-toed feet, small two-clawed arms, and a long heavy
tail tapering to a point, carried level.

  1. block out from one Cube: chest, neck, head knifed at the mouth into
     skull and jaw, tail, the gut sagged (C.gut), legs out of the gut's flanks
     (C.leg_patches), small arms out of the low chest;
  2. knife: brows, cheek jowls, a nose ridge, a back ridge;
  3. clay; personality: a longer right arm, a scar across the left flank and
     a broken tooth; accents: teeth, eyes, nostrils, toe and hand claws;
     connect.
Paint from the skeleton (ribs, hip, tail vertebrae and chevrons, skull
windows, limb and foot bones), balanced front, side and back. Palette: the
Tyrant's, from zack, orange scheme.

usage: python build_rex.py -- <out dir> [seed]
"""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bb_lib import Creature, Painter, Rig, ease
from mathutils import Vector, Matrix
import bmesh
import numpy as np

args = sys.argv[sys.argv.index('--') + 1:]
OUT = args[0]
SEED = int(args[1]) if len(args) > 1 else 11
C = Creature(SEED)
J, R = C.J, C.R
JAW = 1

# ---------- 1. block out ----------
HIP = Vector((0, 0, 11))
C.start_cube((5.6, 6.0, 5.6), HIP)
front = C.run(C.face_where((0, -1, 0)), [
    ((0, -1, 0.2), 3.0, 1.0, 0.95),     # chest, deep
    ((0, -1, 0.9), 2.0, 0.85, 0.8),     # shoulders, up to the throat
], name='chest', region='chest')
front = C.run(front, [
    ((0, -0.7, 1), 1.8, 0.9, 1.0),      # thick neck rises
    ((0, -1, 0.4), 1.4, 1.05, 1.05),    # and turns forward under the skull
], name='neck', region='neck')

# head: the end of the neck knifed across at the mouth line, skull above, jaw below
nc = front.calc_center_median()
hh = max(v.co.z for v in front.verts) - min(v.co.z for v in front.verts)
MOUTH_Z = nc.z - hh * 0.1
low, up = C.split_face(front, (0, 0, MOUTH_Z))
JAW_PIVOT = Vector((0, nc.y, MOUTH_Z))
C.run(up, [
    ((0, -1, 0.1), 0.8, 1.4, 1.5),      # skull swells over the jaw hinge
    ((0, -1, 0.0), 3.0, 1.0, 1.0),      # the big box of the skull
    ((0, -1, -0.1), 2.4, 0.9, 0.92),    # snout
    ((0, -1, -0.15), 1.8, 0.82, 0.85),
    ((0, -1, -0.1), 0.9, 0.75, 0.8),    # nose
], name='head', region='head', keep=(MOUTH_Z, 1, 2))
C.run(low, [
    ((0, -1, -0.35), 0.8, 1.35, 1.55),  # jaw hinge, under the cheeks
    ((0, -1, -0.45), 2.8, 0.95, 0.92),  # jaw hangs open
    ((0, -1, -0.35), 2.4, 0.88, 0.88),
    ((0, -1, -0.2), 2.2, 0.84, 0.82),
    ((0, -1, -0.05), 0.9, 0.74, 0.72),  # chin
], name='jaw', region='head', part=JAW, keep=(MOUTH_Z, -1, 2))

tail = C.run(C.face_where((0, 1, 0)), [
    ((0, 1, 0.4), 2.2, 0.86, 0.66),     # tail root, the gut line sweeping up into it
    ((0, 1, 0.1), 2.2, 0.82, 0.92),
    ((0, 1, 0.0), 2.2, 0.76, 0.9),
    ((0, 1, -0.05), 2.2, 0.7, 0.88),
    ((0, 1, -0.05), 2.0, 0.58, 0.85),
    ((0, 1, 0.05), 1.8, 0.3, 0.8),
], name='tail', region='tail')
C.end_point(tail, tail.calc_center_median() + Vector((0, 1.0, 0)))

# a boss is fat, and its legs are one mass with it (SKILL step 1)
C.gut(6.0, HIP, half=3.0)
pats = C.leg_patches(HIP, x_cut=0.45)   # a wider belly strip between the thighs takes the walk
for side, key in ((-1, 'leg_l'), (1, 'leg_r')):
    C.run(pats[side], [
        (tuple(pats[side].normal), 0.7, 1.0, 1.0, (1.35, 1.05, 1.0), (side * 0.45, 0, 0)),  # haunch
        ((-side * 0.05, -0.2, -1), 2.6, 0.92, 1.0),   # massive thigh
        ((side * 0.04, 0.6, -1), 3.0, 0.68, 1.0),     # shin, back
        ((0, -0.2, -1), 1.6, 0.85, 1.0),              # ankle
        ((0, -1, -0.15), 2.8, 1.05, 0.5),             # big foot, flat and forward
    ], name=key, region='leg')

# small arms out of the low sides of the chest, held forward so they read
for side, key in ((-1, 'arm_l'), (1, 'arm_r')):
    c0 = J['chest'][0]
    f = max((f for f in C.bm.faces if f.normal.x * side > 0.6 and C.on('chest', f)),
            key=lambda f: -((f.calc_center_median() - Vector((side * 3, c0.y - 0.8, c0.z - 1.8))).length))
    bmesh.ops.inset_region(C.bm, faces=[f], thickness=0.35, depth=0)
    C.run(f, [
        ((side, -0.3, 0.0), 0.6, 0.8, 1.0),           # shoulder
        ((side * 0.5, -0.6, -0.5), 1.6, 0.75, 1.0),   # upper arm
        ((side * 0.1, -1, -0.4), 1.4, 0.75, 1.0),     # forearm, forward
        ((0, -1, -0.6), 0.6, 0.8, 0.8),               # hand
    ], name=key, region='arm')

# hold the block-out to the reference: ratios measured off zack's drawing,
# each against the length nose to tail (SKILL step 1b)
REF = {'head_len': 0.27, 'head_depth': 0.20, 'body_depth': 0.34, 'height': 0.63}
OFF = C.proportions(REF)
if os.environ.get('BLOCKOUT_ONLY'): sys.exit(0)

# ---------- 2. knife and extrude (features on their own region's part-0 faces) ----------
eye_y = (J['head'][0].y + J['head'][1].y) / 2 - 0.4
skull = J['head'][1]
skull_top = max(p.z for p in R['head'][1])
skull_w = max(p.x for p in R['head'][1])
head = lambda f: C.on('head', f)
top = [f for f in C.bm.faces if head(f) and f.normal.z > 0.35 and eye_y - 1.8 < f.calc_center_median().y < eye_y + 1.2]
brows = C.knife_pair(top, [((0, eye_y - 1.5, 0), (0, -1, 0)), ((0, eye_y + 0.9, 0), (0, 1, 0))], skull_w * 0.35)
for side in (-1, 1):
    if brows[side]: C.pull(brows[side], (side * 0.4, 0, 1), 0.6, shrink=0.85)
for side in (-1, 1):
    sides = [f for f in C.bm.faces if head(f) and f.normal.x * side > 0.6
             and J['head'][0].y - 0.3 < f.calc_center_median().y < eye_y + 1.0
             and f.calc_center_median().z < skull.z + 0.3]
    jowl = C.knife(sides, [((0, 0, skull.z + 0.2), (0, 0, 1)), ((0, eye_y - 0.4, 0), (0, -1, 0))])
    if jowl: C.pull(jowl, (side, 0, -0.2), 0.45, shrink=0.85)
snout = [f for f in C.bm.faces if head(f) and f.normal.z > 0.5 and J['head'][-1].y - 0.2 < f.calc_center_median().y < J['head'][2].y]
ridge = C.knife(snout, [((0.45, 0, 0), (1, 0, 0)), ((-0.45, 0, 0), (-1, 0, 0))])
if ridge: C.pull(ridge, (0, 0, 1), 0.28, shrink=0.92)
back = [f for f in C.bm.faces if f.normal.z > 0.55 and J['chest'][-1].y < f.calc_center_median().y < J['tail'][2].y
        and not C.on('head', f)]
ridge = C.knife(back, [((0.6, 0, 0), (1, 0, 0)), ((-0.6, 0, 0), (-1, 0, 0))])
if ridge: C.pull(ridge, (0, 0, 1), 0.4, shrink=0.9)

assert C.mirror_error() < 1e-3, "the skeleton must be mirror-true before the clay"
C.clay()

# ---------- personality: once or twice, on purpose ----------
C.lengthen('arm_r', 1.15)                                     # the right arm a little longer
fl = Vector((0, HIP.y - 1.5, HIP.z + 1.2))   # high on the flank, clear of the hip joint
C.scar(fl + Vector((-12, 0, 0)), (1, 0, 0), (0, 1, 0.55), 3.2)  # a scar raked across the left flank
BROKEN_TOOTH = 4                                               # and one upper tooth snapped short

# ---------- 4. accents, seated with C.skin ----------
def edge(rings, side, pick): return [pick([p for p in ring if p.x * side > 0.15]) for ring in rings]
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
    pts = along(up_l, 0.6)
    for i, p in enumerate(pts):
        t = i / max(1, len(pts) - 1)
        h = (0.6 + 0.6 * math.sin(math.pi * min(1, t * 1.2))) * (0.4 if (i == BROKEN_TOOTH and side > 0) else 1)
        C.cone(p + Vector((-side * 0.25, 0, 0.15)), (side * 0.05, 0.2, -1), 0.22, h + 0.2, 'teeth')
    pts = along(lo_l, 0.7)
    for i, p in enumerate(pts):
        t = i / max(1, len(pts) - 1)
        C.cone(p + Vector((-side * 0.22, 0, -0.1)), (-side * 0.1, 0.15, 1), 0.15, 0.45 + 0.35 * math.sin(math.pi * t), 'teeth', part=JAW)
for side in (-1, 1):
    p = C.skin((side * 9, eye_y - 0.6, skull_top - 1.5), (-side, 0, 0))
    if p is not None: C.ball(p - Vector((side * 0.19, 0, 0)), 0.38, 'eyes')   # sunk half its radius: an eye, not a peg
    p = C.skin((side * 0.6, J['head'][-1].y + 0.5, 40), (0, 0, -1))   # on the snout, not past its tip
    if p is not None: C.ball(p + Vector((0, 0.3, 0)), 0.26, 'nostrils')
for key in ('leg_l', 'leg_r'):                  # three toe claws a foot, seated on its front
    toe = J[key][-1]
    hw = max(abs(p.x - toe.x) for p in R[key][-1])
    for k in (-1, 0, 1):
        d = Vector((k * 0.25, -1, -0.35)).normalized()
        p = C.skin(toe + Vector((k * hw * 0.6, -6, -0.1)), (0, 1, 0))
        if p is not None: C.cone(p - d * 0.25, d, 0.3, 1.1, 'claws')
for key in ('arm_l', 'arm_r'):                  # two hand claws, seated on the front of the hand
    h = J[key][-1]
    for k in (-1, 1):
        d = Vector((k * 0.15, -1, -0.6)).normalized()
        p = C.skin(h + Vector((k * 0.25, -6, -0.1)), (0, 1, 0))
        if p is not None: C.cone(p - d * 0.2, d, 0.17, 0.8, 'claws')
C.connect()
ob, me = C.to_object()

# ---------- paint: the Tyrant palette from zack, orange scheme ----------
NAVY, ORANGE, RED, BROWN, YELLOW = "#0c1c4e", "#ff960d", "#ff000e", "#4c240c", "#ffdf0b"
BASE, BACK, STRIPE, BELLY, BONE, INK, EYE, MOUTH_C, TONGUE = ORANGE, BROWN, NAVY, YELLOW, YELLOW, NAVY, YELLOW, BROWN, RED
P = Painter(C, BASE)
PZ = P.PZ
V = P.V
P.broad(min(V[:, 1]), max(V[:, 1]), BACK, 'above', r=1.6, step=0.5)
P.broad(J['jaw'][-1].y + 0.3, J['tail'][3].y, BELLY, 'below', r=1.6, step=0.45)
BODY = P.region('body', 'chest'); NECK = P.region('neck'); TAILR = P.region('tail'); HEAD = P.region('head')
LEG = P.region('leg'); ARM = P.region('arm')
top_z = lambda y: P.top_z(y, HIP.z + 4); bot_z = lambda y: P.bot_z(y, HIP.z - 5)
for side in (-1, 1):
    y_a, y_b = J['chest'][0].y - 0.4, HIP.y + 2.0          # ribs down the flank, sweeping back
    for i in range(11):
        t = i / 10
        y0 = y_a + (y_b - y_a) * t
        tz, bz = top_z(y0) - 0.7, bot_z(y0)
        reach = 0.85 - 0.4 * t ** 1.5
        P.side_line([(y0 + 1.0 * math.sin(f * math.pi * 0.55), tz - (tz - bz) * reach * f) for f in np.linspace(0, 1, 7)], 0.26, STRIPE, BODY, side)
    iz = top_z(HIP.y + 1) - 1.6                            # the hip plate over the thigh
    P.side_oval(HIP.y + 1.0, iz, 3.0, 1.0, BACK, BODY, side, tilt=0.08)
    for k in range(4):                                     # neck vertebrae
        y = J['chest'][-1].y + (J['neck'][-1].y - J['chest'][-1].y) * (k + 0.5) / 4
        z0 = top_z(y)
        P.side_line([(y, z0 - 0.3), (y + 0.35, z0 - 1.3)], 0.22, STRIPE, NECK, side)
    tp = [HIP + Vector((0, 3.0, 0))] + J['tail']           # tail: spine above, chevron below, each vertebra
    vs = []
    for a, b in zip(tp, tp[1:]): vs += [a.lerp(b, 0.25), a.lerp(b, 0.75)]
    for k, v in enumerate(vs):
        t = k / max(1, len(vs) - 1)
        tz, bz = top_z(v.y), bot_z(v.y); hgt = tz - bz
        P.side_line([(v.y, tz - 0.15), (v.y + 0.45, tz - hgt * 0.42 * (1 - 0.4 * t))], 0.24 * (1 - 0.5 * t), STRIPE, TAILR, side)
        P.side_line([(v.y + 0.2, bz + 0.1), (v.y + 0.55, bz + hgt * 0.26 * (1 - 0.4 * t))], 0.18 * (1 - 0.5 * t), BACK, TAILR, side)
    eye = next((e for e in C.ACC.get('eyes', []) if e.x * side > 0), Vector((0, eye_y, skull_top - 1.5)))
    h2, h3 = J['head'][2], J['head'][3]                     # skull windows
    P.side_oval((h2.y + h3.y) / 2 + 0.3, h2.z + 0.15, 1.35, 0.6, STRIPE, HEAD, side, tilt=-0.12)
    P.side_oval(eye.y + 1.5, eye.z - 0.7, 0.75, 1.0, STRIPE, HEAD, side, tilt=0.3)
    P.side_oval(eye.y, eye.z - 0.1, 0.55, 0.85, INK, HEAD, side)
    j1 = J['jaw'][1]
    P.side_oval(j1.y + 0.2, j1.z - 0.1, 0.95, 0.35, STRIPE, HEAD & (PZ < j1.z + 0.6), side, tilt=0.35)
    L = J['leg_l' if side < 0 else 'leg_r']                # thigh, shin and foot bones
    P.side_line([(L[0].y, L[0].z + 0.6), (L[1].y, L[1].z + 0.3)], 0.42, BACK, LEG, side)
    P.side_line([(L[1].y + 0.2, L[1].z - 0.3), (L[2].y, L[2].z + 0.3)], 0.3, BACK, LEG, side)
    f0, f1 = L[3], L[4]
    foot = LEG & (PZ < f0.z + 0.5)
    for k in (-1, 0, 1):
        P.top_line([(f0.x + k * 0.55, f0.y + 0.3), (f1.x + k * 0.7, f1.y - 0.6)], 0.15, STRIPE, foot)
    A = J['arm_l' if side < 0 else 'arm_r']
    P.side_line([(A[0].y, A[0].z), (A[1].y, A[1].z)], 0.16, STRIPE, ARM, side)
V3 = lambda x, z: Vector((x, 0, z))
c0 = J['chest'][0]
P.view_line([V3(-2.4, c0.z + 1.4), V3(0, c0.z - 0.8), V3(2.4, c0.z + 1.4)], 0.3, STRIPE, BODY | NECK, 'front')   # wishbone
for k in range(4):                                                                                          # belly ribs
    z = c0.z - 1.8 - k * 1.1
    P.view_line([V3(-2.2 + k * 0.3, z + 0.7), V3(0, z), V3(2.2 - k * 0.3, z + 0.7)], 0.22, STRIPE, BODY, 'front')
for view in ('front', 'back'):
    for lk in ('leg_l', 'leg_r'):
        L = J[lk]
        P.view_line([L[0] + Vector((0, 0, 0.8)), L[1], L[2]], 0.34, STRIPE, LEG, view)
        P.view_line([L[2], L[3]], 0.26, BACK, LEG, view)
    for ak in ('arm_l', 'arm_r'):
        A = J[ak]
        P.view_line([A[0], A[1], A[2]], 0.18, STRIPE, ARM, view)
tzh = top_z(HIP.y + 1.5)
for sd in (-1, 1):                                                                                          # hip plates, shoulder blades
    P.view_line([V3(sd * 0.9, tzh - 0.2), V3(sd * 2.2, HIP.z + 0.2), V3(sd * 2.8, HIP.z - 2.0)], 0.38, STRIPE, BODY, 'back')
    P.view_line([V3(sd * 1.0, top_z(J['chest'][-1].y) - 0.3), V3(sd * 2.6, c0.z + 0.2)], 0.32, STRIPE, BODY | NECK, 'back')
P.spine_bars([J['neck'][-1], J['neck'][0], J['chest'][-1], J['chest'][0], HIP] + J['tail'], STRIPE, BODY | NECK | TAILR, taper_from=HIP.y + 3)
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
        if q[0] * side < -0.05 or not (y0 - 0.2 < q[1] < y1): continue
        zt, zb = lerp_line(up_l, q[1]), lerp_line(lo_l, q[1])
        if zb - 0.15 < q[2] < zt + 0.15 and abs(P.nrm[iy, ix][0]) < 0.75:
            P.img[iy, ix] = P.col(MOUTH_C)
    P.stroke(up_l, 0.22, INK, wobble=0.03); P.stroke(lo_l, 0.22, INK, wobble=0.03)
P.accents({'teeth': BONE, 'claws': BONE, 'eyes': EYE, 'nostrils': INK})
for e in C.ACC['eyes']:
    P.dab(e + Vector((math.copysign(0.34, e.x), -0.12, 0)), 0.16, INK)
P.paint_scars(INK, BELLY)
P.save(OUT, "rex")

# ---------- rig: the Tyrant's pivots, a bone for every leg segment ----------
G = Rig(C)
G.bone("Body", HIP, J['chest'][0])
G.bone("Chest", J['chest'][0], J['chest'][-1], "Body")
G.chain("Neck", [J['chest'][-1]] + J['neck'], "Chest")   # a bone per neck ring, the bend shared
NECK_BONES = len(J['neck'])
G.bone("Head", J['neck'][-1], J['head'][-1], "Neck.%03d" % (NECK_BONES - 1) if NECK_BONES > 1 else "Neck")
G.bone("Jaw", JAW_PIVOT, J['jaw'][-1], "Head")
G.chain("Tail", [HIP + Vector((0, 3.0, 0))] + J['tail'], "Body", limb='tail')
TAIL_BONES = sum(1 for b in G.arm.edit_bones if b.name.startswith("Tail"))
for key, side in (('leg_l', 'Left'), ('leg_r', 'Right')):
    p = J[key]
    sock = Vector((p[0].x * 0.8, p[0].y, HIP.z - 1.0))
    G.bone(f"Leg{side}", sock, p[1], "Body", limb=key)
    G.bone(f"Shin{side}", p[1], p[2], f"Leg{side}", limb=key)
    G.bone(f"Ankle{side}", p[2], p[3], f"Shin{side}", limb=key)
    G.bone(f"Foot{side}", p[3], p[4], f"Ankle{side}", limb=key)
G.bone("Arms", J['chest'][0] + Vector((0, -1, -1.5)), J['chest'][0] + Vector((0, -1.8, -1.5)), "Chest")
for key, side in (('arm_l', 'Left'), ('arm_r', 'Right')):
    G.bone(f"Arm{side}", J[key][0], J[key][-1], "Arms", limb=key)
G.skin(part_bones={JAW: "Jaw"}, skip=("Arms",))

def walk(n, ph):
    w = ph * 2 * math.pi
    if n == "Body": return (0, 0, 3 * math.sin(w)), (0, 0, -0.35 * abs(math.cos(w)))
    for side in ("Left", "Right"):
        if n.endswith(side) and n[:-len(side)] in ("Leg", "Shin", "Ankle", "Foot"):
            ph_ = w + (0 if side == "Left" else math.pi)
            leg = 11 * math.sin(ph_)
            lift = max(0, math.sin(ph_ + 0.6))
            shin, ankle = -22 * lift, 14 * lift
            foot = -(leg + shin + ankle) * (1 - lift)
            return ({"Leg": leg, "Shin": shin, "Ankle": ankle, "Foot": foot}[n[:-len(side)]], 0, 0), (0, 0, 0)
    if n.startswith("Tail"):
        k = 0 if n == "Tail" else int(n.split('.')[1])
        return (2 * math.sin(w * 2 - k * 0.4), 0, 6 * math.sin(w - k * 0.5)), (0, 0, 0)
    if n.startswith("Neck"): return (4 * math.sin(w * 2 + 0.8) / NECK_BONES, 0, -3 * math.sin(w) / NECK_BONES), (0, 0, 0)
    if n == "Head": return (-3 * math.sin(w * 2 + 1.2), 0, 0), (0, 0, 0)
    if n == "Jaw": return (4 + 3 * math.sin(w * 2), 0, 0), (0, 0, 0)
    return (0, 0, 0), (0, 0, 0)

def roar(n, ph):
    up = ease(min(1, ph * 3)) * (1 - ease(max(0, (ph - 0.75) * 4)))
    shake = math.sin(ph * 70) * up * 2.5
    if n == "Body": return (-4 * up, 0, 0), (0, 0, 0)
    if n == "Chest": return (-6 * up, 0, 0), (0, 0, 0)
    if n.startswith("Neck"): return (-16 * up / NECK_BONES, 0, shake / NECK_BONES), (0, 0, 0)   # the bend split along the chain
    if n == "Head": return (-8 * up + shake, 0, 0), (0, 0, 0)
    if n == "Jaw": return (34 * up, 0, 0), (0, 0, 0)
    if n.startswith("Arm"): return (-12 * up, 0, 0), (0, 0, 0)
    if n.startswith("Tail"): return (12 * up / TAIL_BONES, 0, 3 * shake / TAIL_BONES), (0, 0, 0)   # the lift split along the chain
    return (0, 0, 0), (0, 0, 0)

def bite(n, ph):
    wind = ease(min(1, ph * 3)) if ph < 0.33 else 1 - ease(min(1, (ph - 0.33) * 6))
    lunge = 0 if ph < 0.33 else ease(min(1, (ph - 0.33) * 6)) * (1 - ease(max(0, (ph - 0.6) * 2.5)))
    snap = 1 if 0.42 < ph < 0.6 else 0
    if n == "Body": return (6 * lunge - 4 * wind, 0, 0), (0, -1.2 * lunge, 0)
    if n.startswith("Neck"): return ((-14 * wind + 18 * lunge) / NECK_BONES, 0, 0), (0, 0, 0)
    if n == "Head": return (-8 * wind + 8 * lunge, 0, 0), (0, 0, 0)
    if n == "Jaw": return (32 * wind * (1 - snap) + 24 * lunge * (1 - snap), 0, 0), (0, 0, 0)
    if n.startswith("Tail"): return (4 * lunge, 0, 0), (0, 0, 0)
    return (0, 0, 0), (0, 0, 0)

G.act("walk", 40, walk)
G.act("roar", 48, roar)
G.act("bite", 30, bite)
G.fix_joints()
G.save(OUT, "rex")
