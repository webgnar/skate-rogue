"""The Locust (Planet Dirt, Last Train Out; also dropped from the Manta's pods),
a one-shot of the blender-bot skill. A small swarm unit that hops in pods of
five: mid-hop it is air, landed it is ground (scripts/locust.gd). The game's
model was a box blockout (scenes/models/locust_body.tscn), so the build reads
its proportions: a thorax with a saddle shield, a big blunt head with big eyes,
a long abdomen under folded wings, and huge jumping hind legs whose knees
stand above the back.

  1. block out from one Cube: thorax; head knifed across at the mouth into
     the head capsule and the mouthparts; abdomen; six legs out of the thorax
     block's sides (each side knifed into three), the hind pair a big femur
     up and back to a knee above the back and a long shin down to the ground;
  2. knife: the saddle shield (pronotum) knifed out of the thorax top and
     pulled up, brow ridges over the eyes, a keel down the abdomen;
  3. clay; personality: the left antenna snapped short, the right hind leg a
     touch longer, a scar across the right of the abdomen;
  4. accents: eyes, antennae, mandibles, foot claws, spurs down the hind
     shins, and the folded wings as two flat plates on their own bones.
Paint from the exoskeleton: segment bands round the abdomen, the shield's
edge and its keel, the head's sutures and eye rings, the femur's herringbone,
leg joint rings, balanced front, side and back. Beads: Four-Color Sawtooth.

PALETTE IS PROVISIONAL: zack asked for one "similar to the one i have, kinda
colorful" (2026-11-04) and gave no swatches, so it is five vivid colours
picked in the feel of the Tyrant's set, none taken from zack's models.

Clips are the ones scripts/locust.gd plays: idle (the 1.2 s rest), hop (the
0.9 s flight) and bite (the 1 s gnaw).

usage: python build_locust.py -- <out dir> [seed]
"""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bb_lib import Creature, Painter, Rig, ease
from mathutils import Vector, Matrix
import bmesh
import numpy as np

args = sys.argv[sys.argv.index('--') + 1:]
OUT = args[0]
SEED = int(args[1]) if len(args) > 1 else 7
C = Creature(SEED)
J, R = C.J, C.R
JAW, WING_L, WING_R = 1, 2, 3

# ---------- 1. block out ----------
BODY0 = Vector((0, 0, 5.2))
C.start_cube((4.0, 4.4, 3.8), BODY0, round_long=0.8)
front = C.run(C.face_where((0, -1, 0)), [
    ((0, -1, 0.15), 0.5, 0.85, 0.9),    # short neck under the shield
], name='neck', region='head')
nc = front.calc_center_median()
hh = max(v.co.z for v in front.verts) - min(v.co.z for v in front.verts)
MOUTH_Z = nc.z - hh * 0.22
low, up = C.split_face(front, (0, 0, MOUTH_Z))
JAW_PIVOT = Vector((0, nc.y, MOUTH_Z))
C.run(up, [
    ((0, -1, 0.15), 0.5, 1.2, 1.3),     # the head capsule swells past the neck
    ((0, -1, 0.05), 2.0, 1.02, 1.05),   # big blunt head
    ((0, -1, -0.7), 1.3, 0.82, 0.86),   # the face turns down, vertical
], name='head', region='head', keep=(MOUTH_Z, 1, 2))
C.run(low, [
    ((0, -1, -0.4), 0.5, 1.05, 1.2),    # mouthparts under the face
    ((0, -1, -0.9), 1.2, 0.85, 0.85),
    ((0, -1, -0.6), 0.6, 0.72, 0.75),
], name='jaw', region='head', part=JAW, keep=(MOUTH_Z, -1, 2))
abd = C.run(C.face_where((0, 1, 0)), [
    ((0, 1, 0.05), 0.8, 0.98, 0.98),    # waist
    ((0, 1, 0.0), 2.6, 0.96, 0.95),     # the abdomen, segment by segment
    ((0, 1, -0.04), 2.6, 0.9, 0.92),
    ((0, 1, -0.08), 2.4, 0.84, 0.88),
    ((0, 1, -0.1), 2.0, 0.76, 0.84),
    ((0, 1, -0.05), 1.2, 0.55, 0.7),    # tip
], name='abdomen', region='abdomen')
C.end_point(abd, abd.calc_center_median() + Vector((0, 0.7, -0.1)))

