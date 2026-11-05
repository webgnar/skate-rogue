"""The Tyrant (Planet Dirt, The Long Haul finale), built the way zack builds
(STYLE_GUIDE.md) on bb_lib:

  1. block out: one default Cube, extruded out and its verts scaled into the
     hip block, chest, neck, head (knifed across at the mouth into skull and
     lower jaw), tail, legs out of the hip block, arms held wide and forward;
     the skeleton is mirror-true;
  2. knife: brows, cheeks, nose ridge and back ridge cut in and extruded;
  3. clay: the only uneven step;
  4. accents: teeth, tongue, eyes, nostrils, claws, back spikes.
Paint: zack's five colours; every mark sits over a bone of the skeleton, from
the side, front, back and above, so it balances in all three views.
Bones carry the names of the pivots tyrant_boss.gd drives (Body, LegLeft,
LegRight, Tail, Head, Jaw, Arms).

usage: python build_tyrant.py -- <out dir> [seed] [orange|navy]
"""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bb_lib import Creature, Painter, Rig, ease
import bmesh
from mathutils import Vector, Matrix
import numpy as np

args = sys.argv[sys.argv.index('--') + 1:]
OUT = args[0]
SEED = int(args[1]) if len(args) > 1 else 5
SCHEME = args[2] if len(args) > 2 else 'orange'
C = Creature(SEED)
J, R = C.J, C.R
JAW = 1                                   # the lower jaw's part number: skins to the Jaw bone

# ---------- 1. block out ----------
HIP = Vector((0, 0, 10))
C.start_cube((4.8, 4.6, 5.0), HIP)
front = C.run(C.face_where((0, -1, 0)), [
    ((0, -1, 0.15), 3.4, 1.1, 1.05),    # chest, deep
    ((0, -1, 0.6), 2.6, 0.84, 1.0),     # shoulders
], name='chest', region='chest')
front = C.run(front, [
    ((0, -0.5, 1), 2.4, 0.86, 1.0),     # thick neck rises
    ((0, -1, 0.6), 1.6, 0.96, 1.05),
], name='neck', region='neck')

# the head: knife the end of the neck across at the mouth line, extrude the two
# halves out as the skull with its upper jaw and as the lower jaw
nc = front.calc_center_median()
hh = max(v.co.z for v in front.verts) - min(v.co.z for v in front.verts)
MOUTH_Z = nc.z - hh * 0.12
lower_f, upper_f = C.split_face(front, (0, 0, MOUTH_Z))
JAW_PIVOT = Vector((0, nc.y, MOUTH_Z))       # the jaw opens about the back of the mouth line
C.run(upper_f, [
    ((0, -1, 0.3), 1.0, 1.5, 1.65),     # back of the skull flares wide and tall
    ((0, -1, 0.05), 2.2, 1.02, 1.0),    # through the eyes
    ((0, -1, -0.12), 1.8, 0.84, 0.9),   # in front of the eyes, the face narrows
    ((0, -1, -0.08), 2.4, 0.9, 0.9),    # long deep upper jaw
    ((0, -1, -0.1), 1.6, 0.9, 0.88),    # snout
    ((0, -1, -0.4), 0.7, 0.74, 0.72),   # blunt nose
], name='head', region='head', keep=(MOUTH_Z, 1, 2))
C.run(lower_f, [
    ((0, -1, -0.3), 1.0, 1.3, 1.5),     # hinge, under the cheeks
    ((0, -1, -0.5), 2.4, 0.94, 0.95),   # lower jaw hangs open, inside the upper
    ((0, -1, -0.42), 2.4, 0.86, 0.88),
    ((0, -1, -0.3), 2.2, 0.84, 0.84),
    ((0, -1, -0.05), 1.0, 0.74, 0.72),  # chin
], name='jaw', region='head', part=JAW, keep=(MOUTH_Z, -1, 2))

tail = C.run(C.face_where((0, 1, 0)), [
    ((0, 1, 0.05), 3.0, 0.86, 1.0),
    ((0, 1, -0.02), 3.2, 0.82, 0.95),
    ((0, 1, -0.08), 3.4, 0.78, 0.92),
    ((0, 1, -0.1), 3.4, 0.72, 0.9),
    ((0, 1, -0.06), 3.2, 0.6, 0.85),
    ((0, 1, 0.0), 2.6, 0.3, 0.8),
], name='tail', region='tail')
C.end_point(tail, tail.calc_center_median() + Vector((0, 1.2, 0)))

