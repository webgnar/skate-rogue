"""The Reclaimer Drone (Planet Dirt, The Stranded, Ignition): the attack drone
the Reclaimer launches from its missile pod, five at a time, hovering low at 60
units so every gun reaches it. Shape from candidate B on the Reclaimer Drones
page (docs/mockups/gen_reclaimer_drone.py): a hull with a plated nose and one
eye, a gun slung under it, two rotor pods on short arms. Neither candidate was
approved; this is that shape built the skill's way. No game scene drives it
yet, so the bones are named for what a scene would spin: Body, Gun,
RotorLeft, RotorRight.

  1. block out from one Cube: nose forward (knifed across at the visor line),
     tail back to the exhaust, an arm out of each side growing into a rotor
     pod, a mast up out of each pod, the gun knifed out of the belly and
     extruded down then forward;
  2. knife: a visor brow over the eye, a dorsal keel, intake scoops on the
     tail, a rim round each pod;
  3. clay (light: it is machinery); 4. personality: a gouge across the right
     side of the nose and a bent antenna, one rotor blade chipped short;
  5. accents: the eye, the rotor hubs and blades, two landing talons, the
     beacon, glow strips along the arms.
Paint: the frame under the plating (panel seams across the back, the side
seam, hazard bands on the arms and pod rims, the gun's ribs), balanced front,
side and back. The rotors are part-bound to their bones whole, so they spin
without dragging the skin.

COLOURS ARE PROVISIONAL: the Reclaimer's own five (teal hull, deep violet
darks and plates, magenta eye and muzzle, hazard orange bands, lime glow),
chosen with the boss so the drones read as its brood. zack asked for a
palette like his, colourful, not his exact swatches.

usage: python build_reclaimer_drone.py -- <out dir> [seed]
"""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bb_lib import Creature, Painter, Rig, ease
from mathutils import Vector, Matrix
import bmesh

args = sys.argv[sys.argv.index('--') + 1:]
OUT = args[0]
SEED = int(args[1]) if len(args) > 1 else 7
C = Creature(SEED)
J, R = C.J, C.R
ROTOR = {-1: 2, 1: 3}                    # part ids: each rotor spins whole on its bone

# ---------- 1. block out ----------
BODY0 = Vector((0, 0, 6))
C.start_cube((6.0, 7.0, 2.6), BODY0, round_long=0.8)
C.run(C.face_where((0, -1, 0)), [
    ((0, -1, 0.0), 0.8, 0.92, 0.95),     # shoulder of the nose
    ((0, -1, -0.06), 1.6, 0.86, 0.9),    # the nose plate
    ((0, -1, -0.12), 0.9, 0.72, 0.78),   # snout, where the eye sits
], name='nose', region='nose')
tail = C.run(C.face_where((0, 1, 0)), [
    ((0, 1, 0.04), 1.0, 0.92, 0.92),
    ((0, 1, 0.1), 1.9, 0.72, 0.78),      # tail cone
    ((0, 1, 0.05), 0.7, 0.62, 0.66),     # exhaust collar
    ((0, 1, 0.0), 0.35, 1.12, 1.12),     # exhaust lip flares
], name='tail', region='tail')

# an arm out of each side face, growing into a rotor pod
for side in (-1, 1):
    f = C.face_where((side, 0, 0))
    C.run(f, [
        ((side, 0, 0), 0.5, 1, 1, (1, 0.45, 1.25)),      # root, narrowed from the long side face
        ((side, 0, 0.06), 2.4, 1, 1, (1, 0.78, 0.9)),    # the arm
        ((side, 0, 0), 0.4, 1, 1, (1, 1.55, 1.6)),       # pod shoulder widens
        ((side, 0, 0), 2.6, 1, 1, (1, 1.04, 1.0)),       # the rotor pod
        ((side, 0, 0), 0.4, 1, 1, (1, 0.82, 0.8)),       # pod's outer cap
    ], name=f"arm_{'l' if side < 0 else 'r'}", region='arm')
POD_X = {s: (J[f"arm_{'l' if s < 0 else 'r'}"][2].x + J[f"arm_{'l' if s < 0 else 'r'}"][3].x) / 2 for s in (-1, 1)}
for side in (-1, 1):                     # a mast up out of the middle of each pod's top
    C.bm.normal_update()
    tops = [f for f in C.bm.faces if f.normal.z > 0.9 and C.on('arm', f)]
    top = min(tops, key=lambda f: abs(f.calc_center_median().x - POD_X[side]) + abs(f.calc_center_median().y))
    C.run(top, [
        ((0, 0, 1), 0.25, 0.55, 1.0),    # mast collar
        ((0, 0, 1), 0.6, 0.6, 1.0),      # mast
    ], name=f"mast_{'l' if side < 0 else 'r'}", region='mast')

