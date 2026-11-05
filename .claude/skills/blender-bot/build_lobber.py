"""The Lobber (Planet Dirt, Meridian): siege artillery, a mortar beetle that
crawls into range, plants, and never takes another step. Everything after is
one shell every six seconds out of the barrel on its back. Built from
SKILL.md and bb_lib, against the game's blockout (scenes/models/
lobber_body.tscn: a low wide hull, a head with two glowing eyes at the front,
six splayed legs, wing cases, a mortar tube leaning forward off the back) and
scripts/lobber.gd (crawl, plant, fire).

  1. block out from one Cube: the thorax block, a short neck, the head knifed
     across at the mouth into a flat shovel head and a mandible plate, a big
     domed abdomen behind, six squat splayed legs out of the thorax's sides
     (each side face knifed into three);
  2. knife: the mortar barrel knifed out of the abdomen's back and extruded
     up and forward (chamber, barrel, muzzle flare), wing cases over the
     flanks, a brow over the eyes, a keel down the thorax;
  3. clay; personality: a scar raked across the left wing case and the right
     mandible snapped short; accents: the glowing shell in the muzzle, spikes
     round the muzzle, eyes, mandibles, foot claws; connect.
Paint from the exoskeleton: segment plates and the side seam, the barrel's
rings, wing case veins, head sutures, leg joint rings, balanced front, side
and back.

PALETTE IS PROVISIONAL (zack, 2026-11-04: "choose a palette similar to the
one i have, kinda colorful"): five swatches of our own, none from zack's
models: plum ink, teal body, deep teal back, hot orange glow, lime belly.

usage: python build_lobber.py -- <out dir> [seed]
"""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bb_lib import Creature, Painter, Rig, ease
from mathutils import Vector
import bmesh
import numpy as np

args = sys.argv[sys.argv.index('--') + 1:]
OUT = args[0]
SEED = int(args[1]) if len(args) > 1 else 21
C = Creature(SEED)
J, R = C.J, C.R
JAW = 1

# ---------- 1. block out ----------
BODY0 = Vector((0, 0, 6.0))
C.start_cube((9.0, 6.0, 7.4), BODY0, round_long=1.5)
front = C.run(C.face_where((0, -1, 0)), [
    ((0, -1, 0.0), 0.7, 0.8, 0.6),     # neck, narrow
    ((0, -1, 0.0), 0.7, 1.0, 1.0),     # a second ring, so the head turns clear of the thorax
], name='neck', region='head')
nc = front.calc_center_median()
hh = max(v.co.z for v in front.verts) - min(v.co.z for v in front.verts)
MOUTH_Z = nc.z - hh * 0.2
low, up = C.split_face(front, (0, 0, MOUTH_Z))
JAW_PIVOT = Vector((0, nc.y, MOUTH_Z))
C.run(up, [
    ((0, -1, 0.05), 0.6, 1.25, 1.12),   # head swells past the neck
    ((0, -1, 0.0), 4.0, 1.05, 1.0),     # the flat wide head
    ((0, -1, -0.2), 1.4, 0.82, 0.7),    # shovel face, sloping down
], name='head', region='head', keep=(MOUTH_Z, 1, 2))
C.run(low, [
    ((0, -1, -0.15), 0.6, 1.25, 1.2),   # mandible plate under the face
    ((0, -1, -0.15), 3.0, 0.95, 0.85),
    ((0, -1, -0.05), 1.2, 0.8, 0.7),
], name='jaw', region='head', part=JAW, keep=(MOUTH_Z, -1, 2))
abd = C.run(C.face_where((0, 1, 0)), [
    ((0, 1, 0.08), 1.0, 1.1, 0.92),     # waist widens into the abdomen
    ((0, 1, 0.02), 4.6, 1.08, 1.02),      # the big dome that carries the gun
    ((0, 1, -0.12), 4.2, 0.92, 0.9),
    ((0, 1, -0.35), 2.2, 0.62, 0.62),
], name='abdomen', region='abdomen')
C.end_point(abd, abd.calc_center_median() + Vector((0, 1.0, -0.3)))

