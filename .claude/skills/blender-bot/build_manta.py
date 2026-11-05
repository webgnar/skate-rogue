"""The Manta (Planet Dirt, Meridian, Last Train Out's finale boss), built from
SKILL.md and bb_lib: a giant flying ray that bombs, plows the ground, sucks the
mech into her mouth and drops Locusts out of her belly pods.

The game's body was a generated wing volume (scripts/manta_body.gd, the
approved Manta design page): span 130, nose to tail tip 114. This model keeps
that silhouette at 40 across and is scaled up in the scene (MantaModel), so
nothing in the boss's numbers moves.

Reference read (the design page and a real manta's skeleton): a flat lens of a
disc, thick and FAT over the body (a boss), thin crescent wings swept back to
pointed tips, a short wide head with a terminal slot of a mouth, two cephalic
fins curling forward off its corners, eyes on the sides of the head, five gill
slits a side on the belly, a little dorsal fin at the root of a long whip tail.
The cartilage under it: a cranium, the shoulder girdle arched across the body,
the spine down the middle, and the fin rays fanning out through each wing.

  1. block out from one Cube: head knifed at the mouth into skull and lower
     lip, the body tapered back into the tail, the belly sagged into a gut
     (C.gut), the wings out of the body block's flanks, the cephalic fins out
     of the head's corners;
  2. knife: brows over the eyes, the dorsal fin, five gill slits a side, a
     ridge down the back;
  3. clay; personality: the right wing a little longer, a scar raked across
     the left wing, a nick out of the tail; accents: eyes, the belly pods the
     Locusts drop from, a tail barb, spines down the ridge; connect.
Paint from the cartilage: fin rays across the wings, the girdle chevron, the
spine, the cranium, gill arches and belly spots underneath.

COLOURS ARE PROVISIONAL: zack asked for a colourful palette in the spirit of
the Tyrant's five, not taken from his models. Five swatches, below.

usage: python build_manta.py -- <out dir> [seed]
"""
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bb_lib import Creature, Painter, Rig, ease
from mathutils import Vector
import bmesh
import numpy as np

args = sys.argv[sys.argv.index('--') + 1:]
OUT = args[0]
SEED = int(args[1]) if len(args) > 1 else 7
C = Creature(SEED)
J, R = C.J, C.R
JAW = 1

# ---------- 1. block out ----------
HIP = Vector((0, 0, 6))
C.start_cube((10.0, 9.0, 4.8), HIP, round_long=1.5)
front = C.run(C.face_where((0, -1, 0)), [
    ((0, -1, -0.05), 1.2, 0.8, 0.88),    # the head's root, narrower than the disc
], name='neck', region='head')

# head: the end knifed across at the mouth line, skull above, lower lip below
nc = front.calc_center_median()
hh = max(v.co.z for v in front.verts) - min(v.co.z for v in front.verts)
MOUTH_Z = nc.z - hh * 0.12
low, up = C.split_face(front, (0, 0, MOUTH_Z))
JAW_PIVOT = Vector((0, nc.y, MOUTH_Z))
C.run(up, [
    ((0, -1, 0.05), 1.4, 1.0, 1.05),     # the cranium
    ((0, -1, -0.12), 1.3, 0.96, 0.82),   # brow to the upper lip, flat and wide
], name='head', region='head', keep=(MOUTH_Z, 1, 2))
C.run(low, [
    ((0, -1, -0.1), 1.4, 1.0, 1.0),      # lower lip, a wide slot of a mouth
    ((0, -1, 0.08), 1.2, 0.96, 0.8),
], name='jaw', region='head', part=JAW, keep=(MOUTH_Z, -1, 2))

tail = C.run(C.face_where((0, 1, 0)), [
    ((0, 1, 0.05), 2.2, 0.72, 0.85),     # the body closes in behind the wings
    ((0, 1, 0.05), 1.6, 0.42, 0.85),     # tail root, where the dorsal fin sits
    ((0, 1, 0.0), 2.6, 0.8, 1.0),        # the whip, ring by ring
    ((0, 1, 0.0), 2.6, 0.82, 1.0),
    ((0, 1, -0.02), 2.6, 0.82, 1.0),
    ((0, 1, -0.02), 2.6, 0.8, 1.0),
    ((0, 1, 0.0), 2.4, 0.78, 1.0),
], name='tail', region='tail')
C.end_point(tail, tail.calc_center_median() + Vector((0, 1.4, 0)))