# the gun: a patch of the belly knifed out and grown down, then forward
C.bm.normal_update()
belly = [f for f in C.bm.faces if C.on('body', f) and f.normal.z < -0.6]
patch = C.knife(belly, [((0.9, 0, 0), (1, 0, 0)), ((-0.9, 0, 0), (-1, 0, 0)),
                        ((0, -2.4, 0), (0, -1, 0)), ((0, 0.2, 0), (0, 1, 0))])
print("gun patch faces", len(patch))
gun_face = patch[0] if len(patch) == 1 else bmesh.ops.dissolve_faces(C.bm, faces=patch)['region'][0]
C.run(gun_face, [
    ((0, 0, -1), 0.3, 0.9, 1.0),         # collar
    ((0, -0.1, -1), 0.6, 1.05, 1.0),     # turret ball
    ((0, -1, 0), 0.9, 0.55, 0.55),       # breech, turned forward (a knee ring comes with the turn)
    ((0, -1, 0), 2.8, 0.6, 0.6),         # barrel
    ((0, -1, 0), 0.35, 1.35, 1.35),      # muzzle brake
    ((0, -1, 0), 0.4, 0.95, 0.95),
], name='gun', region='gun')

# ---------- 2. knife shapes in, extrude them ----------
nz = J['nose']
C.bm.normal_update()
top = [f for f in C.bm.faces if C.on('nose', f) and f.normal.z > 0.4 and nz[0].y + 0.2 > f.calc_center_median().y > nz[2].y + 0.3]
visor = C.knife(top, [((0, nz[1].y - 0.5, 0), (0, -1, 0)), ((0, nz[1].y + 0.5, 0), (0, 1, 0))])
if visor: C.pull(visor, (0, -0.35, 1), 0.4, shrink=0.9)        # a brow plate over the eye
C.bm.normal_update()
keel = [f for f in C.bm.faces if C.on('body', f) and f.normal.z > 0.6]
keel = C.knife(keel, [((0.45, 0, 0), (1, 0, 0)), ((-0.45, 0, 0), (-1, 0, 0))])
if keel: C.pull(keel, (0, 0, 1), 0.35, shrink=0.9)            # a keel down the back
tl = J['tail']
C.bm.normal_update()
ttop = [f for f in C.bm.faces if C.on('tail', f) and f.normal.z > 0.5 and tl[0].y < f.calc_center_median().y < tl[1].y]
scoops = C.knife_pair(ttop, [((0, tl[0].y + 0.2, 0), (0, -1, 0)), ((0, tl[1].y - 0.3, 0), (0, 1, 0))], 0.5)
for side in (-1, 1):
    if scoops[side]: C.pull(scoops[side], (side * 0.4, 0.3, 1), 0.3, shrink=0.85)   # intake scoops

assert C.mirror_error() < 1e-3, "the skeleton must be mirror-true before the clay"
C.clay(jitter=0.02, lumps=3, box=((-3, 3), (-5, 6), (4.6, 7.4)), lump_r=(1.0, 1.8), lump_amt=(-0.1, 0.12))

# ---------- personality: on purpose, once or twice ----------
C.scar(Vector((7, J['nose'][1].y + 0.35, J['nose'][1].z - 0.15)), (-1, 0, 0), (0, 1, 0.3), 1.25)   # a gouge across the right side of the nose

# ---------- accents ----------
C.bm.normal_update()
nose_end = J['nose'][-1]
p = C.skin((0, nose_end.y - 8, nose_end.z + 0.1), (0, 1, 0))
if p is not None: C.ball(p + Vector((0, 0.3, 0)), 0.62, 'eye')               # the one eye, half sunk
HUB = {}
for side in (-1, 1):
    m = J[f"mast_{'l' if side < 0 else 'r'}"][-1]
    hub = m + Vector((0, 0, 0.12))
    HUB[side] = hub
    C.ball(hub, 0.5, 'hub', part=ROTOR[side])
    for k in range(2):                                                     # two crossed blades, four tips
        ang = k * math.pi / 2 + (0.35 if side < 0 else -0.35)
        L = 7.0
        if side > 0 and k == 1: L = 5.6                                    # one blade chipped short: personality
        off = Vector((0, 0, 0)) if L == 7.0 else Vector((math.cos(ang), math.sin(ang), 0)) * -(7.0 - L) / 2
        mtx = Matrix.Translation(hub + Vector((0, 0, 0.28)) + off) @ Matrix.Rotation(ang, 4, 'Z') @ Matrix.Diagonal((L, 0.7, 0.14, 1))
        C.box(mtx, 'blades', part=ROTOR[side], at=hub)
    a = J[f"arm_{'l' if side < 0 else 'r'}"]                              # a glow strip along each arm's top
    tz = max(v.z for v in R[f"arm_{'l' if side < 0 else 'r'}"][1])
    ax = (a[0].x + a[1].x) / 2
    C.box(Matrix.Translation((ax, 0, tz + 0.02)) @ Matrix.Diagonal((abs(a[1].x - a[0].x) * 0.9, 0.35, 0.22, 1)), 'glow')
    p = C.skin((side * 2.0, -1.0, BODY0.z - 8), (0, 0, 1))                 # landing talons under the hull
    if p is not None: C.cone(p + Vector((0, 0, 0.1)), (side * 0.25, -0.3, -1), 0.32, 1.4, 'talons')
