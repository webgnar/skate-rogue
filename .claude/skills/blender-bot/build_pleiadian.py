"""The Pleiadians, the crew of the ship (zack 2026-11-10: "we need to make a pleadian character for the ship
scene. will be lots of them on board the ship"). zack's two references (a portrait and a full figure): tall and
slim, long straight blond hair, a blue bodysuit with a high collar, a pink eight-point star on the chest, a
light-blue cape off the shoulders, tall blue boots. Built on build_human.py's body (one Cube, the same seven-bone
rig the title's people have), longer in the leg and narrower, with the hair and cape as accents.

Three of them, so a deck full of crew isn't one person cloned (the game adds height and which idle on top):
  a  after the full figure: platinum hair to the shoulders, the orange sash, a round brooch, the cape
  b  after the portrait: golden hair past the shoulders, a lilac stripe down the collar, pink and blue cuffs
  c  a woman: white-gold hair to the waist, narrower shoulders, a paler cape

Their clips are idles for standing about the deck: idle (breathing), greet (the portrait's raised palm), look (up
at the stars, hands clasped behind), talk (a hand out, explaining), nod.

usage: python build_pleiadian.py -- <out dir> <a|b|c>
"""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bb_lib import Creature, Painter, Rig, ease
from mathutils import Vector, Matrix
import bmesh
import numpy as np
EV = lambda k, d: float(os.environ.get(k, d))

args = sys.argv[sys.argv.index('--') + 1:]
OUT = args[0]
WHO = args[1] if len(args) > 1 else 'a'
NAME = 'pleiadian-' + WHO
SUIT, SUIT_DK = '#2450d8', '#1a3698'
LOOKS = {
    'a': dict(hair='#f2e6b0', hair_dk='#d8c483', cape='#8ccaf2', sash='#f0a024', brooch='#bfe8ff', hair_len=0.55,
              locks=False, shoulders=1.04, seed=41),
    'b': dict(hair='#e2b44e', hair_dk='#b88a30', cape='#9ad2f6', stripe='#e8c8f0', cuffs=('#f0a0d0', '#9ad8f0'),
              hair_len=0.75, locks=True, shoulders=1.0, seed=43),
    'c': dict(hair='#f8f0d8', hair_dk='#e0d0a8', cape='#bfe2fa', hair_len=1.0, locks=True, shoulders=0.88, fem=True,
              seed=47),
}
L = LOOKS[WHO]
SKIN = '#f4d4c0'
C = Creature(L['seed'])
J, R = C.J, C.R
bm = C.bm

# ---------- 1. block out: a tall, slim body ----------
HIP = Vector((0, 0, 11.4))
C.start_cube((3.1, 2.3, 1.6), HIP, round_long=0, round_plan=0.55, plan_segments=1)
SW = L['shoulders']
top = C.run(C.face_where((0, 0, 1)), [
    ((0, 0, 1), 1.5, 0.92, 1.0, (0.97 if SW < 1 else 1.0, 1.0, 1.0)),          # the waist
    ((0, 0, 1), 2.5, 1.12, 1.0, (1.08 * SW, 1.12, 1.0)),                      # the chest
    ((0, 0, 1), 1.5, 1.0, 1.0, (1.08 * (SW if SW > 1 else 1.0), 0.94, 1.0)),  # the shoulders
], name='torso', region='torso')
top = C.run(top, [
    ((0, 0, 1), 0.45, 0.42 / (SW if SW < 1 else 1.0) ** 0.5, 1.0, (0.95, 1.1, 1.0)),   # the top of the shoulders
    ((0, -0.1, 1), 1.1, 0.95, 1.0),                      # a long neck, in its high collar
], name='neck', region='neck')
top = C.run(top, [
    ((0, -0.05, 1), 0.45, 1.5, 1.0, (1.0, 1.35, 1.0)),   # the jaw
    ((0, 0, 1), 1.05, 1.06, 1.0),                        # the cheeks, a long face
    ((0, 0, 1), 0.9, 1.0, 1.0),                          # the brow
    ((0, 0.05, 1), 0.55, 0.7, 1.0),                      # the crown
], name='head', region='head')
C.end_point(top, top.calc_center_median() + Vector((0, 0.05, 0.25)))