# six legs out of the thorax block: each side face knifed into three
LEGS = {}
for side in (-1, 1):
    f = C.face_where((side, 0, 0), lambda f: -abs(f.calc_center_median().y) * 0.1)
    a, rest = C.split_face(f, (0, -0.6, 0), (0, 1, 0))
    b, c = C.split_face(rest, (0, 0.6, 0), (0, 1, 0))
    s = 'l' if side < 0 else 'r'
    for k, face, fwd in ((0, a, -0.8), (1, b, 0.25)):         # front and middle: short walking legs
        C.run(face, [
            ((side, fwd * 0.2, -0.1), 0.5, 0.85, 1.0),         # hip
            ((side, fwd * 0.6, 0.25), 2.2, 0.82, 1.0),         # femur out and up a little
            ((side * 0.3, fwd * 0.35, -1), 4.2, 0.72, 1.0),    # shin down to the ground
            ((side * 0.15, fwd, -0.35), 1.0, 0.8, 0.6),        # foot
        ], name=f'leg{k}_{s}', region='leg')
        LEGS[f'leg{k}_{s}'] = side
    C.run(c, [                                                  # the hind pair: the jump
        ((side, 0.15, 0.05), 0.6, 1.05, 1.05),                 # hip, wide
        ((side * 0.3, 1, 1.0), 5.4, 1.12, 1.18),               # big femur, up and back
        ((side * 0.12, 1, 0.45), 1.6, 0.72, 0.75),             # tapering to the knee, above the back
        ((side * 0.05, -0.2, -1), 8.2, 0.55, 1.0),             # long shin down
        ((0, 0.4, -1), 0.8, 0.9, 1.0),                         # ankle
        ((0, 1, -0.15), 1.5, 0.85, 0.5),                       # foot, flat and back
    ], name=f'hind_{s}', region='hind')
    LEGS[f'hind_{s}'] = side

REF = {'head_len': 0.20, 'head_depth': 0.20, 'body_depth': 0.20, 'height': 0.48}
OFF = C.proportions(REF)
if os.environ.get('BLOCKOUT_ONLY'): sys.exit(0)

# ---------- 2. knife shapes in, extrude them ----------
body = lambda f: C.on('body', f)
top = [f for f in C.bm.faces if body(f) and f.normal.z > 0.6]
shield = C.knife(top, [((1.3, 0, 0), (1, 0, 0)), ((-1.3, 0, 0), (-1, 0, 0)),
                       ((0, -1.9, 0), (0, -1, 0)), ((0, 2.0, 0), (0, 1, 0))])
if shield:
    sf = bmesh.ops.dissolve_faces(C.bm, faces=shield)['region'][0]
    C.run(sf, [((0, 0.15, 1), 0.55, 1.12, 1.0)], name='shield', region='shield')   # the saddle shield stands up off the thorax
hd = J['head']
hw = max(p.x for p in R['head'][1])
ht = [f for f in C.bm.faces if C.on('head', f) and f.normal.z > 0.4 and hd[1].y - 1.2 < f.calc_center_median().y < hd[0].y + 0.2]
brows = C.knife_pair(ht, [((0, hd[1].y - 0.9, 0), (0, -1, 0)), ((0, hd[0].y + 0.1, 0), (0, 1, 0))], hw * 0.35)
for side in (-1, 1):
    if brows[side]: C.pull(brows[side], (side * 0.3, -0.1, 1), 0.3, shrink=0.9)
ab = J['abdomen']
keel = [f for f in C.bm.faces if C.on('abdomen', f) and f.normal.z < -0.6 and ab[1].y < f.calc_center_median().y < ab[3].y]
keel = C.knife(keel, [((0.5, 0, 0), (1, 0, 0)), ((-0.5, 0, 0), (-1, 0, 0))])
if keel: C.pull(keel, (0, 0, -1), 0.25, shrink=0.9)            # a keel down the belly plates

assert C.mirror_error() < 1e-3, "the skeleton must be mirror-true before the clay"
C.clay(jitter=0.03, lumps=5, box=((-1.5, 1.5), (-4, 12), (3.5, 7.5)), lump_r=(0.8, 1.6), lump_amt=(-0.1, 0.14))

