"""The people on the title screen's street for Skate Escape (zack 2026-11-05:
"use blender bot on the humans in the intro, not the player"): the homeless
man against the pizza place, the hitchhiker, the crazy guy and the dancer by
the boombox. One body for all four, built here; each is shaped, dressed and kitted
out after zack's reference for them (WHO below; the photos are in
/mnt/project-files/blender-bot/people/refs/).

The game poses them in code (src/title/life.ts, the street's minute): seven
bones, the root, the hips (the torso), each leg, each arm and the head, every
one turned about the model's own axes. So the rig keeps those seven, named as
peds.ts names them, with a shin, a foot, a forearm and a hand under them for
the code to bend too. The actions here are the code's own extremes (sat on the
sidewalk, both arms over the head, a high knee, a thumb out, the shrug), keyed
in the code's terms (convert below), so fix_joints readies the skin for every
pose the street puts it in.

  1. block out from one Cube (the pelvis): the waist, chest and shoulders up,
     the neck and the head; two legs out of the seat to the feet, turned
     forward; two arms out of the shoulders, hanging, to the hands;
  2. clay; accents: eyes, nose, ears, and whatever each one wears.

usage: python build_human.py -- <out dir> <who>      who: homeless | hitch | wild | dancer
"""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bb_lib import Creature, Painter, Rig, ease
from mathutils import Vector, Matrix, Euler
import bmesh
EV = lambda k, d: float(os.environ.get(k, d))     # tuning overrides for sweeps

args = sys.argv[sys.argv.index('--') + 1:]
OUT = args[0]
WHO = args[1] if len(args) > 1 else 'hitch'
# ---------- who: each one's build, clothes and kit, after zack's references ----------
LOOKS = {
    # the homeless man (refs/homeless.jpg): an older skater, grey hair swept back, thick black glasses, a worn
    # canvas work vest open over a grey sweater vest and a white shirt, sleeves to the elbow, tattooed forearms,
    # khakis
    'homeless': dict(skin='#e0b494', hair='#b8b2a8', top='#f2f0ea', vest='#3a3428', sweater='#6e6e72',
                     pants='#c8b48c', shoes='#4a3426', glasses=True, sleeves='elbow', tattoos=True,
                     shoulders=1.0, legs=(0.82, 0.8), seed=7),
    # the hitchhiker (refs/hitchhiker.jpg, her own take on it): hair up in two buns, goggles, a white crop top
    # with a high yellow collar, a bare middle, baggy orange cargo pants with patch pockets, chunky white sneakers
    'hitch': dict(skin='#e8b48c', hair='#d83a8a', top='#f4f0e2', collar='#e8c33a', pants='#e8702a',
                  patch='#f4e0b0', shoes='#f4f4f4', sole='#3ab8c8', buns=True, goggles=True, crop=True,
                  sleeves='none', shoulders=0.86, legs=(0.95, 1.0), cuff='#e8c33a', seed=11),
    # the crazy guy (refs/crazy-guy.jpg): a white suit, a red tie and pocket square, a white fedora with a red
    # band, white shoes and black socks
    'wild': dict(skin='#6a4430', hair='#1a1210', top='#f4f2ee', tie='#d42a2a', pants='#f4f2ee', shoes='#f4f2ee',
                 fedora=True, band='#d42a2a', jacket=True, sleeves='long', shoulders=1.04, legs=(0.86, 0.84), seed=23),
    # the dancer (refs/dancer.jpg): a red cap, a red tank top with navy letters, a chain, bare arms, a black
    # backpack, baggy blue pants cut off under the knee, chunky trainers
    'dancer': dict(skin='#e8b898', hair='#7a4a22', top='#d4282e', letters='#1a2448', pants='#2a5ad8',
                   shoes='#2a2420', sole='#c89a5a', cap='#d4282e', chain=True, backpack='#1a1a1e', sleeves='none',
                   shoulders=1.0, legs=(0.95, 1.02), capri=True, seed=31),
}
L = LOOKS[WHO]
C = Creature(L['seed'])
J, R = C.J, C.R
bm = C.bm

