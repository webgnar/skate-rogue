"""A city pigeon for Skate Escape, one-shot from SKILL.md on bb_lib, from zack's
reference (2026-11-05: a classic rock pigeon, side on, in an old plate).

Reference read: a plump egg of a body, the breast high and full, a small round
head on a thick neck held up, a short beak with a white cere at its root, an
orange eye; the wings folded down the flanks with their tips crossing over a
long, narrow tail; short legs, feathered to the ankle, then red bare shanks and
red toes, three forward and one back. Colours straight from the bird (zack's
reference names them, so no palette was invented): blue grey #8f9bb0 and a
paler mantle #a9b3c4, a slate head and neck #4c536a with an iridescent green
#2f8c5e and purple #7a4f8f throat, black wing bars and tail band #1d1f2a, red
feet #d8433a, an orange eye #f08a24, a white cere #eef0f2.

  1. block out from one Cube (the middle of the egg): the breast, neck and
     round head out of its front face, the beak one closed wedge (a split
     bill read as a gaping parrot); the back of the egg, the rump and a
     drooping tail fan out of its back face; the legs out of the belly
     (C.leg_patches); the wings out of the upper flank bevels, folded back
     over the rump, the primaries crossing the tail;
  2. knife: a low crown, the cere;
  3. clay; personality: a stubbed middle toe on the left foot (city pigeons
     lose them to string and hair) and a ruffled patch high on the right of
     the breast; accents: eyes, toes, a hind toe; connect.

Bones: Body, Chest, Neck chain, Head, Beak, Tail chain, WingLeft/Right and
their Tip, Leg/Shin/Foot a side. Actions: walk (the head bob: it holds, then
shoots forward), peck (bows, two jabs, tail up), fly (the inner wing swings
30 degrees out of the fold and the outer wing the rest, beating three times a
loop; a wider swing at the shoulder folds the flank), coo (the bow and turn).
A small creature on screen: a 512 texture, a few bones a limb.

Paint: pass 1 here, then pass 3 (sketch marks) and the UV blackout. Pass 2
(beads) was skipped: the bead book is not in this project's files.

usage: python build_pigeon.py -- <out dir> [seed]
    sketch_marks.py -- <out>/pigeon.blend Cube <out>/pigeon.png sketched.png --glow-ref=<out>/pigeon.png
    uv_blackout.py  -- <out>/pigeon.blend Cube sketched.png art/bot/pigeon.png
    export_glb.py   -- art/bot/pigeon.blend public/models/bot/pigeon.glb
"""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bb_lib import Creature, Painter, Rig, ease
from mathutils import Vector
import bmesh
import numpy as np

args = sys.argv[sys.argv.index('--') + 1:]
OUT = args[0]
SEED = int(args[1]) if len(args) > 1 else 3
C = Creature(SEED)
J, R = C.J, C.R
bm = C.bm

# ---------- 1. block out ----------
HIP = Vector((0, 0, 8))
C.start_cube((5.4, 3.0, 6.8), HIP, round_long=1.8, round_plan=0.6)   # the middle of the egg

front = C.run(C.face_where((0, -1, 0)), [
    ((0, -1, 0.25), 1.3, 1.04, 1.0),     # the breast swells
    ((0, -1, 0.6), 1.2, 0.92, 0.95),     # full and forward
    ((0, -0.5, 1), 1.2, 0.74, 0.72),     # rounding up to the throat
], name='chest', region='chest')
front = C.run(front, [
    ((0, -0.3, 1), 1.7, 0.95, 0.95),     # a thick neck, held up
    ((0, -0.1, 1), 1.4, 0.92, 1.0),
], name='neck', region='neck')
# the round head: it swells over the neck and turns forward
front = C.run(front, [
    ((0, -0.4, 1), 0.8, 1.05, 0.9),
    ((0, -1, 0.35), 1.1, 0.95, 0.92),
    ((0, -1, -0.1), 0.9, 0.8, 0.82),     # the face
    ((0, -1, -0.2), 0.35, 0.5, 0.45),    # narrowing to the beak
], name='head', region='head')
# the beak: one closed wedge out of the face (a pigeon's bill is never open
# enough to read, so no jaw split: two halves read as a gaping parrot)
JAW_PIVOT = front.calc_center_median()
MOUTH_Z = JAW_PIVOT.z
beak_tip = C.run(front, [
    ((0, -1, -0.15), 0.45, 0.85, 0.8),   # the cere, the beak's root
    ((0, -1, -0.25), 0.8, 0.7, 0.7),
    ((0, -1, -0.4), 0.45, 0.5, 0.6),     # the tip, hooked a little
], name='beak', region='beak')
C.end_point(beak_tip, beak_tip.calc_center_median() + Vector((0, -0.25, -0.12)))