# ---------- personality: once or twice, on purpose ----------
C.lengthen('hind_r', 1.06)                                    # the right jumping leg a touch longer
a2 = J['abdomen'][2]
C.scar(a2 + Vector((9, 0.4, 0.5)), (-1, 0, 0), (0, 1, 0.5), 2.2, width=0.22, depth=0.25)   # an old gash down the right flank
BROKEN_ANTENNA = -1                                           # and the left antenna snapped short

# ---------- accents, seated with C.skin ----------
eye_y = hd[1].y - 0.2
for side in (-1, 1):
    p = C.skin((side * 9, eye_y, hd[1].z + 0.4), (-side, 0, 0))   # big compound eyes, sunk half
    if p is not None: C.ball(p - Vector((side * 0.35, 0, 0)), 0.75, 'eyes')
    p = C.skin((side * 0.55, hd[-1].y - 0.3, 30), (0, 0, -1))     # antennae from between the eyes
    if p is not None:
        d = Vector((side * 0.45, -0.55, 0.75)).normalized()
        C.cone(p - d * 0.1, d, 0.2, 1.4 if side == BROKEN_ANTENNA else 4.2, 'antennae', sides=4)
    j = J['jaw'][-1]                                               # mandibles either side of the mouth
    C.cone(j + Vector((side * 0.45, 0.25, 0.15)), (-side * 0.5, -0.8, -0.4), 0.28, 1.0, 'mandibles', part=JAW)
for key, side in LEGS.items():                 # two claws under each foot
    t = J[key][-1]
    hwid = min((q - t).length for q in R[key][-1])
    for k in (-1, 1):
        p = C.skin(t + Vector((k * hwid * 0.4, 0, 6)), (0, 0, -1))
        if p is None: continue
        fd = (J[key][-1] - J[key][-2]).normalized()               # claws point the way the foot does
        d = Vector((k * 0.25 + fd.x * 0.5, fd.y * 0.8, -0.6)).normalized()
        C.cone(p - d * 0.1, d, min(0.18, hwid * 0.5), 0.6, 'claws')
for key in ('hind_l', 'hind_r'):              # spurs down the back of each hind shin
    side = LEGS[key]
    a, b = J[key][2], J[key][3]
    for t in (0.3, 0.5, 0.7):
        q = a.lerp(b, t)
        p = C.skin(q + Vector((0, 6, 0)), (0, -1, 0))
        if p is not None: C.cone(p - Vector((0, 0.08, 0)), (side * 0.2, 1, 0.4), 0.13, 0.55, 'spurs')
C.connect()

# the folded wings: two flat plates lying roof-wise down the back, past the
# abdomen's end, each on its own part so its bone can open it mid-hop
sh = J['shield'][-1]
y0, y1 = 2.5, ab[-1].y + 1.6                    # from behind the shield to past the abdomen's tip
ROOF, WX = 0.5, 0.6                             # each plate leans out and down from the spine
def need(y):
    """the wing centre's lowest height at y that keeps every edge off the back"""
    z = -1e9
    for x in (0.0, WX, 2 * WX):
        p = C.skin((x, y, 30), (0, 0, -1))
        if p is not None: z = max(z, p.z + 0.22 + (x - WX) * math.tan(ROOF))
    return z
ys = [y0 + (y1 - y0) * t for t in np.linspace(0, 1, 16)]
nz = [(y, need(y)) for y in ys]
nz = [(y, z) for y, z in nz if z > -1e8]
slope = (nz[-1][1] - nz[0][1]) / (nz[-1][0] - nz[0][0])
za = max(z - (y - y0) * slope for y, z in nz)   # the straight line that clears every sample
pitch = math.atan(-slope)
WINGS = {}
for side, part in ((-1, WING_L), (1, WING_R)):
    ln = y1 - y0
    mid = Vector((side * WX, (y0 + y1) / 2, za + slope * ln / 2))
    m = Matrix.Translation(mid) @ Matrix.Rotation(-pitch, 4, 'X') @ Matrix.Rotation(side * ROOF, 4, 'Y') @ \
        Matrix.Diagonal(Vector((1.4, ln, 0.14, 1)))
    C.box(m, 'wings', part=part, at=mid)
    WINGS[side] = (Vector((side * 0.3, y0, za + 0.2)), Vector((side * 0.9, y1, za + slope * ln)))