# ---------- 1. block out ----------
HIP = Vector((0, 0, 10.0))
C.start_cube((3.4, 2.5, 1.6), HIP, round_long=0, round_plan=0.55, plan_segments=1)   # the pelvis, eight-sided
SW = L['shoulders']                                       # her shoulders narrower than his
top = C.run(C.face_where((0, 0, 1)), [
    ((0, 0, 1), 1.4, 0.94, 1.0, (0.97 if SW < 1 else 1.0, 1.0, 1.0)),          # the waist
    ((0, 0, 1), 2.4, 1.12, 1.0, (1.06 * SW, 1.15, 1.0)),                      # the chest
    ((0, 0, 1), 1.5, 1.0, 1.0, (1.08 * (SW if SW > 1 else 1.0), 0.94, 1.0)),  # the shoulders
], name='torso', region='torso')
top = C.run(top, [
    ((0, 0, 1), 0.45, 0.42 / (SW if SW < 1 else 1.0) ** 0.5, 1.0, (0.95, 1.1, 1.0)),   # the top of the shoulders
    ((0, -0.1, 1), 0.9, 0.95, 1.0),                      # the neck
], name='neck', region='neck')
top = C.run(top, [
    ((0, -0.05, 1), 0.45, 1.55, 1.0, (1.0, 1.35, 1.0)),  # the jaw, under the chin
    ((0, 0, 1), 1.0, 1.08, 1.0),                         # the cheeks
    ((0, 0, 1), 0.9, 1.0, 1.0),                          # the brow
    ((0, 0.05, 1), 0.55, 0.7, 1.0),                      # the crown
], name='head', region='head')
C.end_point(top, top.calc_center_median() + Vector((0, 0.05, 0.25)))

# two legs out of the seat; baggy trousers keep their width down the leg
bm.normal_update()
under = [f for f in bm.faces if f.normal.z < -0.5 and f.calc_center_median().z < HIP.z]
lp = C.knife_pair(under, [((0, 2, 0), (0, 1, 0)), ((0, -2, 0), (0, -1, 0))], 0.25)
LEGS = {}
TH, SH_ = L['legs']
for side in (-1, 1):
    fs = lp[side]
    f = fs[0] if len(fs) == 1 else bmesh.ops.dissolve_faces(bm, faces=fs)['region'][0]
    key = 'leg_l' if side < 0 else 'leg_r'
    C.run(f, [
        ((0, 0, -1), 0.4, 1.0, 1.0, (1.1, 1.0, 1.0), (side * 0.1, 0, 0)),   # the seat
        ((side * 0.03, 0, -1), 3.9, TH, 1.0),                              # the thigh
        ((0, 0.02, -1), 3.7, SH_, 1.0),                                    # the shin
        ((0, 0, -1), 0.6, 0.85 * 0.8 / SH_ if SH_ > 0.9 else 0.85, 1.0),   # the ankle (in from a baggy hem)
        ((0, -1, -0.15), 1.3, 1.0, 0.55),                                  # the foot
        ((0, -1, 0), 0.55, 0.85, 0.8),                                     # the toe
    ], name=key, region='leg')
    LEGS[key] = side

# two arms out of the shoulders, hanging a little out from the sides
ARMS = {}
for side in (-1, 1):
    bm.normal_update()
    f = max((f for f in bm.faces if f.normal.x * side > 0.8 and C.on('torso', f)), key=lambda f: f.calc_center_median().z)
    key = 'arm_l' if side < 0 else 'arm_r'
    C.run(f, [
        ((side, 0, 0), 0.35, 0.9, 1.0),                       # the shoulder
        ((side * 0.16, 0, -1), 3.0, 0.82, 1.0),               # the upper arm
        ((side * 0.06, -0.04, -1), 2.7, 0.85, 1.0),           # the forearm
        ((0, 0, -1), 0.35, 0.8, 1.0),                         # the wrist
        ((0, 0, -1), 1.1, 1.1, 1.0, (0.6, 1.15, 1.0)),        # the hand, flat to the thigh
    ], name=key, region='arm')
    ARMS[key] = side

