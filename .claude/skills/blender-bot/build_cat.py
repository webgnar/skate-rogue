"""The title screen's tuxedo cat for Skate Escape, one-shot from SKILL.md on
bb_lib (zack 2026-11-05: "do the cat and dog from the intro"). It replaces the
code-built cat in src/title/life.ts and keeps its look (zack: "detail to the
cat"): black, with a white bib, muzzle, belly, socks and tail tip, pink nose
and inner ears, green eyes that catch the light. The colours are the code-built
cat's, so no palette was invented.

  1. block out from one Cube (the ribcage): a slim chest, a short neck, a
     round skull with a short muzzle (one closed head: the cat never opens its
     mouth on screen); the rump and a long tail carried up in an S; four legs
     out of the belly, the hind ones long with the hock turned back; pointed
     ears out of the top of the skull;
  2. knife: brows over the eyes;
  3. clay; personality: a notch out of the right ear (a street cat), the tail
     a little kinked near its tip; accents: eyes, the nose; connect.

Bones: Body, Chest, Neck chain, Head, EarLeft/Right, Tail chain, and a Leg,
Shin, Ankle and Foot to each leg. Actions: walk (diagonal pairs, the tail
swaying), run (a bound), sit (on its haunches, tail wrapped forward, looking
round, the tip twitching), jump (crouch, spring, land).

usage: python build_cat.py -- <out dir> [seed]
    sketch_marks.py -- <out>/cat.blend Cube <out>/cat.png sketched.png --glow=#b8ff6a --glow-ref=<out>/cat.png
    uv_blackout.py  -- <out>/cat.blend Cube sketched.png art/bot/cat.png
    export_glb.py   -- art/bot/cat.blend public/models/bot/cat.glb
"""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bb_lib import Creature, Painter, Rig, ease
from mathutils import Vector
import bmesh

args = sys.argv[sys.argv.index('--') + 1:]
OUT = args[0]
SEED = int(args[1]) if len(args) > 1 else 3
C = Creature(SEED)
J, R = C.J, C.R
bm = C.bm

# ---------- 1. block out ----------
HIP = Vector((0, 0, 7.2))
C.start_cube((3.4, 7.0, 3.3), HIP, round_long=1.15)       # the ribcage and the long loins

front = C.run(C.face_where((0, -1, 0)), [
    ((0, -1, 0.1), 1.0, 1.0, 1.05),      # the chest
    ((0, -1, 0.4), 0.8, 0.82, 0.8),      # the shoulders
], name='chest', region='chest')
front = C.run(front, [
    ((0, -0.8, 0.7), 1.0, 0.85, 0.9),    # a short neck
], name='neck', region='neck')
front = C.run(front, [
    ((0, -1, 0.25), 0.7, 1.4, 1.35),     # the round skull swells
    ((0, -1, 0.0), 1.3, 0.95, 0.95),
    ((0, -1, -0.15), 0.7, 0.72, 0.72),   # the short muzzle
    ((0, -1, -0.1), 0.45, 0.7, 0.65),
], name='head', region='head')

tail = C.run(C.face_where((0, 1, 0)), [
    ((0, 1, -0.05), 1.0, 0.9, 0.9),      # the rump
    ((0, 1, 0.2), 0.8, 0.42, 0.42),      # the tail's root
], name='rump', region='body')
tip = C.run(tail, [
    ((0, 1, 0.35), 1.6, 0.92, 0.92),     # the tail, long, carried up in an S
    ((0, 0.6, 0.8), 1.6, 0.92, 0.92),
    ((0, 0.1, 1), 1.6, 0.92, 0.92),
    ((0, -0.3, 1), 1.4, 0.9, 0.9),
    ((0, -0.6, 0.6), 1.2, 0.85, 0.85),
], name='tail', region='tail')
C.end_point(tip, tip.calc_center_median() + Vector((0, -0.4, 0.2)))