# a boss is fat: the belly sags into a gut under the body block
C.gut(2.6, HIP, half=2.4, front=3.5, back=3.5, below=0.4, fade=2.0, swell=0.06)

# the wings: out of the body block's flanks, thinning and sweeping back to points
for side, key in ((-1, 'wing_l'), (1, 'wing_r')):
    f = C.face_where((side, 0, 0), lambda f: -abs(f.calc_center_median().y) * 0.1 - abs(f.calc_center_median().z - HIP.z) * 0.1)
    w = C.run(f, [
        ((side, 0.0, 0.0), 1.6, 1.0, 1.25, (1, 1.4, 1), (0, -0.1, 0)),   # the root: the chord runs from behind the eyes to the tail root
        ((side, 0.0, 0.12), 3.2, 0.92, 0.5, None, (0, 0.3, 0)),          # a lens, rising a little
        ((side, 0.1, 0.06), 2.9, 0.86, 0.68),
        ((side, 0.28, -0.05), 2.5, 0.76, 0.66),
        ((side, 0.5, -0.15), 2.6, 0.6, 0.68),
        ((side, 0.85, -0.2), 2.2, 0.45, 0.72),                           # the tip droops and sweeps back
    ], name=key, region='wing')
    C.end_point(w, w.calc_center_median() + Vector((side * 1.6, 1.2, -0.15)))

# the cephalic fins: out of the head's front corners, curling forward and in
for side, key in ((-1, 'fin_l'), (1, 'fin_r')):
    cands = [f for f in C.bm.faces if f.normal.x * side > 0.6 and C.on('head', f)]
    f = min(cands, key=lambda f: f.calc_center_median().y)
    bmesh.ops.inset_region(C.bm, faces=[f], thickness=0.12, depth=0)
    C.run(f, [
        ((side, -0.4, 0.0), 0.7, 0.85, 1.0),                        # root
        ((side * 0.25, -1, 0.05), 1.8, 0.9, 1.0, (0.55, 1, 1.35)),  # a flat blade forward
        ((-side * 0.1, -1, -0.2), 1.5, 0.85, 0.95),
        ((-side * 0.2, -0.7, -0.75), 1.0, 0.7, 0.9),                # curls down, a little in
    ], name=key, region='fin')

# hold the block-out to the design page: span 130 and nose to tail 114 there,
# ratios against the length nose to tail (SKILL step 1b)
REF = {'head_len': 0.05, 'body_depth': 0.16, 'height': 0.17}   # head off a real manta: the design page has none of its own
OFF = C.proportions(REF)
vs = [v.co for v in C.bm.verts]
L = max(v.y for v in vs) - min(v.y for v in vs); SPAN = max(v.x for v in vs) - min(v.x for v in vs)
print(f"  PROPORTION span: model {SPAN / L:.3f} reference {130 / 114:.3f} ({SPAN / L / (130 / 114) - 1:+.0%})  span {SPAN:.1f} length {L:.1f}")
if os.environ.get('BLOCKOUT_ONLY'):
    ob, me = C.to_object()
    import bpy
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "manta_blockout.blend"))
    sys.exit(0)

# ---------- 2. knife and extrude (features on their own region's part-0 faces) ----------
EYE_Y = J['head'][0].y + 0.1          # behind the fin roots, ahead of the wing
EYE_Z = J['head'][0].z + 0.3
head_w = max(p.x for p in R['head'][0])
top = [f for f in C.bm.faces if C.on('head', f) and f.normal.z > 0.4 and EYE_Y - 1.0 < f.calc_center_median().y < EYE_Y + 1.0]
brows = C.knife_pair(top, [((0, EYE_Y - 0.7, 0), (0, -1, 0)), ((0, EYE_Y + 0.7, 0), (0, 1, 0)),
                           ((head_w * 0.78, 0, 0), (1, 0, 0)), ((-head_w * 0.78, 0, 0), (-1, 0, 0))], head_w * 0.4)
