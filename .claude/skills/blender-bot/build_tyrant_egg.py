"""The Tyrant Egg (Planet Dirt), one-shot from SKILL.md and bb_lib, 2026-11-04.

What the game needs (scripts/tyrant_egg.gd, scenes/tyrant_egg.tscn): an egg
the Tyrant lays behind it, sitting in a nest. It warms for ten seconds, glows
and throbs harder as it does, then bursts into three raptors. The blockout is
a sphere 22 across and 30 tall on a nest 36 across and 5 high; the build is
held to those ratios (REF below) and made at game size, 1 unit = 1 game unit.

Not a creature with legs, so the skill's steps are read for a prop:
  1. block out from one Cube: the flat nest, its lip rolled up and in, the egg
     rising out of the nest's bowl (one mesh: the egg grows from the nest, it
     does not sit on it), the top cap its own run so it can rock and lift;
  2. knife: four shell ridges, left, right, front and back (the Tyrant's
     plated hide shows on its eggs), pulled out;
  3. clay; personality: the egg leans a little off true, and a jagged crack
     on its front right with a raptor claw already through it (the story: it
     is about to go); accents: nubs down the ridges, stones and bone shards
     round the nest; connect.
Paint from the skeleton: the curled raptor inside, seen through the shell the
way an egg looks held to a lamp (spine, ribs, skull, folded legs, tail),
balanced front, side and back.

Palette: PROVISIONAL. zack asked for one like his, "kinda colorful", and gave
no swatches for this model, so these five are new, vivid, and none is from his
models: violet ink, warm yellow shell, hot pink marks, teal, rust nest.

usage: python build_tyrant_egg.py -- <out dir> [seed]
"""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bb_lib import Creature, Painter, Rig, ease, hexc
from mathutils import Vector
from mathutils.bvhtree import BVHTree
import bmesh
import numpy as np

args = sys.argv[sys.argv.index('--') + 1:]
OUT = args[0]
SEED = int(args[1]) if len(args) > 1 else 7
C = Creature(SEED)
J, R = C.J, C.R

# ---------- 1. block out: one cube, flattened into the nest ----------
NEST_W, NEST_H = 34.0, 3.0
C.start_cube((NEST_W, NEST_W, NEST_H), (0, 0, NEST_H / 2), round_long=0)
# eight sides round the up axis: bevel the four vertical edges (start_cube's
# own rounding bevels the edges along y, for a body lying nose to tail)
bm = C.bm
vert_edges = [e for e in bm.edges if abs((e.verts[0].co - e.verts[1].co).normalized().z) > 0.9]
bmesh.ops.bevel(bm, geom=vert_edges, offset=NEST_W * 0.29, offset_type='OFFSET', segments=1, profile=0.5, affect='EDGES')
for v in bm.verts:                      # the walls slope in: a mound, not a plinth (zack scales verts)
    if v.co.z > NEST_H / 2: v.co.x *= 0.82; v.co.y *= 0.82
bm.normal_update()

top = C.face_where((0, 0, 1))
bowl = C.run(top, [
    ((0, 0, 1), 1.8, 1.05, 1),          # the nest's lip rolls up and out
    ((0, 0, 1), 0.9, 0.66, 1),          # and turns in over the bowl
], name='nest', region='nest')
shell = C.run(bowl, [
    ((0, 0, 1), 1.6, 1.06, 1),          # the egg comes up out of the bowl
    ((0, 0, 1), 3.4, 1.08, 1),
    ((0, 0, 1), 4.6, 1.02, 1),          # widest, low: an egg's fat end sits down
    ((0, 0, 1), 4.6, 0.92, 1),
    ((0, 0, 1), 4.2, 0.82, 1),          # the crack line: the cap starts here
], name='shell', region='shell')
cap = C.run(shell, [
    ((0, 0, 1), 3.0, 0.78, 1),
    ((0, 0, 1), 2.4, 0.66, 1),
    ((0, 0, 1), 1.6, 0.5, 1),
], name='cap', region='cap')
C.end_point(cap, cap.calc_center_median() + Vector((0, 0, 1.0)))
TIP = J['cap'][-1] + Vector((0, 0, 1.0))