# a boss is fat: the underside sags into a gut, and the legs come out of its
# flanks as one mass with the body (C.gut, C.leg_patches; see their notes)
C.gut(3.6, HIP)
corners = C.leg_patches(HIP)
for side, key in ((-1, 'leg_l'), (1, 'leg_r')):
    n = tuple(corners[side].normal)
    C.run(corners[side], [
        (n, 0.6, 1.0, 1.0, (1.3, 1.05, 1.0), (side * 0.4, 0, 0)),   # haunch: flank and belly swell out as one
        ((-side * 0.05, -0.15, -1), 2.2, 0.92, 1.0),  # big thigh, down and a little forward
        ((side * 0.05, 0.55, -1), 3.0, 0.7, 1.0),     # shin, back
        ((0, -0.15, -1), 1.8, 0.82, 1.0),             # ankle
        ((0, -1, -0.15), 2.6, 1.0, 0.5),              # foot, flat and forward
    ], name=key, region='leg')

# arms: out of the low sides of the chest, held wide and forward so they read
# from the front, the side and the back
for side, key in ((-1, 'arm_l'), (1, 'arm_r')):
    c0 = J['chest'][0]
    f = max((f for f in C.bm.faces if f.normal.x * side > 0.6),
            key=lambda f: -((f.calc_center_median() - Vector((side * 3, c0.y - 1.0, c0.z - 1.2))).length))
    bmesh.ops.inset_region(C.bm, faces=[f], thickness=0.45, depth=0)
    C.run(f, [
        ((side, -0.2, 0.1), 1.0, 0.9, 1.0),              # shoulder bulge
        ((side * 0.9, -0.35, -0.45), 2.4, 0.8, 1.0),     # upper arm, out to the side
        ((side * 0.25, -1, -0.15), 2.2, 0.78, 1.0),      # forearm, reaching forward
        ((side * 0.1, -1, -0.5), 0.9, 0.8, 0.8),         # hand
    ], name=key, region='arm')

# ---------- 2. knife shapes in, extrude them out (head features on head faces only) ----------
eye_y = (J['head'][0].y + J['head'][1].y) / 2
skull_top = max(p.z for p in R['head'][1])
skull_w = max(p.x for p in R['head'][1])
skull = J['head'][1]
head = lambda f: C.on('head', f)
# brows: one strip over the eyes, cut at the same x both sides, each end raised
top = [f for f in C.bm.faces if head(f) and f.normal.z > 0.35 and eye_y - 2.0 < f.calc_center_median().y < eye_y + 1.2]
brows = C.knife_pair(top, [((0, eye_y - 1.6, 0), (0, -1, 0)), ((0, eye_y + 0.9, 0), (0, 1, 0))], skull_w * 0.35)
for side in (-1, 1):
    if brows[side]: C.pull(brows[side], (side * 0.4, 0, 1), 0.7, shrink=0.85)
# cheeks: the side of the skull behind the eye pulled out into a jowl
for side in (-1, 1):
    sides = [f for f in C.bm.faces if head(f) and f.normal.x * side > 0.6
             and J['head'][0].y - 0.3 < f.calc_center_median().y < eye_y + 1.0
             and f.calc_center_median().z < skull.z + 0.3 and not any(v[C.PART] for v in f.verts)]
    jowl = C.knife(sides, [((0, 0, skull.z + 0.2), (0, 0, 1)), ((0, eye_y - 0.4, 0), (0, -1, 0))])
    if jowl: C.pull(jowl, (side, 0, -0.2), 0.45, shrink=0.85)
# nose ridge down the top of the snout
snout = [f for f in C.bm.faces if head(f) and f.normal.z > 0.5 and J['head'][-1].y - 0.2 < f.calc_center_median().y < J['head'][2].y]
ridge = C.knife(snout, [((0.45, 0, 0), (1, 0, 0)), ((-0.45, 0, 0), (-1, 0, 0))])
if ridge: C.pull(ridge, (0, 0, 1), 0.3, shrink=0.92)
# back ridge from the shoulders onto the tail
back = [f for f in C.bm.faces if f.normal.z > 0.55 and J['chest'][-1].y < f.calc_center_median().y < J['tail'][2].y]
ridge = C.knife(back, [((0.55, 0, 0), (1, 0, 0)), ((-0.55, 0, 0), (-1, 0, 0))])
if ridge: C.pull(ridge, (0, 0, 1), 0.55, shrink=0.9)