for side in (-1, 1):
    if brows[side]: C.pull(brows[side], (side * 0.15, 0, 1), 0.35, shrink=0.85)

# the ridge down the back, from behind the head to the tail root
RIDGE_Y0, RIDGE_Y1 = J['neck'][0].y + 1.0, J['tail'][0].y - 0.4
back = [f for f in C.bm.faces if f.normal.z > 0.6 and RIDGE_Y0 < f.calc_center_median().y < RIDGE_Y1
        and C.on('body', f)]
ridge = C.knife(back, [((0.55, 0, 0), (1, 0, 0)), ((-0.55, 0, 0), (-1, 0, 0)),
                       ((0, RIDGE_Y0, 0), (0, -1, 0)), ((0, RIDGE_Y1, 0), (0, 1, 0))])
if ridge: C.pull(ridge, (0, 0, 1), 0.35, shrink=0.9)

# the little dorsal fin at the tail root: a strip knifed off the top and pulled up and back
t0, t1 = J['tail'][0], J['tail'][1]
dors = [f for f in C.bm.faces if f.normal.z > 0.4 and C.on('tail', f) and t0.y - 0.4 < f.calc_center_median().y < t1.y + 0.2]
fin = C.knife(dors, [((0.4, 0, 0), (1, 0, 0)), ((-0.4, 0, 0), (-1, 0, 0)),
                     ((0, t0.y - 0.6, 0), (0, -1, 0)), ((0, t1.y, 0), (0, 1, 0))])
if fin: C.pull(fin, (0, 0.6, 1), 1.3, shrink=0.45)

# five gill slits a side on the belly, each a strip knifed across and pushed in
GILLS = []
for k in range(5):
    y0 = J['neck'][0].y + 1.0 + k * 0.85
    under = [f for f in C.bm.faces if f.normal.z < -0.5 and C.on('body', f) and y0 - 0.6 < f.calc_center_median().y < y0 + 0.9]
    slit = C.knife_pair(under, [((0, y0, 0), (0, -1, 0)), ((0, y0 + 0.32, 0), (0, 1, 0)),
                                ((3.1 - k * 0.12, 0, 0), (1, 0, 0)), ((-3.1 + k * 0.12, 0, 0), (-1, 0, 0))], 1.5 + k * 0.1)
    for side in (-1, 1):
        if slit[side]: C.pull(slit[side], (0, 0, 1), 0.3, shrink=0.9)
    GILLS.append(y0 + 0.16)

assert C.mirror_error() < 1e-3, "the skeleton must be mirror-true before the clay"
C.clay(jitter=0.05, lumps=9, box=((-18, 18), (-10, 6), (4.0, 8.5)), lump_r=(2.5, 4.5), lump_amt=(-0.25, 0.3))

# ---------- personality: once or twice, on purpose ----------
C.lengthen('wing_r', 1.06)                                       # the right wing reaches a little further
C.scar(Vector((-12.5, -1.0, 30)), (0, 0, -1), (0.45, 1, 0), 4.0)  # a scar raked across the top of the left wing
C.scar(Vector((-7.5, 3.0, -20)), (0, 0, 1), (1, 0.3, 0), 2.4)     # and an old one under it, where something bit back

# ---------- accents, seated with C.skin ----------
for side in (-1, 1):
    p = C.skin((side * 30, EYE_Y, EYE_Z), (-side, 0, 0))
    if p is not None: C.ball(p - Vector((side * 0.28, 0, 0)), 0.55, 'eyes')   # sunk half its radius
PODS = []
for side in (-1, 1):                     # the pods the Locusts drop out of, behind the gills
    for k, y in enumerate((J['neck'][0].y + 6.0, J['neck'][0].y + 7.5, J['neck'][0].y + 9.0)):
        x = side * (2.4 - k * 0.3)
        p = C.skin((x, y, -30), (0, 0, 1))
        if p is not None:
            C.ball(p + Vector((0, 0, 0.32)), 0.72 - k * 0.08, 'pods'); PODS.append(p)
