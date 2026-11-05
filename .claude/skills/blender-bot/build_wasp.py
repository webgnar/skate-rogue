"""The Wasp (Planet Dirt, Meridian's bomber), built from SKILL.md with bb_lib.
The game's model was a box blockout (scenes/models/wasp_body.tscn): a thorax,
a big head with red eyes and mandibles, a two-banded abdomen with a sting, four
wings and six hanging legs. It never lands, so its clips are "fly" (the wing
buzz it plays all the time) and "bomb" (the abdomen curls under and lets the
bomb go, played when wasp.gd drops one).

Anatomy read: a wasp is three masses on two pinches. A deep thorax carrying
everything that moves (four wings off the top of its flanks, six legs off the
bottom), a short neck to a wide head that is mostly compound eye, and a thin
petiole to a long gaster of six tergite plates tapering into the sting. In
flight the legs hang down and back.

  1. block out from one Cube (the thorax): neck and head knifed at the mouth
     into the head capsule and the mandible plate, the petiole and gaster out
     of the back, each flank knifed into a wing half above and three legs
     below;
  2. knife: brows over the eyes, the scutellum plate on the back of the
     thorax, a keel along the gaster;
  3. clay; personality: a torn left hind wing and a scar across the gaster;
     accents: compound eyes, ocelli, antennae (the left snapped short),
     mandibles, the sting, a claw on each foot; connect.
Paint from the exoskeleton: the gaster's tergite bands, the thorax sutures,
the face plate, leg joint rings, wing veins.

PALETTE IS PROVISIONAL: zack asked for "kinda colorful", like his own. Five
swatches chosen here, none taken from his models.

usage: python build_wasp.py -- <out dir> [seed]
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
THX = Vector((0, 0, 8))
C.start_cube((4.4, 5.0, 4.6), THX, round_long=0.9)

# front: a short neck, then the end knifed across at the mouth line
front = C.run(C.face_where((0, -1, 0)), [
    ((0, -1, 0.0), 0.6, 0.55, 0.62),    # neck, a pinch
], name='neck', region='head')
nc = front.calc_center_median()
hh = max(v.co.z for v in front.verts) - min(v.co.z for v in front.verts)
MOUTH_Z = nc.z - hh * 0.2
low, up = C.split_face(front, (0, 0, MOUTH_Z))
JAW_PIVOT = Vector((0, nc.y, MOUTH_Z))
C.run(up, [
    ((0, -1, 0.05), 0.5, 2.3, 2.1),     # the head capsule swells, wide as the thorax
    ((0, -1, 0.0), 1.6, 1.02, 1.0),
    ((0, -1, -0.35), 1.2, 0.8, 0.85),   # the face slopes down to the clypeus
    ((0, -1, -0.5), 0.6, 0.7, 0.75),
], name='head', region='head', keep=(MOUTH_Z, 1, 2))
C.run(low, [
    ((0, -1, -0.3), 0.5, 2.0, 1.5),     # the mandible plate under the face
    ((0, -1, -0.45), 1.3, 0.85, 0.85),
    ((0, -1, -0.6), 0.7, 0.6, 0.65),
], name='jaw', region='head', part=JAW, keep=(MOUTH_Z, -1, 2))

# back: the petiole pinch, then the gaster's six tergites tapering to the sting
gas = C.run(C.face_where((0, 1, 0)), [
    ((0, 1, -0.1), 0.7, 0.42, 0.42),    # the petiole, the wasp waist
    ((0, 1, -0.1), 0.6, 1.0, 1.0),
    ((0, 1, -0.15), 1.0, 2.5, 2.5),     # the first tergite flares
    ((0, 1, -0.15), 2.2, 1.15, 1.12),
    ((0, 1, -0.2), 2.2, 1.0, 1.0),
    ((0, 1, -0.28), 2.0, 0.86, 0.88),
    ((0, 1, -0.38), 1.8, 0.72, 0.74),
    ((0, 1, -0.5), 1.4, 0.55, 0.56),
], name='gaster', region='gaster')
C.end_point(gas, gas.calc_center_median() + Vector((0, 0.6, -0.3)))

# each flank knifed: the upper strip grows the two wings, the lower the three legs
WINGS, LEGS = {}, {}
WING_Z = THX.z + 0.7
for side in (-1, 1):
    f = C.face_where((side, 0, 0))
    legf, wingf = C.split_face(f, (0, 0, WING_Z))
    wf, wh = C.split_face(wingf, (0, 0.2, 0), (0, 1, 0))       # front wing, hind wing
    a, rest = C.split_face(legf, (0, -0.8, 0), (0, 1, 0))
    b, c = C.split_face(rest, (0, 0.9, 0), (0, 1, 0))
    for k, face in ((0, wf), (1, wh)):
        key = f"wing{k}_{'l' if side < 0 else 'r'}"
        L = 1.0 if k == 0 else 0.78                              # the hind wing is the smaller
        sw = (-0.08, 0.5)[k]                                     # the front wing straight out, the hind swept back
        up = (0.16, -0.06)[k]                                    # one over the other, so they never touch
        C.run(face, [
            ((side, sw * 0.3, 0.2), 0.6, 1.0, 1.0, (1, 0.9, 0.55)),   # the wing root, flattened
            ((side, sw, up), 3.6 * L, 1.0, 1.0, (1, 2.0, 0.4)),       # the blade widens
            ((side, sw + 0.1, up), 4.4 * L, 1.0, 1.0, (1, 1.15, 0.7)),
            ((side, sw + 0.25, up * 0.5), 3.0 * L, 0.6, 1.0),          # rounds off to the tip
            ((side, sw + 0.4, 0.0), 1.2 * L, 0.45, 1.0),
        ], name=key, region='wing')
        WINGS[key] = side
    for k, face in zip((0, 1, 2), (a, b, c)):     # front, middle, hind
        fwd = (-0.8, 0.0, 0.8)[k]
        key = f"leg{k}_{'l' if side < 0 else 'r'}"
        L = (0.9, 1.0, 1.25)[k]                    # the hind legs are the long ones
        C.run(face, [
            ((side, fwd * 0.3, -0.25), 0.5, 0.9, 1.0),                 # coxa
            ((side * 0.7, fwd * 0.5, -1), 2.2 * L, 0.72, 1.0),         # femur down and out
            ((side * 0.25, (-0.35, 0.25, 0.85)[k], -1), 2.8 * L, 0.72, 1.0),   # tibia hangs down, fanned so no two touch
            ((side * 0.1, (-0.1, 0.6, 1.3)[k], -0.7), 1.6 * L, 0.7, 1.0),     # tarsus trails back
        ], name=key, region='leg')
        LEGS[key] = side

REF = {'head_len': 0.17, 'head_depth': 0.20, 'body_depth': 0.20, 'height': 0.42}
OFF = C.proportions(REF)
if os.environ.get('BLOCKOUT_ONLY'):
    print("OFF", OFF); sys.exit(0)

# ---------- 2. knife shapes in, extrude them ----------
hd = J['head']
hw = max(p.x for p in R['head'][1])
top = [f for f in C.bm.faces if C.on('head', f) and f.normal.z > 0.4 and hd[0].y + 0.2 > f.calc_center_median().y > hd[2].y]
brows = C.knife_pair(top, [((0, hd[2].y + 0.2, 0), (0, -1, 0)), ((0, hd[0].y, 0), (0, 1, 0))], hw * 0.35)
for side in (-1, 1):
    if brows[side]: C.pull(brows[side], (side * 0.3, -0.2, 1), 0.35, shrink=0.85)
# the scutellum: a plate at the back of the thorax's top, knifed and raised
thtop = [f for f in C.bm.faces if C.on('body', f) and f.normal.z > 0.6]
scut = C.knife(thtop, [((0.9, 0, 0), (1, 0, 0)), ((-0.9, 0, 0), (-1, 0, 0)),
                       ((0, 0.6, 0), (0, -1, 0)), ((0, THX.y + 2.3, 0), (0, 1, 0))])
if scut: C.pull(scut, (0, 0.1, 1), 0.45, shrink=0.8)
# a keel down the back of the gaster
gt = [f for f in C.bm.faces if C.on('gaster', f) and f.normal.z > 0.7
      and J['gaster'][2].y < f.calc_center_median().y < J['gaster'][6].y]
keel = C.knife(gt, [((0.5, 0, 0), (1, 0, 0)), ((-0.5, 0, 0), (-1, 0, 0))])
if keel: C.pull(keel, (0, 0, 1), 0.3, shrink=0.9)

assert C.mirror_error() < 1e-3, "the skeleton must be mirror-true before the clay"
if os.environ.get('MIRROR_ONLY'): sys.exit(0)
C.clay(jitter=0.03, lumps=4, box=((-2.5, 2.5), (-3, 14), (5, 11)), lump_r=(0.8, 1.6), lump_amt=(-0.12, 0.16))

# ---------- personality: on purpose, twice ----------
C.lengthen('wing1_l', 0.8)                      # the left hind wing is torn short
g3 = J['gaster'][4]                             # an old gash across the right of the gaster
C.scar(g3 + Vector((9, 0, 0.6)), (-1, 0, 0), (0, 0.8, -0.6), 2.4)

# ---------- accents ----------
for side in (-1, 1):
    # compound eyes: big, seated in the side of the head under the brow, a third along
    ey = hd[0].y + (hd[2].y - hd[0].y) * 0.4
    p = C.skin((side * 9, ey, hd[1].z - 0.2), (-side, 0, 0))
    if p is not None: C.ball(p + Vector((side * 0.35, 0, 0)), 0.95, 'eyes')
    # antennae from the front of the brow, up and forward; the left one snapped
    p = C.skin((side * 0.7, hd[2].y - 6, hd[1].z + 0.6), (0, 1, 0))
    if p is not None:
        C.cone(p - Vector((0, -0.1, 0)), (side * 0.35, -0.8, 0.75), 0.22, 1.5 if side < 0 else 4.2, 'antennae')
    # mandibles, on the jaw
    j = J['jaw'][-1]
    C.cone(j + Vector((side * 0.55, 0.15, 0.05)), (-side * 0.5, -1, -0.15), 0.28, 1.3, 'mandibles', part=JAW)
for dx, dy in ((0, -0.5), (-0.5, 0.15), (0.5, 0.15)):     # three ocelli on the crown
    p = C.skin((dx, hd[1].y + dy, 20), (0, 0, -1))
    if p is not None: C.ball(p - Vector((0, 0, 0.08)), 0.22, 'ocelli')
g = J['gaster'][-1]                                        # the sting
C.cone(g + Vector((0, 0.1, -0.4)), (0, 1, -0.45), 0.3, 2.0, 'sting')
for key, side in LEGS.items():                             # a claw on the end of each foot
    t, t0 = J[key][-1], J[key][-2]
    d = (t - t0).normalized()
    p = C.skin(t + d * 4, -d)                                  # aimed back down the foot, so every foot is found
    if p is not None: C.cone(p - d * 0.1, d + Vector((0, 0, -0.5)), 0.16, 0.6, 'claws')
print('ACCENTS', {k: len(v) for k, v in C.ACC.items()})
C.connect()
ob, me = C.to_object()

# ---------- paint pass 1 (PROVISIONAL palette, "kinda colorful") ----------
INDIGO, YELLOW, MAGENTA, TEAL, MAROON = "#1f1452", "#ffc414", "#ff2a7a", "#18c6b0", "#5a1030"
BASE, BACK, BAND, BELLY, WINGC, EYE = YELLOW, MAROON, INDIGO, MAGENTA, TEAL, MAGENTA
P = Painter(C, BASE, size=512)
PX, PY, PZ = P.PX, P.PY, P.PZ
V = P.V
HEAD = P.region('head'); BODY = P.region('body'); GAS = P.region('gaster'); LEG = P.region('leg'); WING = P.region('wing')
P.broad(J['head'][0].y, J['gaster'][-1].y, BACK, 'above', r=1.2, step=0.45)
P.broad(J['jaw'][0].y + 0.4, J['gaster'][-2].y, BELLY, 'below', r=1.1, step=0.4)
P.img[WING & P.mask] = P.col(WINGC)
# the gaster: a band at the back edge of every tergite, right round the body, so it
# reads from the side, the back and from above
gp = J['gaster']
for k in range(2, len(gp) - 1):
    y = gp[k].y - 0.25
    w = 0.55 if k > 2 else 0.4
    yy = PY + 0.12 * np.sin(PX * 2.1 + k)            # a hand-drawn edge, not a ruler line
    P.img[P.mask & GAS & (np.abs(yy - y) < w)] = P.col(BAND)
P.img[P.mask & GAS & (PY < gp[1].y + 0.3)] = P.col(BAND)     # the petiole, all dark
P.spine_bars([gp[2], gp[-1]], BAND, GAS, every=2.2, width=0.35)
for side in (-1, 1):
    # each tergite's front edge dips down the flank in a point (the wasp's notch)
    for k in range(3, len(gp) - 2):
        y0 = gp[k].y + 0.3; tz = P.top_z(y0, gp[k].z + 2)
        P.side_line([(y0, tz - 0.3), (y0 + 0.7, gp[k].z + 0.2), (y0 + 1.3, tz - 0.6)], 0.18, BAND, GAS, side)
    # thorax: the pleural suture down the flank and the plate edges
    P.side_line([(THX.y - 2.2, THX.z + 1.8), (THX.y - 0.2, THX.z + 0.2), (THX.y + 2.2, THX.z + 1.6)], 0.24, BAND, BODY, side)
    P.side_oval(THX.y + 0.4, THX.z - 1.2, 1.4, 0.7, BAND, BODY, side)
    # head: an eye ring and the cheek suture to the mandible
    eye = next((e for e in C.ACC.get('eyes', []) if e.x * side > 0), None)
    if eye is not None:
        P.side_oval(eye.y, eye.z, 1.35, 1.4, BAND, HEAD, side)
        P.side_line([(eye.y - 0.8, eye.z - 1.0), (J['jaw'][1].y, J['jaw'][1].z + 0.2)], 0.17, BAND, HEAD, side)
    P.side_line([(p.y, p.z + 0.3) for p in J['jaw']], 0.15, BAND, HEAD & (PZ < MOUTH_Z + 0.3), side)
# thorax from above: the scutum's outline and the midline, the scutellum dark
P.top_line([(-1.6, THX.y - 2.0), (-1.9, THX.y), (-1.0, THX.y + 1.4), (1.0, THX.y + 1.4), (1.9, THX.y), (1.6, THX.y - 2.0)], 0.2, BAND, BODY)
P.top_line([(0, THX.y - 2.2), (0, THX.y + 0.4)], 0.16, BAND, BODY)
P.img[P.mask & BODY & (PZ > THX.z + 2.4) & (PY > THX.y + 0.7) & (np.abs(PX) < 1.0)] = P.col(BAND)
# head from above and the front: the vertex plate and the face's anchor mark
P.top_line([(-1.4, hd[0].y), (0, hd[1].y + 0.6), (1.4, hd[0].y)], 0.18, BAND, HEAD)
V3 = lambda x, z: Vector((x, 0, z))
P.view_line([V3(-0.9, hd[1].z + 1.1), V3(0, hd[-1].z - 0.2), V3(0.9, hd[1].z + 1.1)], 0.22, BAND, HEAD, 'front')
P.view_line([V3(-0.6, MOUTH_Z + 0.4), V3(0.6, MOUTH_Z + 0.4)], 0.16, BAND, HEAD, 'front')
# thorax front and back: the collar and the plate under the scutellum
P.view_line([V3(-2.0, THX.z + 1.2), V3(0, THX.z + 2.0), V3(2.0, THX.z + 1.2)], 0.24, BAND, BODY, 'front')
P.view_line([V3(-1.8, THX.z - 0.6), V3(0, THX.z - 1.6), V3(1.8, THX.z - 0.6)], 0.2, BAND, BODY, 'back')
# legs: femur dark, joint rings, the tibia's line in every view
for key, side in LEGS.items():
    L = J[key]
    m = P.mask & LEG
    seg = np.zeros_like(m)
    a_, b_ = np.array(L[0]), np.array(L[1])
    ab = b_ - a_; t = np.clip(((P.pos - a_) @ ab) / (ab @ ab), 0, 1)
    seg = np.linalg.norm(P.pos - (a_ + t[..., None] * ab), axis=2) < 0.9
    P.img[m & seg] = P.col(BAND)
    for p in L[1:-1]:
        P.dab(p, 0.45, MAROON)
    P.side_line([(L[1].y, L[1].z), (L[2].y, L[2].z)], 0.14, BAND, LEG, side)
    for view in ('front', 'back'):
        P.view_line([L[1], L[2], L[3]], 0.14, BAND, LEG, view)
# wings: veins from the root, seen from above and from below
for key, side in WINGS.items():
    W = J[key]
    for f in (-0.5, 0.0, 0.55):
        pts = [(W[0].x, W[0].y)] + [(p.x, p.y + f * (0.6 + 1.6 * min(i, 2) / 2)) for i, p in enumerate(W[1:-1])]
        P.top_line(pts, 0.12, BAND, WING)
        mk = P.mask & WING & P._line_mask(P.PX, P.PY, P._wob(pts, 0.04), 0.12) & (P.NZ < -0.3)
        P.img[mk] = P.col(BAND)
    P.top_line([(W[1].x, W[1].y - 1.0), (W[2].x, W[2].y - 1.4), (W[-1].x, W[-1].y)], 0.16, BAND, WING)   # the leading edge
P.accents({'eyes': EYE, 'ocelli': YELLOW, 'antennae': INDIGO, 'mandibles': MAROON, 'sting': INDIGO, 'claws': INDIGO})
for e in C.ACC['eyes']:
    P.dab(e + Vector((math.copysign(0.8, e.x), -0.3, 0.2)), 0.22, YELLOW)    # a glint
P.paint_scars(INDIGO, YELLOW)
P.save(OUT, "wasp")

# ---------- rig ----------
G = Rig(C)
G.bone("Body", THX + Vector((0, 2.2, 0)), THX + Vector((0, -2.2, 0)))
G.bone("Head", J['neck'][0], J['head'][-1], "Body")
G.bone("Jaw", JAW_PIVOT, J['jaw'][-1], "Head")
G.chain("Gaster", [THX + Vector((0, 2.4, 0))] + J['gaster'][1:], "Body", limb='gaster')
GASTER_BONES = len(J['gaster']) - 1
for key, side in WINGS.items():
    W = J[key]; nm = ("WingFront" if key.startswith("wing0") else "WingHind") + ("Left" if side < 0 else "Right")
    G.bone(nm, W[0], W[2], "Body", limb=key)   # the hinge at the root ring, so the thorax wall stays put
    G.bone(nm + "Tip", W[2], W[-1], nm, limb=key)
for key, side in LEGS.items():
    L = J[key]; nm = key.replace('leg', 'Leg').replace('_l', 'Left').replace('_r', 'Right')
    G.bone(nm, L[0], L[1], "Body", limb=key)
    G.bone(nm.replace('Leg', 'Shin'), L[1], L[2], nm, limb=key)
    G.bone(nm.replace('Leg', 'Foot'), L[2], L[3], nm.replace('Leg', 'Shin'), limb=key)
G.skin(part_bones={JAW: "Jaw"})

SWEEP, LIFT = 14.0, 14.0          # degrees: a wasp's stroke is mostly fore and aft
def wings(n, w):
    """the buzz: the fore and hind wing hooked together (they beat as one, as an
    insect's do, so they never cross), sweeping fore and aft and lifting as they
    go back, the tip trailing the root"""
    if not n.startswith("Wing"): return None
    tip = n.endswith("Tip")
    right = n.replace("Tip", "").endswith("Right")
    lag = 0.7 if tip else 0.0
    sw = math.sin(w - lag)
    sweep = (12.0 if tip else SWEEP) * (sw if sw > 0 else 0.55 * sw)   # local Z: + sends a right wing back, split root and tip so the hinge never creases; the forward stroke is the short one, the thorax is in front of it
    lift = (5.0 if tip else LIFT) * math.cos(w - lag)            # local X: + tips both wings up
    if "Hind" in n: lift *= 0.7                                   # under the fore wing: it rises less, never into it
    return (lift, 0, sweep if right else -sweep), (0, 0, 0)

def fly(n, ph):
    w = ph * 2 * math.pi
    r = wings(n, w * 4)
    if r: return r
    if n == "Body": return (2 * math.sin(w), 0, 1.5 * math.sin(w + 1)), (0, 0, 0.4 * math.sin(w))
    if n.startswith("Gaster"):
        k = 0 if n == "Gaster" else int(n.split('.')[1])
        return ((-6 * math.sin(w - k * 0.5)) / GASTER_BONES, 0, (4 * math.sin(w + 1 - k * 0.4)) / GASTER_BONES), (0, 0, 0)
    if n == "Head": return (2 * math.sin(w * 2), 0, 3 * math.sin(w), ), (0, 0, 0)
    if n == "Jaw": return (6 + 4 * math.sin(w * 2), 0, 0), (0, 0, 0)
    if n.startswith(("Leg", "Shin", "Foot")):
        k = int(next(ch for ch in n if ch.isdigit()))
        sway = math.sin(w + k * 0.9)
        if n.startswith("Leg"): return (-4 * sway, 0, 0), (0, 0, 0)
        if n.startswith("Shin"): return (6 * sway, 0, 0), (0, 0, 0)
        return (8 * math.sin(w + k * 0.9 - 0.7), 0, 0), (0, 0, 0)
    return (0, 0, 0), (0, 0, 0)

def bomb(n, ph):
    """the gaster lifts (wind up), curls hard under the body to drop, then settles"""
    w = ph * 2 * math.pi
    r = wings(n, w * 6)
    if r: return r
    settle = 1 - ease(max(0, (ph - 0.65) / 0.35))
    lift = ease(min(1, ph / 0.3)) * (1 - ease(min(1, max(0, (ph - 0.3) / 0.15))))
    curl = ease(min(1, max(0, (ph - 0.3) / 0.15))) * settle
    if n.startswith("Gaster"):
        k = 0 if n == "Gaster" else int(n.split('.')[1])
        tot = 20 * lift - 58 * curl                      # -X tips a backward bone's end down
        lag = 1.0 if k > 0 else 0.6
        return (tot * lag / GASTER_BONES, 0, 0), (0, 0, 0)
    if n == "Body": return (-6 * lift + 8 * curl, 0, 0), (0, 0, 0.6 * lift - 0.8 * curl)
    if n == "Head": return (4 * lift - 6 * curl, 0, 0), (0, 0, 0)
    if n == "Jaw": return (6 + 20 * lift, 0, 0), (0, 0, 0)
    if n.startswith(("Leg", "Shin", "Foot")):
        k = int(next(ch for ch in n if ch.isdigit()))
        if n.startswith("Leg"): return (-22 * curl if k == 2 else -8 * curl, 0, 0), (0, 0, 0)  # the hind legs swing forward, clear of the sting
        if n.startswith("Shin"): return (10 * lift, 0, 0), (0, 0, 0)
    return (0, 0, 0), (0, 0, 0)

G.act("fly", 24, fly)
G.act("bomb", 36, bomb)
G.fix_joints()
G.soften()                              # whatever a cut could not fix, the pose gives up a little
G.save(OUT, "wasp")