p = C.skin((0, J['tail'][0].y + 0.4, BODY0.z + 8), (0, 0, -1))
if p is not None: C.ball(p - Vector((0, 0, 0.18)), 0.36, 'beacon')       # beacon on the back
p = C.skin((-0.7, J['tail'][1].y - 0.4, BODY0.z + 8), (0, 0, -1))
if p is not None: C.cone(p - Vector((0, 0, 0.05)), (-0.55, 0.5, 1), 0.12, 2.1, 'antenna', sides=4)   # bent back in some crash
C.connect()
ob, me = C.to_object()

# ---------- paint pass 1 (PROVISIONAL palette, the Reclaimer's) ----------
TEAL, VIOLET, MAGENTA, ORANGE, LIME = "#17b3a3", "#2b0f4c", "#ff2e88", "#ff8c1a", "#e8ff3a"
import numpy as np
from bb_lib import hexc
mix = lambda a, b, t: hexc(a) * (1 - t) + hexc(b) * t
LIGHT, DARK = mix(TEAL, "#ffffff", 0.22), mix(TEAL, "#000000", 0.35)   # the scheme colour, lighter and darker
P = Painter(C, TEAL, size=512)
V = P.V
P.broad(min(V[:, 1]), max(V[:, 1]), LIGHT, 'above', r=1.0, step=0.4)          # the back catches the light
P.broad(J['nose'][1].y, J['tail'][1].y, VIOLET, 'below', r=1.0, step=0.4)       # belly plates
BODY = P.region('body'); NOSE = P.region('nose'); TAIL = P.region('tail')
ARM = P.region('arm'); MAST = P.region('mast'); GUN = P.region('gun')
PX, PY, PZ = P.PX, P.PY, P.PZ
P.img[GUN & P.mask] = P.col(VIOLET)
P.img[MAST & P.mask] = DARK
# the frame under the plating: a seam across the back at every rib
P.spine_bars([J['nose'][-1], J['nose'][0], BODY0 + Vector((0, -2.5, 0)), BODY0, BODY0 + Vector((0, 2.5, 0))] + J['tail'][:2],
             DARK, BODY | NOSE | TAIL, every=1.2, width=0.35)
for side in (-1, 1):
    path = [(J['nose'][-1].y, J['nose'][-1].z - 0.2), (J['nose'][0].y, BODY0.z), (BODY0.y + 3.5, BODY0.z)] + \
           [(p.y, p.z - 0.1) for p in J['tail'][:3]]
    P.side_line(path, 0.2, DARK, BODY | NOSE | TAIL, side)                  # the side seam
    for y in (-2.2, 0.0, 2.2):                                              # frame posts down from the keel
        tz = P.top_z(y, BODY0.z + 1.3)
        P.side_line([(y, tz - 0.25), (y, BODY0.z + 0.1)], 0.16, DARK, BODY, side)
    key = f"arm_{'l' if side < 0 else 'r'}"
    a = J[key]
    for t in (0.25, 0.55, 0.85):                                            # hazard bands round the arm
        x = a[0].x + (a[1].x - a[0].x) * t
        band = ARM & (np.abs(PX - x) < 0.22) & (PX * side > 0)
        P.img[band & P.mask] = P.col(ORANGE)
    for x in (a[2].x, a[4].x):                                              # the pod's rims, orange
        band = ARM & (np.abs(PX - x) < 0.25) & (PX * side > 0) & (np.abs(P.NX) < 0.5)
        P.img[band & P.mask] = P.col(ORANGE)
    podmid = (a[2].x + a[4].x) / 2                                          # a brown plate round the pod's middle
    P.img[ARM & (np.abs(PX - podmid) < 0.5) & (PZ < BODY0.z + 0.3) & P.mask] = P.col(VIOLET)
# gun ribs and the red muzzle
g = J['gun']
for k in range(3):
    y = g[2].y + (g[3].y - g[2].y) * (k + 1) / 4
    P.img[GUN & (np.abs(PY - y) < 0.12) & P.mask] = P.col(ORANGE)
