"""The title screen's dog for Skate Escape, on bb_lib. First a stray mutt
(zack 2026-11-05: "do the cat and dog from the intro"); reshaped 2026-11-06 into
a tri-colour Bernedoodle after zack's photo and cartoon ("trace the dogs outline
and compare it to your dog"): a shorter, deeper body (length to height 1.21, as
the cartoon's outline), a big head on an upright neck, thick legs, long curly
ears, a short plume of a tail; black curly coat, rust legs, cheeks and brows,
white blaze, muzzle and paws.

  1. block out from one Cube (the ribcage): the deep chest, the neck held up,
     the skull knifed across at the mouth into the muzzle and the jaw (it
     pants); the rump and a tail carried up; four legs out of the belly, a
     pair under the chest and a pair under the hips (the hind ones with the
     hock turned back); floppy ears out of the top of the skull;
  2. knife: brows over the eyes, the stop;
  3. clay; personality: the left ear torn short at the tip, a scruffy tuft
     on the right cheek; accents: eyes, the nose, the collar's tag; connect.

Bones: Body, Chest, Neck chain, Head, Jaw, EarLeft/Right, Tail chain, and a
Leg, Shin, Ankle and Foot to each leg (FrontLeft ...). Actions: walk (a trot,
diagonal pairs), run (a gallop), sit (on its haunches, panting, wagging),
sniff (nose down, working), shake (a wet-dog shake).

usage: python build_dog.py -- <out dir> [seed]
    sketch_marks.py -- <out>/dog.blend Cube <out>/dog.png sketched.png
    uv_blackout.py  -- <out>/dog.blend Cube sketched.png art/bot/dog.png
    export_glb.py   -- art/bot/dog.blend public/models/bot/dog.glb
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
JAW = 1

# ---------- 1. block out ----------
HIP = Vector((0, 0, E('HZ', 9.8)))
C.start_cube((5.0, E('BL', 12.0), E('BD', 6.4)), HIP, round_long=1.6)        # the ribcage and loins

front = C.run(C.face_where((0, -1, 0)), [
    ((0, -1, E('CZ', 0.05)), 0.6, 1.0, 1.15),    # the deep chest, dropping to the front legs
    ((0, -0.6, E('SZ', 0.4)), 0.5, 0.95, 1.0),      # the shoulders, rounding up
], name='chest', region='chest')
front = C.run(front, [
    ((0, E('NY', -0.25), 1), E('N1', 0.4), 1.0, 1.0),   # the neck, thick, reaching forward and up
    ((0, E('NY', -0.25) * 0.6, 1), E('N2', 0.3), 1.0, 1.0),
], name='neck', region='neck')
front = C.run(front, [
    ((0, -1, 0.1), 1.0, E('HS', 1.0), 1.0),      # the back of the skull swells: a big round doodle head
    ((0, -1, 0.0), E('SK', 1.3), 1.0, 0.9),       # the skull, to the stop
], name='head', region='head')
nc = front.calc_center_median()
hh = max(v.co.z for v in front.verts) - min(v.co.z for v in front.verts)
MOUTH_Z = nc.z - hh * 0.22
low, up = C.split_face(front, (0, 0, MOUTH_Z))
C.run(up, [
    ((0, -1, -0.1), 1.0, 0.9, 0.85),     # the muzzle
    ((0, -1, -0.05), 0.8, 0.85, 0.85),   # to the nose
], name='muzzle', region='head', keep=(MOUTH_Z, 1, 2))
C.run(low, [
    ((0, -1, -0.12), 0.9, 0.85, 0.8),    # the lower jaw
    ((0, -1, 0.0), 0.8, 0.8, 0.8),
], name='jaw', region='head', part=JAW, keep=(MOUTH_Z, -1, 2))

tail = C.run(C.face_where((0, 1, 0)), [
    ((0, 1, 0.0), 0.4, 0.95, 0.95),      # the rump
    ((0, 1, E('TR', -0.5)), 0.7, 0.6, 0.6),      # the tail's root
], name='rump', region='body')
tip = C.run(tail, [
    ((0, E('TY', 0.35), -0.6), 1.6, 0.9, 0.9),     # the tail, an otter tail hanging down behind
    ((0, 0.5, -1), 1.8, 0.85, 0.85),
    ((0, 0.3, -1), 1.4, 0.7, 0.7),
], name='tail', region='tail')
C.end_point(tip, tip.calc_center_median() + Vector((0, -0.2, 0.6)))


OPEN = (0, C.regions['chest'], C.regions['neck'])   # a leg may grow out of the body or the chest


def belly_pair(y0, y1, x_cut, below=1.0):
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
fp = belly_pair(E('F0', -9.4), E('F1', -7.2), E('FX', 0.6))
for side in (-1, 1):
    key = 'front_l' if side < 0 else 'front_r'
    C.run(fp[side], [
        (tuple(fp[side].normal), 0.5, 1.0, 1.0, (1.1, 1.0, 1.0), (side * 0.15, 0, 0)),   # the shoulder
        ((side * 0.05, E('UA', 0.05), -1), 1.4, 1.05, 1.0),       # the upper arm, forward under the chest, thick with coat
        ((0, -0.05, -1), E('FA', 2.6), 1.05, 1.0),               # the forearm, fluffing out to the paw
        ((0, E('PA', 0.0), -1), 1.0, 1.05, 1.0),                # the pastern
        ((0, -1, -0.2), 0.9, 1.0, 0.55),                 # the paw
    ], name=key, region='leg')
    LEGS[key] = side
hp = belly_pair(E('H0', 3.4), E('H1', 5.8), 0.3)
for side in (-1, 1):
    key = 'hind_l' if side < 0 else 'hind_r'
    C.run(hp[side], [
        (tuple(hp[side].normal), 0.5, 1.0, 1.0, (1.15, 1.0, 1.0), (side * 0.15, 0, 0)),  # the haunch
        ((side * 0.05, -0.1, -1), E('TH', 1.9), 1.05, 1.0),       # the thigh
        ((0, 0.4, -1), E('SH', 1.9), 1.0, 1.0),                   # the shin, back to the hock
        ((0, -0.08, -1), 1.0, 1.05, 1.0),                # below the hock
        ((0, -1, -0.2), 0.9, 1.0, 0.55),                 # the paw
    ], name=key, region='leg')
    LEGS[key] = side

# floppy ears out of the top of the skull, hanging down its sides
hd = J['head']
hw = max(abs(p.x) for p in R['head'][0])
top = [f for f in bm.faces if C.on('head', f) and f.normal.z > 0.2 and abs(f.normal.x) > 0.3
       and hd[0].y + 0.4 > f.calc_center_median().y > hd[1].y + 0.3]
ep = C.knife_pair(top, [((0, hd[0].y + 0.1, 0), (0, 1, 0)), ((0, hd[0].y - 1.0, 0), (0, -1, 0))], hw * 0.55)
EARS = {}
for side in (-1, 1):
    fs = ep[side]
    face = fs[0] if len(fs) == 1 else bmesh.ops.dissolve_faces(bm, faces=fs)['region'][0]
    key = 'ear_l' if side < 0 else 'ear_r'
    tipf = C.run(face, [
        (tuple(face.normal), 0.2, 0.85, 1.0),                        # the ear's root
        ((side * 0.5, 0.0, -1), 0.45, 0.9, 1.0, (0.5, 1.1, 1.0)),    # off the side of the skull, folding over
        ((side * 0.08, 0.05, -1), 2.3, 1.0, 1.0, (0.5, 1.3, 1.0)),  # the flap, long and curly, hanging by the cheek
        ((side * 0.05, 0.0, -1), 1.0, 0.7, 1.0),
    ], name=key, region='ear')
    C.end_point(tipf, tipf.calc_center_median() + Vector((0, 0, -0.35)))
    EARS[key] = side

# a mutt off the street: length nose to tail 2.1, head 0.55, head depth 0.36,
# body at the hips 0.5, height back of the skull to the soles 1.55
REF = {'head_len': 0.26, 'head_depth': 0.17, 'body_depth': 0.22, 'height': 0.72}
OFF = C.proportions(REF)
if os.environ.get('BLOCKOUT_ONLY'):
    for k in LEGS: print('FOOT', k, [round(c, 2) for c in J[k][-1]])
    _x = C.crossings(); inv = {v: k for k, v in C.regions.items()}
    print('CROSSINGS', len(_x), sorted({inv[v[C.REG]] for v in _x}))
    C.to_object(); import bpy; bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "dog_blockout.blend")); sys.exit(0)

# ---------- 2. knife and extrude ----------
mz = J['muzzle']
brow = [f for f in bm.faces if C.on('head', f) and f.normal.z > 0.5 and hd[1].y + 0.9 > f.calc_center_median().y > hd[1].y - 0.4]
br = C.knife_pair(brow, [((0, hd[1].y + 0.7, 0), (0, 1, 0)), ((0, hd[1].y - 0.3, 0), (0, -1, 0))], hw * 0.15)
for side in (-1, 1):
    if br[side]: C.pull(br[side], (side * 0.3, -0.3, 1), 0.3, shrink=0.85)        # brows over the eyes

assert C.mirror_error() < 1e-3, "the skeleton must be mirror-true before the clay"
C.clay(jitter=0.04, lumps=5, box=((-2.5, 2.5), (-9, 6), (3, 14)), lump_r=(1.0, 2.0), lump_amt=(-0.12, 0.16))

# ---------- personality ----------
# a doodle's coat: lots of small soft lumps all over, the curls (the clay above gives the big ones)
C.clay(jitter=0.03, lumps=16, box=((-2.8, 2.8), (-9, 7), (2, 15)), lump_r=(0.6, 1.1), lump_amt=(-0.06, 0.18))

# ---------- accents ----------
for side in (-1, 1):
    p = C.skin((side * 9, hd[1].y - 0.1, hd[1].z + 0.35), (-side, 0, 0))
    if p is not None: C.ball(p + Vector((side * 0.1, 0, 0)), 0.3, 'eyes')
nose = J['muzzle'][-1]
p = C.skin(nose + Vector((0, -6, 0.25)), (0, 1, 0))
if p is not None: C.ball(p + Vector((0, 0.15, 0)), 0.5, 'nose')
C.connect()
ob, me = C.to_object()

# ---------- paint: a tri-colour Bernedoodle (zack's photo and cartoon, 2026-11-06) ----------
# black curly coat, rust on the legs, the cheeks and over the eyes, white down the chest, on the muzzle and the paws
BLACK, CURL, RUST, WHITE, INK, PINK = "#231e1d", "#3b3230", "#b0602c", "#efe9df", "#141218", "#d8586a"
P = Painter(C, BLACK, size=512)
V = P.V; PZ = P.PZ; PY = P.PY
BODY = P.region('body', 'chest'); NECK = P.region('neck'); HEAD = P.region('head'); TAILR = P.region('tail')
LEG = P.region('leg'); EAR = P.region('ear')
FEET = min(J[k][-1].z for k in LEGS)
P.img[LEG & (PZ < FEET + 3.2) & P.mask] = P.col(RUST)                             # rust legs
P.img[LEG & (PZ < FEET + 0.9) & P.mask] = P.col(WHITE)                            # white paws
P.view_line([J['chest'][0] + Vector((0, 0, -1.8)), J['neck'][0], J['neck'][-1] + Vector((0, 0, -0.6))], 1.2, WHITE, BODY | NECK, 'front')   # the white blaze down the chest
P.img[HEAD & (PY < mz[0].y + 0.5) & P.mask] = P.col(RUST)                         # rust cheeks and muzzle sides
P.img[HEAD & (PY < mz[0].y + 0.2) & (PZ < MOUTH_Z + 0.9) & P.mask] = P.col(WHITE)  # the white muzzle and chin
P.view_line([Vector((0, 0, MOUTH_Z + 0.4)), Vector((0, 0, hd[-1].z + 1.6))], 0.5, WHITE, HEAD, 'front')   # the white stripe up the face
for side in (-1, 1):
    P.side_oval(hd[1].y - 0.2, hd[1].z + 0.95, 0.35, 0.28, RUST, HEAD, side)          # rust brows over the eyes
P.img[TAILR & (PZ > J['tail'][-2].z + 0.3) & P.mask] = P.col(WHITE)                 # a white tip to the plume
# the curls: little lighter rings all over the black (the cartoon's curl marks)
import random
_r = random.Random(7)
for _ in range(220):
    y = _r.uniform(-6, 6); z = _r.uniform(FEET + 3.6, 15); side = _r.choice((-1, 1))
    p = C.skin((side * 12, y, z), (-side, 0, 0))
    if p is None: continue
    P.dab(p, _r.uniform(0.18, 0.3), CURL)
P.accents({'eyes': INK, 'nose': INK})
for e in C.ACC['eyes']:
    P.dab(e + Vector((math.copysign(0.22, e.x), -0.14, 0.1)), 0.08, WHITE)     # a catchlight
P.save(OUT, "dog")

# ---------- rig ----------
G = Rig(C)
REAR = Vector((0, 4.0, HIP.z))
G.bone("Body", REAR, J['chest'][0])
G.bone("Chest", J['chest'][0], J['chest'][-1], "Body")
G.chain("Neck", [J['chest'][-1]] + J['neck'], "Chest")
NECK_BONES = len(J['neck'])
G.bone("Head", J['neck'][-1], J['head'][-1], "Neck.%03d" % (NECK_BONES - 1))
G.bone("Snout", J['head'][-1], J['muzzle'][-1], "Head", limb='muzzle')
G.bone("Jaw", Vector((0, J['head'][-1].y + 0.4, MOUTH_Z)), J['jaw'][-1], "Head", limb='jaw')
for key, side in EARS.items():
    e = J[key]; nm = "Ear" + ("Left" if side < 0 else "Right")
    G.bone(nm, e[1], e[-1], "Head", limb=key, hinge=True)
G.chain("Tail", [REAR + Vector((0, 1.2, 0.6))] + J['tail'], "Body", limb='tail')
TAIL_BONES = len(J['tail'])
for key, side in LEGS.items():
    p = J[key]
    sfx = ("Front" if key.startswith('front') else "Hind") + ("Left" if side < 0 else "Right")
    sock = Vector((p[0].x * 0.6, p[0].y, HIP.z - 0.8))
    G.bone("Leg" + sfx, sock, p[1], "Chest" if key.startswith("front") else "Body", limb=key)   # the front legs grow out of the chest
    G.bone("Shin" + sfx, p[1], p[2], "Leg" + sfx, limb=key)
    G.bone("Ankle" + sfx, p[2], p[3], "Shin" + sfx, limb=key)
    G.bone("Foot" + sfx, p[3], p[4], "Ankle" + sfx, limb=key)
G.skin(part_bones={JAW: "Jaw"})

ZERO = ((0, 0, 0), (0, 0, 0))
POSE = {}            # bone -> (rx, ry, rz) for the pose being keyed, filled by the actions below


def gait(n, w, phase, stride, lift, gather=0):
    """a leg's swing: phase picks the leg's place in the gait. +X swings a leg back"""
    for sfx, ph in phase.items():
        if not n.endswith(sfx): continue
        part = n[:-len(sfx)]
        a = w + ph
        swing = stride * math.sin(a)                         # forward and back
        up = max(0.0, math.sin(a + math.pi / 2))             # lifted on the swing forward
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


TROT = {"FrontLeft": 0, "HindRight": 0, "FrontRight": math.pi, "HindLeft": math.pi}
GALLOP = {"FrontLeft": 0, "FrontRight": 0.5, "HindLeft": math.pi, "HindRight": math.pi + 0.5}


def walk(n, ph):
    """the trot: diagonal pairs together, the head nodding, the ears and tail swinging"""
    w = ph * 2 * math.pi * 2
    g = gait(n, w, TROT, E("TS", 14), 34, gather=E("TG", 18))
    if g: return g
    if n == "Body": return (0, 0, 2 * math.sin(w)), (0, 0, 0.12 * abs(math.cos(w)))
    if n.startswith("Neck"): return ((3 * math.sin(w * 2)) / NECK_BONES, 0, 0), (0, 0, 0)
    if n == "Head": return (-3 * math.sin(w * 2 + 0.5), 0, 0), (0, 0, 0)
    if n.startswith("Ear"): return (0, 0, 14 * math.sin(w * 2 + 1) * (1 if "Left" in n else -1)), (0, 0, 0)
    if n.startswith("Tail"): return (-6 / TAIL_BONES, 0, 18 * math.sin(w * 2) / TAIL_BONES), (0, 0, 0)
    return ZERO


def run(n, ph):
    """the gallop: the front pair then the hind pair, the back flexing, ears back"""
    w = ph * 2 * math.pi * 2
    g = gait(n, w, GALLOP, E("GS", 16), 36, gather=E("GG", 22))
    if g: return g
    if n == "Body": return (6 * math.sin(w), 0, 0), (0, 0, 0.3 * math.sin(w + 1))
    if n == "Chest": return (-4 * math.sin(w), 0, 0), (0, 0, 0)
    if n.startswith("Neck"): return ((10 + 8 * math.sin(w)) / NECK_BONES, 0, 0), (0, 0, 0)
    if n == "Head": return (-6 - 4 * math.sin(w), 0, 0), (0, 0, 0)
    if n == "Jaw": return (10 + 4 * abs(math.sin(w)), 0, 0), (0, 0, 0)
    if n.startswith("Ear"): return (-30, 0, 10 * (1 if "Left" in n else -1)), (0, 0, 0)
    if n.startswith("Tail"): return (20 / TAIL_BONES, 0, 8 * math.sin(w) / TAIL_BONES), (0, 0, 0)
    return ZERO


SIT_BODY = float(os.environ.get("SIT_BODY", -28))     # the back tipped up on its haunches
SIT_DROP = float(os.environ.get("SIT_DROP", 4.6))


SH_LX, SH_LZ, SH_SH, SH_AH = E("SH_LX", 0), E("SH_LZ", 38), E("SH_SH", 40), E("SH_AH", -10)   # the sat hind leg


def sat(n):
    """the sitting pose, to lay the sit over"""
    if n == "Body": return [SIT_BODY, 0, 0], [0, 0, SIT_DROP]
    if n.startswith("LegFront"): return [-SIT_BODY - E("SIT_FL", 15), 0, 0], [0, 0, 0]
    if n.startswith("FootFront"): return [-6, 0, 0], [0, 0, 0]
    if n.startswith("LegHind"): return [SH_LX, 0, -SH_LZ if n.endswith("Right") else SH_LZ], [0, 0, 0]   # splayed, outside the front legs
    if n.startswith("ShinHind"): return [SH_SH, 0, 0], [0, 0, 0]
    if n.startswith("AnkleHind"): return [SH_AH, 0, 0], [0, 0, 0]
    if n.startswith("FootHind"): return [-10, 0, 0], [0, 0, 0]
    if n.startswith("Neck"): return [-SIT_BODY * 0.5 / NECK_BONES, 0, 0], [0, 0, 0]
    if n == "Head": return [-SIT_BODY * 0.4, 0, 0], [0, 0, 0]
    if n.startswith("Tail"): return [-20 / TAIL_BONES, 0, 0], [0, 0, 0]
    return [0, 0, 0], [0, 0, 0]


def sit(n, ph):
    """sat by the man to be petted: panting, the tail sweeping the pavement, a head tilt"""
    w = ph * 2 * math.pi
    r, l = sat(n)
    if n == "Jaw": r[0] += 12 + 5 * abs(math.sin(w * 6))
    if n == "Chest": r[0] += 1.5 * math.sin(w * 12)                     # the panting breath
    if n.startswith("Tail"): r[2] += 30 * math.sin(w * 4 - int(n[-1:] or 0)) / TAIL_BONES if n != "Tail" else 30 * math.sin(w * 4) / TAIL_BONES
    if n == "Head": r[1] += 14 * math.sin(w) ** 3                        # a tilt, now and then
    if n.startswith("Ear"): r[2] += 6 * math.sin(w * 6) * (1 if "Left" in n else -1)
    return tuple(r), tuple(l)


def sniff(n, ph):
    """nose down at the trash can, working along it, tail going"""
    w = ph * 2 * math.pi
    if n == "Body": return (6, 0, 2 * math.sin(w)), (0, 0, 0)
    if n.startswith("LegFront"): return (-4, 0, 0), (0, 0, 0)
    if n.startswith("Neck"): return ((50 + 4 * math.sin(w * 2)) / NECK_BONES, 0, 6 * math.sin(w) / NECK_BONES), (0, 0, 0)
    if n == "Head": return (12 + 4 * math.sin(w * 9) ** 2, 0, 0), (0, 0, 0)
    if n == "Snout": return (2 * math.sin(w * 18), 0, 0), (0, 0, 0)
    if n.startswith("Ear"): return (14, 0, 0), (0, 0, 0)
    if n.startswith("Tail"): return (-8 / TAIL_BONES, 0, 22 * math.sin(w * 6) / TAIL_BONES), (0, 0, 0)
    return ZERO


def shake(n, ph):
    """a wet-dog shake, stood square: the roll starts at the head and runs down to the tail,
    the ears flapping, then a beat still. (The scratch it replaces lifted a hind leg, which
    the hip's rings can't take without the groin folding through itself.)"""
    w = ph * 2 * math.pi
    env = math.sin(min(1.0, ph / 0.75) * math.pi) ** 2 if ph < 0.75 else 0.0   # shake, then still
    roll = lambda lag: env * math.sin(w * 6 - lag)
    if n == "Head": return (4, 18 * roll(0), 0), (0, 0, 0)
    if n.startswith("Neck"): return (4 / NECK_BONES, 14 * roll(0.4) / NECK_BONES, 0), (0, 0, 0)
    if n == "Chest": return (0, 8 * roll(0.8), 0), (0, 0, 0)
    if n == "Body": return (0, 6 * roll(1.2), 0), (0, 0, 0)
    if n.startswith("Ear"): return (6 * env, 0, (22 * env + 18 * roll(0.2)) * (1 if "Left" in n else -1)), (0, 0, 0)   # flung out, never in
    if n == "Jaw": return (6 * env, 0, 0), (0, 0, 0)
    if n.startswith("Tail"): return (0, 0, 30 * roll(1.8) / TAIL_BONES), (0, 0, 0)
    return ZERO


G.act("walk", 24, walk)
G.act("run", 16, run)
G.act("sit", 48, sit)
G.act("sniff", 36, sniff)
G.act("shake", 24, shake)
if not os.environ.get('NO_FIX'):
    G.fix_joints()
G.save(OUT, "dog")