bm.normal_update()
under = [f for f in bm.faces if f.normal.z < -0.5 and f.calc_center_median().z < HIP.z]
lp = C.knife_pair(under, [((0, 2, 0), (0, 1, 0)), ((0, -2, 0), (0, -1, 0))], 0.25)
LEGS = {}
for side in (-1, 1):
    fs = lp[side]
    f = fs[0] if len(fs) == 1 else bmesh.ops.dissolve_faces(bm, faces=fs)['region'][0]
    key = 'leg_l' if side < 0 else 'leg_r'
    C.run(f, [
        ((0, 0, -1), 0.4, 1.0, 1.0, (1.05, 1.0, 1.0), (side * 0.1, 0, 0)),  # the seat
        ((side * 0.03, 0, -1), 4.3, 0.8, 1.0),                             # the thigh, long
        ((0, 0.02, -1), 0.7, 0.9, 1.0),                                    # under the knee
        ((0, 0, -1), 0.25, 1.22, 1.0),                                     # the boot's wide cuff
        ((0, 0.02, -1), 3.4, 0.78, 1.0),                                   # the boot's shaft
        ((0, 0, -1), 0.5, 0.95, 1.0),                                      # the ankle
        ((0, -1, -0.15), 1.3, 1.0, 0.55),                                  # the foot
        ((0, -1, 0), 0.55, 0.85, 0.8),                                     # the toe
    ], name=key, region='leg')
    LEGS[key] = side

ARMS = {}
for side in (-1, 1):
    bm.normal_update()
    f = max((f for f in bm.faces if f.normal.x * side > 0.8 and C.on('torso', f)), key=lambda f: f.calc_center_median().z)
    key = 'arm_l' if side < 0 else 'arm_r'
    C.run(f, [
        ((side, 0, 0), 0.35, 0.9, 1.0),
        ((side * 0.16, 0, -1), 3.3, 0.8, 1.0),               # the upper arm, long
        ((side * 0.06, -0.04, -1), 2.9, 0.84, 1.0),          # the forearm
        ((0, 0, -1), 0.35, 0.8, 1.0),                        # the wrist
        ((0, 0, -1), 1.15, 1.1, 1.0, (0.6, 1.15, 1.0)),      # the hand
    ], name=key, region='arm')
    ARMS[key] = side

HEAD_C = (J['head'][1] + J['head'][2]) / 2
HW = max(abs(p.x) for p in R['head'][1])
HD = max(abs(p.y - J['head'][1].y) for p in R['head'][1])

if os.environ.get('BLOCKOUT_ONLY'):
    for k in list(LEGS) + list(ARMS): print('END', k, [round(c, 2) for c in J[k][-1]])
    _x = C.crossings(); inv = {v: k for k, v in C.regions.items()}
    print('CROSSINGS', len(_x), sorted({inv[v[C.REG]] for v in _x}))
    print('MIRROR', C.mirror_error()); sys.exit(0)

# ---------- 2. shape ----------
BROW = J['head'][2].z
CHEST = J['torso'][1]
SHO = J['torso'][-1]
if L.get('fem'):                              # her chest
    for v in bm.verts:
        if v[C.REG] == C.regions['torso'] and v.co.y < 0 and abs(v.co.z - (CHEST.z - 0.4)) < 0.9 and abs(v.co.x) < 1.5:
            v.co.y -= 0.2 * (1 - abs(v.co.z - (CHEST.z - 0.4)) / 0.9)
else:                                         # his chest, a little proud, as the full figure's
    for v in bm.verts:
        if v[C.REG] == C.regions['torso'] and v.co.y < 0 and abs(v.co.z - (CHEST.z - 0.2)) < 1.0 and abs(v.co.x) < 1.7:
            v.co.y -= 0.12 * (1 - abs(v.co.z - (CHEST.z - 0.2)) / 1.0)
for v in bm.verts:                            # the hair's volume over the crown
    if v[C.REG] == C.regions['head'] and v.co.z > BROW - 0.2:
        c = Vector((0, HEAD_C.y, v.co.z)); v.co = c + (v.co - c) * 1.07
        v.co.z += 0.08

assert C.mirror_error() < 1e-3, "the skeleton must be mirror-true before the clay"
C.clay(jitter=0.025, lumps=3, box=((-2.5, 2.5), (-1.5, 1.5), (3, 21)), lump_r=(1.0, 1.6), lump_amt=(-0.05, 0.06))