def belly_pair(y0, y1, x_cut, below=0.8):
    """the underside between y0 and y1 knifed into a left and a right patch, each one face"""
    bm.normal_update()
    faces = [f for f in bm.faces if f.normal.z < -0.3 and f.calc_center_median().z < HIP.z - below
             and min(v.co.y for v in f.verts) < y1 and max(v.co.y for v in f.verts) > y0
             and all(v[C.LIMB] == 0 and v[C.REG] == 0 for v in f.verts)]
    pats = C.knife_pair(faces, [((0, y1, 0), (0, 1, 0)), ((0, y0, 0), (0, -1, 0))], x_cut)
    for side in (-1, 1):
        fs = pats[side]
        pats[side] = fs[0] if len(fs) == 1 else bmesh.ops.dissolve_faces(bm, faces=fs)['region'][0]
    bm.normal_update()
    return pats


LEGS = {}
fp = belly_pair(-3.4, -1.7, 0.3)
for side in (-1, 1):
    key = 'front_l' if side < 0 else 'front_r'
    C.run(fp[side], [
        (tuple(fp[side].normal), 0.4, 1.0, 1.0, (1.05, 1.0, 1.0), (side * 0.1, 0, 0)),   # the shoulder
        ((side * 0.04, 0.12, -1), 1.6, 0.8, 1.0),        # the upper arm
        ((0, -0.05, -1), 1.9, 0.8, 1.0),                 # the slim forearm
        ((0, -0.1, -1), 0.9, 0.9, 1.0),                  # the pastern
        ((0, -1, -0.2), 0.7, 1.0, 0.6),                  # the round paw
    ], name=key, region='leg')
    LEGS[key] = side
hp = belly_pair(1.5, 3.4, 0.3)
for side in (-1, 1):
    key = 'hind_l' if side < 0 else 'hind_r'
    C.run(hp[side], [
        (tuple(hp[side].normal), 0.4, 1.0, 1.0, (1.1, 1.0, 1.0), (side * 0.1, 0, 0)),    # the haunch
        ((side * 0.04, -0.35, -1), 1.7, 0.85, 1.0),      # the thigh, forward
        ((0, 0.5, -1), 1.7, 0.75, 1.0),                  # the shin, back to the hock
        ((0, -0.08, -1), 1.3, 0.9, 1.0),                 # the long foot to the ground
        ((0, -1, -0.2), 0.7, 1.0, 0.6),                  # the paw
    ], name=key, region='leg')
    LEGS[key] = side

# pointed ears out of the top of the skull
hd = J['head']
hw = max(abs(p.x) for p in R['head'][0])
top = [f for f in bm.faces if C.on('head', f) and f.normal.z > 0.3 and hd[0].y + 0.3 > f.calc_center_median().y > hd[1].y]
ep = C.knife_pair(top, [((0, hd[0].y + 0.1, 0), (0, 1, 0)), ((0, hd[0].y - 0.9, 0), (0, -1, 0))], hw * 0.3)
EARS = {}
for side in (-1, 1):
    fs = ep[side]
    face = fs[0] if len(fs) == 1 else bmesh.ops.dissolve_faces(bm, faces=fs)['region'][0]
    key = 'ear_l' if side < 0 else 'ear_r'
    tipf = C.run(face, [
        (tuple(face.normal), 0.25, 0.95, 1.0),                         # the ear's root
        ((side * 0.3, 0.05, 1), 0.9, 0.6, 1.0, (1.0, 0.45, 1.0)),      # up, thin front to back
    ], name=key, region='ear')
    C.end_point(tipf, tipf.calc_center_median() + Vector((side * 0.15, 0.05, 0.7)))
    EARS[key] = side