HEAD_C = (J['head'][1] + J['head'][2]) / 2
HW = max(abs(p.x) for p in R['head'][1])       # the head's half width at the cheeks
HD = max(abs(p.y - J['head'][1].y) for p in R['head'][1])

if os.environ.get('BLOCKOUT_ONLY'):
    for k in list(LEGS) + list(ARMS): print('END', k, [round(c, 2) for c in J[k][-1]])
    _x = C.crossings(); inv = {v: k for k, v in C.regions.items()}
    print('CROSSINGS', len(_x), sorted({inv[v[C.REG]] for v in _x}))
    print('MIRROR', C.mirror_error())
    C.to_object(); import bpy; bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "human_blockout.blend")); sys.exit(0)

# ---------- 2. shape ----------
BROW = J['head'][2].z
if L.get('crop') or L.get('fem', SW < 1):     # her chest
    for v in bm.verts:
        if v[C.REG] == C.regions['torso'] and v.co.y < 0 and abs(v.co.z - (J['torso'][1].z - 0.4)) < 0.9 and abs(v.co.x) < 1.6:
            v.co.y -= 0.22 * (1 - abs(v.co.z - (J['torso'][1].z - 0.4)) / 0.9)
if L.get('fedora') or L.get('cap'):           # a hat's crown sits up on the head
    for v in bm.verts:
        if v[C.REG] == C.regions['head'] and v.co.z > BROW + 0.15:
            v.co.z += 0.3 if L.get('fedora') else 0.12
            v.co.x *= 1.06; v.co.y = HEAD_C.y + (v.co.y - HEAD_C.y) * 1.06
if L.get('jacket'):                           # the suit jacket hangs over the hips
    for v in bm.verts:
        if v[C.REG] == C.regions['torso'] and v.co.z < J['torso'][0].z + 0.3:
            c = Vector((0, 0, v.co.z)); v.co = c + (v.co - c) * 1.06
for v in bm.verts:                            # the swept-back hair and a nose bridge come with the clay
    pass

assert C.mirror_error() < 1e-3, "the skeleton must be mirror-true before the clay"
C.clay(jitter=0.03, lumps=4, box=((-2.5, 2.5), (-1.5, 1.5), (3, 19)), lump_r=(1.0, 1.6), lump_amt=(-0.06, 0.08))

# ---------- accents ----------
EZ = J['head'][1].z + 0.55                    # the eye line
for side in (-1, 1):
    p = C.skin((side * 0.55, -20, EZ), (0, 1, 0))
    if p is not None:
        if L.get('goggles'):                  # goggles: a round lens each side
            C.box(Matrix.Translation(p + Vector((0, -0.08, 0))) @ Matrix.Diagonal((0.62, 0.2, 0.5, 1)), 'goggles')
        else:
            C.ball(p + Vector((0, 0.08, 0)), 0.17, 'eyes')
            if L.get('glasses'):              # thick black frames over the eyes
                C.box(Matrix.Translation(p + Vector((0, -0.14, 0.02))) @ Matrix.Diagonal((0.66, 0.08, 0.42, 1)), 'glasses')
    p = C.skin((side * 20, HEAD_C.y + 0.1, EZ - 0.1), (-side, 0, 0))
    if p is not None: C.ball(p + Vector((-side * 0.05, 0, 0)), 0.26, 'ears')
    if L.get('buns'):                         # her hair up in two buns
        p = C.skin((side * HW * 0.55, HEAD_C.y + 0.2, 30), (0, 0, -1))
        if p is not None: C.ball(p + Vector((side * 0.1, 0.05, 0.3)), 0.62, 'buns')