# hold it to the blockout (SKILL 1b, for a prop): the sphere 22 x 30 on a nest
# 36 across. Ratios against the egg's own height off the ground.
def measure():
    zs = [v.co.z for v in bm.verts]
    egg = [v.co for v in bm.verts if v.co.z > NEST_H + 2.5]
    h = max(zs)
    w = 2 * max(math.hypot(p.x, p.y) for p in egg) * math.cos(math.pi / 8)
    nest = 2 * max(math.hypot(v.co.x, v.co.y) for v in bm.verts) * math.cos(math.pi / 8)
    return {'egg_width': w / h, 'nest_width': nest / h, 'nest_height': (NEST_H + 2.1) / h}, h
REF = {'egg_width': 22 / 30, 'nest_width': 36 / 30, 'nest_height': 5 / 30}
got, HEIGHT = measure()
print("HEIGHT", round(HEIGHT, 1))
for k in REF:
    off = got[k] / REF[k] - 1
    print("  PROPORTION %-12s model %.3f ref %.3f %+.0f%%" % (k, got[k], REF[k], off * 100), "OFF" if abs(off) > 0.15 else "")
if os.environ.get('BLOCKOUT_ONLY'): sys.exit(0)

# ---------- 2. knife the shell ridges in, pull them out ----------
Z0, Z1 = J['shell'][0].z + 0.5, J['shell'][-2].z + 1.0       # the ridges stay on the shell, off the cap
on_shell = lambda f: C.on('shell', f) and Z0 < f.calc_center_median().z < Z1
RW = 1.0
def plates(strip):
    # each face of the knifed strip pulled out on its own along its own
    # normal: a row of plates down the egg, the way a hide's plates overlap,
    # not one flat panel (a whole strip pulled at once read as a door)
    for f in sorted(strip, key=lambda f: f.calc_center_median().z):
        if f.is_valid: C.pull([f], tuple(f.normal), 0.9, shrink=0.55)
flank = [f for f in bm.faces if on_shell(f) and abs(f.normal.x) > 0.5]
ridges = C.knife_pair(flank, [((0, RW, 0), (0, 1, 0)), ((0, -RW, 0), (0, -1, 0))], 6.0)
for side in (-1, 1):
    plates(ridges[side])
for sy in (-1, 1):                     # front and back: one strip each, cut on x = +-RW, so the mirror holds
    face = [f for f in bm.faces if on_shell(f) and f.normal.y * sy > 0.5]
    plates(C.knife(face, [((RW, 0, 0), (1, 0, 0)), ((-RW, 0, 0), (-1, 0, 0)), ((0, sy * 6.0, 0), (0, -sy, 0))]))
bm.normal_update()

assert C.mirror_error() < 1e-3, "the skeleton must be mirror-true before the clay"
C.clay(jitter=0.06, lumps=8, box=((-10, 10), (-10, 10), (6, 28)), lump_r=(2.5, 4.5), lump_amt=(-0.3, 0.35))

# ---------- personality: once or twice, on purpose ----------
# the egg leans a little to its right and back, off true, the nest left level
LEAN = Vector((0.055, 0.03, 0))
lean = lambda p: p + LEAN * max(0.0, p.z - (NEST_H + 2.0))
for v in bm.verts: v.co = lean(v.co)
for k in J: J[k] = [lean(p) for p in J[k]]
for k in R: R[k] = [[lean(p) for p in ring] for ring in R[k]]
TIP = lean(TIP)
bm.normal_update(); C._bvh = BVHTree.FromBMesh(bm)
# a jagged crack across the front right, three slashes, the cap's ring in the middle
cz = J['shell'][-1].z
# (below the lid's joint, so the lid heaving never tears the crack open as slop)
legs = [((3.6, -12, cz - 8.0), (0.25, 0, 1.0), 2.8), ((4.8, -12, cz - 5.2), (1.0, 0, 0.4), 2.4), ((6.2, -12, cz - 3.0), (0.3, 0, 1.0), 2.2)]
for o, d, L in legs:
    C.scar(o, (0, 1, 0), d, L, width=0.22, depth=0.3, reach=2.0)
