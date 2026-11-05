"""The Tyrant (sector 2 finale), the one-shot test of the blender-bot skill
(2026-11-04): built in one pass from SKILL.md and PAINTING.md, with the game's
placeholder (godot-sandbox/tools/gen_tyrant.py, the box blockout) as the only
reference. No hand-tuned Tyrant script or .blend was read for this.

The placeholder is a reared tyrannosaur: hips high, the chest and neck rising
forward to a big skull, a long tail sweeping down and back, drumstick legs,
tiny arms held forward, a dorsal ridge. Its pivots (tyrant_boss.gd) are Body,
LegLeft, LegRight, Tail, Head, Head/Jaw and Arms, so those name the bones.

  1. block out from one Cube: chest, neck, the head knifed at the mouth into
     skull and jaw, the tail, a fat gut, legs out of the gut's flanks, arms out
     of the chest;
  2. knife: brows, jaw muscles, a ridge down the back;
  3. clay; personality: a scar across the right thigh, one broken back spike;
  4. accents: teeth, eyes, back spikes, foot and hand claws; connect.
Paint: zack's Tyrant palette, an orange body.

usage: python build_tyrant_oneshot.py -- <out dir> [seed]
"""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bb_lib import Creature, Painter, Rig, ease
from mathutils import Vector
import bmesh, bpy

args = sys.argv[sys.argv.index('--') + 1:]
OUT = args[0]
SEED = int(args[1]) if len(args) > 1 else 7
C = Creature(SEED)
J, R = C.J, C.R
JAW = 1

# ratios measured off the placeholder's side view (41.1 long nose to tail at 0.1 scale)
REF = {'head_len': 0.18, 'head_depth': 0.13, 'body_depth': 0.16, 'height': 0.53}

# ---------- 1. block out ----------
HIP = Vector((0, 0, 11.5))
C.start_cube((5.0, 4.4, 4.8), HIP, round_long=1.1)
neck = C.run(C.face_where((0, -1, 0)), [
    ((0, -1, 0.55), 2.6, 0.95, 1.0),     # chest, rising
    ((0, -1, 0.9), 2.4, 0.85, 0.95),     # upper chest
    ((0, -0.6, 1), 2.2, 0.8, 0.95),      # neck up
    ((0, -1, 0.3), 1.6, 0.92, 1.0),      # neck turns forward
    ((0, -1, 0.0), 0.8, 1.0, 1.0),       # the head's root
], name='neck', region='neck')
nc = neck.calc_center_median()
hh = max(v.co.z for v in neck.verts) - min(v.co.z for v in neck.verts)
MOUTH_Z = nc.z - hh * 0.18
low, up = C.split_face(neck, (0, 0, MOUTH_Z))
JAW_PIVOT = Vector((0, nc.y, MOUTH_Z))
C.run(up, [
    ((0, -1, 0.15), 0.8, 1.5, 1.75),    # the skull swells behind the eyes
    ((0, -1, 0.05), 2.8, 1.0, 1.0),
    ((0, -1, -0.12), 2.4, 0.84, 0.85),   # muzzle
    ((0, -1, -0.2), 1.3, 0.72, 0.78),    # snout
], name='head', region='head', keep=(MOUTH_Z, 1, 2))
C.run(low, [
    ((0, -1, -0.25), 0.8, 1.45, 1.5),    # jaw root, deep under the cheek
    ((0, -1, -0.08), 2.8, 0.95, 0.9),
    ((0, -1, 0.0), 2.4, 0.85, 0.8),
    ((0, -1, 0.05), 1.3, 0.72, 0.75),    # chin
], name='jaw', region='head', part=JAW, keep=(MOUTH_Z, -1, 2))
tail = C.run(C.face_where((0, 1, 0)), [
    ((0, 1, -0.15), 2.4, 0.9, 0.95),     # tail root
    ((0, 1, -0.3), 4.0, 0.82, 0.85),
    ((0, 1, -0.38), 4.0, 0.78, 0.8),
    ((0, 1, -0.42), 4.0, 0.72, 0.75),
    ((0, 1, -0.42), 3.6, 0.65, 0.7),
    ((0, 1, -0.35), 3.0, 0.55, 0.6),
], name='tail', region='tail')
C.end_point(tail, tail.calc_center_median() + Vector((0, 1.4, -0.4)))
C.gut(2.3, HIP)                          # a boss is fat