# six squat splayed legs out of the thorax: each side face knifed into three
LEGS = {}
for side in (-1, 1):
    f = C.face_where((side, 0, 0), lambda f: -abs(f.calc_center_median().y) * 0.1)
    a, rest = C.split_face(f, (0, -0.85, 0), (0, 1, 0))
    b, c = C.split_face(rest, (0, 0.85, 0), (0, 1, 0))
    for k, face in zip((0, 1, 2), (a, b, c)):     # front, middle, back
        fwd = (-0.6, 0.0, 0.6)[k]
        key = f"leg{k}_{'l' if side < 0 else 'r'}"
        C.run(face, [
            ((side, fwd * 0.3, 0.0), 0.6, 0.8, 0.85),           # hip, low on the flank
            ((side, fwd, 0.35), 2.8, 0.85, 1.0),                # femur, squat, out
            ((side * 0.5, fwd * 0.4, -1), 3.4, 0.78, 1.0),      # tibia down to the ground
            ((side * 0.2, fwd * 0.2, -1), 1.0, 0.75, 1.0),      # foot
        ], name=key, region='leg')
        LEGS[key] = side

# hold the block-out to the game's blockout (lobber_body.tscn), each ratio
# against the length head to tail: head 12 of 51, head 9 deep, the hull 17.5
# deep, 28 to the top of the mortar
REF = {'head_len': 0.23, 'head_depth': 0.17, 'body_depth': 0.30, 'height': 0.55}

# ---------- 2. knife shapes in, extrude them ----------
# the mortar: a patch of the abdomen's back knifed out, merged, grown up and forward
ab = J['abdomen']
topf = [f for f in C.bm.faces if C.on('abdomen', f) and f.normal.z > 0.5]
GY = ab[1].y - 0.4                      # an eight-sided patch, so the barrel is a round tube
oc = lambda sx, sy: ((sx * 1.55, GY + sy * 1.55, 0), (sx, sy, 0))
patch = C.knife(topf, [((2.1, 0, 0), (1, 0, 0)), ((-2.1, 0, 0), (-1, 0, 0)),
                      ((0, GY - 2.1, 0), (0, -1, 0)), ((0, GY + 2.1, 0), (0, 1, 0)),
                      oc(1, 1), oc(1, -1), oc(-1, 1), oc(-1, -1)])
gun = bmesh.ops.dissolve_faces(C.bm, faces=patch)['region'][0]
TILT = (0, -0.8, 1)                     # 39 degrees off upright, leaning over the head like the blockout's tube
C.run(gun, [
    ((0, -0.1, 1), 0.6, 1.2, 1.0),      # collar
    ((0, -0.35, 1), 1.5, 1.08, 1.0),    # the chamber, fat
    (TILT, 1.0, 0.72, 1.0),             # neck of the barrel
    (TILT, 2.2, 1.0, 1.0),              # barrel
    (TILT, 1.7, 1.06, 1.0),
    (TILT, 0.7, 1.32, 1.0),             # muzzle flare
], name='gun', region='gun')
OFF = C.proportions(REF)
if os.environ.get('BLOCKOUT_ONLY'):
    import bpy
    C.to_object(); bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "blockout.blend")); sys.exit(0)

# wing cases over the flanks of the abdomen, both sides cut together
wing = [f for f in C.bm.faces if C.on('abdomen', f) and 0.15 < f.normal.z < 0.9
        and ab[0].y - 0.2 < f.calc_center_median().y < ab[2].y + 0.4]
cases = C.knife_pair(wing, [((0, ab[0].y + 0.3, 0), (0, -1, 0)), ((0, ab[2].y, 0), (0, 1, 0))], 2.6)
print("WING faces", len(wing), {k: len(v) for k, v in cases.items()})
for side in (-1, 1):
    if cases[side]: C.pull(cases[side], (side * 0.7, 0.15, 0.6), 0.85, shrink=0.94)