assert C.mirror_error() < 1e-3, "the skeleton must be mirror-true before the clay"
C.clay()

# ---------- personality: on purpose, once or twice ----------
C.lengthen('arm_l', 1.18)                                   # a longer left arm
th = J['leg_r'][0].lerp(J['leg_r'][1], 0.45)                 # a scar across the outside of the right thigh
C.scar(th + Vector((9, 0.3, 0.3)), (-1, 0, 0), (0, 0.8, 1), 2.8)
BROKEN_SPIKE = 3                                            # and one back spike snapped off

# ---------- 4. accents ----------
def edge_line(rings, side, pick):
    return [pick([p for p in ring if p.x * side > 0.15]) for ring in rings]
def along(line, step):
    out = []
    for a, b in zip(line, line[1:]):
        n = max(1, int((b - a).length / step))
        out += [a.lerp(b, i / n) for i in range(n)]
    return out
MOUTH = {}
for side in (-1, 1):
    up = edge_line(R['head'][1:], side, lambda ps: min(ps, key=lambda p: p.z - abs(p.x) * 0.3))
    lo = edge_line(R['jaw'][1:], side, lambda ps: max(ps, key=lambda p: p.z + abs(p.x) * 0.3))
    MOUTH[side] = (up, lo)
    pts = along(up, 0.62)
    for i, p in enumerate(pts):        # upper teeth: long, curved back, biggest mid-jaw
        t = i / max(1, len(pts) - 1)
        h = 0.55 + 0.6 * math.sin(math.pi * min(1, t * 1.2))
        C.cone(p + Vector((-side * 0.25, 0, 0.15)), (side * 0.05, 0.25, -1), 0.22, h + 0.2, 'teeth')
    pts = along(lo, 0.7)
    for i, p in enumerate(pts):        # lower teeth: shorter, pointing up and in
        t = i / max(1, len(pts) - 1)
        C.cone(p + Vector((-side * 0.22, 0, -0.1)), (-side * 0.1, 0.15, 1), 0.15, 0.45 + 0.35 * math.sin(math.pi * t), 'teeth', part=JAW)
# tongue: a stretched cube lying in the lower jaw
j0, j3 = J['jaw'][1], J['jaw'][3]
mid = (j0 + j3) / 2; dirj = (j3 - j0).normalized()
floor_z = (sum(p.z for p in MOUTH[1][1][:4]) / 4) - 0.55
tm = Matrix.Translation(Vector((0, mid.y, floor_z))) @ Vector((0, -1, 0)).rotation_difference(dirj).to_matrix().to_4x4() @ Matrix.Diagonal((1.3, (j3 - j0).length * 0.55, 0.32, 1))
C.box(tm, 'tongue', part=JAW)
for side in (-1, 1):                    # eyes under the brows, nostrils on the nose
    p = C.skin((side * 8, eye_y - 0.9, skull_top - 1.7), (-side, 0, 0))
    if p is not None: C.ball(p + Vector((side * 0.02, 0, 0)), 0.4, 'eyes')
    p = C.skin((side * 0.7, J['head'][-1].y - 0.2, 30), (0, 0, -1))
    if p is not None: C.ball(p + Vector((0, 0.3, 0)), 0.28, 'nostrils')
for key in ('leg_l', 'leg_r'):          # toe claws, three a foot, two on each hand: each one
    toe = J[key][-1]                    # seated where a ray meets the skin, base sunk a little
    hw = max(abs(p.x - toe.x) for p in R[key][-1])
    for k in (-1, 0, 1):
        d = Vector((k * 0.25, -1, -0.35)).normalized()
        p = C.skin(toe + Vector((k * hw * 0.6, -6, -0.1)), (0, 1, 0))
        if p is not None: C.cone(p - d * 0.25, d, 0.3, 1.1, 'claws')