p = C.skin((0, -20, EZ - 0.45), (0, 1, 0))
if p is not None: C.cone(p + Vector((0, 0.08, 0)), (0, -1, -0.35), 0.2, 0.42, 'nose')
if L.get('fedora'):                           # the fedora's brim, all round and wide
    C.box(Matrix.Translation(Vector((0, HEAD_C.y, BROW + 0.3))) @ Matrix.Diagonal((2 * HW + 1.6, 2 * HD + 1.5, 0.22, 1)), 'brim')
if L.get('cap'):                              # the cap's bill, out front
    C.box(Matrix.Translation(Vector((0, HEAD_C.y - HD - EV('BILLY', 0.75), BROW + 0.2))) @ Matrix.Rotation(-0.12, 4, 'X') @ Matrix.Diagonal((2.4, 1.3, 0.42, 1)), 'bill')
if L.get('backpack'):                         # the backpack on his back
    ch = J['torso'][1]
    p = C.skin((0, 20, ch.z - 0.3), (0, -1, 0))
    if p is not None: C.box(Matrix.Translation(p + Vector((0, 0.4, 0))) @ Matrix.Diagonal((2.4, 1.0, 2.8, 1)), 'backpack')
C.connect()
ob, me = C.to_object()

# ---------- paint ----------
P = Painter(C, L['top'], size=512)
PX, PY, PZ, NX, NY = P.PX, P.PY, P.PZ, P.NX, P.NY
TORSO = P.region('torso'); NECK = P.region('neck'); HEAD = P.region('head'); ARM = P.region('arm'); LEG = P.region('leg')
M = P.mask
SKIN = L['skin']
paint = lambda where, c: P.img.__setitem__(where & M, P.col(c))
paint(HEAD | NECK, SKIN)
face = PY < HEAD_C.y - HD * 0.35
paint(HEAD & (PZ > BROW + 0.1), L['hair'])                                   # the hair over the top
paint(HEAD & ~face & (PZ > J['head'][0].z + 0.35), L['hair'])                 # and round the back
if L.get('cap'): paint(HEAD & (PZ > BROW + 0.05), L['cap'])
if L.get('fedora'):
    paint(HEAD & (PZ > BROW + 0.2), L['top'])
    paint(HEAD & (abs(PZ - (BROW + 0.55)) < 0.2), L['band'])
# the arms: skin, under whatever sleeves
arm_j = J['arm_l']
elbow, wrist = arm_j[1].z, arm_j[3].z
paint(ARM, SKIN)
sleeve = {'long': wrist + 0.3, 'elbow': elbow - 0.2, 'none': 99}[L['sleeves']]
paint(ARM & (PZ > sleeve), L['top'])
if L['sleeves'] == 'elbow': paint(ARM & (abs(PZ - sleeve) < 0.25), '#dedad2')    # rolled up
if L.get('tattoos'):
    import random; rr = random.Random(3)
    for side in (-1, 1):
        for _ in range(7):
            z = rr.uniform(wrist + 0.4, sleeve - 0.4)
            P.dab(Vector((side * 3.0, rr.uniform(-0.4, 0.4), z)), 0.22, '#3a4a5a')
# the legs and feet
knee, ankle = J['leg_l'][1].z, J['leg_l'][3].z
paint(LEG, L['pants'])
paint(~ARM & ~HEAD & ~NECK & (PZ < HIP.z + 0.85), L['pants'])              # the seat and crotch: no region of their own
if L.get('capri'): paint(LEG & (PZ < knee - 1.4), SKIN)
paint(LEG & (PZ < ankle + 0.35), L['shoes'])
paint(LEG & (PZ < ankle + 0.35) & (PZ > ankle) & (abs(NX) < 0.9), '#141414' if L.get('jacket') else L['shoes'])   # socks under the suit
paint(LEG & (PZ < 0.3), L.get('sole', '#2a2a2a'))
if L.get('patch'):                            # cargo pockets on the thighs, a camo of patches
    import random; rr = random.Random(5)
    for side in (-1, 1):
        cz = knee + 0.9
        paint(LEG & (PX * side > 0.9) & (NX * side > 0.4) & (abs(PZ - cz) < 0.9), L['patch'])
        for _ in range(6):
            P.dab(Vector((side * 2.2, rr.uniform(-0.6, 0.6), cz + rr.uniform(-0.7, 0.7))), 0.18, L['pants'])
    paint(LEG & (abs(PZ - (ankle + 0.55)) < 0.2), L['cuff'])                     # the ankle cuffs