CRACK = [s[0] for s in C.scars]

# ---------- accents, seated with C.skin ----------
# the claw: a raptor's toe through the top of the crack, hooked up and out
cp = C.skin((6.9, -12, cz - 1.6), (0, 1, 0))
if cp is not None:
    n = (cp - Vector((0, 0, cp.z))).normalized()
    C.cone(cp - n * 0.3, (n + Vector((0, 0, 0.9))).normalized(), 0.55, 2.6, 'claw')
# nubs down each ridge, the Tyrant's plates in small
for side in (-1, 1):
    for z in (Z0 + 2.0, (Z0 + Z1) / 2, Z1 - 2.0):
        p = C.skin(lean(Vector((side * 15, 0, z))), (-side, 0, 0))
        if p is not None: C.cone(p - Vector((side * 0.2, 0, 0)), (side, 0, 0.35), 0.45, 1.1, 'nubs')
for sy in (-1, 1):
    for z in (Z0 + 2.0, (Z0 + Z1) / 2, Z1 - 2.0):
        p = C.skin(lean(Vector((0, sy * 15, z))), (0, -sy, 0))
        if p is not None: C.cone(p - Vector((0, sy * 0.2, 0)), (0, sy, 0.35), 0.45, 1.1, 'nubs')
# stones and bone shards round the nest's rim
lip_r = sum(math.hypot(p.x, p.y) for p in R['nest'][0]) / len(R['nest'][0]) * 0.97
rng = C.rng
for i in range(11):             # dropped from above onto the top of the lip
    a = i / 11 * math.tau + rng.uniform(-0.15, 0.15)
    out = Vector((math.cos(a), math.sin(a), 0))
    p = C.skin(out * (lip_r - 1.2) + Vector((0, 0, 40)), (0, 0, -1))
    if p is None: continue
    if i % 3 == 1:   # a shard of the last egg's shell, or a bone, standing up out of the lip
        C.cone(p - Vector((0, 0, 0.25)), (out * 0.5 + Vector((0, 0, 1))).normalized(), 0.5, 2.4, 'shards')
    else:
        r = rng.uniform(0.8, 1.2)
        C.ball(p + Vector((0, 0, r * 0.35)), r, 'stones')
C.connect()
ob, me = C.to_object()

# ---------- paint ----------
INK, SHELL, PINK, TEAL, RUST = "#1e0f45", "#ffd23f", "#ff2e88", "#12b5a5", "#5a2a12"
P = Painter(C, SHELL, size=1024)
PX, PY, PZ, NX, NY, NZ = P.PX, P.PY, P.PZ, P.NX, P.NY, P.NZ
NEST = P.region('body', 'nest'); EGG = P.region('shell', 'cap')
P.img[NEST] = hexc(RUST)
# the sprayed base: white and black at low opacity, up to about half, the
# light following each part's own form (the egg lit as an egg, the nest as a
# ring), soft like a can, not a sun over the whole model
L = np.array([-0.45, -0.55, 0.7]); L /= np.linalg.norm(L)
ax = np.stack([PX - (PZ - NEST_H - 2) * LEAN.x, PY - (PZ - NEST_H - 2) * LEAN.y], -1)   # off the egg's own axis
radial = np.concatenate([ax / (np.linalg.norm(ax, axis=-1, keepdims=True) + 1e-6), np.zeros(PX.shape + (1,))], -1)
form_egg = P.nrm @ L
form_nest = (radial * 0.6 + np.array([0, 0, 0.8])) @ L
form = np.where(NEST, form_nest, form_egg)
noise = np.random.default_rng(SEED).normal(0, 0.06, PX.shape)
lite = np.clip((form - 0.25) * 0.8 + noise, 0, 0.5) * P.mask * np.where(NEST, 0.4, 1.0)   # the nest is earth: it takes less light
dark = np.clip((-form + 0.05) * 0.7 + noise, 0, 0.5) * P.mask
low = np.clip((NEST_H + 8 - PZ) / 5, 0, 1) * EGG * 0.35          # the egg darkens down into the bowl
dark = np.maximum(dark, low)
P.img = P.img * (1 - lite[..., None]) + lite[..., None]
P.img = P.img * (1 - dark[..., None])