for key in ('arm_l', 'arm_r'):
    h = J[key][-1]
    for k in (-1, 1):
        d = Vector((k * 0.15, -1, -0.6)).normalized()     # seated on the front of the hand, like the toes
        p = C.skin(h + Vector((k * 0.3, -6, -0.15)), (0, 1, 0))
        if p is not None: C.cone(p - d * 0.2, d, 0.2, 0.9, 'claws')
for i in range(9):                      # spikes along the ridge, shrinking down the tail
    t = i / 8
    y = J['chest'][-1].y + (J['tail'][3].y - J['chest'][-1].y) * t
    p = C.skin((0, y, 30), (0, 0, -1))
    if p is not None:
        h = (1.6 - t * 1.0) * (0.35 if i == BROKEN_SPIKE else 1.0)
        C.cone(p + Vector((0, 0, -0.1)), (0, 0.35, 1), 0.45 - t * 0.25, h, 'spikes', sides=4 if i != BROKEN_SPIKE else 3)
C.connect()                             # final pass: floating accents get a socket extruded from the body
ob, me = C.to_object()

# ---------- paint: zack's palette, marks over the skeleton ----------
NAVY, ORANGE, RED, BROWN, YELLOW = "#0c1c4e", "#ff960d", "#ff000e", "#4c240c", "#ffdf0b"
SCHEMES = {   # zack picked orange (2026-11-04); navy kept for comparison
    #           BASE    BACK   STRIPE  BELLY   BONE    INK    EYE     MOUTH  TONGUE
    'orange': (ORANGE, BROWN, NAVY,   YELLOW, YELLOW, NAVY,  YELLOW, BROWN, RED),
    'navy':   (NAVY,   BROWN, ORANGE, BROWN,  YELLOW, BROWN, YELLOW, RED,   ORANGE),
}
BASE, BACK, STRIPE, BELLY, BONE, INK, EYE, MOUTH_C, TONGUE = SCHEMES[SCHEME]
P = Painter(C, BASE)
PX, PY, PZ, NX = P.PX, P.PY, P.PZ, P.NX
V = P.V
P.broad(min(V[:, 1]), max(V[:, 1]), BACK, 'above', r=1.6, step=0.5)          # darker back
P.broad(J['jaw'][-1].y + 0.3, J['tail'][3].y, BELLY, 'below', r=1.5, step=0.45)  # pale belly, from the chin back