# the torso, by who
waist = J['torso'][0].z
if L.get('crop'):
    paint(TORSO & (PZ < J['torso'][1].z - 1.2), SKIN)                             # the bare middle
    paint(TORSO & (PZ < waist - 0.4), L['pants'])
    paint(NECK, L['collar']); paint(TORSO & (PZ > J['torso'][-1].z - 0.35) & (abs(PX) < 1.3), L['collar'])
    paint(TORSO & (abs(PZ - (J['torso'][1].z - 0.5)) < 0.08), '#d42a2a')            # a thin red line
    for side in (-1, 1): paint(ARM & (abs(PZ - (wrist + 0.4)) < 0.25), L['collar'])  # wristbands
if L.get('vest'):
    paint(TORSO & (PZ < HIP.z - 0.1), L['pants'])
    paint(TORSO & (PY < 0) & (abs(PX) < 1.1) & (PZ > HIP.z + 0.3), L['sweater'])      # the sweater vest's front
    paint(TORSO & (PY < 0) & (abs(PX) < 0.6 - (J['torso'][-1].z - PZ) * 0.0) & (PZ > J['torso'][-1].z - 1.2), L['top'])   # the V and the shirt
    paint(TORSO & ((PY >= 0) | (abs(PX) >= 1.1)) & (PZ > HIP.z - 0.1), L['vest'])     # the canvas vest, open at the front
    paint(TORSO & (PY < 0) & (abs(abs(PX) - 1.1) < 0.12) & (PZ > HIP.z), '#b89a5a')   # its zip
    paint(NECK & (PZ < J['neck'][0].z + 0.3), L['top'])                                  # the shirt collar
    paint(ARM & (PZ > sleeve + 0.2) & (PZ > elbow + 1.6), L['vest'])                     # the vest's shoulders
if L.get('jacket'):
    paint(TORSO & (PY < 0) & (abs(PX) < 0.55) & (PZ > J['torso'][1].z - 1.4), '#ffffff')   # the shirt
    paint(TORSO & (PY < 0) & (abs(PX) < 0.22) & (PZ > J['torso'][1].z - 1.3), L['tie'])     # the red tie
    paint(TORSO & (PY < 0) & (PX < -0.9) & (PX > -1.5) & (abs(PZ - J['torso'][1].z) < 0.15), L['tie'])   # the pocket square
    paint(NECK & (PZ < J['neck'][0].z + 0.3), '#ffffff')
    for z in (waist + 0.2, waist + 0.9): P.dab(Vector((0, -2, z)), 0.1, '#c8c4bc')          # buttons
if L.get('letters'):                          # the tank top: navy trim, block letters, bare shoulders
    paint(TORSO & (PZ < HIP.z - 0.1), L['pants'])
    paint(TORSO & (PZ > J['torso'][-1].z - 0.5) & (abs(PX) > 1.1), SKIN)                   # the arm holes
    paint(TORSO & (abs(PZ - (J['torso'][-1].z - 0.5)) < 0.08) & (abs(PX) > 1.0), L['letters'])
    paint(NECK, SKIN)
    paint(TORSO & (PY < 0) & (abs(PZ - (J['torso'][1].z - 0.5)) < 0.35) & (abs(PX) < 1.4) & (abs(PX) % 0.95 < 0.55), L['letters'])
    if L.get('chain'):
        P.stroke([Vector((-0.8, -1.6, J['torso'][-1].z - 0.2)), Vector((0, -1.9, J['torso'][1].z + 0.2)), Vector((0.8, -1.6, J['torso'][-1].z - 0.2))], 0.08, '#e8c050')
    for side in (-1, 1):                      # the backpack's straps over the shoulders
        paint(TORSO & (abs(PX - side * 1.0) < 0.22) & ((PY > 0) | (PZ > J['torso'][1].z)), L['backpack'])