tail = C.run(C.face_where((0, 1, 0)), [
    ((0, 1, -0.05), 1.4, 0.86, 0.88),                     # the back of the egg
    ((0, 1, -0.15), 1.2, 0.72, 0.6),                      # the rump
    ((0, 1, -0.3), 1.6, 0.85, 0.55, (1.1, 1, 0.75)),      # the tail, drooping, fanning flat
    ((0, 1, -0.35), 2.0, 1.0, 1.0, (1.12, 1, 0.8)),
    ((0, 1, -0.35), 1.2, 1.0, 1.0, (1.06, 1, 0.9)),       # its blunt, banded end
], name='tail', region='tail')

# short legs out of the belly, feathered to the ankle; the shank and foot are bare
pats = C.leg_patches(HIP, y_half=1.0, x_cut=0.95, below=2.0)
for side, key in ((-1, 'leg_l'), (1, 'leg_r')):
    C.run(pats[side], [
        (tuple(pats[side].normal), 0.4, 0.9, 1.0, (1.0, 1.0, 1.0), (side * 0.1, 0, 0)),     # haunch
        ((side * 0.05, 0.15, -1), 0.9, 0.55, 1.0),       # the feathered thigh
        ((0, 0.2, -1), 1.3, 0.6, 1.0),                   # the red shank, back
        ((0, -0.2, -1), 0.35, 0.95, 1.0),                # ankle
        ((0, -1, -0.15), 1.0, 0.8, 0.45),                # the foot, flat and forward
    ], name=key, region='leg')

# the wings, folded: out of the shoulder bevels, round the wrist, swept back
# down the flanks so the tips cross over the tail
def patch_pair(pick, y0, y1, x_cut=0.35):
    bm.normal_update()
    faces = [f for f in bm.faces if all(v[C.REG] == 0 and v[C.LIMB] == 0 for v in f.verts) and pick(f)
             and min(v.co.y for v in f.verts) < y1 and max(v.co.y for v in f.verts) > y0]
    pats = C.knife_pair(faces, [((0, y1, 0), (0, 1, 0)), ((0, y0, 0), (0, -1, 0))], x_cut)
    for side in (-1, 1):
        fs = pats[side]
        pats[side] = fs[0] if len(fs) == 1 else bmesh.ops.dissolve_faces(bm, faces=fs)['region'][0]
    bm.normal_update()
    return pats


WINGS = {}
pats = patch_pair(lambda f: f.normal.z > 0.3 and abs(f.normal.x) > 0.3, -0.6, 1.5, x_cut=0.8)
for side in (-1, 1):
    key = 'wing_l' if side < 0 else 'wing_r'
    tip = C.run(pats[side], [
        ((side * 0.8, 0.45, 0.4), 0.5, 0.75, 0.7, (0.6, 1.0, 1.0)),   # out of the flank, back
        ((side * 0.12, 1, -0.15), 1.8, 1.0, 1.0, (0.6, 1.0, 1.0)),    # the folded wing's end, flat on the rump
        ((-side * 0.02, 1, -0.25), 1.8, 0.9, 0.9),
        ((-side * 0.1, 1, -0.25), 1.8, 0.7, 0.7),                    # the primaries, crossing the tail
        ((-side * 0.1, 1, -0.2), 1.2, 0.45, 0.5),
    ], name=key, region='wing')
    C.end_point(tip, tip.calc_center_median() + Vector((-side * 0.15, 0.7, 0.05)))
    WINGS[key] = side