ob, me = C.to_object()

# ---------- paint (PROVISIONAL palette: vivid, in the feel of zack's Tyrant set) ----------
LIME, PLUM, TEAL, MAGENTA, GOLD = "#7fe61c", "#3a0d5c", "#0fa3a8", "#ff2a8a", "#ffc21a"
BASE, BACK, MARK, BELLY, WING, EYE, INK = LIME, TEAL, PLUM, GOLD, MAGENTA, MAGENTA, PLUM
P = Painter(C, BASE, size=512)                 # a small swarm unit: 512 (PAINTING.md)
PZ, V = P.PZ, P.V
P.broad(min(V[:, 1]), max(V[:, 1]), BACK, 'above', r=1.3, step=0.35)
P.broad(J['jaw'][-1].y + 0.3, ab[-1].y, BELLY, 'below', r=0.9, step=0.3)
BODY = P.region('body'); HEAD = P.region('head'); ABD = P.region('abdomen'); SH = P.region('shield')
LEG = P.region('leg'); HIND = P.region('hind')
top_z = lambda y: P.top_z(y, BODY0.z + 2); bot_z = lambda y: P.bot_z(y, BODY0.z - 2)
for side in (-1, 1):
    # the abdomen's segment bands, from the back down to the belly plates
    for p, q in zip(ab, ab[1:]):
        y = (p.y + q.y) / 2 - 0.2
        tz, bz = top_z(y), bot_z(y)
        P.side_line([(y - 0.15, tz - 0.1), (y + 0.15, bz + 0.2)], 0.17, MARK, ABD, side)
    # the side seam where back plates meet belly plates
    P.side_line([(BODY0.y - 1.8, BODY0.z - 0.3)] + [(p.y, p.z - 0.35) for p in ab[:-1]], 0.14, MARK, BODY | ABD, side)
    # the shield's lower edge and its groove
    sz = top_z(BODY0.y)
    P.side_line([(-2.2, sz - 1.4), (0.0, sz - 1.7), (2.3, sz - 1.3)], 0.18, MARK, SH | BODY, side)
    P.side_line([(-0.4, sz - 0.1), (-0.2, sz - 1.4)], 0.13, MARK, SH | BODY, side)
    # head: an eye ring, the cheek suture down to the mouth, the face plate's edge
    eye = next((e for e in C.ACC.get('eyes', []) if e.x * side > 0), None)
    if eye is not None:
        P.side_oval(eye.y, eye.z, 1.05, 1.15, INK, HEAD, side)
        P.side_line([(eye.y + 0.2, eye.z - 1.0), (J['jaw'][0].y + 0.2, MOUTH_Z + 0.1)], 0.13, MARK, HEAD, side)
    P.side_line([(p.y, p.z + 0.3) for p in J['jaw']], 0.12, MARK, HEAD & (PZ < MOUTH_Z + 0.5), side)
    # the hind femur's herringbone: chevrons down its outside, the jumper's mark
    H = J['hind_l' if side < 0 else 'hind_r']
    for t in np.linspace(0.15, 0.85, 6):
        c = H[0].lerp(H[1], t)
        P.side_line([(c.y - 0.45, c.z + 0.55), (c.y, c.z), (c.y - 0.45, c.z - 0.55)], 0.12, MARK, HIND, side)
    P.side_line([(H[2].y, H[2].z - 0.2), (H[3].y, H[3].z + 0.3)], 0.13, MARK, HIND, side)    # the shin bone
# from above: the shield's keel and a bar per abdomen segment
P.top_line([(0, -2.1), (0, 2.2)], 0.15, MARK, SH | BODY)
P.spine_bars([J['head'][-1], J['head'][0], BODY0 + Vector((0, -2, 0)), BODY0 + Vector((0, 2, 0))] + ab,
             MARK, HEAD | BODY | ABD, every=1.25, width=0.9)