# a slim cat: nose to tail tip 1.0, head 0.13, head depth 0.12, body at the hips 0.14,
# height ear tips to soles 0.5
REF = {'head_len': 0.16, 'head_depth': 0.13, 'body_depth': 0.16, 'height': 0.62}
OFF = C.proportions(REF)
if os.environ.get('BLOCKOUT_ONLY'):
    for k in LEGS: print('FOOT', k, [round(c, 2) for c in J[k][-1]])
    _x = C.crossings(); inv = {v: k for k, v in C.regions.items()}
    print('CROSSINGS', len(_x), sorted({inv[v[C.REG]] for v in _x}))
    C.to_object(); import bpy; bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "cat_blockout.blend")); sys.exit(0)

# ---------- 2. knife and extrude ----------
brow = [f for f in bm.faces if C.on('head', f) and f.normal.z > 0.5 and hd[1].y + 0.6 > f.calc_center_median().y > hd[2].y]
br = C.knife_pair(brow, [((0, hd[1].y + 0.4, 0), (0, 1, 0)), ((0, hd[1].y - 0.4, 0), (0, -1, 0))], hw * 0.12)
for side in (-1, 1):
    if br[side]: C.pull(br[side], (side * 0.3, -0.3, 1), 0.18, shrink=0.85)        # brows over the eyes

assert C.mirror_error() < 1e-3, "the skeleton must be mirror-true before the clay"
C.clay(jitter=0.03, lumps=4, box=((-2, 2), (-7, 5), (3, 10)), lump_r=(0.8, 1.6), lump_amt=(-0.1, 0.12))

# ---------- personality ----------
er = J['ear_r']                                # a notch out of the right ear, a street cat
for v in bm.verts:
    if v[C.LIMB] == C.limbs['ear_r'] and v.co.z > er[0].z + 0.2 and v.co.y > er[1].y:
        v.co.z -= 0.25
tl = J['tail']                                 # the tail kinked near its tip, an old break
for v in bm.verts:
    if v[C.LIMB] == C.limbs['tail'] and v.co.z > tl[-2].z - 0.2:
        v.co.x += 0.25

# ---------- accents ----------
for side in (-1, 1):
    p = C.skin((side * 9, hd[1].y - 0.1, hd[1].z + 0.15), (-side, 0, 0))
    if p is not None: C.ball(p + Vector((side * 0.08, 0, 0)), 0.3, 'eyes')
p = C.skin(hd[-1] + Vector((0, -6, 0.2)), (0, 1, 0))
if p is not None: C.ball(p + Vector((0, 0.1, 0)), 0.22, 'nose')
C.connect()
ob, me = C.to_object()

# ---------- paint: the tuxedo's own colours (the code-built cat's) ----------
FUR, BACKC, WHITE, PINK, EYE, INK, MARK = "#23202a", "#18161d", "#f2f0f6", "#e89aa8", "#b8ff6a", "#0a0a0a", "#3a3542"
P = Painter(C, FUR, size=512)
V = P.V; PZ = P.PZ; PY = P.PY
BODY = P.region('body', 'chest'); NECK = P.region('neck'); HEAD = P.region('head'); TAILR = P.region('tail')
LEG = P.region('leg'); EAR = P.region('ear')
P.broad(min(V[:, 1]), max(V[:, 1]), BACKC, 'above', r=1.0, step=0.35)                  # a darker back
P.broad(J['chest'][0].y + 0.2, J['rump'][0].y - 1.5, WHITE, 'below', r=0.9, step=0.3)    # the white belly
for side in (-1, 1):                                                                    # the white bib
    P.side_oval(J['chest'][-1].y + 0.2, J['chest'][-1].z - 0.5, 0.9, 1.3, WHITE, BODY | NECK, side, tilt=0.4)
