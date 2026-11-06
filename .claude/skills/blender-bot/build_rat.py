"""The sewer's rat for Skate Escape, on bb_lib, from zack's reference (2026-11-06:
"build me a rat", a brown rat drawn side on). It replaces the code-built rats in
src/render/sewer-view.ts that run at the skater in packs.

  1. block out from one Cube (the haunches): the rat is a hump, high over the
     hips and falling to a low chest; a short neck; a long wedge of a head to
     a blunt pink nose; the rump and a long tail that drops to the ground and
     lies along it, curving out to one side; four short legs out of the belly,
     the hind feet long and flat; round ears out of the top of the skull;
  2. knife: brows over the eyes;
  3. clay; personality: a nick out of the left ear (a sewer rat), the tail
     curled round on the ground; accents: eyes, the nose; connect.

Bones: Body, Chest, Neck, Head, EarLeft/Right, Tail chain, and a Leg, Shin,
Ankle and Foot to each leg. Actions: run (the scurry the pack runs in), walk,
sniff (stopped, nose up and working, whiskers going), hop (cleared by a skater
going over: a startled jump).

usage: python build_rat.py -- <out dir> [seed]
    sketch_marks.py -- <out>/rat.blend Cube <out>/rat.png sketched.png
    uv_blackout.py  -- <out>/rat.blend Cube sketched.png art/bot/rat.png
    export_glb.py   -- art/bot/rat.blend public/models/bot/rat.glb
"""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bb_lib import Creature, Painter, Rig, ease
from mathutils import Vector
import bmesh
E = lambda k, d: float(os.environ.get(k, d))     # tuning overrides for sweeps

args = sys.argv[sys.argv.index('--') + 1:]
OUT = args[0]
SEED = int(args[1]) if len(args) > 1 else 3
C = Creature(SEED)
J, R = C.J, C.R
bm = C.bm

# ---------- 1. block out ----------
HIP = Vector((0, 0, E('HZ', 5.2)))
C.start_cube((E('BW', 3.6), E('BL', 5.0), E('BD', 8.5)), HIP, round_long=E('RL', 1.6))   # the haunches, the hump

front = C.run(C.face_where((0, -1, 0)), [
    ((0, -1, E('C1', -0.6)), E('CL1', 0.8), 0.95, E('CS1', 0.9)),    # the back falling to the chest
    ((0, -1, E('C2', -0.6)), E('CL2', 0.7), 0.85, E('CS2', 0.82)),   # the shoulders
], name='chest', region='chest')
front = C.run(front, [
    ((0, -1, E('NZ', -0.1)), E('NL', 0.3), 0.85, 0.9),             # a short thick neck
], name='neck', region='neck')
front = C.run(front, [
    ((0, -1, 0.05), E('H1', 0.4), 1.0, 1.0),                     # the back of the skull
    ((0, -1, E('H2Z', -0.15)), E('H2', 1.4), 0.78, 0.78),         # the head narrowing
    ((0, -1, E('H3Z', -0.2)), E('H3', 1.3), 0.66, 0.62),          # the long muzzle
    ((0, -1, -0.15), E('H4', 0.6), 0.6, 0.6),                    # the blunt nose
], name='head', region='head')

tail = C.run(C.face_where((0, 1, 0)), [
    ((0, 1, E('RZ', -0.6)), E('RU', 0.6), 0.85, 0.85),          # the rump, rounding down
    ((0, 1, -0.5), 0.6, E('TW', 0.26), E('TW', 0.26), None, (0, 0, -E('TD', 2.4))),   # the tail's root, thick, low on the rump
], name='rump', region='body')
TS = E('TS', 2.0)
tip = C.run(tail, [
    ((0, E('T1Y', 0.3), -1), TS * E('T1', 0.9), 0.9, 0.9),   # the tail, down to the ground
    ((0, 1, E('T2Z', -0.4)), TS, 0.9, 0.9),
    ((0, 1, -0.02), TS, 0.88, 0.88),     # and lying along it (bent round to one side after the clay,
    ((0, 1, 0.0), TS, 0.86, 0.86),       # which wants the skeleton mirror-true)
    ((0, 1, 0.0), TS, 0.84, 0.84),
    ((0, 1, 0.0), TS, 0.8, 0.8),
    ((0, 1, 0.0), TS, 0.78, 0.78),
], name='tail', region='tail')
C.end_point(tip, tip.calc_center_median() + Vector((0, 0.6, 0.0)))

OPEN = (0, C.regions['chest'])   # a leg may grow out of the body or the chest