# front and back views
V3 = lambda x, z: Vector((x, 0, z))
P.view_line([V3(-1.1, hd[1].z + 1.0), V3(0, hd[-1].z - 0.3), V3(1.1, hd[1].z + 1.0)], 0.16, MARK, HEAD, 'front')     # the face's Y suture
P.view_line([V3(0, hd[-1].z - 0.3), V3(0, MOUTH_Z + 0.2)], 0.14, MARK, HEAD, 'front')
for k in range(3):                                                                                                 # throat and chest plates
    z = BODY0.z - 0.6 - k * 0.55
    P.view_line([V3(-1.4 + k * 0.3, z + 0.3), V3(0, z), V3(1.4 - k * 0.3, z + 0.3)], 0.14, MARK, BODY, 'front')
for k in range(3):                                                                                                 # rings round the abdomen's tip
    z = ab[-2].z + 0.6 - k * 0.6
    P.view_line([V3(-1.0, z), V3(1.0, z)], 0.13, MARK, ABD, 'back')
for view in ('front', 'back'):
    for key, side in LEGS.items():
        L = J[key]
        P.view_line(L[1:4], 0.15, MARK, HIND if key.startswith('hind') else LEG, view)
for key, side in LEGS.items():                 # a ring at every leg joint, reading from every side
    for p in J[key][1:-1]:
        P.dab(p, 0.32, MARK)
# the wings: magenta with plum veins running their length and a cross vein at each third
WG = np.zeros_like(P.mask)
code = C.acc_codes.get('wings')
if code: WG = P.acc == code
P.accents({'wings': WING, 'eyes': EYE, 'antennae': INK, 'mandibles': INK, 'claws': INK, 'spurs': GOLD})
for side, (wa, wb) in WINGS.items():
    for dx in (-0.45, 0.0, 0.45):
        P.stroke([wa + Vector((dx, 0, 0.1)), wb + Vector((dx * 0.6, 0, 0.1))], 0.09, INK)
    for t in (0.33, 0.66):
        c = wa.lerp(wb, t)
        P.stroke([c + Vector((-0.8, 0, 0.1)), c + Vector((0.8, 0, 0.1))], 0.08, INK)
for e in C.ACC['eyes']:                        # a gold glint in each eye
    P.dab(e + Vector((math.copysign(0.55, e.x), -0.25, 0.3)), 0.2, GOLD)
P.paint_scars(INK, BELLY)
P.save(OUT, "locust")

# ---------- rig ----------
G = Rig(C)
G.bone("Body", BODY0 + Vector((0, 2.0, 0)), BODY0 + Vector((0, -2.0, 0)))
G.bone("Head", J['neck'][0], J['head'][-1], "Body")
G.bone("Jaw", JAW_PIVOT, J['jaw'][-1], "Head")
G.chain("Abdomen", [BODY0 + Vector((0, 2.0, 0))] + J['abdomen'], "Body", limb='abdomen')
for side, nm, part in ((-1, "WingLeft", WING_L), (1, "WingRight", WING_R)):
    wa, wb = WINGS[side]
    G.bone(nm, wa, wb, "Body")
for key, side in LEGS.items():
    L = J[key]; sd = 'Left' if side < 0 else 'Right'
    if key.startswith('hind'):
        G.bone(f"Hind{sd}", L[0], L[2], "Body", limb=key)          # femur, hip to knee
        G.bone(f"HindShin{sd}", L[2], L[3], f"Hind{sd}", limb=key)
        G.bone(f"HindFoot{sd}", L[3], L[5], f"HindShin{sd}", limb=key)
    else:
        k = key[3]
        G.bone(f"Leg{k}{sd}", L[0], L[1], "Body", limb=key)
        G.bone(f"Shin{k}{sd}", L[1], L[2], f"Leg{k}{sd}", limb=key)
        G.bone(f"Foot{k}{sd}", L[2], L[3], f"Shin{k}{sd}", limb=key)
G.skin(part_bones={JAW: "Jaw", WING_L: "WingLeft", WING_R: "WingRight"})
NA = len(J['abdomen'])

# ---------- actions: the clips locust.gd plays ----------
def side_of(n): return -1 if n.endswith("Left") else 1

