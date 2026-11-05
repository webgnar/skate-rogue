"""Pass 3: the 20 percent sketch marks.

usage: python sketch_marks.py -- file.blend object texture_in.png texture_out.png [min_angle] [dark_opacity]
           [--glow=hex,hex] [--glow-ref=base.png] [--glow-map=glow.png]

Glowing parts (eyes, a glowing sac): --glow names their colours. Any accent part whose
texels are mostly one of those colours (read off --glow-ref, the pass 1 texture, if the
beads have gone over it) gets no sketch marks at all, light or dark, so it stays clean
and bright. --glow-map also writes an emission map: those parts in their own colour, the
rest black, to plug into the material's Emission Color.

Stains the crevices dark and highlights the spikes, eyes and body shape light (zack).
Dark: every edge that sits in a crevice, found by ambient occlusion at its two vertices (rays
cast off the surface; a low-poly model has few edges that fold in, so the fold alone left the
darks unread), plus any edge that folds in. Light: a hard edge over min_angle degrees (28) that
folds out and is open to the sky (ridges, the outline of the body). Accents (every loose part
but the body: teeth, eyes, spikes, claws) are always hit with light on every edge, whatever
their occlusion, so teeth deep in the mouth still catch a highlight (zack). A line is never one drag: segments 0.3 to 1.4 long, each starting on
the end of the last, three brush sizes, each segment its own 20% dab so the restarts stack.
First version; zack is painting an example to tune it against.
"""
import bpy, sys, os, random
import numpy as np
from collections import defaultdict
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bb_texels import texel_samples

a = sys.argv[sys.argv.index('--') + 1:]
opt = {k[2:]: v for k, _, v in (x.partition('=') for x in a if x.startswith('--'))}
a = [x for x in a if not x.startswith('--')]
BLEND, OBJ, SRC, OUT = a[:4]
GLOW = [np.array([int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]) for h in opt.get('glow', '').split(',') if h]
MIN_ANGLE = float(a[4]) if len(a) > 4 else 28.0
SIZES = [0.12, 0.2, 0.32]        # brush radii in world units (Tyrant scale)
SEG = (0.3, 1.4)
OPACITY = 0.2                    # the light marks
DARK_OPACITY = float(a[5]) if len(a) > 5 else 0.35   # the darks go on heavier (zack: "black needs to be higher opacity")
rng = random.Random(7)

bpy.ops.wm.open_mainfile(filepath=BLEND)
ob = bpy.data.objects[OBJ]; me = ob.data; M = np.array(ob.matrix_world)
tex = np.array(Image.open(SRC).convert('RGB')).astype(float) / 255
S = tex.shape[0]
P, R, C, PF, FN = texel_samples(ob, S)
TN = FN[PF]
V = np.array([(M @ np.array([*v.co, 1]))[:3] for v in me.vertices])
FC = np.array([V[list(p.vertices)].mean(0) for p in me.polygons])
CELL = 0.6
grid = defaultdict(list)
for i, k in enumerate(map(tuple, np.floor(P / CELL).astype(int))):
    grid[k].append(i)
grid = {k: np.array(v) for k, v in grid.items()}

# vertex ambient occlusion: share of rays off the surface that hit the model within AO_REACH
from mathutils.bvhtree import BVHTree
import mathutils, math
AO_REACH, AO_RAYS, CREVICE, OPEN = 6.0, 96, 0.55, 0.7
Mw = ob.matrix_world
bvh = BVHTree.FromPolygons([Mw @ v.co for v in me.vertices], [list(p.vertices) for p in me.polygons])
rr = random.Random(3); dirs = []
for _ in range(AO_RAYS):
    z = rr.random(); ph = rr.random() * 2 * math.pi; q = math.sqrt(1 - z * z)
    dirs.append((q * math.cos(ph), q * math.sin(ph), z))
AO = []
for v in me.vertices:
    n = (Mw.to_3x3() @ v.normal).normalized(); p0 = Mw @ v.co + n * 0.05
    t = n.orthogonal().normalized(); b = n.cross(t)
    hits = sum(bvh.ray_cast(p0, t * x + b * y + n * z, AO_REACH)[0] is not None for x, y, z in dirs)
    AO.append(1 - hits / AO_RAYS)
AO = np.array(AO)
col = tex[R, C].copy()
TONES = {'dark': 0, 'light': 0}