BODY = P.region('body', 'chest'); NECK = P.region('neck'); TAILR = P.region('tail'); HEAD = P.region('head')
LEG = P.region('leg'); ARM = P.region('arm')
top_z = lambda y: P.top_z(y, HIP.z + 4); bot_z = lambda y: P.bot_z(y, HIP.z - 4)
for side in (-1, 1):
    # ribs: down the flank from under the spine, sweeping back, deepest at the front
    y_a, y_b = J['chest'][0].y - 0.6, HIP.y + 1.6
    for i in range(10):
        t = i / 9
        y0 = y_a + (y_b - y_a) * t
        tz, bz = top_z(y0) - 0.7, bot_z(y0)
        reach = 0.9 - 0.45 * t ** 1.5
        P.side_line([(y0 + 1.1 * math.sin(f * math.pi * 0.55), tz - (tz - bz) * reach * f) for f in np.linspace(0, 1, 7)], 0.27, STRIPE, BODY, side)
    # shoulder blade
    a0 = J['arm_l' if side < 0 else 'arm_r'][0]
    ys = J['chest'][-1].y + 1.0
    P.side_line([(ys, top_z(ys) - 0.4), ((ys + a0.y) / 2, (top_z(ys) + a0.z) / 2 + 0.2), (a0.y + 0.3, a0.z + 0.6)], 0.42, STRIPE, BODY | NECK, side)
    # hip: the ilium plate, the pubis reaching down and forward
    iz = top_z(HIP.y) - 1.7
    P.side_oval(HIP.y + 0.4, iz, 3.0, 0.95, BACK, BODY, side, tilt=0.08)
    P.side_line([(HIP.y - 0.6, iz - 0.6), (HIP.y - 2.0, bot_z(HIP.y - 2.0) + 0.6)], 0.35, BACK, BODY, side)
    # neck vertebrae
    for k in range(4):
        y = J['chest'][-1].y + (J['neck'][-1].y - J['chest'][-1].y) * (k + 0.5) / 4
        z0 = top_z(y)
        P.side_line([(y, z0 - 0.3), (y + 0.35, z0 - 1.4)], 0.22, STRIPE, NECK, side)
    # tail: neural spine down from the top and chevron up from below, every vertebra
    tp = [HIP + Vector((0, 2.3, 0))] + J['tail']
    verts = []
    for a, b in zip(tp, tp[1:]): verts += [a.lerp(b, 0.25), a.lerp(b, 0.75)]
    for k, v in enumerate(verts):
        t = k / max(1, len(verts) - 1)
        tz, bz = top_z(v.y), bot_z(v.y); h = tz - bz
        P.side_line([(v.y, tz - 0.15), (v.y + 0.45, tz - h * 0.42 * (1 - 0.4 * t))], 0.24 * (1 - 0.5 * t), STRIPE, TAILR, side)
        P.side_line([(v.y + 0.2, bz + 0.1), (v.y + 0.55, bz + h * 0.26 * (1 - 0.4 * t))], 0.18 * (1 - 0.5 * t), BACK, TAILR, side)
    # skull windows: socket, the opening in front of the eye and behind it, nostril, jaw window
    eye = next((e for e in C.ACC.get('eyes', []) if e.x * side > 0), Vector((0, eye_y, skull_top - 1.7)))
    h2, h3 = J['head'][2], J['head'][3]
    P.side_oval((h2.y + h3.y) / 2 + 0.3, h2.z + 0.15, 1.35, 0.6, STRIPE, HEAD, side, tilt=-0.12)
    P.side_oval(eye.y + 1.5, eye.z - 0.7, 0.75, 1.0, STRIPE, HEAD, side, tilt=0.3)
    P.side_oval(eye.y, eye.z - 0.1, 0.55, 0.85, INK, HEAD, side)
    nz = J['head'][-2]
    P.side_oval(nz.y - 0.1, nz.z + 0.55, 0.5, 0.28, INK, HEAD, side)
    j1 = J['jaw'][1]
    P.side_oval(j1.y + 0.2, j1.z - 0.1, 0.95, 0.35, STRIPE, HEAD & (PZ < j1.z + 0.6), side, tilt=0.35)
    # thigh and shin bones, then the foot bones from above
    L = J['leg_l' if side < 0 else 'leg_r']
    P.side_line([(L[0].y, L[0].z + 0.6), (L[1].y, L[1].z + 0.3)], 0.42, BACK, LEG, side)
    P.side_line([(L[1].y + 0.2, L[1].z - 0.3), (L[2].y, L[2].z + 0.3)], 0.3, BACK, LEG, side)
    f0, f1 = L[3], L[4]
    foot = LEG & (PZ < f0.z + 0.5)
    for k in (-1, 0, 1):
        P.top_line([(f0.x + k * 0.55, f0.y + 0.3), (f1.x + k * 0.7, f1.y - 0.6)], 0.15, STRIPE, foot)
    for yy in (f1.y - 0.1, f1.y - 0.8):
        P.top_line([(f1.x - 1.4, yy), (f1.x + 1.4, yy)], 0.12, STRIPE, foot)
    A = J['arm_l' if side < 0 else 'arm_r']
    P.side_line([(A[0].y, A[0].z), (A[1].y, A[1].z)], 0.18, STRIPE, ARM, side)

# the same skeleton from the front and the back, so all three views balance
V3 = lambda x, z: Vector((x, 0, z))
c0 = J['chest'][0]
P.view_line([V3(-2.3, c0.z + 1.6), V3(0, c0.z - 0.6), V3(2.3, c0.z + 1.6)], 0.3, STRIPE, BODY | NECK, 'front')   # wishbone
for k in range(3):                                                                                          # belly ribs
    z = c0.z - 1.6 - k * 1.1
    P.view_line([V3(-1.9 + k * 0.3, z + 0.7), V3(0, z), V3(1.9 - k * 0.3, z + 0.7)], 0.22, STRIPE, BODY, 'front')