# the plate: length beak to tail 790, head (back of skull to beak tip) 200, head depth 140,
# body depth at the hips 330, height from the back to the soles 520 (the neck held up adds the rest)
REF = {'head_len': 0.25, 'head_depth': 0.18, 'body_depth': 0.40, 'height': 0.90}
OFF = C.proportions(REF)
if os.environ.get('BLOCKOUT_ONLY'):
    _x = C.crossings(); inv = {v: k for k, v in C.regions.items()}
    print('CROSSINGS', len(_x), sorted({inv[v[C.REG]] for v in _x}), sorted({tuple(round(c, 1) for c in v.co) for v in _x})[:8])
    C.to_object(); import bpy; bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "pigeon_blockout.blend")); sys.exit(0)

# ---------- 2. knife and extrude ----------
hd = J['head']
hw = max(p.x for p in R['head'][1])
crown = [f for f in bm.faces if C.on('head', f) and f.normal.z > 0.6 and hd[0].y - 0.6 < f.calc_center_median().y < hd[1].y + 0.6]
cr = C.knife(crown, [((0.5, 0, 0), (1, 0, 0)), ((-0.5, 0, 0), (-1, 0, 0))])
if cr: C.pull(cr, (0, 0.2, 1), 0.18, shrink=0.9)                   # a low crown over the round head
cere = [f for f in bm.faces if C.on('beak', f) and f.normal.z > 0.4 and f.calc_center_median().y > J['beak'][1].y - 0.2]
ce = C.knife(cere, [((0.35, 0, 0), (1, 0, 0)), ((-0.35, 0, 0), (-1, 0, 0))])
if ce: C.pull(ce, (0, 0, 1), 0.14, shrink=0.85)                   # the white cere

assert C.mirror_error() < 1e-3, "the skeleton must be mirror-true before the clay"
C.clay(jitter=0.03, lumps=4, box=((-2.5, 2.5), (-6, 6), (6, 12)), lump_r=(1.0, 2.0), lump_amt=(-0.12, 0.16))

# ---------- personality ----------
STUB = -1                                    # the left foot's middle toe, lost to a string
ch = J['chest'][0]
for v in bm.verts:                           # a ruffled patch high on the right of the breast
    d = v.co - Vector((2.6, ch.y - 0.4, ch.z + 1.0))
    if d.length < 1.3 and v[C.LIMB] == C.limbs['chest']:
        v.co += Vector((0.22, -0.05, 0.05)) * (1 - d.length / 1.3) * (1 if (v.index % 2) else -0.4)

# ---------- accents ----------
for side in (-1, 1):
    ey = (hd[1].y + hd[2].y) / 2 + 0.1
    p = C.skin((side * 9, ey, hd[1].z + 0.25), (-side, 0, 0))
    if p is not None: C.ball(p - Vector((side * 0.12, 0, 0)), 0.34, 'eyes')
TOES = {}
for key, side in (('leg_l', -1), ('leg_r', 1)):
    toe = J[key][-1]
    hw_ = max(abs(p.x - toe.x) for p in R[key][-1])
    for k in (-1, 0, 1):
        ln = 1.1 if k == 0 else 0.85
        if side == STUB and k == 0: ln = 0.35
        d = Vector((k * 0.45, -1, -0.12)).normalized()
        p = C.skin(toe + Vector((k * hw_ * 0.55, -6, 0.0)), (0, 1, 0))
        if p is not None: C.cone(p - d * 0.12, d, 0.18, ln, 'toes')
    heel = J[key][-2]
    d = Vector((0, 1, -0.3)).normalized()
    p = C.skin(heel + Vector((0, 6, -0.15)), (0, -1, 0))
    if p is not None: C.cone(p - d * 0.1, d, 0.15, 0.6, 'toes')
C.connect()
ob, me = C.to_object()

# ---------- paint: the rock pigeon's own colours ----------
GREY, BACKG, SLATE, GREEN, PURPLE, BAR, INK, RED, ORANGE, CERE, BEAK = (
    "#8f9bb0", "#a9b3c4", "#4c536a", "#2f8c5e", "#7a4f8f", "#1d1f2a", "#14151d", "#d8433a", "#f08a24", "#eef0f2", "#3a3a40")