def belly_pair(y0, y1, x_cut, below=0.8):
    """the underside between y0 and y1 knifed into a left and a right patch, each one face"""
    bm.normal_update()
    faces = [f for f in bm.faces if f.normal.z < -0.3 and f.calc_center_median().z < HIP.z - below
             and min(v.co.y for v in f.verts) < y1 and max(v.co.y for v in f.verts) > y0
             and all(v[C.LIMB] in (0, C.limbs['chest']) and v[C.REG] in OPEN for v in f.verts)]
    pats = C.knife_pair(faces, [((0, y1, 0), (0, 1, 0)), ((0, y0, 0), (0, -1, 0))], x_cut)
    for side in (-1, 1):
        fs = pats[side]
        pats[side] = fs[0] if len(fs) == 1 else bmesh.ops.dissolve_faces(bm, faces=fs)['region'][0]
    bm.normal_update()
    return pats


LEGS = {}
fp = belly_pair(E('F0', -4.2), E('F1', -3.4), E('FX', 0.6))
for side in (-1, 1):
    key = 'front_l' if side < 0 else 'front_r'
    C.run(fp[side], [
        (tuple(fp[side].normal), 0.3, 1.0, 1.0, (1.05, 1.0, 1.0), (side * 0.1, 0, 0)),   # the shoulder
        ((side * 0.05, -0.15, -1), E('FA', 0.9), 0.85, 1.0),   # the short arm
        ((0, -0.05, -1), E('FB', 0.7), 0.85, 1.0),             # the wrist
        ((0, -1, -0.3), 0.6, 1.0, 0.55),                       # the pink hand, fingers forward
    ], name=key, region='leg')
    LEGS[key] = side
hp = belly_pair(E('P0', 0.6), E('P1', 1.8), E('PX', 1.0))
for side in (-1, 1):
    key = 'hind_l' if side < 0 else 'hind_r'
    C.run(hp[side], [
        (tuple(hp[side].normal), 0.3, 1.0, 1.0, (1.1, 1.0, 1.0), (side * 0.15, 0, 0)),   # the haunch
        ((side * 0.05, -0.4, -1), E('TH', 0.3), 0.85, 1.0),    # the thigh, forward under the hump
        ((0, 0.5, -1), E('SH', 0.2), 0.8, 1.0),                # the shin, back to the heel
        ((0, -1, -0.15), E('FT', 1.0), 0.9, 0.5),              # the long flat foot
    ], name=key, region='leg')
    LEGS[key] = side

# round ears out of the top of the skull
hd = J['head']
hw = max(abs(p.x) for p in R['head'][0])
top = [f for f in bm.faces if C.on('head', f) and f.normal.z > 0.3 and hd[0].y + 0.3 > f.calc_center_median().y > hd[1].y]
ep = C.knife_pair(top, [((0, hd[0].y + E('EY0', -0.3), 0), (0, 1, 0)), ((0, hd[0].y - E('EY1', 1.1), 0), (0, -1, 0))], hw * E('EX', 0.3))
EARS = {}
for side in (-1, 1):
    fs = ep[side]
    face = fs[0] if len(fs) == 1 else bmesh.ops.dissolve_faces(bm, faces=fs)['region'][0]
    key = 'ear_l' if side < 0 else 'ear_r'
    tipf = C.run(face, [
        (tuple(face.normal), 0.2, 0.95, 1.0),                          # the ear's root
        ((side * E('EO', 0.8), E('EF', 0.15), 1), E('EA', 0.5), 1.4, 1.0, (1.0, 0.35, 1.0)),   # up and out, a round thin cup
        ((side * 0.5, 0.1, 1), E('EB', 0.3), 0.75, 1.0),
    ], name=key, region='ear')
    C.end_point(tipf, tipf.calc_center_median() + Vector((side * 0.08, 0.05, 0.15)))
    EARS[key] = side

# the tail, lying on the ground, curls round to the rat's left and forward beside it, as in zack's
# drawing: every tail vert past where it meets the ground is bent round an arc (and its joints with it).
# Done after the clay, which wants the skeleton mirror-true.
TBR = E('TBR', 2.6)                            # the curl's radius
TBMAX = E('TBMAX', 3.1)                        # how far round it goes (radians)


def curl(p, y0):
    s = p.y - y0
    if s <= 0: return p
    th = min(s / TBR, TBMAX)
    over = max(0.0, s - TBR * TBMAX)           # past the arc, straight on
    r = TBR - p.x
    q = Vector((TBR - r * math.cos(th), y0 + r * math.sin(th), p.z))
    return q + Vector((math.sin(th), math.cos(th), 0)) * over