for view in ('front', 'back'):
    for lk in ('leg_l', 'leg_r'):
        L = J[lk]
        P.view_line([L[0] + Vector((0, 0, 0.8)), L[1], L[2]], 0.34, STRIPE, LEG, view)
        P.view_line([L[2], L[3]], 0.26, BACK, LEG, view)
    for ak in ('arm_l', 'arm_r'):
        A = J[ak]
        P.view_line([A[0], A[1], A[2]], 0.2, STRIPE, ARM, view)
tzh = top_z(HIP.y + 1.5)
for sd in (-1, 1):                                                                                          # hip plates, shoulder blades from behind
    P.view_line([V3(sd * 0.9, tzh - 0.2), V3(sd * 2.0, HIP.z + 0.4), V3(sd * 2.4, HIP.z - 1.6)], 0.38, STRIPE, BODY, 'back')
    P.view_line([V3(sd * 1.0, top_z(J['chest'][-1].y) - 0.3), V3(sd * 2.4, c0.z + 0.4)], 0.32, STRIPE, BODY | NECK, 'back')
P.spine_bars([J['neck'][-1], J['neck'][0], J['chest'][-1], J['chest'][0], HIP] + J['tail'], STRIPE, BODY | NECK | TAILR, taper_from=HIP.y + 3)

# the inside of the mouth, between the two mouth edges, and the mouth lines
def lerp_line(line, y):
    pts = sorted(line, key=lambda p: p.y)
    if y <= pts[0].y: return pts[0].z
    for a, b in zip(pts, pts[1:]):
        if y <= b.y: return a.z + (b.z - a.z) * (y - a.y) / max(b.y - a.y, 1e-6)
    return pts[-1].z
for side in (-1, 1):
    up, lo = MOUTH[side]
    y0, y1 = min(p.y for p in up + lo), max(p.y for p in up + lo)
    for iy, ix in zip(*np.nonzero(P.mask)):
        q = P.pos[iy, ix]
        if q[0] * side < -0.05 or not (y0 - 0.2 < q[1] < y1): continue
        zt, zb = lerp_line(up, q[1]), lerp_line(lo, q[1])
        if zb - 0.15 < q[2] < zt + 0.15 and abs(P.nrm[iy, ix][0]) < 0.75:
            P.img[iy, ix] = P.col(MOUTH_C)
    P.stroke(up, 0.22, INK, wobble=0.03); P.stroke(lo, 0.22, INK, wobble=0.03)
P.accents({'teeth': BONE, 'claws': BONE, 'spikes': BONE, 'eyes': EYE, 'tongue': TONGUE, 'nostrils': INK})
for p in C.ACC['spikes']:
    P.dab(p + Vector((0, 0.4, 1.4)), 0.3, INK)
for e in C.ACC['eyes']:
    P.dab(e + Vector((math.copysign(0.36, e.x), -0.12, 0)), 0.17, INK)   # the pupil
P.paint_scars(INK, BELLY)
P.save(OUT, "tyrant")

# ---------- rig: bones named after the game's pivots ----------
G = Rig(C)
G.bone("Body", HIP, J['chest'][0])
G.bone("Chest", J['chest'][0], J['chest'][-1], "Body")
G.bone("Neck", J['chest'][-1], J['neck'][-1], "Chest")
G.bone("Head", J['neck'][-1], J['head'][-1], "Neck")
G.bone("Jaw", JAW_PIVOT, J['jaw'][-1], "Head")
G.chain("Tail", [HIP + Vector((0, 2.2, 0))] + J['tail'], "Body", limb='tail')
for key, side in (('leg_l', 'Left'), ('leg_r', 'Right')):
    p = J[key]
    sock = Vector((p[0].x * 0.8, p[0].y, HIP.z - 0.8))   # the hip socket, inside the body: the
    G.bone(f"Leg{side}", sock, p[1], "Body", limb=key)     # thigh slides round it, not into the flank
    G.bone(f"Shin{side}", p[1], p[2], f"Leg{side}", limb=key)
    G.bone(f"Ankle{side}", p[2], p[3], f"Shin{side}", limb=key)   # a boss is big on screen:
    G.bone(f"Foot{side}", p[3], p[4], f"Ankle{side}", limb=key)   # a bone for every leg segment
G.bone("Arms", J['chest'][0] + Vector((0, -1, -1.5)), J['chest'][0] + Vector((0, -1.8, -1.5)), "Chest")
for key, side in (('arm_l', 'Left'), ('arm_r', 'Right')):
    G.bone(f"Arm{side}", J[key][0], J[key][-1], "Arms", limb=key)