P = Painter(C, GREY, size=512)
V = P.V; PZ = P.PZ; PY = P.PY
P.broad(min(V[:, 1]), max(V[:, 1]), BACKG, 'above', r=0.9, step=0.35)     # the paler mantle and wing coverts
BODY = P.region('body', 'chest'); NECK = P.region('neck'); HEAD = P.region('head'); TAILR = P.region('tail')
LEG = P.region('leg'); WNG = P.region('wing'); BEAKR = P.region('beak')
P.img[(HEAD | NECK) & P.mask] = P.col(SLATE)                              # the slate head and neck
P.img[BEAKR & P.mask] = P.col(BEAK)
n0, n1 = J['chest'][-1], J['neck'][-1]
for side in (-1, 1):                                                     # the iridescent throat: green, a purple sheen low
    P.side_oval((n0.y + n1.y) / 2 - 0.1, (n0.z + n1.z) / 2 - 0.2, 0.9, 2.0, GREEN, NECK | BODY, side, tilt=0.55)
    P.side_oval(n0.y - 0.5, n0.z - 0.9, 0.9, 0.5, PURPLE, NECK | BODY, side, tilt=0.5)
P.view_line([Vector((-1.6, 0, n0.z + 0.6)), Vector((0, 0, n0.z - 0.4)), Vector((1.6, 0, n0.z + 0.6))], 0.6, GREEN, NECK | BODY, 'front')
P.img[LEG & (PZ < HIP.z - 4.2) & P.mask] = P.col(RED)                    # bare red shanks and feet
W = J['wing_l']
for side in (-1, 1):                                                     # the folded wing: pale coverts, two black bars, dark primaries
    w = J['wing_l' if side < 0 else 'wing_r']
    y0, y1 = HIP.y - 1.2, w[2].y
    for i in range(14):                                                  # the coverts carry down the flank under the wing
        y = y0 + (y1 - y0) * i / 13
        tz, bz = P.top_z(y, HIP.z + 3), P.bot_z(y, HIP.z - 3)
        P.side_line([(y, tz), (y, bz + (tz - bz) * 0.3)], 0.32, BACKG, BODY | WNG, side)
    for t in (0.45, 0.75):                                               # the two bars, slanting down and back
        y = y0 + (y1 - y0) * t
        tz, bz = P.top_z(y, HIP.z + 3), P.bot_z(y, HIP.z - 3)
        P.side_line([(y - 0.9, tz - 0.3), (y + 0.5, bz + (tz - bz) * 0.3)], 0.42, BAR, BODY | WNG, side)
        P.top_line([(side * 0.8, y - 0.6), (w[2].x + side * 1.5, y + 0.3)], 0.3, BAR, WNG | BODY)
    P.side_line([(p.y, p.z - 0.1) for p in w[2:]], 0.45, SLATE, WNG, side)   # dark primaries
    P.top_line([(p.x, p.y) for p in w[2:]], 0.5, SLATE, WNG)
    P.side_line([(w[0].y - 0.3, w[0].z + 0.2), (w[1].y, w[1].z + 0.5)], 0.18, SLATE, WNG | BODY, side)   # the wrist's leading edge
    e = next((e for e in C.ACC.get('eyes', []) if e.x * side > 0), None)
    if e is not None: P.side_oval(e.y, e.z, 0.4, 0.4, CERE, HEAD, side)     # the pale eye ring
t = J['tail']
P.img[TAILR & (PY > t[-1].y - 1.0) & P.mask] = P.col(BAR)                # the black band at the tail's end
P.img[TAILR & (PY > t[-1].y - 1.35) & (PY <= t[-1].y - 1.0) & P.mask] = P.col(SLATE)
for k in (-1, 0, 1):                                                     # feather shafts down the tail, from above
    P.top_line([(k * 0.6, t[0].y), (k * 1.0, t[-1].y - 1.2)], 0.1, SLATE, TAILR)