P.accents({'eyes': '#141218', 'nose': SKIN, 'ears': SKIN, 'glasses': '#141218', 'goggles': '#9ad8e8',
           'buns': L['hair'], 'brim': L.get('top'), 'bill': L.get('cap', '#000000'), 'backpack': L.get('backpack', '#000000')})
for e in C.ACC.get('eyes', []):
    P.dab(e + Vector((math.copysign(0.05, e.x), -0.15, 0.06)), 0.05, '#ffffff')    # a catchlight
P.save(OUT, WHO)

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
    G.bone("Shin" + s, p[1], p[3], "Leg" + s, limb=key)
    G.bone("Foot" + s, p[3], p[5], "Shin" + s, limb=key)
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
SHIN = (J['leg_l'][3] - J['leg_l'][1]).length / UNIT

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
def sit(ph):        # sat on the sidewalk against the wall, legs out; petting the dog, then nodding along
    pet = ease(min(1, max(0, (ph - 0.15) / 0.15))) * (1 - ease(min(1, max(0, (ph - 0.55) / 0.15))))
    b = abs(S(ph * PI * 6))
    return {"Root": ((0, 0, 0), 0.32 - 0.95), "Hips": (-0.25, 0, 0),
            "LegL": (-1.3, 0, -0.14), "LegR": (-1.25, 0, 0.12), "ArmL": (-0.7, 0, -0.1),
            "ArmR": (-0.8 - b * 0.25 * (1 - pet) - 0.1 * pet, 0, 0.1 + pet * (0.65 + 0.18 * S(ph * PI * 8))),
            "Head": (0.25 + 0.1 * pet + b * 0.25 * (1 - pet), 0.5 * pet, 0)}
WV = EV('WV', 2.3)
def wave(ph):       # both arms over the head, then one high to you
    w = S(ph * PI * 4)
    return {"ArmR": (0, 0, WV + w * 0.3), "ArmL": (0, 0, -WV - S(ph * PI * 4 + 1) * 0.3), "Hips": ((0, 0, 0), abs(w) * 0.06)}
def thumb(ph):      # thumb out at the road; the shrug; the phone, the other hand on the hip
    k = ph * 3
    if k < 1: return {"ArmR": (-0.2, 0, 1.45), "ArmL": (0, 0, -0.12), "Head": (0, -0.6 + S(k * PI * 2) * 0.5, 0)}
    if k < 2: return {"ArmR": (-0.5, 0, 0.9), "ArmL": (-0.5, 0, -0.9), "Head": (0, 0, 0.3)}
    return {"ArmL": (-1.25, 0, -0.05), "ArmR": (0, 0, 0.5), "Head": (0.45, 0, 0)}
def dance(ph):      # the crazy guy's: the hips swinging, the arms flung about, the head jerking
    a = ph * PI * 2; b = abs(S(a * 2)); sw = S(a)
    return {"Hips": ((0.15 + b * 0.15, 0, sw * 0.2 + 0.1 * S(a * 6)), -b * 0.1), "LegL": (S(a) * 0.5, 0, 0), "LegR": (-S(a) * 0.5, 0, 0),
            "ArmL": (S(a * 3) * 1.2, 0, -1.2 - S(a * 2) * 0.9), "ArmR": (math.cos(a * 3) * 1.2, 0, 1.2 + math.cos(a * 2) * 0.9),
            "Head": (b * 0.4 + 0.3 * S(a * 5), S(a * 2) * 0.5, 0.4 * S(a * 5))}
def stomp(ph):      # travelling: big stomps; then the moonwalk
    a = ph * PI * 2
    if ph < 0.5: return {"LegL": (S(a * 2) * 0.55, 0, 0), "LegR": (-S(a * 2) * 0.55, 0, 0), "ArmL": (S(a * 2) * 0.8, 0, -1.0), "ArmR": (-S(a * 2) * 0.8, 0, 1.0)}
    sl = S(a * 2)
    return {"LegL": (max(0, sl) * -0.45, 0, 0), "LegR": (max(0, -sl) * -0.45, 0, 0), "ArmL": (-0.3 + sl * 0.2, 0, -0.25), "ArmR": (-0.3 - sl * 0.2, 0, 0.25), "Hips": (0.05, 0, 0)}