P.img[GUN & (PY < g[4].y + 0.25) & P.mask] = P.col(MAGENTA)
# front and back: the visor frame round the eye, the exhaust's rings
P.view_line([Vector((-1.4, 0, nz[-1].z + 0.9)), Vector((0, 0, nz[-1].z + 1.2)), Vector((1.4, 0, nz[-1].z + 0.9))], 0.22, ORANGE, NOSE, 'front')
P.view_line([Vector((-1.6, 0, nz[-1].z - 0.7)), Vector((1.6, 0, nz[-1].z - 0.7))], 0.2, DARK, NOSE, 'front')
P.img[TAIL & (PY > J['tail'][2].y - 0.15) & P.mask] = P.col(VIOLET)
P.img[TAIL & (PY > J['tail'][3].y - 0.08) & P.mask] = P.col(ORANGE)
for k in range(2):
    z = BODY0.z + 0.5 - k * 1.0
    P.view_line([Vector((-1.2, 0, z)), Vector((1.2, 0, z))], 0.18, DARK, TAIL, 'back')
P.accents({'eye': MAGENTA, 'hub': LIME, 'blades': ORANGE, 'glow': LIME, 'talons': VIOLET, 'beacon': LIME, 'antenna': VIOLET})
for e in C.ACC['eye']:
    P.dab(e + Vector((0.15, -0.5, 0.15)), 0.16, LIME)                      # a glint
blade = P.acc == C.acc_codes['blades']
P.img[blade & (np.hypot(PX - np.sign(PX) * abs(POD_X[1]), PY) > 2.9)] = P.col(LIME)   # yellow blade tips
for t in C.ACC['talons']:
    P.dab(t + Vector((0, -0.3, -1.25)), 0.25, LIME)
P.paint_scars(DARK, ORANGE)
P.save(OUT, "reclaimer_drone")

# ---------- rig ----------
G = Rig(C)
G.bone("Body", BODY0 + Vector((0, 2.5, 0)), BODY0 + Vector((0, -2.5, 0)))
G.bone("Gun", g[1], g[-1], "Body", limb='gun')
for side, nm in ((-1, "RotorLeft"), (1, "RotorRight")):
    G.bone(nm, HUB[side], HUB[side] + Vector((0, 0, 1.5)), "Body")       # points up: its roll spins the blades
G.skin(part_bones={ROTOR[-1]: "RotorLeft", ROTOR[1]: "RotorRight"})

# ---------- actions ----------
TURNS = 3                                 # rotor turns per loop, opposite ways so the drone does not yaw

def spin(n, ph, rate=1.0):
    if n == "RotorLeft": return (0, 360 * TURNS * rate * ph, 0), (0, 0, 0)
    if n == "RotorRight": return (0, -360 * TURNS * rate * ph, 0), (0, 0, 0)
    return None

def hover(n, ph):
    """bobbing in place, nose hunting side to side, gun tracking"""
    w = ph * 2 * math.pi
    s = spin(n, ph)
    if s: return s
    if n == "Body": return (3 * math.sin(w), 4 * math.sin(w + 1.2), 5 * math.sin(w * 2) * 0.6), (0, 0, 0.6 * math.sin(w))
    if n == "Gun": return (6 * math.sin(w + 0.5), 0, 0), (0, 0, 0)
    return (0, 0, 0), (0, 0, 0)

def fire(n, ph):
    """rears back to wind up, dips the nose at the target, three rounds, settles"""
    s = spin(n, ph, 1.4)
    if s: return s
    settle = 1 - ease(max(0, (ph - 0.75) / 0.25))
    wind = ease(min(1, ph / 0.3)) * settle
    dip = ease(min(1, max(0, (ph - 0.3) / 0.12))) * settle
    kick = 0.0
    for t0 in (0.42, 0.52, 0.62):                                          # three shots, each a recoil
        u = (ph - t0) / 0.08
        if 0 <= u < 1: kick = max(kick, 1 - u)
    if n == "Body": return (-10 * wind * (1 - dip) + 12 * dip - 4 * kick, 0, 0), (0, 0.9 * wind * (1 - dip) + 0.5 * kick, 0.4 * wind)
    if n == "Gun": return (8 * dip - 6 * kick, 0, 0), (0, 0.25 * kick, 0)
    return (0, 0, 0), (0, 0, 0)

def death(n, ph):
    """hit: the rotors stall, it lurches onto its chipped side and spins down"""
    s = spin(n, ph * (1.6 - ph), 1.0)   # the spin winds down
    if s: return s
    fall = ease(min(1, ph / 0.85))
    if n == "Body": return (18 * fall, 0, 40 * fall + 6 * math.sin(ph * 30) * (1 - fall)), (0, 0, -5.0 * fall * fall)
    if n == "Gun": return (14 * fall, 0, 0), (0, 0, 0)
    return (0, 0, 0), (0, 0, 0)

G.act("hover", 32, hover)
G.act("fire", 40, fire)
G.act("death", 36, death)
G.fix_joints()
G.save(OUT, "reclaimer_drone")