# legs out of the gut's flanks: haunch along the patch's own normal, then down
pats = C.leg_patches(HIP)
LEGS = {}
for side in (-1, 1):
    key = 'leg_l' if side < 0 else 'leg_r'
    C.run(pats[side], [
        (tuple(pats[side].normal), 0.6, 1, 1, (1.3, 1.05, 1), (side * 0.4, 0, 0)),   # haunch
        ((side * 0.25, -0.35, -1), 2.6, 0.82, 1.0),     # thigh, a drumstick
        ((side * 0.05, 0.5, -1), 3.0, 0.68, 1.0),       # shin, back down
        ((0, -0.35, -1), 1.6, 0.85, 1.0),               # ankle
        ((0, -1, -0.2), 2.2, 0.95, 0.55),               # foot, flat and forward
    ], name=key, region='leg')
    LEGS[key] = side

# tiny arms out of the lower chest, held wide and forward
nk = J['neck']
chest = [f for f in C.bm.faces if C.on('neck', f) and abs(f.normal.x) > 0.3]
y0, y1 = nk[0].y - 0.6, nk[1].y + 0.6
zc = nk[0].z - 0.2
apats = C.knife_pair(chest, [((0, y1, 0), (0, -1, 0)), ((0, y0, 0), (0, 1, 0)),
                             ((0, 0, zc + 0.8), (0, 0, 1)), ((0, 0, zc - 0.8), (0, 0, -1))], 1.2)
ARMS = {}
for side in (-1, 1):
    fs = apats[side]
    if not fs: print("ARM patch missing", side); continue
    f = fs[0] if len(fs) == 1 else bmesh.ops.dissolve_faces(C.bm, faces=fs)['region'][0]
    key = 'arm_l' if side < 0 else 'arm_r'
    C.run(f, [
        ((side, -0.3, -0.1), 0.5, 0.8, 1.0),            # shoulder
        ((side * 0.6, -1, -0.5), 1.8, 0.7, 1.0),        # upper arm, forward and out
        ((side * 0.2, -1, 0.1), 1.3, 0.75, 1.0),        # forearm
        ((side * 0.1, -1, -0.3), 0.6, 0.8, 1.0),        # hand
    ], name=key, region='arm')
    ARMS[key] = side

if os.environ.get('BLOCKOUT_ONLY'):
    off = C.proportions(REF)
    print("PROPORTIONS OFF", off)
    C.mirror_error()
    ob, me = C.to_object()
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "blockout.blend"))
    sys.exit(0)
off = C.proportions(REF)
print("PROPORTIONS OFF", off)

# ---------- 2. knife shapes in, extrude them ----------
hd = J['head']
hw = max(abs(p.x) for p in R['head'][1])
top = [f for f in C.bm.faces if C.on('head', f) and f.normal.z > 0.35 and hd[0].y + 0.2 > f.calc_center_median().y > hd[1].y - 1.4]
brows = C.knife_pair(top, [((0, hd[1].y - 1.2, 0), (0, -1, 0)), ((0, hd[0].y, 0), (0, 1, 0))], hw * 0.35)
for side in (-1, 1):
    if brows[side]: C.pull(brows[side], (side * 0.4, 0, 1), 0.5, shrink=0.85)
# jaw muscles: a bulge on each cheek behind the eye
cheek = [f for f in C.bm.faces if C.on('head', f) and abs(f.normal.x) > 0.6 and f.calc_center_median().y > hd[1].y - 0.2]
cheeks = C.knife_pair(cheek, [((0, 0, MOUTH_Z + 1.6), (0, 0, 1)), ((0, 0, MOUTH_Z + 0.25), (0, 0, -1))], hw * 0.5)
for side in (-1, 1):
    if cheeks[side]: C.pull(cheeks[side], (side, 0, 0), 0.35, shrink=0.9)
# a ridge down the back, neck to tail
keel = [f for f in C.bm.faces if (C.on('body', f) or C.on('neck', f) or C.on('tail', f)) and f.normal.z > 0.55]
keel = C.knife(keel, [((0.45, 0, 0), (1, 0, 0)), ((-0.45, 0, 0), (-1, 0, 0))])
if keel: C.pull(keel, (0, 0, 1), 0.45, shrink=0.92)