def runman(ph):     # the running man: a knee up, the other foot back, arms pumping
    k = S(ph * PI * 2)
    return {"LegL": (-1.0 * k if k > 0 else -0.3 * k, 0, 0), "LegR": (1.0 * k if k < 0 else -0.3 * k, 0, 0),
            "ArmL": (-0.9 * max(0, k), 0, -0.3), "ArmR": (-0.9 * max(0, -k), 0, 0.3), "Hips": ((0, 0, 0), -0.06 + abs(k) * 0.05)}
def roll(ph):       # the body roll, arms out in a wave
    a = ph * PI * 2; r = S(a)
    return {"Hips": (r * 0.25, 0, math.cos(a) * 0.12), "Head": (-r * 0.3, 0, 0), "LegL": (0, 0, -0.12), "LegR": (0, 0, 0.12),
            "ArmL": (0, 0, -1.4 - r * 0.4), "ArmR": (0, 0, 1.4 + S(a + 1.2) * 0.4)}

def groove(ph):     # the hitchhiker dancing along: hips swaying, a foot lifting, the arms pumping in front
    a = ph * PI * 2; sw = S(a); b = abs(S(a * 2))
    return {"Hips": ((0, sw * 0.3, sw * 0.08), -b * 0.07), "LegL": (max(0, sw) * -0.4, 0, 0), "LegR": (max(0, -sw) * -0.4, 0, 0),
            "ArmR": (-0.6 - b * 0.5, 0, 0.5), "ArmL": (-0.6 - (1 - b) * 0.5, 0, -0.5), "Head": (b * 0.2, S(a * 0.5) * 0.3, 0)}
def two(ph):        # the dancer's two-step
    a = ph * PI * 2; h = S(a); b = abs(S(a * 2))
    return {"Hips": ((0, 0, h * 0.12), -b * 0.08), "LegL": (max(0, h) * -0.3, 0, -0.1), "LegR": (max(0, -h) * -0.3, 0, 0.1),
            "ArmL": (-0.4 + h * 0.5, 0, -0.4), "ArmR": (-0.4 - h * 0.5, 0, 0.4), "Head": (b * 0.25, 0, 0)}
def up(ph):         # arms up on the drop, jumping on the beat
    b = abs(S(ph * PI * 2))
    return {"ArmL": (0, 0, -2.4 - b * 0.2), "ArmR": (0, 0, 2.4 + b * 0.2), "Hips": ((0, 0, 0), b * 0.18),
            "LegL": (-b * 0.3, 0, 0), "LegR": (-b * 0.3, 0, 0), "Head": (-0.3, 0, 0)}
def point(ph):      # the crazy guy pointing at the drones
    j = S(ph * PI * 6)
    return {"Hips": (-0.1, 0, 0), "ArmR": (0, 0, 2.4 + j * 0.15), "ArmL": (-0.3, 0, -0.5), "Head": (-0.5, 0.2, 0)}

G.act("groove", 32, posed(groove))
G.act("two", 32, posed(two))
G.act("up", 24, posed(up))
G.act("point", 24, posed(point))
if WHO == "homeless": G.act("sit", 48, posed(sit))     # only he sits; the rest stand all minute
G.act("wave", 24, posed(wave))
G.act("thumb", 36, posed(thumb))
G.act("dance", 48, posed(dance))
G.act("stomp", 48, posed(stomp))
G.act("runman", 24, posed(runman))
G.act("roll", 32, posed(roll))
G.act("idle", 24, posed(lambda ph: {"Hips": (0.02 * S(ph * PI * 2), 0, 0)}))
if not os.environ.get('NO_FIX'):
    G.fix_joints()
G.save(OUT, WHO)