P.view_line([J['chest'][0] + Vector((0, 0, -1.2)), J['neck'][0], J['neck'][-1] + Vector((0, 0, -0.6))], 0.9, WHITE, BODY | NECK, 'front')
P.img[HEAD & (PY < hd[2].y + 0.2) & (PZ < hd[2].z + 0.15) & P.mask] = P.col(WHITE)     # the white muzzle and chin
P.view_line([hd[1] + Vector((0, 0, 0.9)), hd[2] + Vector((0, 0, 0.1))], 0.35, WHITE, HEAD, 'front')   # the blaze up the nose
P.img[LEG & (PZ < 1.6) & P.mask] = P.col(WHITE)                                         # white socks
P.img[TAILR & (PZ > J['tail'][-2].z + 0.2) & P.mask] = P.col(WHITE)                       # the white tail tip
for side in (-1, 1):                                                                    # pink inner ears
    e = J['ear_l' if side < 0 else 'ear_r']
    P.view_line([e[0] + Vector((0, 0, 0.1)), e[-1] + Vector((0, 0, -0.1))], 0.25, PINK, EAR, 'front')
# the skeleton under the coat, in a dark grey that reads on black: ribs, the shoulder blade, the hip, the spine
for side in (-1, 1):
    for k in range(4):
        y = -2.2 + k * 0.8
        tz, bz = P.top_z(y, HIP.z + 1.5), P.bot_z(y, HIP.z - 1.5)
        P.side_line([(y - 0.15, tz - 1.0), (y + 0.3, bz + 0.9)], 0.12, MARK, BODY, side)
    P.side_line([(-2.8, HIP.z + 1.3), (-2.0, HIP.z - 0.3)], 0.16, MARK, BODY, side)
    P.side_oval(2.3, HIP.z + 0.3, 0.7, 0.55, MARK, BODY, side)
for view in ('front', 'back'):
    for lk in LEGS:
        L = J[lk]
        P.view_line([L[1], L[2], L[3]], 0.14, MARK, LEG & (PZ >= 1.6), view)
P.spine_bars([J['neck'][-1], J['neck'][0], J['chest'][0], HIP, J['rump'][0]] + J['tail'][:3], MARK, BODY | NECK | TAILR, every=0.9, width=0.35)
P.accents({'eyes': EYE, 'nose': PINK})
for e in C.ACC['eyes']:
    P.dab(e + Vector((math.copysign(0.24, e.x), -0.05, 0)), 0.09, INK)       # the slit pupil
    P.dab(e + Vector((math.copysign(0.24, e.x), -0.05, 0.12)), 0.07, INK)
    P.dab(e + Vector((math.copysign(0.24, e.x), -0.05, -0.12)), 0.07, INK)
P.save(OUT, "cat")

# ---------- rig ----------
G = Rig(C)
REAR = Vector((0, 3.0, HIP.z))
G.bone("Body", REAR, J['chest'][0])
G.bone("Chest", J['chest'][0], J['chest'][-1], "Body")
G.chain("Neck", [J['chest'][-1]] + J['neck'], "Chest")
NECK_BONES = len(J['neck'])
G.bone("Head", J['neck'][-1], J['head'][-1], "Neck")
for key, side in EARS.items():
    e = J[key]; nm = "Ear" + ("Left" if side < 0 else "Right")
    G.bone(nm, e[0], e[-1] + Vector((0, 0, 0.6)), "Head", limb=key, hinge=True)