assert C.mirror_error() < 1e-3, "the skeleton must be mirror-true before the clay"
C.clay(jitter=0.05, lumps=7, box=((-3, 3), (-8, 12), (6, 16)), lump_r=(1.5, 2.8), lump_amt=(-0.2, 0.25))

# ---------- personality ----------
lg = J['leg_r']                                     # an old slash across the right thigh
C.scar((10, (lg[0].y + lg[1].y) / 2, (lg[0].z + lg[1].z) / 2 + 0.3), (-1, 0, 0), (0, 1, 0.6), 2.8)

# ---------- accents ----------
# back spikes along the ridge, tallest over the hips, one snapped off
ridge = [J['neck'][2], J['neck'][1], J['neck'][0], HIP + Vector((0, -1.5, 0)), HIP + Vector((0, 1.5, 0))] + J['tail'][:5]
pts = []
for a, b in zip(ridge, ridge[1:]):
    pts += [a.lerp(b, t) for t in (0.25, 0.75)]
BROKEN = 7
for i, q in enumerate(pts):
    p = C.skin(Vector((0, q.y, q.z + 12)), (0, 0, -1))
    if p is None: continue
    t = i / (len(pts) - 1)
    h = 1.6 * (1 - abs(t - 0.4) * 1.4) + 0.4
    if i == BROKEN: h *= 0.35                       # the broken one
    C.cone(p - Vector((0, 0, 0.05)), (0, 0.35, 1), 0.3 * (h / 1.6 + 0.3), h, 'spikes', sides=4)
# teeth on both mouth edges, from the ring logs
for side in (-1, 1):
    for k, ring in enumerate(R['head'][1:]):
        if k == 0: continue                         # the mouth's corner: no tooth in the cheek
        lowest = min((p for p in ring if p.x * side > 0), key=lambda p: p.z)
        for t in (0.0, 0.5):
            if k == len(R['head']) - 2 and t > 0: continue
            q = lowest if t == 0 else lowest.lerp(min((p for p in R['head'][k + 2] if p.x * side > 0), key=lambda p: p.z), 0.5)
            q = q + Vector((-side * 0.25, 0, 0.1))
            C.cone(q, (0, 0, -1), 0.22, 0.9 if k < 2 else 0.7, 'teeth')
    for k, ring in enumerate(R['jaw'][1:]):
        highest = max((p for p in ring if p.x * side > 0), key=lambda p: p.z)
        q = highest + Vector((-side * 0.3, 0, -0.1))
        C.cone(q, (0, 0, 1), 0.2, 0.65, 'teeth', part=JAW)
    # eyes under the brows
    ey = hd[1].y + 0.3
    p = C.skin((side * 8, ey, hd[1].z + 0.5), (-side, 0, 0))
    if p is not None: C.ball(p + Vector((side * 0.1, 0, 0)), 0.45, 'eyes')
# foot claws, three forward, one back
for key, side in LEGS.items():
    tip = J[key][-1]
    rw = max((q - tip).length for q in R[key][-1])
    for dx in (-0.6, 0.0, 0.6):
        o = tip + Vector((dx * rw, -0.4, 0.2))
        p = C.skin(o + Vector((0, -6, 0)), (0, 1, 0))
        if p is not None: C.cone(p - Vector((0, -0.15, 0)), (dx * 0.3, -1, -0.3), 0.3, 1.1, 'claws')
for key, side in ARMS.items():
    tip = J[key][-1]
    for dx in (-0.2, 0.2):
        p = C.skin(tip + Vector((dx, -5, 0)), (0, 1, 0))
        if p is not None: C.cone(p - Vector((0, -0.1, 0)), (dx, -1, -0.6), 0.16, 0.6, 'claws')
C.connect()
ob, me = C.to_object()

# UV as PAINTING.md says: Smart UV 80, average island scale, pack islands
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(80), island_margin=0.0)
bpy.ops.uv.average_islands_scale()
bpy.ops.uv.pack_islands(rotate=True, rotate_method='ANY', scale=True, margin_method='FRACTION', margin=0.004, shape_method='CONCAVE')
bpy.ops.object.mode_set(mode='OBJECT')

