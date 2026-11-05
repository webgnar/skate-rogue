"""The Skimmer (Planet Dirt, The Stranded), the first flyer: a winged alien that
skims over every wall straight for the mech. One-shot from SKILL.md and bb_lib.

Reference: the game's own block-out (scenes/models/skimmer_body.tscn), the only
one there is: a broad flat body, wings out to twice the body's length each side
with a little dihedral and hooked tips, a crest over the head end, two talons
hanging under the belly with a glow between them, and a tail ending in a
glowing bulb (the scene's green light sits at the tail). The game turns the
model so its +Z faces the target, which is Blender's -Y: the head is at -Y.

  1. block out from one Cube: head knifed at the mouth into skull and jaw, a
     tail tapering to the bulb, two wings out of the body block's sides (each
     a flattened tube, chord widening then sweeping back to a tip), two talons
     out of the belly;
  2. knife: a crest down the back, brows over the eyes, the belly's glow sac;
  3. clay; personality: a longer left talon, a broken right mandible and a
     scar across the right wing; accents: eyes, mandibles, wing-edge hooks,
     wing-tip claws, talon claws, the tail bulb; connect.
Paint from the skeleton: the wing's finger bones radiating to the trailing
edge, back plates and tail vertebrae, the ribs, skull windows, talon bones.

PALETTE IS PROVISIONAL: zack asked for "kinda colorful", like his own; it is
five swatches of our own (teal, plum, magenta, lime, cream), not his.

usage: python build_skimmer.py -- <out dir> [seed]
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

# ratios off the game's block-out, each against nose to tail (37 units there)
REF = {'head_len': 0.22, 'head_depth': 0.14, 'body_depth': 0.22, 'height': 0.45}

# ---------- 1. block out ----------
BODY0 = Vector((0, 0, 8))
C.start_cube((4.4, 5.6, 3.8), BODY0, round_long=0.9)
front = C.run(C.face_where((0, -1, 0)), [
    ((0, -1, 0.05), 0.45, 0.86, 0.95),  # short neck under the crest, two rings so the throat folds
    ((0, -1, 0.05), 0.45, 0.9, 0.97),
], name='neck', region='head')
nc = front.calc_center_median()
hh = max(v.co.z for v in front.verts) - min(v.co.z for v in front.verts)
MOUTH_Z = nc.z - hh * 0.12
low, up = C.split_face(front, (0, 0, MOUTH_Z))
JAW_PIVOT = Vector((0, nc.y, MOUTH_Z))
C.run(up, [
    ((0, -1, 0.1), 0.5, 1.2, 1.1),     # skull swells over the jaw hinge
    ((0, -1, 0.0), 2.0, 1.0, 1.0),
    ((0, -1, -0.3), 1.4, 0.7, 0.75),    # face slopes down to a beak
    ((0, -1, -0.4), 0.6, 0.55, 0.6),
], name='head', region='head', keep=(MOUTH_Z, 1, 2))
C.run(low, [
    ((0, -1, -0.15), 0.5, 1.15, 1.1),
    ((0, -1, -0.1), 2.2, 0.85, 0.8),
    ((0, -1, 0.0), 1.0, 0.6, 0.65),
], name='jaw', region='head', part=JAW, keep=(MOUTH_Z, -1, 2))
tail = C.run(C.face_where((0, 1, 0)), [
    ((0, 1, 0.05), 1.4, 0.85, 0.9),     # rump
    ((0, 1, 0.0), 2.0, 0.68, 0.8),
    ((0, 1, 0.05), 1.9, 0.62, 0.8),
    ((0, 1, 0.1), 1.9, 0.62, 0.85),
    ((0, 1, 0.1), 1.6, 0.7, 0.9),       # whip
], name='tail', region='tail')
C.end_point(tail, tail.calc_center_median() + Vector((0, 0.5, 0.05)))

# the wings: each side face of the body block, grown out as a flattened tube
WINGS = {}
for side in (-1, 1):
    f = C.face_where((side, 0, 0))
    key = f"wing_{'l' if side < 0 else 'r'}"
    C.run(f, [
        ((side, 0.0, 0.35), 1.0, 1.0, 0.7, (1, 1.1, 1)),          # shoulder, a little dihedral
        ((side, 0.1, 0.32), 3.2, 0.95, 0.6, (1, 1.15, 1)),         # inner wing, chord widens, thins
        ((side, 0.35, 0.05), 3.4, 0.72, 0.8),                      # outer wing sweeps back
        ((side, 0.7, -0.15), 2.6, 0.45, 0.85),                     # hooked tip
    ], name=key, region='wing')
    WINGS[key] = side

# two talons out of the belly, either side of the glow sac
TALONS = {}
under = [f for f in C.bm.faces if C.on('body', f) and f.normal.z < -0.6]
pats = C.knife_pair(under, [((0, -0.4, 0), (0, 1, 0)), ((0, -1.6, 0), (0, -1, 0)),
                             ((1.35, 0, 0), (1, 0, 0)), ((-1.35, 0, 0), (-1, 0, 0))], 0.45)
for side in (-1, 1):
    fs = pats[side]
    face = fs[0] if len(fs) == 1 else bmesh.ops.dissolve_faces(C.bm, faces=fs)['region'][0]
    C.bm.normal_update()
    key = f"talon_{'l' if side < 0 else 'r'}"
    C.run(face, [
        (tuple(face.normal), 0.5, 1.0, 1.0, (1.15, 1.05, 1)),      # haunch along the patch's own normal
        ((side * 0.25, -0.3, -1), 2.6, 0.75, 1.0),                # leg hangs down and forward
        ((side * 0.1, -1, -0.5), 1.4, 0.7, 1.0),                   # grasping foot reaching forward
    ], name=key, region='talon')
    TALONS[key] = side

off = C.proportions(REF)
if off: print("PROPORTIONS OFF", off)
if os.environ.get('BLOCKOUT_ONLY'):
    C.to_object(); bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "skimmer_blockout.blend")); sys.exit(0)

# ---------- 2. knife shapes in, extrude them ----------
# the crest: a strip down the middle of the back, from the neck to the rump
top = [f for f in C.bm.faces if (C.on('body', f) or C.on('tail', f)) and f.normal.z > 0.6
       and f.calc_center_median().y < J['tail'][1].y]
crest = C.knife(top, [((0.45, 0, 0), (1, 0, 0)), ((-0.45, 0, 0), (-1, 0, 0)),
                      ((0, -2.4, 0), (0, -1, 0))])
if crest: C.pull(crest, (0, 0, 1), 1.0, shrink=0.85)
# brows over the eyes, both sides together
hd = J['head']
hw = max(p.x for p in R['head'][1])
htop = [f for f in C.bm.faces if C.on('head', f) and f.normal.z > 0.4
        and hd[0].y + 0.1 > f.calc_center_median().y > hd[1].y - 0.4]
brows = C.knife_pair(htop, [((0, hd[1].y - 0.4, 0), (0, -1, 0)), ((0, hd[0].y + 0.1, 0), (0, 1, 0))], hw * 0.3)
for side in (-1, 1):
    if brows[side]: C.pull(brows[side], (side * 0.4, -0.2, 1), 0.35, shrink=0.85)
# the glow sac under the belly, behind the talons
belly = [f for f in C.bm.faces if C.on('body', f) and f.normal.z < -0.6]
sac = C.knife(belly, [((0.8, 0, 0), (1, 0, 0)), ((-0.8, 0, 0), (-1, 0, 0)),
                      ((0, 0.4, 0), (0, -1, 0)), ((0, 2.2, 0), (0, 1, 0))])
SAC_C = None
if sac:
    nv = C.pull(sac, (0, 0, -1), 0.5, shrink=0.8)
    SAC_C = sum((v.co for v in nv), Vector()) / len(nv)

assert C.mirror_error() < 1e-3, "the skeleton must be mirror-true before the clay"
C.clay(jitter=0.035, lumps=5, box=((-2.5, 2.5), (-4, 6), (6, 10)), lump_r=(0.9, 1.8), lump_amt=(-0.12, 0.15))

# ---------- personality ----------
C.lengthen('talon_l', 1.15)                         # the left talon hangs longer: it grabs first
w1 = J['wing_r'][1]                                 # an old tear across the right wing's top
C.scar(w1 + Vector((0.8, 0.4, 6)), (0, 0, -1), (0.4, 1, 0), 2.2, width=0.2, depth=0.12)

# ---------- accents ----------
for side in (-1, 1):
    # eyes in the skull's sides under the brows, a third of the way along
    ey = hd[0].y + (hd[1].y - hd[0].y) * 0.7
    p = C.skin((side * 8, ey, hd[1].z + 0.15), (-side, 0, 0))
    if p is not None: C.ball(p + Vector((side * 0.15, 0, 0)), 0.42, 'eyes')
    # mandibles from the jaw tip; the right one broken off short
    j = J['jaw'][-1]
    C.cone(j + Vector((side * 0.45, 0.25, 0.05)), (side * 0.4, -1, 0.15), 0.22,
           1.3 if side < 0 else 0.55, 'mandibles', part=JAW)
for key, side in WINGS.items():
    W = J[key]
    # hooks along the leading edge, one per joint of the wing
    for k in (1, 2):
        ring = R[key][k]
        lead = min(ring, key=lambda q: q.y)
        C.cone(lead + Vector((0, 0.15, 0)), (side * 0.3, -1, 0.1), 0.2, 0.8, 'hooks')
    # the claw at the wing's tip
    tip = (W[-1] - W[-2]).normalized()
    C.cone(W[-1] + tip * 0.05, tip, 0.18, 0.9, 'claws')
for key, side in TALONS.items():
    t = J[key][-1]
    hwid = min((q - t).length for q in R[key][-1])
    for dx in (-0.25, 0.25):                         # two hooked claws per foot
        C.cone(t + Vector((dx, -0.05, 0)), (dx * 0.6, -0.6, -1), min(0.2, hwid * 0.5), 0.8, 'claws')
C.ball(J['tail'][-1] + Vector((0, 0.45, 0.05)), 0.6, 'bulb')   # the glowing tail bulb
C.connect()
ob, me = C.to_object()

# ---------- paint pass 1 (PROVISIONAL palette, zack: "kinda colorful") ----------
TEAL, PLUM, MAGENTA, LIME, CREAM = "#17a89b", "#2e1046", "#e02a7c", "#b9ef2a", "#ffe8b0"
P = Painter(C, TEAL, size=512)
V = P.V
BODY = P.region('body'); HEAD = P.region('head'); TAIL = P.region('tail')
WING = P.region('wing'); TAL = P.region('talon')
P.img[WING & P.mask] = P.col(MAGENTA)                      # the wing membrane
P.broad(min(V[:, 1]), J['tail'][-1].y, PLUM, 'above', r=0.9, step=0.4)   # darker back
P.broad(J['jaw'][0].y + 0.3, J['tail'][1].y, CREAM, 'below', r=0.9, step=0.35)  # pale belly
# the wing's bones, the way a bat's run: the arm along the leading edge to the
# wrist, and the fingers fanning from the wrist to the trailing edge
for key, side in WINGS.items():
    lead = [min(r, key=lambda q: q.y) + Vector((0, 0.3, 0)) for r in R[key]]
    trail = [max(r, key=lambda q: q.y) for r in R[key]]
    wrist = lead[2]
    fingers = [[(wrist.x, wrist.y), (t.x, t.y)] for t in trail[1:]] + [[(wrist.x, wrist.y), (lead[-1].x, lead[-1].y)]]
    arm = [(q.x, q.y) for q in lead[:3]]
    P.top_line(arm, 0.22, PLUM, WING)
    for f in fingers: P.top_line(f, 0.15, PLUM, WING)
    under = P.mask & WING & (P.NZ < -0.3)               # the underside carries the same bones
    for f in [arm] + fingers:
        P.img[under & P._line_mask(P.PX, P.PY, P._wob(f, 0.04), 0.16)] = P.col(PLUM)
    for q in lead[1:3]: P.dab(q, 0.3, CREAM)            # elbow and wrist knuckles
    P.view_line(lead, 0.18, PLUM, WING, 'front')
    P.view_line(trail, 0.16, PLUM, WING, 'back')
# back plates down the spine to the bulb, and the tail's vertebrae
spine = [J['head'][1], J['neck'][0], BODY0 + Vector((0, -2, 0)), BODY0, BODY0 + Vector((0, 2.4, 0))] + J['tail']
P.spine_bars(spine, CREAM, BODY | HEAD | TAIL, every=0.9, width=0.9, taper_from=J['tail'][0].y, taper=0.1)
for side in (-1, 1):
    # ribs down the flank under the wing root
    for k in range(4):
        y = -1.8 + k * 1.1
        P.side_line([(y, BODY0.z + 0.6), (y + 0.4, BODY0.z - 0.9)], 0.14, PLUM, BODY, side)
    # the tail's chevrons, seen from the side
    for p in J['tail'][:-1]:
        P.side_line([(p.y - 0.3, p.z + 0.4), (p.y + 0.3, p.z - 0.3)], 0.12, PLUM, TAIL, side)
    # skull windows: eye ring, the window behind it, the jaw window
    eye = next((e for e in C.ACC.get('eyes', []) if e.x * side > 0), None)
    if eye is not None:
        P.side_oval(eye.y, eye.z, 0.6, 0.55, PLUM, HEAD, side)
        P.side_oval(eye.y + 0.9, eye.z + 0.1, 0.3, 0.35, MAGENTA, HEAD, side)
    j = J['jaw']
    P.side_oval((j[0].y + j[1].y) / 2, j[1].z, 0.45, 0.2, PLUM, HEAD & (P.PZ < MOUTH_Z), side)
# front and back: the face plate's suture, the rump's plates
P.view_line([Vector((-0.8, 0, hd[1].z + 0.5)), Vector((0, 0, hd[-1].z)), Vector((0.8, 0, hd[1].z + 0.5))], 0.15, PLUM, HEAD, 'front')
for k in range(3):
    z = BODY0.z + 0.7 - k * 0.6
    P.view_line([Vector((-1.4 + k * 0.4, 0, z)), Vector((1.4 - k * 0.4, 0, z))], 0.13, PLUM, BODY | TAIL, 'back')
# talons: a ring at every joint, a line down each bone
for key, side in TALONS.items():
    L = J[key]
    for p in L[:-1]: P.dab(p, 0.32, PLUM)
    for view in ('front', 'back'): P.view_line(L, 0.12, PLUM, TAL, view)
    P.side_line([(p.y, p.z) for p in L], 0.12, PLUM, TAL, side)
if SAC_C is not None:
    P.dab(SAC_C, 0.95, LIME, facing=(0, 0, -1))          # the belly's glow sac
P.accents({'eyes': LIME, 'mandibles': CREAM, 'hooks': CREAM, 'claws': PLUM, 'bulb': LIME})
for e in C.ACC['eyes']:
    P.dab(e + Vector((math.copysign(0.36, e.x), -0.1, 0.05)), 0.15, PLUM)
P.paint_scars(PLUM, CREAM)
P.save(OUT, "skimmer")

# ---------- rig ----------
G = Rig(C)
G.bone("Body", BODY0 + Vector((0, 2.4, 0)), BODY0 + Vector((0, -2.4, 0)))
G.bone("Head", J['neck'][0], J['head'][-1], "Body")
G.bone("Jaw", JAW_PIVOT, J['jaw'][-1], "Head")
TAIL_BONES = len(J['tail'])
G.chain("Tail", [BODY0 + Vector((0, 2.6, 0))] + J['tail'], "Body", limb='tail')
for key, side in WINGS.items():
    W = J[key]; s = "Left" if side < 0 else "Right"
    sock = Vector((side * 1.6, W[0].y, BODY0.z + 0.2))
    G.bone(f"Wing{s}", sock, W[1], "Body", limb=key)
    G.bone(f"WingOuter{s}", W[1], W[2], f"Wing{s}", limb=key)
    G.bone(f"WingTip{s}", W[2], W[3], f"WingOuter{s}", limb=key)
for key, side in TALONS.items():
    L = J[key]; s = "Left" if side < 0 else "Right"
    G.bone(f"Talon{s}", L[0] + Vector((0, 0, 0.6)), L[1], "Body", limb=key)
    G.bone(f"Foot{s}", L[1], L[2], f"Talon{s}", limb=key)
G.skin(part_bones={JAW: "Jaw"})

# which way +X swings a wing: measure it, never guess it
def up_sign(bone):
    pb = G.ao.pose.bones[bone]
    rest = (G.ao.matrix_world @ pb.tail).z
    pb.rotation_euler = (math.radians(20), 0, 0); bpy.context.view_layer.update()
    moved = (G.ao.matrix_world @ pb.tail).z
    pb.rotation_euler = (0, 0, 0); bpy.context.view_layer.update()
    return 1 if moved > rest else -1
UP = {s: up_sign(f"Wing{s}") for s in ("Left", "Right")}
print("WING +X lifts", UP)
def fwd_sign(bone):
    pb = G.ao.pose.bones[bone]
    rest = (G.ao.matrix_world @ pb.tail).y
    pb.rotation_euler = (math.radians(20), 0, 0); bpy.context.view_layer.update()
    moved = (G.ao.matrix_world @ pb.tail).y
    pb.rotation_euler = (0, 0, 0); bpy.context.view_layer.update()
    return 1 if moved < rest else -1          # forward is -Y
FWD = {s: fwd_sign(f"Talon{s}") for s in ("Left", "Right")}
print("TALON +X swings forward", FWD)

def wing_side(n):
    return "Left" if n.endswith("Left") else "Right"

# ---------- actions ----------
def fly(n, ph):
    """the cruise: a full flap, the outer wing and tip lagging so it whips"""
    w = ph * 2 * math.pi
    if n.startswith("Wing"):
        u = UP[wing_side(n)]
        if n.startswith("WingOuter"): return (u * 22 * math.sin(w - 0.7), 0, 0), (0, 0, 0)
        if n.startswith("WingTip"): return (u * 16 * math.sin(w - 1.4), 0, 0), (0, 0, 0)
        return (u * 34 * math.sin(w), 0, 0), (0, 0, 0)
    if n == "Body": return (3 * math.sin(w + math.pi), 0, 0), (0, 0, -0.25 * math.sin(w))
    if n.startswith("Tail"):
        k = 0 if n == "Tail" else int(n.split('.')[1])
        return (14 / TAIL_BONES * math.sin(w - 0.6 - k * 0.5), 18 / TAIL_BONES * math.sin(w * 0.5 - k * 0.4), 0), (0, 0, 0)
    if n.startswith("Talon"): return (FWD[wing_side(n)] * (-10 + 5 * math.sin(w - 1.0)), 0, 0), (0, 0, 0)   # trailing back
    if n.startswith("Foot"): return (6 + 6 * math.sin(w - 1.6), 0, 0), (0, 0, 0)
    if n == "Jaw": return (2 + 2 * math.sin(w * 2), 0, 0), (0, 0, 0)
    if n == "Head": return (-3 * math.sin(w), 0, 0), (0, 0, 0)
    return (0, 0, 0), (0, 0, 0)

def attack(n, ph):
    """rears back with the wings raised, then stoops on the target talons first,
    jaw open, and settles back to the cruise pose by the last frame"""
    settle = 1 - ease(max(0, (ph - 0.62) / 0.38))
    load = ease(min(1, ph / 0.4)) * settle
    strike = ease(min(1, max(0, (ph - 0.4) / 0.14))) * settle
    if n.startswith("Wing"):
        u = UP[wing_side(n)]
        if n.startswith("WingOuter"): return (u * (20 * load * (1 - strike) - 14 * strike), 0, 0), (0, 0, 0)
        if n.startswith("WingTip"): return (u * (12 * load * (1 - strike) - 12 * strike), 0, 0), (0, 0, 0)
        return (u * (30 * load * (1 - strike) - 22 * strike), 0, 0), (0, 0, 0)
    if n == "Body": return (-14 * load * (1 - strike) + 14 * strike, 0, 0), (0, 0, 0.3 * load * (1 - strike) - 0.5 * strike)
    if n == "Head": return (-8 * load * (1 - strike) - 4 * strike, 0, 0), (0, 0, 0)   # chin up as it bites
    if n == "Jaw": return (4 + 13 * strike, 0, 0), (0, 0, 0)
    if n.startswith("Talon"): return (FWD[wing_side(n)] * (-16 * load * (1 - strike) + 10 * strike), 0, 0), (0, 0, 0)
    if n.startswith("Foot"): return (-14 * load * (1 - strike) + 22 * strike, 0, 0), (0, 0, 0)   # open, then grasp
    if n.startswith("Tail"): return (10 / TAIL_BONES * load - 12 / TAIL_BONES * strike, 0, 0), (0, 0, 0)
    return (0, 0, 0), (0, 0, 0)

G.act("fly", 24, fly)
G.act("attack", 30, attack)
G.fix_joints()
G.save(OUT, "skimmer")