for view in ('front', 'back'):                                          # the leg bones
    for lk in ('leg_l', 'leg_r'):
        L = J[lk]
        P.view_line([L[1], L[2]], 0.18, SLATE, LEG & (PZ >= HIP.z - 4.2), view)
for sd in (-1, 1):                                                       # shoulder blades and the hip from behind
    P.view_line([Vector((sd * 0.6, 0, HIP.z + 2.0)), Vector((sd * 1.8, 0, HIP.z + 0.8))], 0.2, SLATE, BODY, 'back')
P.spine_bars([n1, n0, J['chest'][0], HIP, HIP + Vector((0, 3, 0))], SLATE, BODY | NECK, every=1.0, width=0.5)
P.accents({'eyes': ORANGE, 'toes': RED})
for e in C.ACC['eyes']:
    P.dab(e + Vector((math.copysign(0.32, e.x), -0.02, 0.02)), 0.1, INK)    # the pupil
ce_p = J['beak'][0]
P.dab(ce_p + Vector((0, 0.05, 0.35)), 0.35, CERE)                        # the cere
P.save(OUT, "pigeon")

# ---------- rig ----------
G = Rig(C)
G.bone("Body", HIP + Vector((0, 2.5, 0)), J['chest'][0])
G.bone("Chest", J['chest'][0], J['chest'][-1], "Body")
G.chain("Neck", [J['chest'][-1]] + J['neck'], "Chest")
NECK_BONES = len(J['neck'])
G.bone("Head", J['neck'][-1], J['head'][-1], "Neck.%03d" % (NECK_BONES - 1) if NECK_BONES > 1 else "Neck")
G.bone("Beak", J['head'][-1], J['beak'][-1], "Head", limb='beak')
G.chain("Tail", [HIP + Vector((0, 3.0, 0))] + J['tail'], "Body", limb='tail')
TAIL_BONES = sum(1 for b in G.arm.edit_bones if b.name.startswith("Tail"))
for key, side in WINGS.items():
    w = J[key]; nm = "Wing" + ("Left" if side < 0 else "Right")
    G.bone(nm, w[0] + (w[1] - w[0]) * 0.6, w[3], "Body", limb=key)
    G.bone(nm + "Tip", w[3], w[-1], nm, limb=key)
for key, side in (('leg_l', 'Left'), ('leg_r', 'Right')):
    p = J[key]
    sock = Vector((p[0].x * 0.8, p[0].y, HIP.z - 1.0))
    G.bone(f"Leg{side}", sock, p[1], "Body", limb=key)
    G.bone(f"Shin{side}", p[1], p[3], f"Leg{side}", limb=key)
    G.bone(f"Foot{side}", p[3], p[4], f"Shin{side}", limb=key)
G.skin()

ZERO = ((0, 0, 0), (0, 0, 0))


def legs(n, w, stride=1.0):
    for side in ("Left", "Right"):
        if n.endswith(side) and n[:-len(side)] in ("Leg", "Shin", "Foot"):
            ph = w + (0 if side == "Left" else math.pi)
            leg = 14 * stride * math.sin(ph)
            lift = max(0, math.sin(ph + 0.6))
            shin = -26 * lift * stride
            foot = -(leg + shin) * (1 - lift) + 20 * lift * stride
            return ({"Leg": leg, "Shin": shin, "Foot": foot}[n[:-len(side)]], 0, 0), (0, 0, 0)
    return None


def walk(n, ph):
    """two steps; on each the head holds still in the air while the body walks
    under it, then shoots forward: the pigeon's head bob"""
    w = ph * 2 * math.pi
    l = legs(n, w, 0.85)
    if l: return l
    k = (ph * 2) % 1.0                                   # one bob a step
    shoot = ease(min(1, max(0, (k - 0.55) / 0.25)))      # holds, then shoots forward
    hold = (k if k < 0.55 else 0.55 * (1 - shoot)) / 0.55
    fwd = 1.4 * shoot - 1.0 * hold                       # world -Y is forward
    if n == "Body": return (0, 0, 0), (0, 0, -0.12 * abs(math.cos(w)))
    if n.startswith("Neck"): return ((-10 * hold + 8 * shoot) / NECK_BONES, 0, 0), (0, 0, 0)
    if n == "Head": return (10 * hold - 8 * shoot, 0, 0), (0, 0, 0)
    if n.startswith("Tail"): return (3 * math.sin(w * 2) / TAIL_BONES, 0, 0), (0, 0, 0)
    return ZERO