# ---------- accents ----------
def taper(key, z_mid, sx_low=1.0, sy_low=1.0, dy_low=0.0):
    """widen (or narrow) the lower half of the accent box just made, and push it back: a cape's hem, the hair's ends"""
    code = C.acc_id(key)
    vs = [v for v in bm.verts if v[C.ACCL] == code]
    cx = sum(v.co.x for v in vs) / len(vs); cy = sum(v.co.y for v in vs) / len(vs)
    for v in vs:
        if v.co.z < z_mid:
            v.co.x = cx + (v.co.x - cx) * sx_low
            v.co.y = cy + (v.co.y - cy) * sy_low + dy_low

EZ = J['head'][1].z + 0.6
for side in (-1, 1):
    p = C.skin((side * 0.5, -20, EZ), (0, 1, 0))
    if p is not None: C.ball(p + Vector((0, 0.08, 0)), 0.16, 'eyes')
p = C.skin((0, -20, EZ - 0.5), (0, 1, 0))
if p is not None: C.cone(p + Vector((0, 0.08, 0)), (0, -1, -0.35), 0.17, 0.4, 'nose')

# the cape, off the shoulders, hanging clear of the back to the back of the knee, its hem flared
cb = C.skin((0, 20, CHEST.z), (0, -1, 0))
ctop, cbot = SHO.z + EV('CAPET', -0.15), J['leg_l'][1].z - 0.6
C.box(Matrix.Translation(Vector((0, cb.y + 0.5, (ctop + cbot) / 2)))
      @ Matrix.Diagonal((2.9 * SW, 0.14, ctop - cbot, 1)), 'cape')
taper('cape', CHEST.z - 1.0, 1.45, 1.0, 0.9)
# the hair: a fall down the back from the crown, and (b, c) a lock down each side of the face onto the chest
back = C.skin((0, 20, BROW), (0, -1, 0))
hl = L['hair_len']
fall_top = BROW + 0.5
fall_bot = SHO.z - 0.2 - hl * 4.0
fall_y = back.y + 0.05
C.box(Matrix.Translation(Vector((0, fall_y + EV('FALLY', 0.25), (fall_top + fall_bot) / 2)))
      @ Matrix.Diagonal((2 * HW + 0.35, 0.55, fall_top - fall_bot, 1)), 'hair')
# its ends lie on the cape (the long ones over it, down the back), never through the back
taper('hair', BROW - 0.6, 1.12, 1.0, cb.y + 0.5 + 0.12 + 0.27 - fall_y)
if L['locks']:
    for side in (-1, 1):
        lk = 'lock_l' if side < 0 else 'lock_r'
        x = side * (HW + EV('LOCKX', 0.32))
        top_z, bot_z = BROW + EV('LOCKT', 0.2), SHO.z + EV('LOCKB', 0.45)
        C.box(Matrix.Translation(Vector((x, HEAD_C.y + 0.1, (top_z + bot_z) / 2)))
              @ Matrix.Diagonal((0.38, 0.9, top_z - bot_z, 1)), lk)
        taper(lk, J['head'][0].z, 1.0, 0.8, -0.1)       # the ends fall a little forward over the collar
if WHO == 'a':                                # the round brooch at the throat that holds it
    p = C.skin((0, -20, SHO.z + 0.25), (0, 1, 0))
    if p is not None: C.ball(p + Vector((0, 0.05, 0)), 0.22, 'brooch')
C.connect()
ob, me = C.to_object()