# the skeleton: the raptor curled inside, seen through the shell
EC = J['shell'][3]                      # the egg's middle, after the lean
def arc(cy, cz, r, a0, a1, n=14):
    return [(cy + r * math.cos(t), cz + r * math.sin(t)) for t in np.linspace(a0, a1, n)]
sp = arc(EC.y + 0.4, EC.z + 0.5, 6.5, math.radians(115), math.radians(-60))      # the spine, a C round the yolk
for side in (-1, 1):
    P.side_line(sp, 0.42, PINK, EGG, side)
    for k in range(2, 11):              # ribs off the spine, curving in
        y, z = sp[k]; t = math.atan2(z - EC.z - 0.5, y - EC.y - 0.4)
        y2, z2 = EC.y + 0.4 + 3.4 * math.cos(t - 0.25), EC.z + 0.5 + 3.4 * math.sin(t - 0.25)
        P.side_line([(y, z), ((y + y2) / 2, (z + z2) / 2 + 0.4), (y2, z2)], 0.2, PINK, EGG, side)
    hy, hz = sp[0]                      # the skull tucked down at the top of the curl, its eye window
    P.side_oval(hy - 1.6, hz - 0.6, 2.4, 1.5, PINK, EGG, side, tilt=-0.5)
    P.side_oval(hy - 1.2, hz - 0.3, 0.8, 0.6, INK, EGG, side)
    P.side_line([(hy - 3.6, hz - 1.6), (hy - 1.0, hz - 2.4)], 0.22, PINK, EGG, side)     # the jaw
    ty, tz = sp[-1]                     # the tail wraps on round under the skull
    P.side_line(arc(EC.y + 0.4, EC.z + 0.5, 6.5, math.radians(-60), math.radians(-150), 8)
                + arc(EC.y - 0.6, EC.z + 0.5, 4.2, math.radians(-150), math.radians(-230), 6), 0.26, PINK, EGG, side)
    # the folded leg: thigh, shin, foot drawn up under the ribs
    P.side_line([(EC.y + 3.6, EC.z - 3.4), (EC.y - 0.4, EC.z - 2.0), (EC.y + 1.6, EC.z - 5.6), (EC.y - 1.4, EC.z - 6.2)], 0.3, TEAL, EGG, side)
V3 = lambda x, z: Vector((x, 0, z))
for k in range(5):                      # front: the ribcage as chevrons, and the curled skull's two eyes
    z = EC.z + 3.0 - k * 1.6; w = 3.4 - abs(k - 1.5) * 0.5
    P.view_line([V3(-w, z + 1.0), V3(0, z), V3(w, z + 1.0)], 0.22, PINK, EGG, 'front')
P.view_line([V3(0, EC.z + 4.6), V3(0, EC.z - 5.0)], 0.3, PINK, EGG, 'front')                 # the breastbone
for sx in (-1, 1):
    P.view_line([V3(sx * 1.4, EC.z + 6.4), V3(sx * 1.6, EC.z + 6.6)], 0.55, INK, EGG, 'front')
    P.view_line([V3(sx * 2.6, EC.z - 3.4), V3(sx * 3.4, EC.z - 6.0), V3(sx * 1.8, EC.z - 6.8)], 0.3, TEAL, EGG, 'front')
for k in range(9):                      # back: a bar for every vertebra up the curl, hips at the bottom
    z = EC.z - 5.5 + k * 1.45
    w = 1.8 - abs(k - 4) * 0.12
    P.view_line([V3(-w, z), V3(w, z)], 0.24, PINK, EGG, 'back')
P.view_line([V3(0, EC.z - 6.0), V3(0, EC.z + 6.2)], 0.24, PINK, EGG, 'back')
for sx in (-1, 1):
    P.view_line([V3(sx * 0.6, EC.z - 4.4), V3(sx * 3.0, EC.z - 5.6), V3(sx * 3.4, EC.z - 7.4)], 0.32, TEAL, EGG, 'back')
    P.view_line([V3(sx * 0.6, EC.z + 4.4), V3(sx * 2.8, EC.z + 3.2)], 0.28, PINK, EGG, 'back')    # shoulder blades