def peck(n, ph):
    """bows from the hips and stabs the beak at the ground twice, the tail tipping up"""
    down = ease(min(1, ph / 0.25)) * (1 - ease(max(0, (ph - 0.8) / 0.2)))
    jab = max(0, math.sin((ph - 0.25) / 0.55 * 2 * math.pi * 2)) if 0.25 < ph < 0.8 else 0
    if n == "Body": return (20 * down, 0, 0), (0, 0, 0)
    if n == "Chest": return (8 * down, 0, 0), (0, 0, 0)
    if n.startswith("Neck"): return ((38 * down + 18 * jab) / NECK_BONES, 0, 0), (0, 0, 0)
    if n == "Head": return (20 * down + 12 * jab, 0, 0), (0, 0, 0)
    if n == "Jaw": return (14 * jab, 0, 0), (0, 0, 0)
    if n.startswith("Tail"): return (-20 * down / TAIL_BONES, 0, 0), (0, 0, 0)
    if n.startswith("Leg"): return (-10 * down, 0, 0), (0, 0, 0)
    if n.startswith("Foot"): return (-10 * down, 0, 0), (0, 0, 0)
    return ZERO


SWEEP = 30     # the wing swings out of the fold (about the bone's own Z) to fly
TIP_SWEEP = 55  # the outer wing swings the rest of the way out, clear of the body
FLAP = 22      # each way of the wingbeat


def fly(n, ph):
    """the wings out of the fold and beating, three beats a loop, the legs tucked back"""
    w = ph * 2 * math.pi
    beat = math.sin(w * 3)
    if n.startswith("Wing"):
        side = -1 if "Left" in n else 1
        if n.endswith("Tip"): return (FLAP * 0.6 * math.sin(w * 3 - 0.6), 0, -side * TIP_SWEEP), (0, 0, 0)
        return (FLAP * beat + 7, 0, -side * SWEEP), (0, 0, 0)   # pitch first (the beat), then swung out of the fold   # pitch first (the beat), then swung out of the fold
    if n == "Body": return (-6, 0, 0), (0, 0, 0.35 * -beat)
    if n.startswith("Neck"): return (14 / NECK_BONES, 0, 0), (0, 0, 0)
    if n == "Head": return (-10, 0, 0), (0, 0, 0)
    if n.startswith("Tail"): return ((-6 + 3 * beat) / TAIL_BONES, 0, 0), (0, 0, 0)
    if n.startswith("Leg"): return (-8, 0, 0), (0, 0, 0)
    if n.startswith("Shin"): return (12, 0, 0), (0, 0, 0)
    return ZERO


def coo(n, ph):
    """the courting coo: throat puffed, a bow, back up, a turn, tail fanned down"""
    bow = math.sin(ph * math.pi * 2) * 0.5 + 0.5
    bow = 1 - bow
    turn = math.sin(ph * 2 * math.pi)
    if n == "Body": return (10 * bow, 0, 8 * turn), (0, 0, 0)
    if n == "Chest": return (-8 * (1 - bow), 0, 0), (0, 0, 0)
    if n.startswith("Neck"): return ((24 * bow - 10) / NECK_BONES, 0, 0), (0, 0, 0)
    if n == "Head": return (8 * bow, 0, 0), (0, 0, 0)
    if n == "Jaw": return (6 * (1 - bow), 0, 0), (0, 0, 0)
    if n.startswith("Tail"): return (14 * bow / TAIL_BONES, 0, 0), (0, 0, 0)
    return ZERO


G.act("walk", 32, walk)
G.act("peck", 36, peck)
G.act("fly", 24, fly)
G.act("coo", 40, coo)
if not os.environ.get('NO_FIX'):
    G.fix_joints()
G.save(OUT, "pigeon")