# ---------- paint ----------
P = Painter(C, SUIT, size=512)
PX, PY, PZ, NX, NY = P.PX, P.PY, P.PZ, P.NX, P.NY
TORSO = P.region('torso'); NECK = P.region('neck'); HEAD = P.region('head'); ARM = P.region('arm'); LEG = P.region('leg')
M = P.mask
paint = lambda where, c: P.img.__setitem__(where & M, P.col(c))
paint(HEAD, SKIN)
face = PY < HEAD_C.y - HD * 0.3
paint(HEAD & (PZ > BROW + 0.05), L['hair'])                                  # the hair over the top, a straight fringe-less part
paint(HEAD & ~face & (PZ > J['head'][0].z + 0.2), L['hair'])                  # and down the back and sides
paint(HEAD & (PZ > BROW + 0.05) & (abs(PX) < 0.06) & (PY < HEAD_C.y), L['hair_dk'])   # the centre parting
neck_top = J['neck'][-1].z
paint(NECK, SKIN)
paint(NECK & (PZ < neck_top - 0.3), SUIT)                                     # the high collar
paint(NECK & (abs(PZ - (neck_top - 0.3)) < 0.06), SUIT_DK)
# the hands, out of the sleeves
arm_j = J['arm_l']
wrist = arm_j[3].z
paint(ARM & (PZ < wrist + 0.1), SKIN)
if L.get('cuffs'):                            # the portrait's cuffs: pink, a blue band, a little symbol
    paint(ARM & (PZ >= wrist + 0.1) & (PZ < wrist + 0.75), L['cuffs'][0])
    paint(ARM & (abs(PZ - (wrist + 0.45)) < 0.12), L['cuffs'][1])
else:
    paint(ARM & (abs(PZ - (wrist + 0.2)) < 0.1), SUIT_DK)
# the boots: the wide cuff a shade lighter, the shaft and the foot in the suit's blue, dark soles
cuff_z = J['leg_l'][3].z
paint(LEG & (PZ < cuff_z + 0.15), SUIT)
paint(LEG & (abs(PZ - cuff_z) < 0.16), '#3a68ee')
paint(LEG & (abs(PZ - (cuff_z - 0.2)) < 0.05), SUIT_DK)
paint(LEG & (PZ < 0.3), '#141a3a')
# the pink eight-point star on the heart, a pale blue eye in it (the portrait's emblem)
sx, sz, sr = -0.95, CHEST.z + 0.05, 0.62
dx, dz = PX - sx, PZ - sz
ang = np.arctan2(dz, dx) + math.pi / 8
k = np.abs(((ang * 8 / (2 * math.pi)) % 1) * 2 - 1)            # 0 at a point, 1 between two
rim = sr * (1 - 0.55 * k)
rr = np.sqrt(dx * dx + dz * dz)
front = (PY < 0) & TORSO
paint(front & (rr < rim + 0.07), '#b8407a')                    # its ink edge
paint(front & (rr < rim), '#f48ac0')
paint(front & (rr < sr * 0.42), '#fbc4de')
paint(front & (rr < 0.13), '#7ac8f0')
if L.get('sash'):                             # the orange sash, the right shoulder to the left hip
    d = (PZ - SHO.z) - (PX - 1.4) * 1.25
    paint(TORSO & (abs(d) < 0.32) & (PZ > HIP.z - 0.2), L['sash'])
    paint(TORSO & (abs(abs(d) - 0.32) < 0.05) & (PZ > HIP.z - 0.2), '#b86a10')
if L.get('stripe'):                           # the lilac stripe down from the collar, a few inches
    paint(TORSO & (PY < 0) & (abs(PX) < 0.14) & (PZ > CHEST.z - 0.6), L['stripe'])
    paint(NECK & (PY < 0) & (abs(PX) < 0.14) & (PZ < neck_top - 0.3), L['stripe'])
P.accents({'eyes': '#24306a', 'nose': SKIN, 'hair': L['hair'], 'lock_l': L['hair'], 'lock_r': L['hair'],
           'cape': L['cape'], 'brooch': L.get('brooch', '#ffffff')})
HAIRS = [C.acc_id(k) for k in ('hair', 'lock_l', 'lock_r') if k in C.ACC]
strands = np.isin(P.acc, HAIRS) & ((np.abs(PX) % 0.42) < 0.07)       # straight strands down the hair
paint(strands, L['hair_dk'])
for e in C.ACC.get('eyes', []):
    P.dab(e + Vector((0, -0.14, 0)), 0.09, '#5a9af0')                  # blue eyes
    P.dab(e + Vector((math.copysign(0.04, e.x), -0.16, 0.05)), 0.04, '#ffffff')
P.save(OUT, NAME)