# ---------- paint pass 1: zack's Tyrant palette, orange body ----------
NAVY, ORANGE, RED, BROWN, YELLOW = "#0c1c4e", "#ff960d", "#ff000e", "#4c240c", "#ffdf0b"
P = Painter(C, ORANGE, size=1024)
V = P.V
P.broad(min(V[:, 1]), max(V[:, 1]), RED, 'above', r=1.4, step=0.45)       # darker back
P.broad(J['jaw'][-1].y + 2.5, J['tail'][2].y, YELLOW, 'below', r=1.5, step=0.45)   # belly
BODY = P.region('body'); NECK = P.region('neck'); HEAD = P.region('head'); TAIL = P.region('tail')
LEG = P.region('leg'); ARM = P.region('arm')
TRUNK = BODY | NECK | TAIL
# vertebrae: a bar per vertebra neck to tail tip
P.spine_bars([J['neck'][-1], J['neck'][2], J['neck'][0], HIP + Vector((0, -2, 0)), HIP + Vector((0, 2, 0))] + J['tail'],
             NAVY, TRUNK | HEAD, every=1.1, width=1.5, taper_from=8, taper=0.06)
for side in (-1, 1):
    # ribs down the flanks, from the spine down and back
    for k in range(6):
        y = J['neck'][0].y + 0.6 + k * 1.15
        tz = P.top_z(y, HIP.z + 2)
        P.side_line([(y, tz - 0.6), (y + 0.5, tz - 2.2), (y + 0.9, tz - 3.6)], 0.2, NAVY, TRUNK, side)
    # hip plate (ilium) over the thigh root
    P.side_oval(0.3, HIP.z + 0.2, 2.0, 1.0, NAVY, BODY | LEG, side, tilt=-0.2)
    # tail chevrons hanging under each tail vertebra
    for a, b in zip(J['tail'], J['tail'][1:]):
        m = a.lerp(b, 0.5)
        bz = P.bot_z(m.y, m.z - 1)
        P.side_line([(m.y - 0.3, m.z - 0.2), (m.y + 0.2, bz + 0.3)], 0.17, NAVY, TAIL, side)
    # skull windows: the eye socket, the opening in front of it, the one behind, the nostril, the jaw window
    eye = next((e for e in C.ACC.get('eyes', []) if e.x * side > 0), None)
    if eye is not None:
        P.side_oval(eye.y, eye.z, 0.8, 0.75, NAVY, HEAD, side)
        P.side_oval(eye.y - 2.0, eye.z - 0.4, 1.1, 0.55, NAVY, HEAD, side, tilt=0.15)   # antorbital
        P.side_oval(eye.y + 1.4, eye.z - 0.2, 0.55, 0.6, NAVY, HEAD, side)              # behind the eye
    P.side_oval(hd[-1].y + 0.7, hd[-1].z + 0.2, 0.35, 0.25, NAVY, HEAD, side)           # nostril
    jw = J['jaw']
    P.side_oval((jw[1].y + jw[2].y) / 2, jw[1].z - 0.2, 0.9, 0.35, NAVY, HEAD, side)    # jaw window
    # leg bones: a line down femur, tibia, the long foot bones; a ring at each joint
    L = J['leg_l' if side < 0 else 'leg_r']
    P.side_line([(p.y, p.z) for p in L[1:]], 0.22, NAVY, LEG, side)
    A = J['arm_l' if side < 0 else 'arm_r']
    P.side_line([(p.y, p.z) for p in A], 0.15, NAVY, ARM, side)
for key in list(LEGS) + list(ARMS):
    for p in J[key][1:-1]:
        P.dab(p, 0.55, BROWN)
# front: the wishbone and belly ribs (gastralia), the leg bones; back: hip plates and leg bones
nk0 = J['neck'][0]
P.view_line([Vector((-1.6, 0, nk0.z + 0.6)), Vector((0, 0, nk0.z - 1.0)), Vector((1.6, 0, nk0.z + 0.6))], 0.25, NAVY, TRUNK, 'front')
for k in range(4):
    z = nk0.z - 2.0 - k * 1.1
    P.view_line([Vector((-2.2 + k * 0.2, 0, z)), Vector((0, 0, z - 0.4)), Vector((2.2 - k * 0.2, 0, z))], 0.2, NAVY, TRUNK, 'front')
for view in ('front', 'back'):
    for key in LEGS:
        P.view_line(J[key][1:], 0.22, NAVY, LEG, view)