def curl_tail():
    y0 = J['tail'][1].y                        # where the tail lies down
    for v in bm.verts:
        if v[C.LIMB] == C.limbs['tail']: v.co = curl(v.co, y0)
    J['tail'] = [curl(p, y0) for p in J['tail']]
    bm.normal_update()


# a brown rat side on: nose to rump 1.0, head 0.32, head depth 0.2, body 0.5 deep at the hump,
# height ears to soles 0.6
REF = {'head_len': 0.32, 'head_depth': 0.2, 'body_depth': 0.5, 'height': 0.6}
OFF = C.proportions(REF)
if os.environ.get('BLOCKOUT_ONLY'):
    for k in LEGS: print('FOOT', k, [round(c, 2) for c in J[k][-1]])
    print('TAIL', [tuple(round(c, 1) for c in p) for p in J['rump'] + J['tail']])
    _x = C.crossings(); inv = {v: k for k, v in C.regions.items()}
    print('CROSSINGS', len(_x), sorted({inv[v[C.REG]] for v in _x}))
    curl_tail(); C.to_object(); import bpy; bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "rat_blockout.blend")); sys.exit(0)

# ---------- 2. knife and extrude ----------
brow = [f for f in bm.faces if C.on('head', f) and f.normal.z > 0.5 and hd[1].y + 0.6 > f.calc_center_median().y > hd[2].y]
br = C.knife_pair(brow, [((0, hd[1].y + 0.4, 0), (0, 1, 0)), ((0, hd[1].y - 0.4, 0), (0, -1, 0))], hw * 0.12)
for side in (-1, 1):
    if br[side]: C.pull(br[side], (side * 0.3, -0.3, 1), 0.15, shrink=0.85)        # brows over the eyes

assert C.mirror_error() < 1e-3, "the skeleton must be mirror-true before the clay"
C.clay(jitter=0.03, lumps=5, box=((-2.5, 2.5), (-7, 5), (2, 9)), lump_r=(0.8, 1.6), lump_amt=(-0.1, 0.14))

# ---------- personality ----------
el = J['ear_l']                                # a nick out of the left ear, a sewer rat
for v in bm.verts:
    if v[C.LIMB] == C.limbs['ear_l'] and v.co.z > el[0].z + 0.25 and v.co.y > el[1].y:
        v.co.z -= 0.2
curl_tail()

# ---------- accents ----------
for side in (-1, 1):
    p = C.skin((side * 9, hd[1].y - 0.2, hd[1].z + 0.2), (-side, 0, 0))
    if p is not None: C.ball(p + Vector((side * 0.08, 0, 0)), 0.32, 'eyes')
p = C.skin(hd[-1] + Vector((0, -6, 0.1)), (0, 1, 0))
if p is not None: C.ball(p + Vector((0, 0.1, 0)), 0.3, 'nose')
C.connect()
ob, me = C.to_object()

# ---------- paint: zack's brown rat ----------
# brown coat, darker down the back, a paler belly; pink nose, ears, hands, feet and a scaly pink-brown tail
FUR, BACKC, BELLY, PINK, TAILC, RING, STREAK, EYE, WHITE = (
    "#5e4a3a", "#45362b", "#8a735e", "#e0a196", "#b9806f", "#94604f", "#4c3b2e", "#0c0a0b", "#f4efe8")
P = Painter(C, FUR, size=512)
V = P.V; PZ = P.PZ; PY = P.PY
BODY = P.region('body', 'chest'); NECK = P.region('neck'); HEAD = P.region('head'); TAILR = P.region('tail')
LEG = P.region('leg'); EAR = P.region('ear')
FEET = min(J[k][-1].z for k in LEGS)
P.broad(min(V[:, 1]), max(V[:, 1]), BACKC, 'above', r=1.0, step=0.35)                  # the darker back
P.broad(J['chest'][0].y, J['rump'][0].y - 1.0, BELLY, 'below', r=0.9, step=0.3)          # the paler belly
P.img[LEG & (PZ < FEET + 0.8) & P.mask] = P.col(PINK)                                 # pink hands and feet
P.img[TAILR & P.mask] = P.col(TAILC)                                                  # the tail
P.img[EAR & P.mask] = P.col(PINK)                                                     # pink ears
P.img[HEAD & (PY < J['head'][-1].y + 0.35) & P.mask] = P.col(PINK)                     # the pink nose tip
# the tail's scales: dark rings down its length
tj = J['rump'][-1:] + J['tail']
import numpy as np
for a, b in zip(tj, tj[1:]):
    for k in range(1, 4):
        c = a.lerp(b, k / 4)
        near = TAILR & (np.linalg.norm(V - np.array(c), axis=1) < 0.9) & P.mask if V.ndim == 2 and len(V) == P.mask.size else None
        if near is not None: P.img[near & (np.abs((V - np.array(c)) @ np.array((b - a).normalized())) < 0.07)] = P.col(RING)