# ---------- rig: the code's seven bones, a shin, foot, forearm and hand under them ----------
G = Rig(C)
LSX, LSY, LSZ = EV('LSX', 0.7), EV('LSY', -0.8), EV('LSZ', -0.3)
LSH = EV('LSH', 0.25)
ASX, ASZ = EV('ASX', 1.8), EV('ASZ', 1.0)
SOCKET = lambda p: Vector((p[0].x * LSX, LSY, HIP.z + LSZ))     # the hip joint, in the pelvis
LJ = J['leg_l']
G.bone("Root", Vector((0, 0.6, 0)), Vector((0, 0.6, 1.0)))
G.bone("Hips", Vector((0, 0, HIP.z - 0.5)), J['torso'][0], "Root")
G.bone("Chest", J['torso'][0], J['torso'][-1], "Hips")
G.bone("Head", J['torso'][-1], J['head'][-1], "Chest")
for key, side in LEGS.items():
    p = J[key]; s = "L" if side < 0 else "R"
    G.bone("Leg" + s, SOCKET(p), p[1], "Root", limb=key)
    G.bone("Shin" + s, p[1], p[5], "Leg" + s, limb=key)
    G.bone("Foot" + s, p[5], p[7], "Shin" + s, limb=key)
for key, side in ARMS.items():
    p = J[key]; s = "L" if side < 0 else "R"
    G.bone("Arm" + s, p[0] + Vector((math.copysign(ASX, p[0].x), 0, ASZ)), p[1], "Chest", limb=key)    # the pivot out at the shoulder, so a raised arm clears the neck
    G.bone("ForeArm" + s, p[1], p[3], "Arm" + s, limb=key)
    G.bone("Hand" + s, p[3], p[4], "ForeArm" + s, limb=key)
G.skin(skip=("Root",))
# the legs hang off Root as the code has them, so the skin gave their root ring all to the leg; share it half
# and half with the pelvis as an arm's is with the chest, or the seat creases when a thigh swings
_me, _ob = C.me, C.ob
_ring, _acc = _me.attributes["ring"].data, _me.attributes["acc"].data
_hips = _ob.vertex_groups["Hips"]
for _n in ("LegL", "LegR"):
    _g = _ob.vertex_groups[_n]
    for _v in _me.vertices:
        if _ring[_v.index].value != 1 or _acc[_v.index].value: continue
        if any(ge.group == _g.index and ge.weight > 0.99 for ge in _v.groups):
            _g.add([_v.index], LSH, 'REPLACE'); _hips.add([_v.index], 1 - LSH, 'REPLACE')
ASH = EV('ASH', 0.5)                                  # the arms' root rings: this much to the arm, the rest the chest
_chest = _ob.vertex_groups["Chest"]
for _n in ("ArmL", "ArmR"):
    _g = _ob.vertex_groups[_n]
    for _v in _me.vertices:
        if _ring[_v.index].value != 1 or _acc[_v.index].value: continue
        if any(ge.group == _g.index for ge in _v.groups) and any(ge.group == _chest.index for ge in _v.groups):
            _g.add([_v.index], ASH, 'REPLACE'); _chest.add([_v.index], 1 - ASH, 'REPLACE')

# ---------- actions, in the code's terms ----------
# life.ts turns each bone about the model's own axes (three.js: y up, the face to +z), XYZ order, radians, and
# moves the hips (and for the sit, the legs too) in the ped's units (the hips 0.95 up). Here each turn is put into
# Blender's axes and then the bone's own: basis = rest^-1 R rest.
import bpy
ARM_OB = G.ao
CV = Matrix(((1, 0, 0), (0, 0, -1), (0, 1, 0)))          # three (x, y, z) -> Blender (x, -z, y)
UNIT = (HIP.z - 0.5) / 0.95                              # the ped's units to this model's
REST = {b.name: b.matrix_local.to_3x3() for b in ARM_OB.data.bones}

def code(n, rot=(0, 0, 0), lift=0.0):
    """the bone's (rotation degrees, location) for a code pose: rot as life.ts sets it, lift = hips/legs y offset"""
    x, y, z = rot
    R3 = Matrix.Rotation(x, 3, 'X') @ Matrix.Rotation(y, 3, 'Y') @ Matrix.Rotation(z, 3, 'Z')
    Rb = CV @ R3 @ CV.transposed()
    rest = REST[n]
    basis = rest.inverted() @ Rb @ rest
    loc = rest.inverted() @ Vector((0, 0, lift * UNIT))
    return tuple(math.degrees(a) for a in basis.to_euler('XYZ')), tuple(loc)

ZERO = ((0, 0, 0), (0, 0, 0))