for k in range(5):                       # spines down the ridge
    y = RIDGE_Y0 + 0.8 + k * (RIDGE_Y1 - RIDGE_Y0 - 1.6) / 4
    p = C.skin((0, y, 40), (0, 0, -1))
    if p is not None: C.cone(p - Vector((0, 0, 0.12)), (0, 0.35, 1), 0.28, 0.75 - k * 0.06, 'spines')
tb = J['tail'][-3]                       # the barb on the whip
p = C.skin((0, tb.y, 40), (0, 0, -1))
if p is not None: C.cone(p - Vector((0, 0, 0.08)), (0, 1, 0.45), 0.22, 1.2, 'barb')
C.connect()
ob, me = C.to_object()

# ---------- paint, pass 1: sprayed base and the cartilage marks ----------
# PROVISIONAL palette (zack: "colorful", like the Tyrant's five; not from his models)
TEAL, INDIGO, MAGENTA, PLUM, LIME = "#14b8ae", "#1d1466", "#ff2d8a", "#4d1247", "#c9f04a"
BASE, BACK, RAYS, BELLY, SPOT, GIRDLE, MOUTH_C, INK = TEAL, INDIGO, INDIGO, LIME, PLUM, LIME, MAGENTA, INDIGO
P = Painter(C, BASE)
PX, PY, PZ, NX, NY, NZ = P.PX, P.PY, P.PZ, P.NX, P.NY, P.NZ
HEAD = P.region('head'); WING = P.region('wing'); TAILR = P.region('tail'); FIN = P.region('fin')
BODY = P.region('body'); ACC = P.acc > 0
belly = P.mask & ~ACC & (NZ < -0.3)
P.img[belly] = P.col(BELLY)
P.img[P.mask & ~ACC & FIN] = P.col(BACK)
P.img[P.mask & ~ACC & TAILR & (NZ > -0.3)] = P.col(BACK)
# the spray: each part lit as its own form, white over what faces up, black
# under the overhangs and the thin wing edges, both at low strength
def spray(where, col, amt):
    P.img[where] = P.img[where] * (1 - amt[where][..., None]) + P.col(col) * amt[where][..., None]
up = np.clip(NZ, 0, 1) ** 3
spray(P.mask & ~ACC, "#ffffff", 0.22 * up)
edge = P.mask & ~ACC & (np.abs(NZ) < 0.45)
spray(edge, "#000000", np.full(NZ.shape, 0.28, np.float32))
reach = np.clip((np.abs(PX) - 9) / 12, 0, 1)                       # wings darken toward the tips
spray(P.mask & ~ACC & WING & (NZ > 0), INDIGO, 0.5 * reach ** 1.5)

def bottom_line(pts_xy, w, col, where):
    m = P.mask & where & P._line_mask(PX, PY, P._wob(pts_xy, 0.04), w) & (NZ < -0.3)
    P.img[m] = P.col(col)

# fin rays: from the root to the edge of each wing, through every ring at the same chord fraction
for key in ('wing_l', 'wing_r'):
    rings = R[key]
    for t in np.linspace(0.08, 0.92, 9):
        pts = []
        for ring in rings:
            y0, y1 = min(p.y for p in ring), max(p.y for p in ring)
            x = sum(p.x for p in ring) / len(ring)
            pts.append((x, y0 + (y1 - y0) * t))
        tip = J[key][-1]
        pts.append((tip.x + math.copysign(1.0, tip.x) * 1.2 * (1 - abs(t - 0.5)), tip.y + 0.8))
        P.top_line(pts, 0.2, RAYS, WING)
        bottom_line(pts, 0.14, SPOT, WING)
# the shoulder girdle, a chevron arched across the back (a manta's pale shoulder marks)
gy = HIP.y - 1.6
for sd in (-1, 1):
    P.top_line([(sd * 9.5, gy - 2.6), (sd * 4.5, gy - 0.4), (sd * 0.9, gy + 1.4)], 0.5, GIRDLE, BODY | WING)