# the coat: dark streaks of fur running back along the sides and the hump (the reference's hatching)
import random
_r = random.Random(11)
for _ in range(420):
    y = _r.uniform(-6.5, 4.5); z = _r.uniform(FEET + 1.4, 10); side = _r.choice((-1, 1))
    p = C.skin((side * 12, y, z), (-side, 0, 0))
    if p is None: continue
    for k in range(3):                         # a short stroke of three dabs, raked back
        P.dab(p + Vector((0, 0.14 * k, 0.04 * k)), 0.07, STREAK)
P.accents({'eyes': EYE, 'nose': PINK})
for e in C.ACC['eyes']:
    P.dab(e + Vector((math.copysign(0.24, e.x), -0.12, 0.1)), 0.08, WHITE)    # a catchlight
P.save(OUT, "rat")

# ---------- rig ----------
G = Rig(C)
REAR = Vector((0, 2.6, HIP.z))
G.bone("Body", REAR, J['chest'][0])
G.bone("Chest", J['chest'][0], J['chest'][-1], "Body")
G.chain("Neck", [J['chest'][-1]] + J['neck'], "Chest")
NECK_BONES = len(J['neck'])
G.bone("Head", J['neck'][-1], J['head'][-1], "Neck")
for key, side in EARS.items():
    e = J[key]; nm = "Ear" + ("Left" if side < 0 else "Right")
    G.bone(nm, e[0], e[-1] + Vector((0, 0, 0.4)), "Head", limb=key, hinge=True)
G.chain("Tail", [J['rump'][-1]] + J['tail'], "Body", limb='tail')
TAIL_BONES = len(J['tail'])
for key, side in LEGS.items():
    p = J[key]
    sfx = ("Front" if key.startswith('front') else "Hind") + ("Left" if side < 0 else "Right")
    sock = Vector((p[0].x * 0.6, p[0].y, p[0].z + 0.6))
    G.bone("Leg" + sfx, sock, p[1], "Chest" if key.startswith('front') else "Body", limb=key)
    G.bone("Shin" + sfx, p[1], p[2], "Leg" + sfx, limb=key)
    G.bone("Foot" + sfx, p[2], p[3], "Shin" + sfx, limb=key)
G.skin()

ZERO = ((0, 0, 0), (0, 0, 0))


def gait(n, w, phase, stride, lift, gather=0):
    """a leg's swing: phase picks the leg's place in the gait. +X swings a leg back"""
    for sfx, ph in phase.items():
        if not n.endswith(sfx): continue
        part = n[:-len(sfx)]
        a = w + ph
        swing = stride * math.sin(a)
        up = max(0.0, math.sin(a + math.pi / 2))
        hind = sfx.startswith("Hind")
        out = 8 + gather * max(0.0, -math.sin(a)) if hind else -gather * 0.4 * max(0.0, math.sin(a))
        splay = out * (1 if sfx.endswith("Left") else -1)
        if part == "Leg": return (swing, 0, splay), (0, 0, 0)
        if part == "Shin": return ((lift if hind else -lift) * up * 0.8, 0, 0), (0, 0, 0)
        if part == "Foot": return (-swing * 0.6 + (-lift if hind else lift) * 0.5 * up, 0, 0), (0, 0, 0)
    return None


WALK = {"FrontLeft": 0, "HindRight": 0.4, "FrontRight": math.pi, "HindLeft": math.pi + 0.4}
BOUND = {"FrontLeft": 0, "FrontRight": 0.5, "HindLeft": math.pi, "HindRight": math.pi + 0.5}


def tail_wave(n, w, sway, lag=0.8):
    """the tail swinging along the ground: each bone its share, a little behind the one before"""
    if not n.startswith("Tail"): return None
    k = int(n.split('.')[1]) if '.' in n else 0
    return (0, 0, sway * math.sin(w - k * lag) / TAIL_BONES * 2), (0, 0, 0)


RS, RL = E('RS', 26), E('RL', 1.6)