THIGH = (J['leg_l'][1] - SOCKET(J['leg_l'])).length / UNIT   # in the ped's units
SHIN = (J['leg_l'][5] - J['leg_l'][1]).length / UNIT

PELVIS = EV('PELVIS', 0.35)

def crouch(t):
    """the code bobs the hips (the torso) up and down on legs that stay put; on one skin that would push the
    pelvis down into the thighs. As the game does it (src/title/bot-people.ts): the whole body drops instead and
    the knees bend just enough to keep the feet on the ground; a lift raises the whole body"""
    t = {k: (v if isinstance(v[0], tuple) else (v, 0.0)) for k, v in t.items()}
    rot, d = t.get("Hips", ((0, 0, 0), 0.0))
    # the code turns the hips as one block; here the pelvis takes a third and the chest the rest
    t["Hips"] = (tuple(a * PELVIS for a in rot), 0.0)
    t["Chest"] = (tuple(a * (1 - PELVIS) for a in rot), 0.0)
    if not d: return t
    r0, l0 = t.get("Root", ((0, 0, 0), 0.0)); t["Root"] = (r0, l0 + d)
    if d < 0:
        a = math.acos(max(-1.0, 1 + d / (THIGH + SHIN)))
        for s in "LR":
            lr, _ = t.get("Leg" + s, ((0, 0, 0), 0.0))
            t["Leg" + s] = ((lr[0] - a, lr[1], lr[2]), 0.0)
            t["Shin" + s] = ((2 * a, 0, 0), 0.0)
            t["Foot" + s] = ((-a, 0, 0), 0.0)
    return t

def posed(table):
    """a pose function from {bone: rot or (rot, lift)} given per phase"""
    def pose(n, ph):
        t = crouch(table(ph))
        if n not in t: return ZERO
        rot, lift = t[n]
        return code(n, rot, lift)
    return pose


S = math.sin; PI = math.pi
FTW = EV('FTW', 1.3)                 # the raised hand's twist, palm to the front
def idle(ph):       # standing easy, breathing
    a = ph * PI * 2
    return {"Hips": (0.02 * S(a), 0, 0), "Head": (0.03 * S(a + 1), 0, 0), "ArmL": (0, 0, -0.06), "ArmR": (0, 0, 0.06)}
def greet(ph):      # the portrait's raised palm, held, a slow nod over it
    a = ph * PI * 2
    return {"ArmR": (-0.3, 0, 0.42), "ForeArmR": (-2.3, 0, 0), "HandR": (0, FTW, 0), "ArmL": (0, 0, -0.06),
            "Head": (0.12 + 0.05 * S(a), 0, 0), "Hips": (0.015 * S(a), 0, 0)}
def look(ph):       # up at the stars through the dome, turning a little, the arms back
    a = ph * PI * 2
    return {"Head": (-0.55, 0.3 * S(a), 0), "Hips": (-0.04, 0.08 * S(a), 0),
            "ArmL": (0.3, 0, -0.1), "ArmR": (0.3, 0, 0.1), "ForeArmL": (-0.3, 0, 0), "ForeArmR": (-0.3, 0, 0)}
def talk(ph):       # explaining something to whoever's beside them, one hand out, the head going
    a = ph * PI * 2
    return {"ArmL": (-0.55 + 0.12 * S(a * 2), 0, -0.22), "ForeArmL": (-0.9 + 0.25 * S(a * 2 + 0.6), 0, 0),
            "ArmR": (-0.1, 0, 0.08), "ForeArmR": (-0.25, 0, 0),
            "Head": (0.06 * S(a * 3), 0.18 * S(a), 0), "Hips": (0.02, 0.08 * S(a), 0)}
def nod(ph):        # listening: nodding along, the weight on one hip
    a = ph * PI * 2
    return {"Head": (0.14 + 0.14 * abs(S(a * 2)), -0.15, 0), "Hips": (0, 0, 0.04),
            "ArmL": (-0.15, 0, -0.08), "ForeArmL": (-0.5, 0, 0), "ArmR": (0, 0, 0.1)}

G.act("idle", 48, posed(idle))
G.act("greet", 48, posed(greet))
G.act("look", 72, posed(look))
G.act("talk", 48, posed(talk))
G.act("nod", 48, posed(nod))
if not os.environ.get('NO_FIX'):
    G.fix_joints()
G.save(OUT, NAME)