# brow plate over the eyes
hd = J['head']
hw = max(p.x for p in R['head'][1])
top = [f for f in C.bm.faces if C.on('head', f) and f.normal.z > 0.4 and hd[0].y - 0.2 > f.calc_center_median().y > hd[1].y - 1.0]
brows = C.knife_pair(top, [((0, hd[1].y - 0.9, 0), (0, -1, 0)), ((0, hd[0].y, 0), (0, 1, 0))], hw * 0.28)
for side in (-1, 1):
    if brows[side]: C.pull(brows[side], (side * 0.35, -0.2, 1), 0.5, shrink=0.85)
# keel down the thorax
keel = [f for f in C.bm.faces if C.on('body', f) and f.normal.z > 0.6]
keel = C.knife(keel, [((0.5, 0, 0), (1, 0, 0)), ((-0.5, 0, 0), (-1, 0, 0))])
if keel: C.pull(keel, (0, 0, 1), 0.45, shrink=0.9)

assert C.mirror_error() < 1e-3, "the skeleton must be mirror-true before the clay"
C.clay(jitter=0.04, lumps=6, box=((-4, 4), (-6, 12), (5, 12)), lump_r=(1.2, 2.4), lump_amt=(-0.15, 0.2))

# ---------- personality: on purpose, once or twice ----------
a1 = J['abdomen'][1]
C.scar(a1 + Vector((-14, -0.8, 1.6)), (1, 0, -0.15), (0.1, 1, 0.6), 3.4)   # raked across the left wing case
BROKEN = 1                                                                  # the right mandible snapped short

# ---------- accents ----------
g = J['gun']
mz, mz_prev = g[-1], g[-2]
gd = (mz - mz_prev).normalized()
mr = sum((p - mz).length for p in R['gun'][-1]) / len(R['gun'][-1])
C.ball(mz - gd * 0.2, mr * 0.62, 'shell')            # the next shell, glowing in the muzzle
ax = gd.cross(Vector((1, 0, 0))).normalized()
for i in range(6):                                    # spikes round the muzzle's lip
    ang = i / 6 * 2 * math.pi + math.pi / 6
    out = (Vector((1, 0, 0)) * math.cos(ang) + ax * math.sin(ang)).normalized()
    p = C.skin(mz - gd * 0.35 + out * (mr + 4), -out)
    if p is not None:
        C.cone(p - out * 0.15, (out + gd * 0.6).normalized(), 0.28, 1.0, 'spikes', sides=4)
for side in (-1, 1):
    p = C.skin((side * 9, hd[1].y - 0.4, hd[1].z + 0.4), (-side, 0, 0))     # eyes, under the brow
    if p is not None: C.ball(p + Vector((side * 0.15, 0, 0)), 0.5, 'eyes')
    j = J['jaw'][-1]                                                        # mandibles curling in
    long_ = 1.8 if side < 0 else 0.8
    C.cone(j + Vector((side * 1.0, 0.3, 0.1)), (-side * 0.5, -1, 0.05), 0.32, long_, 'mandibles', part=JAW)
for key, side in LEGS.items():          # a claw under each foot, seated on the sole
    t = J[key][-1]
    d = Vector((side * 0.2, 0, -1)).normalized()
    p = C.skin(t + Vector((0, 0, -6)), (0, 0, 1))
    hwf = min((q - t).length for q in R[key][-1])
    if p is not None: C.cone(p - d * 0.15, d, min(0.32, hwf * 0.6), 0.9, 'claws')
C.connect()
ob, me = C.to_object()
print("SOLES at z", round(min(v.co.z for v in me.vertices), 2))   # the Godot scene lifts it onto the ground