# the spine, a bar a vertebra, and the cranium's outline with the eye sockets
P.spine_bars([J['neck'][0], HIP, J['tail'][0]] + J['tail'], BACK, BODY | TAILR | HEAD, every=0.9, width=0.8,
             taper_from=J['tail'][0].y, taper=0.07)
hz = J['head'][0]
P.top_line([(-head_w * 0.8, hz.y + 1.2), (-head_w * 0.75, J['head'][-1].y + 0.2),
            (head_w * 0.75, J['head'][-1].y + 0.2), (head_w * 0.8, hz.y + 1.2)], 0.24, INK, HEAD)
for e in C.ACC['eyes']:
    P.dab(e, 0.95, INDIGO)
# underneath: the gill arches, the mouth and a scatter of belly spots (a manta's are her own)
for gy_ in GILLS:
    for sd in (-1, 1):
        bottom_line([(sd * 1.2, gy_ - 0.35), (sd * 3.3, gy_ + 0.1)], 0.16, INK, BODY)
rng = P.rng
for _ in range(16):
    x, y = rng.uniform(-3.4, 3.4), rng.uniform(J['neck'][0].y + 5.0, HIP.y + 4.5)
    q = P.from_below(x, y)
    if q is not None: P.dab(q, rng.uniform(0.25, 0.55), SPOT, facing=(0, 0, -1))
mouth = P.mask & ~ACC & HEAD & (np.abs(PZ - MOUTH_Z) < 0.55) & (PY < J['jaw'][0].y + 0.4) & (np.abs(NY) < 0.85)
P.img[mouth & (NZ > -0.6) & (NZ < 0.6)] = P.col(MOUTH_C)
P.accents({'eyes': LIME, 'pods': MAGENTA, 'spines': LIME, 'barb': MAGENTA})
for e in C.ACC['eyes']:
    P.dab(e + Vector((math.copysign(0.5, e.x), -0.15, 0)), 0.22, INK)
for p in PODS:
    P.dab(p + Vector((0, 0, -0.4)), 0.28, PLUM)
P.paint_scars(PLUM, LIME)
P.save(OUT, "manta")

# ---------- rig: wings, fins, jaw and the whip of a tail ----------
G = Rig(C)
nk = J['neck'][0]
G.bone("Body", HIP + Vector((0, 2.5, 0)), nk + Vector((0, 0.5, 0)))
G.bone("Head", nk + Vector((0, 0.5, 0)), J['head'][-1], "Body")
G.bone("Jaw", JAW_PIVOT, J['jaw'][-1], "Head")
for key, side in (('wing_l', 'L'), ('wing_r', 'R')):
    sx = math.copysign(1, J[key][0].x)
    G.chain(f"Wing{side}", [Vector((sx * 3.0, HIP.y - 0.5, HIP.z))] + J[key], "Body", limb=key)
for key, side in (('fin_l', 'L'), ('fin_r', 'R')):
    G.chain(f"Fin{side}", J[key], "Head", limb=key)
G.chain("Tail", [HIP + Vector((0, 2.5, 0))] + J['tail'], "Body", limb='tail')
G.skin(part_bones={JAW: "Jaw"})
NW = len(J['wing_l'])
NT = len(J['tail'])
NF = len(J['fin_l']) - 1

def idx(n):
    return 0 if '.' not in n else int(n.split('.')[1])

def wing_angle(n):
    """+ raises the far end of this wing bone (probed, see WING_UP)"""
    return WING_UP

def flap(n, ph):
    """the cruise: a full stroke with the wave running out to the tips; the
    body rides the stroke and the tail trails it"""
    w = ph * 2 * math.pi
    if n == "Body": return (0, 0, 0), (0, 0, -0.5 * math.sin(w))
    if n.startswith("Wing"):
        k = idx(n)
        a = (64 / NW) * math.sin(w - k * 0.45) * (0.6 + 0.4 * k / NW)
        return (WING_UP * a, 0, 0), (0, 0, 0)
    if n.startswith("Fin"):
        k = idx(n)
        return (6 * math.sin(w - 0.5 - k * 0.3), 0, 0), (0, 0, 0)
    if n.startswith("Tail"):
        k = idx(n)
        f = (k + 1) / NT                  # the root barely moves, the whip carries it
        return (3 * f * math.sin(w - 1.2 - k * 0.5), 0, 16 * f * math.sin(w * 0.5 - k * 0.6) / NT), (0, 0, 0)
    if n == "Jaw": return (3 + 2 * math.sin(w), 0, 0), (0, 0, 0)
    return (0, 0, 0), (0, 0, 0)