for side in (-1, 1):
    P.view_line([Vector((side * 0.6, 0, HIP.z + 1.6)), Vector((side * 2.6, 0, HIP.z)), Vector((side * 2.2, 0, HIP.z - 1.4))], 0.25, NAVY, BODY | TAIL, 'back')
P.view_line([Vector((-1.2, 0, hd[1].z + 0.9)), Vector((0, 0, hd[-1].z + 0.4)), Vector((1.2, 0, hd[1].z + 0.9))], 0.2, NAVY, HEAD, 'front')
# the skull's top: the midline suture and the brow bones
P.top_line([(0, hd[-1].y), (0, hd[0].y)], 0.18, NAVY, HEAD)
P.accents({'teeth': YELLOW, 'eyes': YELLOW, 'spikes': NAVY, 'claws': BROWN})
for e in C.ACC['eyes']:
    P.dab(e + Vector((math.copysign(0.4, e.x), -0.05, 0)), 0.2, RED)
for i, sp in enumerate(C.ACC['spikes']):
    P.dab(sp + Vector((0, 0.2, 0.9)), 0.3, RED)          # a red root to each spike
P.paint_scars(BROWN, YELLOW)
P.save(OUT, "tyrant_oneshot")

# ---------- rig: the game's pivots, a bone per leg segment ----------
G = Rig(C)
G.bone("Body", HIP + Vector((0, 2.0, 0)), HIP + Vector((0, -2.0, 0)))
G.chain("Neck", [HIP + Vector((0, -2.0, 0))] + J['neck'][1:4], "Body", limb='neck')
G.bone("Head", J['neck'][3], J['head'][-1], "Neck.002")
G.bone("Jaw", JAW_PIVOT, J['jaw'][-1], "Head")
G.chain("Tail", [HIP + Vector((0, 2.0, 0))] + J['tail'], "Body", limb='tail')
for key, side in LEGS.items():
    L = J[key]; sd = 'Left' if side < 0 else 'Right'
    G.bone("Leg" + sd, L[0] + Vector((0, 0, 1.0)), L[1], "Body", limb=key)
    G.bone("Shin" + sd, L[1], L[2], "Leg" + sd, limb=key)
    G.bone("Ankle" + sd, L[2], L[3], "Shin" + sd, limb=key)
    G.bone("Foot" + sd, L[3], L[4], "Ankle" + sd, limb=key)
for key, side in ARMS.items():
    A = J[key]; sd = 'Left' if side < 0 else 'Right'
    G.bone("Arm" + sd, A[0], A[2], "Neck", limb=key)
    G.bone("Hand" + sd, A[2], A[3], "Arm" + sd, limb=key)
G.skin(part_bones={JAW: "Jaw"})


# ---------- actions ----------
def leg_walk(n, w):
    right = n.endswith("Right")
    ph = w + (math.pi if right else 0)
    s, c = math.sin(ph), math.cos(ph)
    lift = max(0.0, -c)                     # the swing half
    if n.startswith("Leg"): return (-15 * s, 0, 0)
    if n.startswith("Shin"): return (-18 * lift, 0, 0)
    if n.startswith("Ankle"): return (22 * lift, 0, 0)
    if n.startswith("Foot"): return (22 * s * (1 - lift) - 18 * lift, 0, 0)     # flat while it carries weight
    return None

def walk(n, ph):
    w = ph * 2 * math.pi
    r = leg_walk(n, w)
    if r is not None: return r, (0, 0, 0)
    if n == "Body": return (0, 4 * math.sin(w), 3 * math.sin(w)), (0, 0, -0.25 * abs(math.cos(w)))
    if n.startswith("Tail"):
        k = int(n.split('.')[1]) if '.' in n else 0
        return (0, 0, 6 * math.sin(w - 0.6 - k * 0.45)), (0, 0, 0)
    if n.startswith("Neck"): return (2 * math.sin(w * 2), 0, -3 * math.sin(w + 0.4)), (0, 0, 0)
    if n == "Head": return (-3 * math.sin(w * 2 + 0.8), 0, -3 * math.sin(w + 0.8)), (0, 0, 0)
    if n == "Jaw": return (6 + 3 * math.sin(w * 2), 0, 0), (0, 0, 0)
    if n.startswith("Arm"): return (8 * math.sin(w + 1.0), 0, 0), (0, 0, 0)
    if n.startswith("Hand"): return (8 * math.sin(w + 1.6), 0, 0), (0, 0, 0)
    return (0, 0, 0), (0, 0, 0)