# ---------- paint (PROVISIONAL palette, ours, colourful) ----------
PLUM, TEAL, DEEP, ORANGE, LIME = "#2b0b3f", "#16b3a3", "#0b4f4a", "#ff7a1a", "#d6f03a"
BASE, BACK, MARK, BELLY, GLOW, INK = TEAL, DEEP, PLUM, LIME, ORANGE, PLUM
P = Painter(C, BASE, size=512)          # a mid-size enemy: 512 (PAINTING.md)
V = P.V
P.broad(min(V[:, 1]), max(V[:, 1]), BACK, 'above', r=1.5, step=0.5)
P.broad(J['jaw'][-1].y + 0.5, J['abdomen'][-1].y, BELLY, 'below', r=1.4, step=0.45)
BODY = P.region('body'); HEAD = P.region('head'); ABD = P.region('abdomen'); LEG = P.region('leg'); GUN = P.region('gun')
PZ = P.PZ
P.img[P.mask & ABD & (P.NZ > 0.45)] = P.col(BACK)        # the wing cases, darker over the back
P.img[P.mask & ~GUN & (P.NZ < -0.35)] = P.col(BELLY)     # belly plates, everything facing the ground
# the barrel: deep teal, with a ring at every step of it and orange heat at the muzzle
P.img[GUN & P.mask] = P.col(BACK)
for k, c in enumerate(g):
    rr = sum((q - c).length for q in R['gun'][k]) / len(R['gun'][k])
    ring = np.abs((P.pos - np.array(c, np.float32)) @ np.array(gd if k > 1 else (0, 0, 1), np.float32)) < 0.22
    near = np.linalg.norm(P.pos - np.array(c, np.float32), axis=2) < rr * 1.6
    P.img[P.mask & GUN & ring & near] = P.col(MARK if k < len(g) - 1 else GLOW)
heat = np.linalg.norm(P.pos - np.array(mz, np.float32), axis=2) < mr * 1.2
P.img[P.mask & GUN & heat] = P.col(GLOW)
# back plates: a bar across the back at every segment, head to tail tip
P.spine_bars([J['head'][-1], J['head'][0], BODY0 + Vector((0, -2.5, 0)), BODY0, BODY0 + Vector((0, 2.5, 0))] + J['abdomen'],
             MARK, BODY | HEAD | ABD, every=1.2, width=2.2)
for side in (-1, 1):
    # the side seam where the back plates meet the belly plates
    path = [(J['head'][1].y, J['head'][1].z - 0.3), (J['neck'][0].y, BODY0.z - 0.4), (BODY0.y, BODY0.z - 0.5)] + \
           [(p.y, p.z - 0.6) for p in J['abdomen']]
    P.side_line(path, 0.24, MARK, BODY | HEAD | ABD, side)
    # wing case veins: three lines sweeping back along the case
    for dz in (1.4, 2.4, 3.2):
        P.side_line([(ab[0].y + 0.5, ab[0].z + dz * 0.8), (ab[1].y, ab[1].z + dz), (ab[2].y, ab[2].z + dz * 0.7), (ab[3].y - 0.3, ab[3].z + dz * 0.3)],
                    0.18, MARK, ABD, side)
    # head: an eye ring, the cheek suture, the mandible plate's edge
    eye = next((e for e in C.ACC.get('eyes', []) if e.x * side > 0), None)
    if eye is not None:
        P.side_oval(eye.y, eye.z, 0.85, 0.8, INK, HEAD, side)
        P.side_line([(eye.y + 0.7, eye.z - 0.3), (J['head'][0].y + 0.2, J['head'][0].z - 1.0)], 0.18, MARK, HEAD, side)
    j = J['jaw']
    P.side_line([(p.y, p.z + 0.35) for p in j], 0.16, MARK, HEAD & (PZ < J['jaw'][0].z + 0.6), side)
    # the barrel's straps down its side, collar to muzzle
    P.side_line([(g[0].y, g[0].z), (g[2].y, g[2].z), (g[4].y, g[4].z)], 0.2, MARK, GUN, side)