def stroke(p0, p1, r, tone, nrm):
    lo = np.floor((np.minimum(p0, p1) - r) / CELL).astype(int)
    hi = np.floor((np.maximum(p0, p1) + r) / CELL).astype(int)
    idx = [grid[(i, j, k)] for i in range(lo[0], hi[0] + 1) for j in range(lo[1], hi[1] + 1)
           for k in range(lo[2], hi[2] + 1) if (i, j, k) in grid]
    if not idx:
        return
    idx = np.concatenate(idx); p = P[idx]; ab = p1 - p0
    t = np.clip(((p - p0) @ ab) / (ab @ ab + 1e-9), 0, 1)
    d = np.linalg.norm(p - (p0 + t[:, None] * ab), axis=1)
    hit = idx[(d <= r) & (TN[idx] @ nrm > 0)]
    op = DARK_OPACITY if tone == 'dark' else OPACITY
    col[hit] = col[hit] * (1 - op) + (0.0 if tone == 'dark' else 1.0) * op

# accents: every loose part of the mesh but the biggest one (the body)
par = list(range(len(me.vertices)))
def _root(x):
    while par[x] != x:
        par[x] = par[par[x]]; x = par[x]
    return x
for e in me.edges:
    par[_root(e.vertices[0])] = _root(e.vertices[1])
part_size = defaultdict(int)
for p in me.polygons:
    part_size[_root(p.vertices[0])] += 1
body = max(part_size, key=part_size.get)
accent_face = np.array([_root(p.vertices[0]) != body for p in me.polygons])
print('accent parts', len(part_size) - 1, 'faces', int(accent_face.sum()))

# glowing parts: an accent part whose texels are mostly a --glow colour is left unmarked
face_part = np.array([_root(p.vertices[0]) for p in me.polygons])
glow_face = np.zeros(len(me.polygons), bool)
if GLOW:
    ref = np.array(Image.open(opt.get('glow-ref', SRC)).convert('RGB')).astype(float) / 255
    refc = ref[R, C]; tpart = face_part[PF]
    for part in set(face_part[accent_face]):
        t = tpart == part
        if not t.any():
            continue
        near = np.min([np.abs(refc[t] - g).sum(1) for g in GLOW], 0) < 0.25
        if near.mean() > 0.5:
            glow_face |= face_part == part
    print('glow faces', int(glow_face.sum()))
glow_tex = glow_face[PF]

edge_faces = defaultdict(list)
for fi, p in enumerate(me.polygons):
    for ek in p.edge_keys:
        edge_faces[ek].append(fi)
for (v0, v1), fs in edge_faces.items():
    if len(fs) != 2:
        continue
    f1, f2 = fs
    ang = np.degrees(np.arccos(np.clip(FN[f1] @ FN[f2], -1, 1)))
    folds_in = (FC[f2] - FC[f1]) @ FN[f1] > 0
    ao = (AO[v0] + AO[v1]) / 2
    sizes = SIZES
    if glow_face[f1] and glow_face[f2]:
        continue                      # a glowing part stays clean
    if accent_face[f1] or accent_face[f2]:
        tone, sizes = 'light', SIZES[:2]   # accents always catch the light, with the smaller brushes
    elif ao <= 0.02:
        continue                      # buried inside another part: nobody sees it
    elif ao < CREVICE or (folds_in and ang >= MIN_ANGLE):
        tone = 'dark'
    elif ang >= MIN_ANGLE and not folds_in and ao > OPEN:
        tone = 'light'
    else:
        continue
    TONES[tone] += 1
    a0, a1 = V[v0], V[v1]; L = np.linalg.norm(a1 - a0); s = 0.0
    while s < L:
        e = min(L, s + rng.uniform(*SEG))
        jit = lambda: np.array([rng.uniform(-0.05, 0.05) for _ in range(3)])
        stroke(a0 + (a1 - a0) * (s / L) + jit(), a0 + (a1 - a0) * (e / L) + jit(),
               rng.choice(sizes), tone, FN[f1] + FN[f2])
        if e >= L:
            break
        s = e - rng.uniform(0.0, 0.15)
col[glow_tex] = tex[R, C][glow_tex]   # no stroke from a neighbour spills onto a glowing part
out = tex.copy(); out[R, C] = col
Image.fromarray((out * 255).round().astype(np.uint8)).save(OUT)
if 'glow-map' in opt:
    gm = np.zeros_like(tex); gm[R[glow_tex], C[glow_tex]] = col[glow_tex]
    Image.fromarray((gm * 255).round().astype(np.uint8)).save(opt['glow-map'])
    print('glow map written', opt['glow-map'])
print('sketch marks written', OUT, TONES)