def bite(n, ph):
    """rears back, jaw opening, then lunges down and snaps shut, and settles"""
    settle = 1 - ease(max(0, (ph - 0.65) / 0.35))
    wind = ease(min(1, ph / 0.4)) * settle
    lunge = ease(min(1, max(0, (ph - 0.4) / 0.15))) * settle
    snap = ease(min(1, max(0, (ph - 0.5) / 0.08)))
    if n.startswith("Neck"): return ((-12 * wind * (1 - lunge) + 14 * lunge) / 3, 0, 0), (0, 0, 0)
    if n == "Head": return (-10 * wind * (1 - lunge) + 12 * lunge, 0, 0), (0, 0, 0)
    if n == "Jaw": return ((34 * wind) * (1 - snap) + 4 * settle * snap, 0, 0), (0, 0, 0)
    if n == "Body": return (-5 * wind * (1 - lunge) + 6 * lunge, 0, 0), (0, -0.8 * lunge, 0)
    if n.startswith("Tail"): return (5 * wind * (1 - lunge) - 4 * lunge, 0, 0), (0, 0, 0)
    if n.startswith("Arm"): return (-8 * wind + 10 * lunge, 0, 0), (0, 0, 0)
    if n.startswith("Shin"): return (8 * lunge, 0, 0), (0, 0, 0)
    if n.startswith("Leg"): return (-8 * lunge, 0, 0), (0, 0, 0)
    return (0, 0, 0), (0, 0, 0)

def tail_swipe(n, ph):
    """winds the tail one way, then sweeps it hard the other, body twisting into it"""
    settle = 1 - ease(max(0, (ph - 0.7) / 0.3))
    wind = ease(min(1, ph / 0.35)) * settle
    sweep = ease(min(1, max(0, (ph - 0.35) / 0.2))) * settle
    a = 22 * wind * (1 - sweep) - 30 * sweep
    if n.startswith("Tail"):
        k = int(n.split('.')[1]) if '.' in n else 0
        lag = 1 + k * 0.15
        return (0, 0, a * lag * 0.22), (0, 0, 0)
    if n == "Body": return (0, 0, -a * 0.35), (0, 0, 0)
    if n.startswith("Neck"): return (0, 0, a * 0.07), (0, 0, 0)
    if n == "Head": return (0, 0, a * 0.25), (0, 0, 0)
    if n == "Jaw": return (8 * sweep, 0, 0), (0, 0, 0)
    if n.startswith("Shin"): return (6 * wind, 0, 0), (0, 0, 0)
    if n.startswith("Leg"): return (-5 * wind, 0, 0), (0, 0, 0)
    return (0, 0, 0), (0, 0, 0)

def roar(n, ph):
    """rears up, head back and jaw wide (the fire breath's wind-up), holds, shakes, settles"""
    up = ease(min(1, ph / 0.3)) * (1 - ease(max(0, (ph - 0.75) / 0.25)))
    shake = math.sin(ph * 2 * math.pi * 7) * up * (1 if 0.3 < ph < 0.75 else 0)
    if n == "Body": return (-8 * up, 0, 0), (0, 0, 0.4 * up)
    if n.startswith("Neck"): return (-4 * up, 0, 0.7 * shake), (0, 0, 0)
    if n == "Head": return (-8 * up + 3 * shake, 0, 3 * shake), (0, 0, 0)
    if n == "Jaw": return (38 * up, 0, 0), (0, 0, 0)
    if n.startswith("Arm"): return (-10 * up, 0, 0), (0, 0, 0)
    if n.startswith("Hand"): return (-15 * up, 0, 0), (0, 0, 0)
    if n.startswith("Tail"): return (2.5 * up, 0, 0.8 * shake), (0, 0, 0)
    if n.startswith("Leg"): return (6 * up, 0, 0), (0, 0, 0)
    if n.startswith("Shin"): return (-6 * up, 0, 0), (0, 0, 0)
    return (0, 0, 0), (0, 0, 0)

G.act("walk", 40, walk)
G.act("bite", 36, bite)
G.act("tail_swipe", 36, tail_swipe)
G.act("roar", 48, roar)
G.fix_joints()
G.save(OUT, "tyrant_oneshot")