G.chain("Tail", [REAR + Vector((0, 1.0, 0.4))] + J['tail'], "Body", limb='tail')
TAIL_BONES = len(J['tail'])
for key, side in LEGS.items():
    p = J[key]
    sfx = ("Front" if key.startswith('front') else "Hind") + ("Left" if side < 0 else "Right")
    sock = Vector((p[0].x * 0.6, p[0].y, HIP.z - 0.6))
    G.bone("Leg" + sfx, sock, p[1], "Body", limb=key)
    G.bone("Shin" + sfx, p[1], p[2], "Leg" + sfx, limb=key)
    G.bone("Ankle" + sfx, p[2], p[3], "Shin" + sfx, limb=key)
    G.bone("Foot" + sfx, p[3], p[4], "Ankle" + sfx, limb=key)
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
        # the hind feet track outside the front ones, and swing wider still as they reach forward
        # past them (a bound gathers all four under the belly); a front foot reaching back tucks in
        out = 10 + gather * max(0.0, -math.sin(a)) if hind else -gather * 0.4 * max(0.0, math.sin(a))
        splay = out * (1 if sfx.endswith("Left") else -1)
        if part == "Leg": return (swing, 0, splay), (0, 0, 0)
        if part == "Shin": return ((lift if hind else -lift) * up * 0.6, 0, 0), (0, 0, 0)
        if part == "Ankle": return ((-lift if hind else lift) * up, 0, 0), (0, 0, 0)
        if part == "Foot": return (-swing * 0.5 + lift * 0.4 * up, 0, 0), (0, 0, 0)
    return None


WALK = {"FrontLeft": 0, "HindRight": 0.4, "FrontRight": math.pi, "HindLeft": math.pi + 0.4}
BOUND = {"FrontLeft": 0, "FrontRight": 0.4, "HindLeft": math.pi, "HindRight": math.pi + 0.4}


def tail_wave(n, w, up, sway):
    """a slow S down the tail: each bone its share, a little behind the one before"""
    if not n.startswith("Tail"): return None
    k = int(n.split('.')[1]) if '.' in n else 0
    return (up / TAIL_BONES, 0, sway * math.sin(w - k * 0.7) / TAIL_BONES * 2), (0, 0, 0)


def walk(n, ph):
    """a cat's walk: diagonal pairs a little apart, the shoulders rolling, the head level, the tail swaying"""
    w = ph * 2 * math.pi * 2
    g = gait(n, w, WALK, 16, 30)
    if g: return g
    t = tail_wave(n, ph * 2 * math.pi, -4, 14)
    if t: return t
    if n == "Body": return (0, 0, 2.5 * math.sin(w)), (0, 0, 0.06 * abs(math.cos(w)))
    if n == "Chest": return (0, 2 * math.sin(w), 0), (0, 0, 0)
    if n == "Head": return (-1.5 * math.sin(w * 2), 0, -2.5 * math.sin(w)), (0, 0, 0)
    if n.startswith("Ear"): return (0, 0, 0), (0, 0, 0)
    return ZERO


def run(n, ph):
    """the bound: front pair, then the hind pair, the back flexing, the tail streaming"""
    w = ph * 2 * math.pi * 2
    g = gait(n, w, BOUND, 24, 36, gather=16)
    if g: return g
    t = tail_wave(n, w, 18, 4)
    if t: return t
    if n == "Body": return (7 * math.sin(w), 0, 0), (0, 0, 0.25 * math.sin(w + 1))
    if n == "Chest": return (-5 * math.sin(w), 0, 0), (0, 0, 0)
    if n.startswith("Neck"): return (6 / NECK_BONES, 0, 0), (0, 0, 0)
    if n == "Head": return (-4 - 3 * math.sin(w), 0, 0), (0, 0, 0)
    if n.startswith("Ear"): return (20, 0, 0), (0, 0, 0)
    return ZERO


SIT_BODY = float(os.environ.get("SIT_BODY", -36))
SIT_DROP = float(os.environ.get("SIT_DROP", 3.8))


E = lambda k, d: float(os.environ.get(k, d))
SH_LX, SH_LZ, SH_SH, SH_AH = E("SH_LX", 0), E("SH_LZ", 35), E("SH_SH", 40), E("SH_AH", -10)   # the sat hind leg