def idle(n, ph):
    """the 1.2 s rest on the ground: it breathes, chews, and sinks into a crouch
    on the hind legs at the end, ready to go again (loops: crouch eases back)"""
    w = ph * 2 * math.pi
    crouch = 0.5 - 0.5 * math.cos(w)                 # 0 at both ends, deepest mid-rest
    if n == "Body": return (-3 * crouch, 0, 0), (0, 0, -0.35 * crouch)
    if n == "Head": return (2 * math.sin(w * 2), 0, 3 * math.sin(w)), (0, 0, 0)
    if n == "Jaw": return (5 + 5 * math.sin(w * 4), 0, 0), (0, 0, 0)
    if n.startswith("Abdomen"): return (1.5 * math.sin(w * 2) / NA, 0, 0), (0, 0, 0)
    if n.startswith("HindShin"): return (-10 * crouch, 0, 0), (0, 0, 0)
    if n.startswith("Hind") and not n.startswith("HindFoot"): return (8 * crouch, 0, 0), (0, 0, 0)
    if n.startswith("Shin"): return (-4 * crouch, 0, 0), (0, 0, 0)
    return (0, 0, 0), (0, 0, 0)

def hop(n, ph):
    """the 0.9 s flight (locust.gd moves the body along the arc): the hind legs
    kick straight off the ground, the wings snap open and beat, the front legs
    reach for the landing, everything folded back by the last frame"""
    kick = ease(min(1, ph / 0.12)) * (1 - ease(min(1, max(0, (ph - 0.2) / 0.5))))
    air = ease(min(1, ph / 0.12)) * (1 - ease(min(1, max(0, (ph - 0.78) / 0.2))))
    reach = ease(min(1, max(0, (ph - 0.55) / 0.3))) * (1 - ease(min(1, max(0, (ph - 0.88) / 0.12))))
    beat = math.sin(ph * 2 * math.pi * 6)
    if n == "Body": return (-6 * kick + 5 * reach, 0, 0), (0, 0, 0)
    if n.startswith("Wing"):
        s = side_of(n)
        return (0, s * (40 + 18 * beat) * air, -s * 25 * air), (0, 0, 0)     # opens out and up, beating
    if n.startswith("HindShin"): return (44 * kick, 0, 0), (0, 0, 0)          # the shin swings out straight behind
    if n.startswith("HindFoot"): return (-12 * kick, 0, 0), (0, 0, 0)
    if n.startswith("Hind"): return (-3 * kick, 0, 0), (0, 0, 0)
    if n.startswith("Leg"): return (-14 * air + 10 * reach, 0, 0), (0, 0, 0)  # tucked, then reaching down
    if n.startswith("Shin"): return (12 * air - 8 * reach, 0, 0), (0, 0, 0)
    if n.startswith("Abdomen"): return ((6 * kick - 4 * reach) / NA, 0, 0), (0, 0, 0)
    if n == "Head": return (-4 * kick + 4 * reach, 0, 0), (0, 0, 0)
    return (0, 0, 0), (0, 0, 0)

def bite(n, ph):
    """the 1 s gnaw: rears back, mouthparts wide, lunges and snaps shut"""
    wind = ease(min(1, ph / 0.3)) if ph < 0.3 else 1 - ease(min(1, (ph - 0.3) / 0.15))
    lunge = 0 if ph < 0.3 else ease(min(1, (ph - 0.3) / 0.15)) * (1 - ease(max(0, (ph - 0.55) / 0.45)))
    snap = 1 if 0.4 < ph < 0.6 else 0
    if n == "Body": return (-5 * wind + 7 * lunge, 0, 0), (0, -0.4 * lunge, -0.2 * wind)
    if n == "Head": return (-8 * wind + 10 * lunge, 0, 0), (0, 0, 0)
    if n == "Jaw": return (20 * wind * (1 - snap) + 6 * lunge * (1 - snap), 0, 0), (0, 0, 0)
    if n.startswith("Leg0"): return (-10 * wind + 6 * lunge, 0, 0), (0, 0, 0)
    if n.startswith("Hind") and not n.startswith(("HindShin", "HindFoot")): return (5 * wind, 0, 0), (0, 0, 0)
    if n.startswith("HindShin"): return (-6 * wind, 0, 0), (0, 0, 0)
    if n.startswith("Abdomen"): return (3 * lunge / NA, 0, 0), (0, 0, 0)
    return (0, 0, 0), (0, 0, 0)

G.act("idle", 29, idle)     # 24 fps: 1.2 s
G.act("hop", 22, hop)       # 0.9 s
G.act("bite", 24, bite)     # 1.0 s
G.fix_joints()
G.save(OUT, "locust")