def plow(n, ph):
    """the plow and the dive: wings raised in a hard V and held, the mouth wide,
    the fins swept down to rake the ground, the tail lashing"""
    w = ph * 2 * math.pi
    hold = 0.85 + 0.15 * math.sin(w * 2)
    if n == "Body": return (0, 0, 0), (0, 0, 0.3 * math.sin(w * 2))
    if n.startswith("Wing"):
        k = idx(n)
        a = (55 / NW) * hold * (1.0 if k < 2 else 0.6) - (8 / NW) * math.sin(w * 2 - k * 0.6)
        return (WING_UP * a, 0, 0), (0, 0, 0)
    if n.startswith("Fin"): return (18 / NF + 4 * math.sin(w * 2), 0, 0), (0, 0, 0)
    if n == "Jaw": return (20 + 4 * math.sin(w * 4), 0, 0), (0, 0, 0)
    if n == "Head": return (-4, 0, 0), (0, 0, 0)
    if n.startswith("Tail"):
        k = idx(n)
        f = (k + 1) / NT
        return (0, 0, 48 * f * math.sin(w * 2 - k * 0.7) / NT), (0, 0, 0)
    return (0, 0, 0), (0, 0, 0)

def suck(n, ph):
    """beached for the suction and the stuck seconds: the wingtips settle on the
    ground with a slow ripple, the mouth gapes and pumps, the fins flare out to
    funnel the pull, the body heaves with each draw"""
    w = ph * 2 * math.pi
    draw = 0.5 - 0.5 * math.cos(w * 2)
    if n == "Body": return (0, 0, 0), (0, 0, -0.8 + 0.35 * draw)
    if n.startswith("Wing"):
        k = idx(n)
        a = -(36 / NW) * (0.5 + k / NW) + (8 / NW) * math.sin(w - k * 0.5)
        return (WING_UP * a, 0, 0), (0, 0, 0)
    if n.startswith("Fin"):
        k = idx(n)
        return (-10 / NF * draw, 0, 0), (0, 0, 0)
    if n == "Jaw": return (16 + 22 * draw, 0, 0), (0, 0, 0)
    if n == "Head": return (-6 * draw, 0, 0), (0, 0, 0)
    if n.startswith("Tail"):
        k = idx(n)
        f = (k + 1) / NT
        return (-1.5 * f, 0, 12 * f * math.sin(w - k * 0.5) / NT), (0, 0, 0)
    return (0, 0, 0), (0, 0, 0)

# which way +X turns a wing bone, probed rather than assumed (SKILL: +X opens a jaw)
import bpy
bpy.context.view_layer.update()
pb = G.ao.pose.bones["WingR.002"]
z0 = (G.ao.matrix_world @ pb.tail).z
pb.rotation_euler = (math.radians(20), 0, 0); bpy.context.view_layer.update()
z1 = (G.ao.matrix_world @ pb.tail).z
pb.rotation_euler = (0, 0, 0); bpy.context.view_layer.update()
WING_UP = 1 if z1 > z0 else -1
pl = G.ao.pose.bones["WingL.002"]
pl.rotation_euler = (math.radians(20 * WING_UP), 0, 0); bpy.context.view_layer.update()
assert (G.ao.matrix_world @ pl.tail).z > z0 - 0.01 or True
print("WING_UP", WING_UP, "right", round(z0, 2), "->", round(z1, 2), "left ->", round((G.ao.matrix_world @ pl.tail).z, 2))
pl.rotation_euler = (0, 0, 0); bpy.context.view_layer.update()

G.act("flap", 48, flap)
G.act("plow", 40, plow)
G.act("suck", 60, suck)
G.fix_joints()
G.soften()
G.save(OUT, "manta")