def sat(n):
    """the sitting pose, to lay the sit over"""
    if n == "Body": return [SIT_BODY, 0, 0], [0, 0, SIT_DROP]
    if n.startswith("LegFront"): return [-SIT_BODY - 12, 0, 0], [0, 0, 0]
    if n.startswith("FootFront"): return [-6, 0, 0], [0, 0, 0]
    if n.startswith("LegHind"): return [SH_LX, 0, -SH_LZ if n.endswith("Right") else SH_LZ], [0, 0, 0]
    if n.startswith("ShinHind"): return [SH_SH, 0, 0], [0, 0, 0]
    if n.startswith("AnkleHind"): return [SH_AH, 0, 0], [0, 0, 0]
    if n.startswith("FootHind"): return [-10, 0, 0], [0, 0, 0]
    if n.startswith("Neck"): return [-SIT_BODY * 0.5 / NECK_BONES, 0, 0], [0, 0, 0]
    if n == "Head": return [-SIT_BODY * 0.45, 0, 0], [0, 0, 0]
    return [0, 0, 0], [0, 0, 0]


def sit(n, ph):
    """sat on a sign, tail wrapped round its feet with the tip twitching, looking about, an ear flick"""
    w = ph * 2 * math.pi
    r, l = sat(n)
    if n.startswith("Tail"):
        k = int(n.split('.')[1]) if '.' in n else 0
        r = [0 if k == 0 else 4, 0, (15 if k == 0 else 35 if k < 3 else 24) + (12 * math.sin(w * 6) if k >= TAIL_BONES - 2 else 0)]
    if n == "Head": r[2] += 30 * math.sin(w) ; r[0] += 4 * math.sin(w * 2)
    if n == "EarRight": r[1] += 25 * max(0, math.sin(w * 10 - 2)) ** 8
    if n == "Chest": r[0] += 1 * math.sin(w * 4)                       # breathing
    return tuple(r), tuple(l)


def jump(n, ph):
    """crouch, spring out with the front legs reaching, the hind ones trailing, then tuck to land"""
    crouch = ease(min(1, ph / 0.3)) * (1 - ease(min(1, max(0, (ph - 0.3) / 0.1))))
    fly = ease(min(1, max(0, (ph - 0.32) / 0.15))) * (1 - ease(min(1, max(0, (ph - 0.7) / 0.2))))
    land = ease(min(1, max(0, (ph - 0.7) / 0.15))) * (1 - ease(min(1, max(0, (ph - 0.9) / 0.1))))
    if n == "Body": return (-10 * fly + 4 * land, 0, 0), (0, 0, -1.2 * crouch - 0.6 * land)
    if n.startswith("LegFront"): return (-24 * fly - 10 * land + 10 * crouch, 0, 0), (0, 0, 0)
    if n.startswith("ShinFront"): return (-30 * crouch - 12 * fly, 0, 0), (0, 0, 0)
    if n.startswith("AnkleFront"): return (40 * crouch + 10 * fly, 0, 0), (0, 0, 0)
    if n.startswith("LegHind"): return (-16 * crouch + 28 * fly - 12 * land, 0, 10 * crouch * (1 if n.endswith("Left") else -1)), (0, 0, 0)
    if n.startswith("ShinHind"): return (36 * crouch - 18 * fly + 20 * land, 0, 0), (0, 0, 0)
    if n.startswith("AnkleHind"): return (-22 * crouch + 20 * fly - 15 * land, 0, 0), (0, 0, 0)
    if n.startswith("Neck"): return ((8 * crouch - 6 * fly) / NECK_BONES, 0, 0), (0, 0, 0)
    if n == "Head": return (6 * crouch + 8 * fly, 0, 0), (0, 0, 0)
    if n.startswith("Ear"): return (16 * fly, 0, 0), (0, 0, 0)
    if n.startswith("Tail"): return ((-20 * crouch + 30 * fly) / TAIL_BONES, 0, 0), (0, 0, 0)
    return ZERO


G.act("walk", 32, walk)
G.act("run", 16, run)
G.act("sit", 72, sit)
G.act("jump", 24, jump)
if not os.environ.get('NO_FIX'):
    G.fix_joints()
G.save(OUT, "cat")