G.skin(part_bones={JAW: "Jaw"}, skip=("Arms",))

# ---------- actions, keyed on every frame ----------
def walk(n, ph):
    w = ph * 2 * math.pi
    if n == "Body": return (0, 0, 3 * math.sin(w)), (0, 0, -0.35 * abs(math.cos(w)))
    for side in ("Left", "Right"):
        if n.endswith(side) and n[:-len(side)] in ("Leg", "Shin", "Ankle", "Foot"):
            ph_ = w + (0 if side == "Left" else math.pi)
            leg = 11 * math.sin(ph_)                       # swing (a fat gut hangs in front of the thigh)
            lift = max(0, math.sin(ph_ + 0.6))             # the leg coming forward bends
            shin = -22 * lift
            ankle = 14 * lift                              # the ankle folds as the foot lifts
            foot = -(leg + shin + ankle) * (1 - lift)      # the foot stays flat while it carries weight
            return ({"Leg": leg, "Shin": shin, "Ankle": ankle, "Foot": foot}[n[:-len(side)]], 0, 0), (0, 0, 0)
    if n.startswith("Tail"):
        k = 0 if n == "Tail" else int(n.split('.')[1])
        return (2 * math.sin(w * 2 - k * 0.4), 0, 6 * math.sin(w - k * 0.5)), (0, 0, 0)
    if n == "Neck": return (4 * math.sin(w * 2 + 0.8), 0, -3 * math.sin(w)), (0, 0, 0)
    if n == "Head": return (-3 * math.sin(w * 2 + 1.2), 0, 0), (0, 0, 0)
    if n == "Jaw": return (4 + 3 * math.sin(w * 2), 0, 0), (0, 0, 0)
    return (0, 0, 0), (0, 0, 0)

def ease(x): return x * x * (3 - 2 * x)
def roar(n, ph):
    """rears up, head high, jaw wide (-X lifts a bone's far end, +X opens the jaw)"""
    up = ease(min(1, ph * 3)) * (1 - ease(max(0, (ph - 0.75) * 4)))
    shake = math.sin(ph * 70) * up * 2.5
    if n == "Body": return (-5 * up, 0, 0), (0, 0, 0)
    if n == "Chest": return (-8 * up, 0, 0), (0, 0, 0)
    if n == "Neck": return (-18 * up, 0, shake), (0, 0, 0)
    if n == "Head": return (-8 * up + shake, 0, 0), (0, 0, 0)
    if n == "Jaw": return (36 * up, 0, 0), (0, 0, 0)
    if n.startswith("Arm"): return (-14 * up, 0, 0), (0, 0, 0)
    if n.startswith("Tail"): return (4 * up, 0, shake), (0, 0, 0)
    return (0, 0, 0), (0, 0, 0)

def bite(n, ph):
    wind = ease(min(1, ph * 3)) if ph < 0.33 else 1 - ease(min(1, (ph - 0.33) * 6))
    lunge = 0 if ph < 0.33 else ease(min(1, (ph - 0.33) * 6)) * (1 - ease(max(0, (ph - 0.6) * 2.5)))
    snap = 1 if 0.42 < ph < 0.6 else 0
    # rears back with the jaw open (-X lifts), then lunges down and forward (+X)
    if n == "Body": return (6 * lunge - 4 * wind, 0, 0), (0, -1.2 * lunge, 0)
    if n == "Neck": return (-14 * wind + 18 * lunge, 0, 0), (0, 0, 0)
    if n == "Head": return (-8 * wind + 8 * lunge, 0, 0), (0, 0, 0)
    if n == "Jaw": return (32 * wind * (1 - snap) + 24 * lunge * (1 - snap), 0, 0), (0, 0, 0)
    if n.startswith("Tail"): return (4 * lunge, 0, 0), (0, 0, 0)           # each of six bones: a counterweight, not a whip
    return (0, 0, 0), (0, 0, 0)


G.act("walk", 40, walk)
G.act("roar", 48, roar)
G.act("bite", 30, bite)
G.fix_joints()                          # loop cut and swell every joint a pose creases
G.save(OUT, "tyrant")