# the cap: its own rings of growth lines, so it reads as the lid that will go
for z in (J['cap'][0].z - 0.6, J['cap'][1].z - 0.4):
    m = P.mask & P.region('cap') & (np.abs(PZ - z) < 0.22)
    P.img[m] = hexc(TEAL)
# the nest: twigs woven round it, two ways
for side in (-1, 1):
    for k in range(9):
        y0 = -14 + k * 3.4
        P.side_line([(y0, 0.4), (y0 + 2.6, NEST_H + 1.6)], 0.2, INK, NEST, side)
        P.side_line([(y0 + 1.4, NEST_H + 1.4), (y0 + 3.6, 0.8)], 0.16, TEAL, NEST, side)
for view in ('front', 'back'):
    for k in range(9):
        x0 = -14 + k * 3.4
        P.view_line([V3(x0, 0.4), V3(x0 + 2.6, NEST_H + 1.6)], 0.2, INK, NEST, view)
        P.view_line([V3(x0 + 1.4, NEST_H + 1.4), V3(x0 + 3.6, 0.8)], 0.16, TEAL, NEST, view)
P.accents({'claw': INK, 'nubs': TEAL, 'stones': INK, 'shards': SHELL})
for e in C.ACC['nubs']:
    P.dab(e + (e - Vector((0, 0, e.z))).normalized() * 0.7, 0.18, PINK)
# the crack: violet edges, the pink heat inside showing through
for p, d, length in C.scars:
    a, b = p - d * length / 2, p + d * length / 2
    P.stroke([a, b], 0.3, INK, wobble=0.02)
    P.stroke([a, b], 0.13, PINK, wobble=0.01)
P.save(OUT, "tyrant_egg")
# which texels are the nest, for the bead pass: the beads go on the egg only
# (bead_project.py has no region mask; the nest, earth under it, keeps pass 1)
from PIL import Image
Image.fromarray((np.flipud(NEST & P.mask) * 255).astype(np.uint8)).save(os.path.join(OUT, "tyrant_egg_nestmask.png"))

# ---------- rig: Nest, Shell, Cap ----------
# The egg script drives no pivot by name; these are what the two clips move.
G = Rig(C)
base = Vector((0, 0, NEST_H + 2.0))
G.bone("Nest", Vector((0, 0, 0)), base)
G.bone("Shell", base, J['shell'][-1], "Nest", limb='shell')
G.bone("Cap", J['shell'][-1], TIP, "Shell", limb='cap')
G.skin()

def warm(n, ph):
    """the loop the egg plays while it warms: it rocks in its nest, and the
    lid rocks against it, a beat behind, as if something shoved from inside"""
    w = ph * math.tau
    if n == "Shell": return (4.0 * math.sin(w), 5.0 * math.sin(w + 0.9), 0), (0, 0, 0)
    if n == "Cap": return (-4.0 * math.sin(w - 0.8), -5.0 * math.sin(w * 2 + 0.3), 0), (0, 0, 0)
    return (0, 0, 0), (0, 0, 0)

def hatch(n, ph):
    """the last second: it shudders harder and harder, the lid heaves up on
    the crack's side and falls back, twice, then a last big shove the game
    cuts off with the burst"""
    grow = ease(min(1, ph * 1.4))
    shake = math.sin(ph * 90) * grow
    heave = max(0, math.sin(ph * math.tau * 1.5)) * grow
    if n == "Shell": return (6 * shake, 8 * math.sin(ph * 70 + 1) * grow, 0), (0, 0, 0)
    if n == "Cap": return (-16 * heave + 3 * shake, 12 * heave, 0), (0, 0, 0)
    return (0, 0, 0), (0, 0, 0)

G.act("warm", 48, warm)
G.act("hatch", 24, hatch)
G.fix_joints()
G.soften()
G.save(OUT, "tyrant_egg")