def run(n, ph):
    """the scurry the pack runs at you in: a quick bound, the hump flexing, the head low, the tail whipping"""
    w = ph * 2 * math.pi * 2
    g = gait(n, w, BOUND, RS, RL, gather=E('RG', 12))
    if g: return g
    t = tail_wave(n, w, 14)
    if t: return t
    if n == "Body": return (6 * math.sin(w), 0, 0), (0, 0, 0.2 * math.sin(w + 1))
    if n == "Chest": return (-4 * math.sin(w), 0, 0), (0, 0, 0)
    if n.startswith("Neck"): return (4 / NECK_BONES, 0, 0), (0, 0, 0)
    if n == "Head": return (-3 - 2 * math.sin(w), 0, 0), (0, 0, 0)
    if n.startswith("Ear"): return (E("RE", 8), 0, 0), (0, 0, 0)
    return ZERO


def walk(n, ph):
    """a rat's walk: diagonal pairs, the hump rolling, the nose working, the tail dragging side to side"""
    w = ph * 2 * math.pi * 2
    g = gait(n, w, WALK, 14, 26)
    if g: return g
    t = tail_wave(n, ph * 2 * math.pi, 10)
    if t: return t
    if n == "Body": return (0, 0, 2 * math.sin(w)), (0, 0, 0.05 * abs(math.cos(w)))
    if n == "Chest": return (0, 2 * math.sin(w), 0), (0, 0, 0)
    if n == "Head": return (2 * math.sin(w * 4), 0, -3 * math.sin(w)), (0, 0, 0)
    return ZERO


def sniff(n, ph):
    """stopped, the front up a little, nose up and working the air, an ear turning, the tail tip flicking"""
    w = ph * 2 * math.pi
    up = E('SU', 10)
    if n == "Body": return (-up, 0, 0), (0, 0, 0)
    if n.startswith("LegFront"): return (up, 0, 0), (0, 0, 0)
    if n.startswith("LegHind"): return (up, 0, 0), (0, 0, 0)
    if n.startswith("Neck"): return (0, 0, E('SN', 8) * math.sin(w) / NECK_BONES), (0, 0, 0)
    if n == "Head": return (E('SH0', -2) + 2 * math.sin(w * 16), 0, E('SN', 8) * math.sin(w)), (0, 0, 0)
    if n == "EarRight": return (0, 0, E("SE", -10) * max(0, math.sin(w * 3)) ** 4), (0, 0, 0)
    if n.startswith("Tail"):
        k = int(n.split('.')[1]) if '.' in n else 0
        return (0, 0, (10 * math.sin(w * 4) if k >= TAIL_BONES - 3 else 0)), (0, 0, 0)
    return ZERO


def hop(n, ph):
    """startled, as a skater goes over: a crouch, a spring with all four legs flung out, a tuck to land"""
    crouch = ease(min(1, ph / 0.25)) * (1 - ease(min(1, max(0, (ph - 0.25) / 0.1))))
    fly = ease(min(1, max(0, (ph - 0.3) / 0.15))) * (1 - ease(min(1, max(0, (ph - 0.65) / 0.2))))
    land = ease(min(1, max(0, (ph - 0.7) / 0.15))) * (1 - ease(min(1, max(0, (ph - 0.9) / 0.1))))
    if n == "Body": return (-8 * fly + 4 * land, 0, 0), (0, 0, -0.6 * crouch - 0.3 * land)
    if n.startswith("LegFront"): return (-20 * fly - 8 * land + 8 * crouch, 0, 0), (0, 0, 0)
    if n.startswith("ShinFront"): return (-20 * crouch - 10 * fly, 0, 0), (0, 0, 0)
    if n.startswith("LegHind"): return (-12 * crouch + 22 * fly - 10 * land, 0, 0), (0, 0, 0)
    if n.startswith("ShinHind"): return (24 * crouch - 12 * fly + 14 * land, 0, 0), (0, 0, 0)
    if n.startswith("Head"): return (3 * crouch - 3 * fly, 0, 0), (0, 0, 0)
    if n.startswith("Ear"): return (E("HE", -8) * fly, 0, 0), (0, 0, 0)
    if n.startswith("Tail"): return (0, 0, 16 * fly * math.sin(ph * 12) / TAIL_BONES), (0, 0, 0)
    return ZERO


G.act("run", 12, run)
G.act("walk", 28, walk)
G.act("sniff", 48, sniff)
G.act("hop", 20, hop)
if not os.environ.get('NO_FIX'):
    G.fix_joints()
G.save(OUT, "rat")
