"""The Reclaimer (Planet Dirt, The Stranded depth 3, Ignition's finale boss),
built from the skill: an alien walker that lay under the rock as long as the
buried ship did, and came up wearing the excavator parts it dug into.

Read from the game, not guessed: scripts/reclaimer.gd poses the pivots of
scenes/models/reclaimer_body.tscn (Pelvis, HipL/R, KneeL/R, AnkleL/R,
ArmL/R, ElbowL/R), so those are the bones and the joints sit on them. The
model is built at a quarter of the game's size (the pivots divided by 4) so
bb_lib's brush and ray numbers hold; the Godot scene scales it back up.
Game x is Blender -x (the scene turns it half round), so ArmL / HipL are at
Blender +x.

  1. block out from one Cube: the hull, a fat gut sagging under it to the
     hips, legs out of the gut's underside, arms out of the hull's shoulders,
     the cockpit hump on top;
  2. knife: the chest core socket, the visor slit, the backpack, brow plates
     over the visor, belly plates;
  3. clay; personality: the two forearms are different weapons (the missile
     pod left, the long cannon right), a gouge raked across the gut, and one
     antenna snapped off; accents: jets, core, visor, cannon muzzle, spikes,
     track cleats and toe claws; connect.
Paint: the frame under the hull (rib plates, spine bars, limb struts, hip and
shoulder plates), hazard chevrons on the dug-up feet, balanced front, side
and back; a Honeycomb bead pass (armour cells); sketch marks.

COLOURS ARE PROVISIONAL: zack asked (2026-11-04) for a palette like his, "kinda
colorful", not taken from his models: violet, teal, magenta, orange, lime.

usage: python build_reclaimer.py -- <out dir> [seed]
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

# the game's pivots (reclaimer_body.tscn), / 4, in Blender axes (x = -game x,
# y = game z, z = game y). Every joint below is built onto these.
S = 0.25
PELVIS = Vector((0, 0.25, 66 * S))
# the hips turn at the top of the thighs, under the gut (the blockout's were up
# at the pelvis, 4 units above any leg, and a leg swung there dragged its
# thigh through the gut): reclaimer.gd now keeps each pivot's own rest height
HIP_Y = 52.0
HIP = {1: Vector((17 * S, 0.25, HIP_Y * S)), -1: Vector((-17 * S, 0.25, HIP_Y * S))}
KNEE_Z, ANKLE_Z = (66 - 26) * S, (66 - 54) * S
SHOULDER = {1: Vector((31 * S, 0.25, 104 * S)), -1: Vector((-31 * S, 0.25, 104 * S))}
ELBOW_Z = 84 * S

# ---------- 1. block out ----------
# The one Cube is the gut: a boss is fat, so the body grows OUT of a round
# belly, the chest up from its top and the legs down from its underside.
GUT = Vector((0, 0.25, 17.0))
C.start_cube((11.5, 9.0, 5.2), GUT, round_long=2.1)
chest = C.run(C.face_where((0, 0, 1)), [
    ((0, 0, 1), 0.6, 1.0, 1.0, (1.38, 0.86, 1.0)),      # the hull rises off the gut, narrower than it
    ((0, 0, 1), 3.0, 1.0, 1.0, (1.0, 0.98, 1.0)),       # to the shoulders
    ((0, 0.1, 1), 1.1, 0.8, 1.0),                       # and slopes in over them
], name='chest', region='chest')
C.run(chest, [
    ((0, 0, 1), 0.5, 0.8, 1.0),                         # collar, hunched between the shoulders
    ((0, -0.35, 1), 1.5, 0.86, 1.0, (0.9, 1.0, 1.0)),   # the cockpit hump leans forward
    ((0, -0.15, 1), 0.9, 0.74, 0.85),
], name='head', region='head')
C.run(C.face_where((0, 0, -1)), [
    ((0, 0.05, -1), 0.8, 1.0, 1.0, (1.3, 0.95, 1.0)),   # the gut rounds under
    ((0, 0, -1), 0.5, 0.92, 1.0),
], name='gut', region='gut')
pats = C.leg_patches(GUT, y_half=2.4, x_cut=0.8, below=2.0)
for side, key in ((1, 'leg_l'), (-1, 'leg_r')):
    out = HIP[side].x - pats[side].calc_center_median().x
    C.run(pats[side], [
        (tuple(pats[side].normal), 0.4, 0.9, 1.0, (1.15, 1.0, 1.0), (out * 0.75, 0, 0)),   # haunch, out of the gut
        ((0, 0, -1), 0.9, 0.8, 1.0),                    # the hip joint: a waist the thigh turns on, so it
        ((side * 0.03, 0, -1), 0.9, 1.22, 1.0),         # never swings up into the gut; the thigh swells again
        ((0, 0, -1), 1.2, 1.04, 1.0),                   # thigh, short under the fat gut
        ((0, 0, -1), 0.9, 0.84, 1.0),                   # knee
        ((0, 0.04, -1), 5.0, 1.02, 1.0),                # shin, heavy
        ((0, 0, -1), 0.8, 0.8, 1.0),                    # ankle
        ((0, 0, -1), 0.6, 0.95, 1.0),
        ((0, 0, -1), 0.5, 1.0, 1.0, (1.5, 2.7, 1.0), (0, 0.6, 0)),   # the dug-up track, long fore and aft
        ((0, 0, -1), 1.3, 1.0, 1.0),
        ((0, 0, -1), 0.45, 0.9, 1.0),
    ], name=key, region='leg')

# arms out of the hull's shoulders, both alike until the personality pass
sides = [f for f in C.bm.faces if abs(f.normal.x) > 0.8 and 20.5 < f.calc_center_median().z < 23.5
         and abs(f.calc_center_median().x) > 4]
shoulders = C.knife_pair(sides, [((0, 2.4, 0), (0, 1, 0)),
                                ((0, -1.9, 0), (0, -1, 0))], 0.1)
ARM_END = {}
for side, key in ((1, 'arm_l'), (-1, 'arm_r')):
    fs = shoulders[side]
    f = fs[0] if len(fs) == 1 else bmesh.ops.dissolve_faces(C.bm, faces=fs)['region'][0]
    ARM_END[side] = C.run(f, [
        ((side, 0, -0.25), 1.6, 1.15, 1.1),              # shoulder mass
        ((side * 0.05, 0, -1), 2.0, 0.88, 1.0),          # upper arm hangs to the elbow
        ((0, 0, -1), 0.8, 0.9, 1.0),                     # elbow
    ], name=key, region='arm')

print("JOINTS", {k: [tuple(round(c, 2) for c in p) for p in v] for k, v in J.items()})
if os.environ.get('BLOCKOUT_ONLY'):
    ob, me = C.to_object()
    import bpy
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "reclaimer_blockout.blend"))
    sys.exit(0)

# ---------- 2. knife and extrude (part-0 faces of one region at a time) ----------
def faces(region, test):
    C.bm.normal_update()
    return [f for f in C.bm.faces if C.on(region, f) and test(f.normal, f.calc_center_median())]
def one(fs):
    return fs[0] if len(fs) == 1 else bmesh.ops.dissolve_faces(C.bm, faces=fs)['region'][0]
def caps(nv):
    s_ = set(nv)
    return [f for f in C.bm.faces if f.is_valid and all(v in s_ for v in f.verts)]

# the chest core: a socket knifed into the front of the hull and pushed in
front = faces('chest', lambda n, c: n.y < -0.6 and 21.3 < c.z < 24.0)
core = C.knife(front, [((1.5, 0, 0), (1, 0, 0)), ((-1.5, 0, 0), (-1, 0, 0)),
                       ((0, 0, 23.6), (0, 0, 1)), ((0, 0, 21.4), (0, 0, -1))])
CORE_AT = sum((f.calc_center_median() for f in core), Vector()) / len(core)
C.pull(core, (0, 1, 0), 0.55, shrink=0.8)

# the visor: a slit across the cockpit's face, a brow plate pulled out over it
hf = faces('head', lambda n, c: n.y < -0.4)
slit = C.knife(hf, [((1.7, 0, 0), (1, 0, 0)), ((-1.7, 0, 0), (-1, 0, 0)),
                    ((0, 0, 26.15), (0, 0, 1)), ((0, 0, 25.55), (0, 0, -1))])
VISOR_AT = sum((f.calc_center_median() for f in slit), Vector()) / max(1, len(slit))
if slit: C.pull(slit, (0, 1, 0), 0.35, shrink=0.9)
hf = faces('head', lambda n, c: n.y < -0.4 and c.z > 26.2)
brow = C.knife_pair(hf, [((0, 0, 26.85), (0, 0, 1)), ((0, 0, 26.2), (0, 0, -1))], 0.25)
for side in (-1, 1):
    if brow[side]: C.pull(brow[side], (side * 0.3, -1, 0.25), 0.35, shrink=0.85)

# the backpack, and its two jets knifed out of its back and bored
back = faces('chest', lambda n, c: n.y > 0.6 and 21.4 < c.z < 24.4)
pack = C.knife(back, [((3.0, 0, 0), (1, 0, 0)), ((-3.0, 0, 0), (-1, 0, 0)), ((0, 0, 24.3), (0, 0, 1)), ((0, 0, 21.3), (0, 0, -1))])
nv = C.pull(pack, (0, 1, 0), 1.5, shrink=0.88)
packface = caps(nv)
jets = C.knife_pair(packface, [((0, 0, 23.6), (0, 0, 1)), ((0, 0, 21.9), (0, 0, -1))], 0.6)
JET_AT = {}
for side in (-1, 1):
    if not jets[side]: continue
    nv = C.pull(jets[side], (0, 1, -0.45), 1.0, shrink=0.8)          # the nozzle
    cap = caps(nv)
    JET_AT[side] = sum((v.co for v in nv), Vector()) / len(nv)
    if cap: C.pull(cap, (0, -1, 0.45), 0.6, shrink=0.65)             # bored in

# a belt plate round the gut, and knee caps
gf = faces('gut', lambda n, c: n.y < -0.6) + [f for f in C.bm.faces if C.on('body', f) and f.normal.y < -0.6]
belt = C.knife(gf, [((0, 0, 15.6), (0, 0, 1)), ((0, 0, 14.7), (0, 0, -1)), ((3.6, 0, 0), (1, 0, 0)), ((-3.6, 0, 0), (-1, 0, 0))])
if belt: C.pull(belt, (0, -1, -0.2), 0.3, shrink=0.94)
kf = faces('leg', lambda n, c: n.y < -0.6 and 8.3 < c.z < 10.4)
knees = C.knife_pair(kf, [((0, 0, 10.2), (0, 0, 1)), ((0, 0, 8.4), (0, 0, -1))], 1.0)
for side in (-1, 1):
    if knees[side]: C.pull(knees[side], (0, -1, 0.1), 0.45, shrink=0.8)

assert C.mirror_error() < 1e-3, "the skeleton must be mirror-true before the clay"
C.clay(jitter=0.05, lumps=6, box=((-5, 5), (-4, 4), (13, 24)), lump_r=(1.8, 3.2), lump_amt=(-0.18, 0.22))

# ---------- personality: on purpose, once or twice ----------
# The two forearms are different weapons, as the game fires them: the missile
# pod on ArmL (Blender +x) and the long cannon on ArmR. Then a gouge raked
# across the gut and one antenna snapped off.
C.bm.normal_update()
C.run(ARM_END[1], [
    ((0, -1, -0.1), 0.8, 1.0, 1.0),                         # wrist
    ((0, -1, 0), 2.4, 1.0, 1.0, (1.45, 1.0, 1.55)),         # the pod, a box of tubes
    ((0, -1, 0), 0.5, 0.94, 0.94),
], name='fore_l', region='pod')
POD_FACE = [f for f in C.bm.faces if f.normal.y < -0.9 and C.on('pod', f)]
POD_AT = sum((f.calc_center_median() for f in POD_FACE), Vector()) / len(POD_FACE)
C.pull(POD_FACE, (0, 1, 0), 0.35, shrink=0.88)               # the tubes' mouth, recessed
muzzle = C.run(ARM_END[-1], [
    ((0, -1, -0.05), 0.8, 0.95, 1.0),                       # wrist
    ((0, -1, 0), 2.2, 0.86, 1.0),                           # the long cannon
    ((0, -1, 0), 2.4, 0.8, 1.0),
    ((0, -1, 0), 0.7, 1.35, 1.35),                          # the muzzle flares
    ((0, -1, 0), 0.4, 0.96, 0.96),
], name='fore_r', region='cannon')
MUZZLE_AT = muzzle.calc_center_median().copy()
nv = C.pull([muzzle], (0, 1, 0), 0.8, shrink=0.6)           # bored
C.bm.normal_update()
C._bvh = __import__('mathutils').bvhtree.BVHTree.FromBMesh(C.bm)
C.scar(Vector((-2.2, -20, 17.4)), (0, 1, 0), (1, 0, -0.45), 3.4, width=0.28, depth=0.32)   # raked across the gut, low left

# ---------- 4. accents, seated with C.skin ----------
C.ball(CORE_AT + Vector((0, 0.3, 0)), 0.7, 'core')
for k in (-1, 0, 1):                                         # three lamps in the visor
    p = C.skin(VISOR_AT + Vector((k * 0.95, -6, 0)), (0, 1, 0))
    if p is not None: C.ball(p + Vector((0, 0.12, 0)), 0.3, 'visor')
head_top = max(v.co.z for v in C.bm.verts if v[C.REG] == C.regions['head'])
for side, h in ((1, 0.7), (-1, 2.4)):                        # antennae; ArmL's side snapped short
    p = C.skin((side * 1.1, 0.5, head_top + 5), (0, 0, -1))
    if p is not None: C.cone(p - Vector((0, 0, 0.1)), (side * 0.15, 0.25, 1), 0.2, h, 'antenna')
for side in (-1, 1):                                         # spikes on the shoulder humps
    sh = J['arm_l' if side > 0 else 'arm_r'][0]
    for dy, h in ((-0.9, 1.5), (0.8, 1.2)):
        p = C.skin((sh.x + side * 0.1, sh.y + dy, sh.z + 6), (0, 0, -1))
        if p is not None: C.cone(p - Vector((0, 0, 0.12)), (side * 0.45, dy * 0.15, 1), 0.38, h, 'spikes')
for side, key in ((1, 'leg_l'), (-1, 'leg_r')):              # digger claws on the front of each track
    toe = J[key][-1]
    for k in (-1, 0, 1):
        p = C.skin((toe.x + k * 0.95, toe.y - 8, toe.z + 0.5), (0, 1, 0))
        if p is not None:
            d = Vector((k * 0.15, -1, -0.25)).normalized()
            C.cone(p - d * 0.15, d, 0.32, 0.95, 'claws')
for k in (-1, 1):                                            # missile noses in the pod's mouth
    for m in (-1, 1):
        q = POD_AT + Vector((k * 0.62, 0.0, m * 0.62))
        p = C.skin(q + Vector((0, -5, 0)), (0, 1, 0))
        if p is not None: C.cone(p + Vector((0, 0.12, 0)), (0, -1, 0), 0.34, 0.6, 'missiles', sides=6)
p = C.skin(MUZZLE_AT + Vector((0, -5, 0)), (0, 1, 0))
if p is not None: C.ball(p + Vector((0, 0.2, 0)), 0.55, 'muzzle')
C.connect()
ob, me = C.to_object()
if os.environ.get('REST_ONLY'):
    import bpy
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'reclaimer_rest.blend')); sys.exit(0)

# ---------- paint (PROVISIONAL palette, zack: "kinda colorful", not his swatches) ----------
VIOLET, TEAL, MAGENTA, ORANGE, LIME = "#2b0f4c", "#17b3a3", "#ff2e88", "#ff8c1a", "#e8ff3a"
BASE, FRAME, PLATE, HAZARD, LAMP = TEAL, VIOLET, MAGENTA, ORANGE, LIME
P = Painter(C, BASE)
PX, PY, PZ = P.PX, P.PY, P.PZ
P.broad(-4.5, 5.5, FRAME, 'above', r=1.4, step=0.45)          # the tops in shadow: shoulders, cockpit
P.broad(-4.0, 4.5, FRAME, 'below', r=1.5, step=0.45)          # and the gut's underside
CHEST = P.region('chest'); GUTR = P.region('gut', 'body'); HEADR = P.region('head')
LEG = P.region('leg'); ARM = P.region('arm'); POD = P.region('pod'); CAN = P.region('cannon')
V3 = lambda x, z: Vector((x, 0, z))
for side in (-1, 1):
    # the frame under the hull, seen from the side: rib plates sweeping round the gut and chest
    for k in range(6):
        z = 14.2 + k * 1.75
        P.side_line([(-3.6, z + 0.5), (-1.2, z), (1.4, z - 0.2), (3.6, z + 0.4)], 0.22, FRAME, CHEST | GUTR, side)
    P.side_oval(0.3, 23.0, 2.3, 1.0, PLATE, CHEST, side, tilt=0.1)          # shoulder blade plate
    L = J['leg_l' if side > 0 else 'leg_r']
    P.side_line([(L[2].y + 0.6, L[2].z), (L[3].y + 0.6, L[3].z)], 0.4, FRAME, LEG, side)        # thigh strut
    P.side_line([(L[4].y + 0.7, L[4].z - 0.2), (L[5].y + 0.7, L[5].z + 0.3)], 0.32, FRAME, LEG, side)  # shin strut
    P.side_oval(L[3].y + 0.2, L[3].z - 0.5, 1.0, 0.8, PLATE, LEG, side)      # knee plate
    foot = LEG & (PZ < 2.4)
    for k in range(5):                                                       # hazard chevrons down the track
        y0 = -2.6 + k * 1.35
        P.side_line([(y0, 2.1), (y0 + 0.55, 1.2), (y0, 0.3)], 0.22, HAZARD, foot, side)
    A = J['arm_l' if side > 0 else 'arm_r']
    P.side_line([(A[0].y, A[0].z + 0.3), (A[1].y, A[1].z)], 0.3, FRAME, ARM, side)               # upper arm bone
    sh = LEG | ARM
    for k in range(3):                                                       # hazard bands on the shoulder hump
        P.side_line([(-1.6 + k * 1.1, 24.6), (-0.9 + k * 1.1, 21.8)], 0.22, HAZARD, ARM & (PZ > 21.5), side)
for view in ('front', 'back'):
    for lk in ('leg_l', 'leg_r'):
        L = J[lk]
        P.view_line([L[2] + Vector((0, 0, 0.3)), L[3]], 0.42, FRAME, LEG, view)
        P.view_line([L[4], L[5]], 0.34, FRAME, LEG, view)
        foot = LEG & (PZ < 2.4)
        for k in (-1, 0, 1):
            x = L[-1].x + k * 1.2
            P.view_line([V3(x - 0.45, 2.1), V3(x + 0.35, 1.2), V3(x - 0.45, 0.3)], 0.2, HAZARD, foot, view)
    for ak in ('arm_l', 'arm_r'):
        A = J[ak]
        P.view_line([A[0] + Vector((0, 0, 0.6)), A[1], A[2]], 0.3, FRAME, ARM, view)
# front: the keel down from the core, the belly ribs and the collar bones
P.view_line([V3(0, 21.0), V3(0, 18.4)], 0.3, FRAME, CHEST | GUTR, 'front')
for k in range(4):
    z = 18.6 - k * 1.25
    P.view_line([V3(-3.8 + k * 0.35, z + 0.8), V3(0, z), V3(3.8 - k * 0.35, z + 0.8)], 0.24, FRAME, GUTR | CHEST, 'front')
for sd in (-1, 1):
    P.view_line([V3(sd * 1.9, 24.0), V3(sd * 4.6, 23.2)], 0.3, FRAME, CHEST, 'front')
    P.view_line([V3(sd * 2.1, 21.2), V3(sd * 3.6, 22.4), V3(sd * 4.6, 22.0)], 0.22, PLATE, CHEST, 'front')
# back: the spine and a bar per vertebra, the hip plates, the shoulder blades
P.view_line([V3(0, 13.2), V3(0, 25.0)], 0.32, FRAME, CHEST | GUTR, 'back')
for k in range(9):
    z = 13.8 + k * 1.3
    w = 1.0 + 0.5 * math.sin(k / 8 * math.pi)
    P.view_line([V3(-w, z), V3(w, z)], 0.2, FRAME, CHEST | GUTR, 'back')
for sd in (-1, 1):
    P.view_line([V3(sd * 1.6, 17.6), V3(sd * 3.9, 16.8), V3(sd * 4.6, 14.6)], 0.34, PLATE, GUTR, 'back')
    P.view_line([V3(sd * 1.4, 24.0), V3(sd * 4.2, 22.6)], 0.3, PLATE, CHEST, 'back')
P.spine_bars([Vector((0, 0.6, 25.0)), Vector((0, -0.6, 27.2))], FRAME, HEADR, every=0.6, width=0.9)
# the weapons: the pod's plates and the cannon's bands
P.view_line([V3(J['fore_l'][-1].x - 1.6, 17.3), V3(J['fore_l'][-1].x + 1.6, 17.3)], 0.25, HAZARD, POD, 'front')
for side in (-1, 1):
    P.side_line([(J['fore_l'][1].y + 0.3, 20.6), (J['fore_l'][-1].y - 0.2, 20.6)], 0.24, PLATE, POD, side)
    P.side_line([(J['fore_l'][1].y + 0.3, 17.4), (J['fore_l'][-1].y - 0.2, 17.4)], 0.24, PLATE, POD, side)
for k, y in enumerate(np.linspace(J['fore_r'][0].y - 0.3, J['fore_r'][-2].y + 0.5, 4)):
    for side in (-1, 1):
        P.side_line([(y, 20.4), (y, 17.4)], 0.22 if k % 2 else 0.3, FRAME if k % 2 else PLATE, CAN, side)
P.accents({'core': MAGENTA, 'visor': LAMP, 'antenna': LAMP, 'spikes': HAZARD, 'claws': LAMP,
           'missiles': HAZARD, 'muzzle': MAGENTA})
P.dab(CORE_AT + Vector((0, -1.0, 0.3)), 0.35, LAMP)                    # a hot spot in the core
P.dab(MUZZLE_AT + Vector((0, -0.4, 0.1)), 0.22, LAMP)
P.paint_scars(FRAME, LAMP)
P.save(OUT, "reclaimer")

# ---------- rig: the game's pivots ----------
# Bones sit on the joints this model has; the scene's pivots are moved onto
# the same points (printed below as PIVOTS). Pelvis and the hips keep their
# heights (HIP_Y, 66), which scripts/reclaimer.gd keeps every frame.
G = Rig(C)
LJ = {s: J['leg_l' if s > 0 else 'leg_r'] for s in (-1, 1)}
AJ = {s: J['arm_l' if s > 0 else 'arm_r'] for s in (-1, 1)}
FJ = {s: J['fore_l' if s > 0 else 'fore_r'] for s in (-1, 1)}
HIP_Y = round(LJ[1][1].z / S, 1)                       # the hip joint's waist ring
HIP = {s: Vector((HIP[s].x, 0.25, HIP_Y * S)) for s in (-1, 1)}
KNEE = {s: Vector((HIP[s].x, 0.25, (LJ[s][3].z + LJ[s][4].z) / 2)) for s in (-1, 1)}
ANKLE = {s: Vector((HIP[s].x, 0.25, LJ[s][6].z)) for s in (-1, 1)}
SHO = {s: Vector((AJ[s][0].x, 0.25, AJ[s][0].z)) for s in (-1, 1)}
ELB = {s: Vector((AJ[s][2].x, 0.25, (AJ[s][1].z + AJ[s][2].z) / 2)) for s in (-1, 1)}
PIV = {"Pelvis": PELVIS}
G.bone("Pelvis", PELVIS, PELVIS + Vector((0, 0, 7.5)))
for s, n in ((1, "L"), (-1, "R")):
    leg, arm, fore = ('leg_l', 'arm_l', 'fore_l') if s > 0 else ('leg_r', 'arm_r', 'fore_r')
    G.bone("Hip" + n, HIP[s], KNEE[s], "Pelvis", limb=leg)
    G.bone("Knee" + n, KNEE[s], ANKLE[s], "Hip" + n, limb=leg)
    G.bone("Ankle" + n, ANKLE[s], Vector((HIP[s].x, 0.8, 0.2)), "Knee" + n, limb=leg)   # down the middle of the track, so all of it rides the ankle
    G.bone("Arm" + n, SHO[s], ELB[s], "Pelvis", limb=arm)
    G.bone("Elbow" + n, ELB[s], FJ[s][-1], "Arm" + n, limb=fore)
    PIV.update({"Hip" + n: HIP[s], "Knee" + n: KNEE[s], "Ankle" + n: ANKLE[s], "Arm" + n: SHO[s], "Elbow" + n: ELB[s]})
G.skin()

# ---- the game's pose (reclaimer.gd _pose), played on the bones ----
# game (x, y, z) = (-bx, bz, by) * 4: one similarity carries a game pivot's
# transform into Blender, so the GIFs move exactly as the pivots do in game.
MAP = Matrix(((-1, 0, 0, 0), (0, 0, 1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))
def g2b(m):
    sc_ = Matrix.Scale(S, 4)
    return sc_ @ MAP @ m @ MAP.inverted() @ sc_.inverted()
def b2g(v): return Vector((-v.x, v.z, v.y)) / S
def eul(x, y, z):     # Godot's rotation: YXZ
    return (Matrix.Rotation(y, 4, 'Y') @ Matrix.Rotation(x, 4, 'X') @ Matrix.Rotation(z, 4, 'Z'))
PARENT = {"Pelvis": None, "HipL": None, "HipR": None, "KneeL": "HipL", "KneeR": "HipR", "AnkleL": "KneeL",
          "AnkleR": "KneeR", "ArmL": "Pelvis", "ArmR": "Pelvis", "ElbowL": "ArmL", "ElbowR": "ArmR"}
def local_pos(n):
    p = b2g(PIV[n]); par = PARENT[n]
    return p - b2g(PIV[par]) if par else p
def pivots(rot, pos=None):
    """rot: {pivot: (x, y, z) radians}, pos: {pivot: game y}; -> Blender world matrix per pivot"""
    pos = pos or {}
    out = {}
    for n in PARENT:                                   # PARENT is in hierarchy order
        lp = local_pos(n)
        if n in pos: lp = Vector((lp.x, pos[n], lp.z))
        m = Matrix.Translation(lp) @ eul(*rot.get(n, (0, 0, 0)))
        out[n] = (out[PARENT[n]] @ m) if PARENT[n] else m
    return {n: g2b(m) for n, m in out.items()}
REST = pivots({})
bpy_bones = None
def pose_from(state):
    """state(ph) -> (rot, pos); returns a Rig.act pose callback in bone-local euler"""
    cache = {}
    def pose(n, ph):
        if ph not in cache:
            rot, pos = state(ph)
            W = pivots(rot, pos)
            import bpy
            bones = G.ao.data.bones
            world = {b: W[b] @ REST[b].inverted() @ bones[b].matrix_local for b in W}
            loc = {}
            for b in W:
                bb = bones[b]
                if bb.parent:
                    rel_rest = bb.parent.matrix_local.inverted() @ bb.matrix_local
                    L = rel_rest.inverted() @ world[bb.parent.name].inverted() @ world[b]
                else:
                    L = bb.matrix_local.inverted() @ world[b]
                loc[b] = L
            cache[ph] = loc
        L = cache[ph].get(n)
        if L is None: return (0, 0, 0), (0, 0, 0)
        e = L.to_euler('XYZ')
        return tuple(math.degrees(a) for a in e), tuple(L.translation)
    return pose

# reclaimer.gd's leg stomp, as the skinned body takes it: a sumo stomp, the leg
# swung out to the side, since a thigh lifted straight forward goes into the gut
STOMP_HIP, STOMP_KNEE, STOMP_ROLL, STOMP_LIFT = 0.55, 0.95, 0.3, 0.0
def legs(ph, g=1.0, fwd=1.0, side_=0.0, t=0.0, c=0.0, ls='', lk=0.0, swing=0.5, lift=1.0):
    rot, pos = {}, {}
    for s_ in ("L", "R"):
        q = ph + (math.pi if s_ == "R" else 0.0)
        sw = math.sin(q) * swing * g
        lift_k = -(max(0.0, math.cos(q)) * lift + 0.12) * g
        hip = sw * fwd * (1 - t) - 0.32 * t + 0.6 * c
        knee = lift_k * (1 - t) - 0.7 * t - 1.2 * c
        roll = sw * side_ * 0.7 * (1 - t)
        if ls:
            if ls == s_:
                hip = hip * (1 - lk) + STOMP_HIP * lk; knee = knee * (1 - lk) - STOMP_KNEE * lk
                roll = roll * (1 - lk) + (-STOMP_ROLL if s_ == "L" else STOMP_ROLL) * lk
            else:
                hip += 0.25 * lk; knee -= 0.5 * lk
        rot["Hip" + s_] = (hip, 0, roll)
        pos["Hip" + s_] = HIP_Y + (STOMP_LIFT * lk if ls == s_ else 0.0)
        rot["Knee" + s_] = (knee, 0, 0)
        rot["Ankle" + s_] = (-(hip + knee) * (1 - t * 0.6), 0, -roll)
    pos["Pelvis"] = 66.0 - 4.0 * g * (0.5 - 0.5 * math.cos(2 * ph)) - 6.0 * lk
    lean = ((-0.07 if ls == "L" else 0.07) * lk) if ls else 0.0
    rot["Pelvis"] = (0, 0.08 * math.sin(ph) * g, 0.045 * math.sin(ph) * g + lean)
    return rot, pos
def arms(rot, ph, g=1.0, t=0.0, aim=0.0, prog=0.0, lk=0.0):
    lift_ = 0.35 * aim
    pitch = aim * (-1.15 + 0.85 * prog)
    rot["ArmL"] = (-0.22 * math.sin(ph) * g + 0.2 * t + lift_ - 0.3 * lk, 0, 0)
    rot["ArmR"] = (0.22 * math.sin(ph) * g + 0.2 * t + lift_ - 0.3 * lk, 0, 0)
    rot["ElbowL"] = (pitch, 0, 0); rot["ElbowR"] = (pitch, 0, 0)
    return rot

def walk(ph01):
    ph = ph01 * 2 * math.pi
    rot, pos = legs(ph)
    return arms(rot, ph), pos
def stomp(ph01):                       # LEG_STOMP on the left: the leg rises and drives down
    lk = ease(min(1, ph01 / 0.45)) * (1 - ease(min(1, max(0, (ph01 - 0.55) / 0.2))))
    rot, pos = legs(0.0, g=0.0, ls="L", lk=lk)
    return arms(rot, 0.0, g=0.0, lk=lk), pos
def laser(ph01):                       # arms up and the beams swept from far to near
    aim = ease(min(1, ph01 / 0.2)) * (1 - ease(min(1, max(0, (ph01 - 0.85) / 0.15))))
    prog = min(1, max(0, (ph01 - 0.2) / 0.6))
    rot, pos = legs(0.0, g=0.0)
    return arms(rot, 0.0, g=0.0, aim=aim, prog=prog), pos
def hop(ph01):                         # the jets: crouch, tuck in the air, land
    c = ease(min(1, ph01 / 0.2)) * (1 - ease(min(1, max(0, (ph01 - 0.2) / 0.1))))
    t = ease(min(1, max(0, (ph01 - 0.25) / 0.15))) * (1 - ease(min(1, max(0, (ph01 - 0.75) / 0.15))))
    c += ease(min(1, max(0, (ph01 - 0.88) / 0.06))) * (1 - ease(min(1, max(0, (ph01 - 0.94) / 0.06)))) * 0.6
    rot, pos = legs(0.0, g=0.0, t=t, c=c)
    return arms(rot, 0.0, g=0.0, t=t), pos

G.act("walk", 40, pose_from(walk))
G.act("stomp", 36, pose_from(stomp))
G.act("laser", 48, pose_from(laser))
G.act("hop", 40, pose_from(hop))
if not os.environ.get("NOFIX"): G.fix_joints()
G.save(OUT, "reclaimer")

# the scene's pivots and markers, in game units, for reclaimer_body.tscn
def gp(n): return local_pos(n)
print("PIVOTS", {n: tuple(round(c, 2) for c in gp(n)) for n in PARENT})
import json
json.dump({"pivots": {n: [round(c, 2) for c in gp(n)] for n in PARENT},
           "core": [round(c, 2) for c in b2g(CORE_AT)], "pod": [round(c, 2) for c in b2g(POD_AT)],
           "muzzle": [round(c, 2) for c in b2g(MUZZLE_AT)],
           "jets": {("L" if s_ > 0 else "R"): [round(c, 2) for c in b2g(v)] for s_, v in JET_AT.items()},
           "feet": {("L" if s_ > 0 else "R"): [round(c, 2) for c in b2g(Vector((HIP[s_].x, 3.6, 0.6)))] for s_ in (-1, 1)}},
          open(os.path.join(OUT, "reclaimer_rig.json"), "w"), indent=1)
print("MARKS", {"core": tuple(round(c, 1) for c in b2g(CORE_AT)), "pod": tuple(round(c, 1) for c in b2g(POD_AT)),
                "muzzle": tuple(round(c, 1) for c in b2g(MUZZLE_AT)),
                "jets": {s: tuple(round(c, 1) for c in b2g(v)) for s, v in JET_AT.items()}})
if os.environ.get('MODEL_ONLY'):
    import bpy
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "reclaimer_model.blend")); sys.exit(0)