# head from above: the Y suture
P.top_line([(0, J['head'][-1].y), (0, J['head'][1].y), (-1.0, J['head'][0].y)], 0.17, MARK, HEAD)
P.top_line([(0, J['head'][1].y), (1.0, J['head'][0].y)], 0.17, MARK, HEAD)
# wing case seam down the middle of the back, seen from above
P.top_line([(0, ab[1].y + 1.6), (0, ab[-1].y)], 0.2, MARK, ABD)
# front and back
P.view_line([Vector((-1.4, 0, hd[1].z + 0.8)), Vector((0, 0, hd[-1].z - 0.2)), Vector((1.4, 0, hd[1].z + 0.8))], 0.2, MARK, HEAD, 'front')
for k in range(3):                          # the gun's front, banded, and the thorax's chest plates
    z = BODY0.z - 0.4 - k * 0.8
    P.view_line([Vector((-3.0 + k * 0.6, 0, z)), Vector((3.0 - k * 0.6, 0, z))], 0.18, MARK, BODY, 'front')
for k in range(4):                          # the abdomen's rear plates
    z = ab[2].z + 2.0 - k * 1.0
    P.view_line([Vector((-3.2 + k * 0.5, 0, z + 0.4)), Vector((0, 0, z)), Vector((3.2 - k * 0.5, 0, z + 0.4))], 0.2, MARK, ABD, 'back')
for view in ('front', 'back'):
    for dx in (-1, 1):
        P.view_line([Vector((dx * 1.4, 0, g[0].z)), Vector((dx * 1.0, 0, g[3].z)), Vector((dx * 1.2, 0, g[-1].z))], 0.18, MARK, GUN, view)
# legs: a ring at every joint and a line down each tibia
for key, side in LEGS.items():
    L = J[key]
    for p in L[1:-1]:
        P.dab(p, 0.6, MARK)
    P.side_line([(L[1].y, L[1].z), (L[2].y, L[2].z)], 0.18, MARK, LEG, side)
    for view in ('front', 'back'):
        P.view_line([L[1], L[2], L[3]], 0.18, MARK, LEG, view)
P.accents({'shell': GLOW, 'eyes': GLOW, 'mandibles': INK, 'claws': INK, 'spikes': LIME})
for e in C.ACC['eyes']:
    P.dab(e + Vector((math.copysign(0.45, e.x), -0.15, 0.05)), 0.2, INK)
P.paint_scars(INK, BELLY)
P.save(OUT, "lobber")

# ---------- rig: Body, Head, Jaw, Abdomen, Mortar and six legs ----------
G = Rig(C)
G.bone("Body", BODY0 + Vector((0, 2.2, 0)), BODY0 + Vector((0, -2.2, 0)))
G.bone("Head", J['neck'][0], J['head'][-1], "Body")
G.bone("Jaw", JAW_PIVOT, J['jaw'][-1], "Head")
G.chain("Abdomen", [BODY0 + Vector((0, 2.5, 0))] + J['abdomen'], "Body", limb='abdomen')
G.chain("Mortar", [g[0] - Vector((0, 0, 1.0))] + g, "Abdomen.001", limb='gun')
MORTAR_BONES = len(g)
for key in LEGS:
    L = J[key]; nm = key.replace('leg', 'Leg').replace('_l', 'Left').replace('_r', 'Right')
    G.bone(nm, L[0], L[1], "Body", limb=key)
    G.bone(nm.replace('Leg', 'Shin'), L[1], L[2], nm, limb=key)
    G.bone(nm.replace('Leg', 'Foot'), L[2], L[3], nm.replace('Leg', 'Shin'), limb=key)
G.skin(part_bones={JAW: "Jaw"})

# ---------- actions: walk (the crawl), fire (the shell), idle (planted) ----------
def leg_parts(n):
    k = int(next(ch for ch in n if ch.isdigit()))
    return k, n.endswith("Right")

def walk(n, ph):
    """a tripod crawl: front and back legs of one side with the middle of the other.
    Heavy: the body sways and the gun rocks a beat behind it"""
    w = ph * 2 * math.pi
    if n == "Body": return (0, 1.5 * math.sin(w), 1.2 * math.sin(w)), (0, 0, 0.18 * math.sin(w * 2))
    if n.startswith(("Leg", "Shin", "Foot")):
        k, right = leg_parts(n)
        grp = (k % 2 == 0) != right
        o = 0 if grp else math.pi
        lift = max(0, math.sin(w + o))
        if n.startswith("Leg"):
            return (-14 * lift, 0, 16 * math.cos(w + o) * (1 if right else -1)), (0, 0, 0)
        if n.startswith("Shin"): return (10 * lift, 0, 0), (0, 0, 0)
        return (4 * lift, 0, 0), (0, 0, 0)
    if n.startswith("Abdomen"): return (0, 0, 2.5 * math.sin(w - 0.8)), (0, 0, 0)
    if n.startswith("Mortar"): return (3 * math.sin(w * 2 - 1.2) / MORTAR_BONES, 0, 3 * math.sin(w - 1.4) / MORTAR_BONES), (0, 0, 0)
    if n == "Jaw": return (3 + 3 * math.sin(w * 2), 0, 0), (0, 0, 0)
    if n == "Head": return (0, 0, -3 * math.sin(w)), (0, 0, 0)
    return (0, 0, 0), (0, 0, 0)

def fire(n, ph):
    """the shot: the body squats and the barrel pulls back to load, a hard kick
    as the shell goes, the barrel whips back down, everything settles to rest"""
    settle = 1 - ease(max(0, (ph - 0.55) / 0.45))
    load = ease(min(1, ph / 0.35)) * settle
    kick = ease(min(1, max(0, (ph - 0.35) / 0.08))) * settle
    if n.startswith("Mortar"): return ((12 * load * (1 - kick) - 40 * kick) / MORTAR_BONES, 0, 0), (0, 0, 0)
    if n.startswith("Abdomen"): return ((4 * load - 9 * kick) / 3, 0, 0), (0, 0, 0)
    if n == "Body": return (4 * load - 8 * kick, 0, 0), (0, 0, -0.9 * load + 0.5 * kick)
    if n.startswith("Leg"): return (8 * load * (1 - kick) - 4 * kick, 0, 0), (0, 0, 0)
    if n.startswith("Shin"): return (-8 * load * (1 - kick) + 6 * kick, 0, 0), (0, 0, 0)
    if n == "Head": return (6 * kick, 0, 0), (0, 0, 0)
    if n == "Jaw": return (16 * kick, 0, 0), (0, 0, 0)          # + opens: it screams with the shot
    return (0, 0, 0), (0, 0, 0)

def idle(n, ph):
    """planted: it breathes, the barrel sways while it aims, the mandibles work"""
    w = ph * 2 * math.pi
    if n == "Body": return (0, 0, 0), (0, 0, -0.15 + 0.15 * math.sin(w))
    if n.startswith("Abdomen"): return (1.5 * math.sin(w) / 3, 0, 0), (0, 0, 0)
    if n.startswith("Mortar"): return (-3 * math.sin(w) / MORTAR_BONES, 0, 4 * math.sin(w + 0.7) / MORTAR_BONES), (0, 0, 0)
    if n == "Jaw": return (4 + 4 * math.sin(w * 3), 0, 0), (0, 0, 0)
    if n == "Head": return (0, 0, 3 * math.sin(w)), (0, 0, 0)
    return (0, 0, 0), (0, 0, 0)

G.act("walk", 32, walk)
G.act("fire", 36, fire)
G.act("idle", 48, idle)
G.fix_joints()
G.soften()
G.save(OUT, "lobber")
