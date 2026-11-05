"""Thaw Leech, built the way zack builds (tools/blender_bot/STYLE_GUIDE.md, first principle).

Nothing here is lifted from one of zack's models. The process is his:
  1. one default Cylinder, extruded out and its verts scaled into the basic
     structure, each step nudged lightly by hand so the sides differ a little;
  2. shapes cut into that mesh as a Knife would (bisected outlines) and
     extruded out for the features: the back crest, the mouth lip, the hooks;
  3. primitives added last as accents: icosphere eyes, cone thorns;
  4. Smart UV, then the texture is laid down with hard round dabs projected
     onto the surface along stroke paths, like the Paint Hard brush;
  5. a bone chain down the extrusions, weights by nearest bone, and actions
     keyed on every frame with overlapping motion.

usage: python build_thaw_leech.py -- <out dir> [seed]
"""
import bpy, bmesh, math, sys, os, random
import numpy as np
from mathutils import Vector, Matrix, Euler

args = sys.argv[sys.argv.index('--') + 1:]
OUT = args[0]
SEED = int(args[1]) if len(args) > 1 else 11
rng = random.Random(SEED)
np_rng = np.random.default_rng(SEED)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene

def hand(s=0.04):
    """a hand's error: never quite where the last vertex was"""
    return Vector((rng.gauss(0, s), rng.gauss(0, s), rng.gauss(0, s)))

bm = bmesh.new()
# a default Cylinder, eight sides, laid along Y: the block the whole leech is pulled out of
bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=8, radius1=0.5, radius2=0.5, depth=0.8,
                      matrix=Matrix.Rotation(math.radians(90), 4, 'X'))
bm.faces.ensure_lookup_table()
for v in bm.verts:            # squashed into a body block
    v.co = Vector((v.co.x * 1.15, v.co.y, v.co.z * 0.75 + 0.45))

def face_toward(d):
    return max(bm.faces, key=lambda f: f.normal.dot(d) + 0.001 * f.calc_center_median().dot(d))

HEAD_N, TAIL_N = 4, 6
SPINE = []  # centres of each extrusion step, for the bones
JIT = 0.5   # zack: "uneven is ok but dont over use it, tune it down a little"

def extrude_run(face, steps):
    """step 1 of zack's process: extrude out, scaling the verts for the basic structure.
    steps: (move along normal, scale x, scale z, turn about x deg, turn about z deg, jitter)"""
    for mv, sx, sz, rx, rz, jit in steps:
        r = bmesh.ops.extrude_face_region(bm, geom=[face])
        nf = [e for e in r['geom'] if isinstance(e, bmesh.types.BMFace)][0]
        c = nf.calc_center_median(); n = nf.normal.copy()
        rot = Euler((math.radians(rx * JIT), 0, math.radians(rz * JIT))).to_matrix()
        newc = c + (rot @ n) * mv
        for v in nf.verts:
            off = rot @ (v.co - c)
            off.x *= sx; off.z *= sz
            v.co = newc + off + hand(jit * JIT)
        SPINE.append(newc.copy())
        face = nf
    return face

# ---- 1. block out: head toward -Y, tail toward +Y ----
head = extrude_run(face_toward(Vector((0, -1, 0))), [
    (0.32, 1.06, 1.08, 3, -2, 0.04),
    (0.34, 1.12, 1.18, 5, -3, 0.04),
    (0.3, 0.92, 0.9, 6, 2, 0.04),
    (0.24, 0.74, 0.76, -12, -4, 0.03),
])
tail = extrude_run(face_toward(Vector((0, 1, 0))), [
    (0.4, 1.08, 1.06, -2, 3, 0.04),
    (0.45, 1.02, 1.0, -3, 5, 0.04),
    (0.55, 0.9, 0.92, -4, -6, 0.04),
    (0.5, 0.82, 0.8, 3, 8, 0.04),
    (0.6, 0.62, 0.64, 6, -5, 0.03),
    (0.55, 0.32, 0.34, 10, 9, 0.03),
])
bmesh.ops.pointmerge(bm, verts=list(tail.verts), merge_co=tail.calc_center_median())

# ---- 2. knife shapes into the mesh, extrude them out for the features ----
def knife(faces, planes):
    """cut the given faces along each plane (co, normal), as a Knife line would, and
    return the faces of the region inside every plane"""
    geom = set(faces)
    for co, no in planes:
        g = list(geom) + list({e for f in geom for e in f.edges}) + list({v for f in geom for v in f.verts})
        r = bmesh.ops.bisect_plane(bm, geom=g, plane_co=co, plane_no=no)
        geom = {e for e in r['geom'] if isinstance(e, bmesh.types.BMFace)} | {f for f in geom if f.is_valid}
    inside = [f for f in geom if f.is_valid and all((f.calc_center_median() - Vector(co)).dot(Vector(no)) < 0 for co, no in planes)]
    return inside

def pull(faces, along, dist, shrink=1.0, jit=0.01):
    r = bmesh.ops.extrude_face_region(bm, geom=faces)
    nv = [e for e in r['geom'] if isinstance(e, bmesh.types.BMVert)]
    bmesh.ops.delete(bm, geom=faces, context='FACES')
    c = sum((v.co for v in nv), Vector()) / len(nv)
    for v in nv:
        v.co = c + (v.co - c) * shrink + Vector(along) * dist + hand(jit * JIT)
    return nv

# a crest down the back: a long strip cut into the top faces, pulled up where the heat sits
top = [f for f in bm.faces if f.normal.z > 0.55 and -1.3 < f.calc_center_median().y < 1.6]
crest = knife(top, [((0.13, 0, 0), (1, 0, 0)), ((-0.11, 0, 0), (-1, 0, 0)), ((0, 1.45, 0), (0, 1, 0)), ((0, -1.2, 0), (0, -1, 0))])
if crest:
    pull(crest, (0, 0, 1), 0.16, shrink=0.8)

# a lip round the mouth: a band cut just behind the front face, pushed out, then the front sunk into a cup
front_y = min(v.co.y for v in bm.verts)
lip_faces = [f for f in bm.faces if f.calc_center_median().y < front_y + 0.35 and abs(f.normal.y) < 0.7]
lip = knife(lip_faces, [((0, front_y + 0.2, 0), (0, 1, 0))])
for f in lip:
    for v in f.verts:
        d = Vector((v.co.x, 0, v.co.z - 0.45))
        if d.length > 1e-4: v.co += d.normalized() * 0.07
mouth = face_toward(Vector((0, -1, 0)))
bmesh.ops.inset_region(bm, faces=[mouth], thickness=0.08, depth=0.0)
for v in mouth.verts:
    v.co += mouth.normal * -0.2

# hooks: a small diamond knifed into each chosen side face and pulled out to a point
def hook(side, y):
    cands = [f for f in bm.faces if f.normal.x * side > 0.7 and abs(f.calc_center_median().y - y) < 0.35]
    if not cands: return
    f = min(cands, key=lambda f: abs(f.calc_center_median().y - y))
    c = f.calc_center_median()
    cut = knife([f], [((c.x, c.y + 0.07, c.z), (0, 1, 0.4)), ((c.x, c.y - 0.07, c.z), (0, -1, 0.4)),
                      ((c.x, c.y, c.z + 0.07), (0, 0.4, 1)), ((c.x, c.y, c.z - 0.09), (0, 0.4, -1))])
    if not cut: return
    nv = pull(cut, (side * 0.75, -0.25, -0.6), 0.5, shrink=0.3)
    bmesh.ops.pointmerge(bm, verts=nv, merge_co=sum((v.co for v in nv), Vector()) / len(nv))
for y in (-0.9, -0.15, 0.6):
    hook(1, y)
for y in (-0.7, 0.35):
    hook(-1, y)

# a light hand pass
for v in bm.verts:
    v.co += hand(0.012 if v.co.x > 0 else 0.018)
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)

# ---- 3. primitives as accents: eyes and a few thorns, joined on ----
ACCENT_EYES = []
head_c = SPINE[2]
for s in (-1, 1):
    ring = [v.co for v in bm.verts if abs(v.co.y - head_c.y) < 0.18 and v.co.x * s > 0.1]
    top_z = max(v.z for v in ring) if ring else head_c.z + 0.35
    eye_at = Vector((0.24 * s, head_c.y - 0.06, top_z - 0.02 + (0.03 if s > 0 else 0)))
    bmesh.ops.create_icosphere(bm, subdivisions=1, radius=0.11, matrix=Matrix.Translation(eye_at))
    ACCENT_EYES.append(eye_at)
for i, y in enumerate((-0.5, 0.25, 0.95)):
    z = max((v.co.z for v in bm.verts if abs(v.co.y - y) < 0.2 and abs(v.co.x) < 0.2), default=0.9)
    bmesh.ops.create_cone(bm, cap_ends=True, segments=4, radius1=0.07, radius2=0.0, depth=0.26 - i * 0.04,
                          matrix=Matrix.Translation((0.18 * (-1) ** i, y, z + 0.06)) @ Matrix.Rotation(math.radians(-14), 4, 'X'))
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)

me = bpy.data.meshes.new("Cylinder")
bm.to_mesh(me); bm.free()
ob = bpy.data.objects.new("Cylinder", me)     # zack keeps the primitive's name
sc.collection.objects.link(ob)
for p in me.polygons:
    p.use_smooth = False
bpy.context.view_layer.objects.active = ob
ob.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.02)
bpy.ops.object.mode_set(mode='OBJECT')
print("TRIS", sum(len(p.vertices) - 2 for p in me.polygons), "VERTS", len(me.vertices))

# ---------- paint: hard round dabs projected onto the surface ----------
S = 256
pos = np.zeros((S, S, 3), np.float32)
nrm = np.zeros((S, S, 3), np.float32)
mask = np.zeros((S, S), bool)
V = np.array([v.co for v in me.vertices], np.float32)
uvl = me.uv_layers.active.data
for poly in me.polygons:
    li = list(poly.loop_indices); vi = list(poly.vertices); n = np.array(poly.normal)
    for k in range(1, len(li) - 1):
        tri = [0, k, k + 1]
        uv = np.array([uvl[li[j]].uv for j in tri]) * S
        mn = np.floor(uv.min(0)).astype(int) - 1; mx = np.ceil(uv.max(0)).astype(int) + 1
        xs, ys = np.meshgrid(np.arange(mn[0], mx[0] + 1) + 0.5, np.arange(mn[1], mx[1] + 1) + 0.5)
        (x0, y0), (x1, y1), (x2, y2) = uv
        den = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2)
        if abs(den) < 1e-9: continue
        w0 = ((y1 - y2) * (xs - x2) + (x2 - x1) * (ys - y2)) / den
        w1 = ((y2 - y0) * (xs - x2) + (x0 - x2) * (ys - y2)) / den
        w2 = 1 - w0 - w1
        ins = (w0 >= -0.03) & (w1 >= -0.03) & (w2 >= -0.03)
        ids = [vi[j] for j in tri]
        P = w0[..., None] * V[ids[0]] + w1[..., None] * V[ids[1]] + w2[..., None] * V[ids[2]]
        px = (xs - 0.5).astype(int); py = (ys - 0.5).astype(int)
        ok = ins & (px >= 0) & (px < S) & (py >= 0) & (py < S)
        pos[py[ok], px[ok]] = P[ok]; nrm[py[ok], px[ok]] = n; mask[py[ok], px[ok]] = True

def hexc(h): return np.array([int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)], np.float32)
# PLACEHOLDER palette: zack gives the real colours and references per model (STYLE_GUIDE.md)
BASE, DARK, WARM, HOT, PALE, INK = (hexc(h) for h in ("#7a4f7d", "#3a2140", "#e0742a", "#ffc44a", "#d9c7b0", "#1b1020"))
img = np.zeros((S, S, 3), np.float32); img[:] = BASE

from mathutils.bvhtree import BVHTree
BVH = BVHTree.FromPolygons([v.co.copy() for v in me.vertices], [list(p.vertices) for p in me.polygons])
AXIS_Z = 0.45
def on_skin(y, t, z=AXIS_Z):
    """where a brush aimed out from the body's middle at angle t lands on the skin"""
    o = Vector((0, y, z)); d = Vector((math.cos(t), 0, math.sin(t)))
    hit = BVH.ray_cast(o + d * 3, -d)
    return hit[0] if hit[0] is not None else None

def dab(p, r, col, facing=None):
    p = BVH.find_nearest(Vector(p))[0] or Vector(p)
    d = np.linalg.norm(pos - np.array(p, np.float32), axis=2)
    m = mask & (d < r)
    if facing is not None:
        m &= (nrm @ np.array(facing, np.float32)) > 0.2
    img[m] = col

def stroke(points, r, col, step=None, facing=None, wobble=0.02):
    """a hard brush dragged through 3D points, a dab every step"""
    step = step or r * 0.6
    for a, b in zip(points, points[1:]):
        a = Vector(a); b = Vector(b); n = max(1, int((b - a).length / step))
        for i in range(n + 1):
            q = a.lerp(b, i / n) + hand(wobble)
            dab(q, r * rng.uniform(0.85, 1.1), col, facing)

ys = [p.y for p in SPINE[:HEAD_N + TAIL_N]]
y0, y1 = min(ys) - 0.4, max(ys) + 0.2
# belly first, pale, laid along the underside
for y in np.arange(y0, y1, 0.12):
    dab((rng.gauss(0, 0.05), y, -0.05), 0.45, PALE, facing=(0, 0, -1))
# dark rings: drag the brush round the body at a few places, each a bit crooked
for yc in np.arange(y0 + 0.5, y1 - 0.3, 0.42) + np.array([rng.uniform(-0.08, 0.08) for _ in np.arange(y0 + 0.5, y1 - 0.3, 0.42)]):
    ring = [on_skin(yc + math.sin(t * 2) * 0.05, t) for t in np.linspace(0, 2 * math.pi, 20)]
    stroke([q for q in ring if q is not None], 0.07, DARK)
# warm veins: wandering strokes down the back, where the stolen heat shows
for side in (-0.25, 0.05, 0.3):
    pts = []; t = math.pi / 2 + side * 2
    for y in np.arange(y0 + 0.3, y1 - 0.2, 0.15):
        t += rng.gauss(0, 0.12); q = on_skin(y, t)
        if q is not None: pts.append(q)
    stroke(pts, 0.06, WARM, facing=(0, 0, 1))
for _ in range(14):        # hot blisters on the veins
    p = on_skin(rng.uniform(y0 + 0.4, y1 - 0.4), math.pi / 2 + rng.uniform(-0.8, 0.8))
    if p is None: continue
    dab(p, 0.09, WARM, facing=(0, 0, 1)); dab(p, 0.05, HOT, facing=(0, 0, 1))
# the cup: dark inside, a hot rim
front = min(v.co.y for v in me.vertices)
for v in me.vertices:
    pass
dab((0, front - 0.05, 0.45), 0.42, INK, facing=(0, -1, 0))
ring = [(math.cos(t) * 0.36, front + 0.02, 0.45 + math.sin(t) * 0.3) for t in np.linspace(0, 2 * math.pi, 16)]
stroke(ring, 0.05, HOT)
# eyes, painted where they land, not quite level
for e in ACCENT_EYES:
    dab(e, 0.13, PALE)
    dab(e + Vector((0, -0.1, 0.02)), 0.05, INK)
# hooks: dark tips
for x, y, z in pos[mask][::7]:
    if abs(x) > 1.0 and z < 0.25:
        dab((x, y, z), 0.05, INK)

# bleed islands outward so seams do not show
from scipy import ndimage
for _ in range(4):
    grown = ndimage.binary_dilation(mask)
    nb = ndimage.maximum_filter(img * mask[..., None], size=(3, 3, 1))
    img[grown & ~mask] = nb[grown & ~mask]; mask = grown
from PIL import Image
png = os.path.join(OUT, "thaw_leech.png")
Image.fromarray((np.flipud(np.clip(img, 0, 1)) * 255).astype(np.uint8)).save(png)

mat = bpy.data.materials.new("Material.001")
mat.use_nodes = True
nt = mat.node_tree; bsdf = nt.nodes['Principled BSDF']; bsdf.inputs['Roughness'].default_value = 0.5
tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = bpy.data.images.load(png); tex.image.filepath = "//thaw_leech.png"
tex.interpolation = 'Closest'
nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
me.materials.append(mat)

# ---------- rig: a chain down the extrusion centres ----------
chain = sorted(SPINE[:HEAD_N], key=lambda p: p.y) + [Vector((0, 0, 0.45))] + sorted(SPINE[HEAD_N:HEAD_N + TAIL_N], key=lambda p: p.y)
arm = bpy.data.armatures.new("Armature"); ao = bpy.data.objects.new("Armature", arm)
sc.collection.objects.link(ao)
bpy.context.view_layer.objects.active = ao
bpy.ops.object.mode_set(mode='EDIT')
names = []
mid = HEAD_N
order = list(range(mid, -1, -1)) + list(range(mid, len(chain)))
prev = None
for i in range(mid, 0, -1):            # toward the head
    b = arm.edit_bones.new(f"main.{len(names):03d}"); b.head = chain[i]; b.tail = chain[i - 1]
    if prev: b.parent = arm.edit_bones[prev]
    prev = b.name; names.append(b.name)
head_bones = list(names)
prev = None
for i in range(mid, len(chain) - 1):   # toward the tail
    b = arm.edit_bones.new(f"main.{len(names):03d}"); b.head = chain[i]; b.tail = chain[i + 1]
    if prev: b.parent = arm.edit_bones[prev]
    prev = b.name; names.append(b.name)
tail_bones = names[len(head_bones):]
root = arm.edit_bones.new("main"); root.head = Vector((0, 0, 0)); root.tail = Vector((0, 0, 0.3))
for n in (head_bones[0], tail_bones[0]):
    arm.edit_bones[n].parent = root
segs = {n: (arm.edit_bones[n].head.copy(), arm.edit_bones[n].tail.copy()) for n in names}
bpy.ops.object.mode_set(mode='OBJECT')

def seg_dist(p, a, b):
    ab = b - a; t = max(0, min(1, (p - a).dot(ab) / ab.length_squared))
    return (p - (a + ab * t)).length
groups = {}
for v in me.vertices:
    best = min(names, key=lambda n: seg_dist(v.co, *segs[n]))
    groups.setdefault(best, []).append(v.index)
for n, vs in groups.items():
    ob.vertex_groups.new(name=n).add(vs, 1.0, 'REPLACE')
ob.parent = ao
md = ob.modifiers.new("Armature", 'ARMATURE'); md.object = ao

# ---------- actions, keyed every frame with overlap ----------
ao.animation_data_create()
for pb in ao.pose.bones:
    pb.rotation_mode = 'XYZ'
def act(name, length, pose):
    a = bpy.data.actions.new(name); ao.animation_data.action = a
    for f in range(0, length + 1):
        for pb in ao.pose.bones:
            r, loc, s = pose(pb.name, f / length)
            pb.rotation_euler = [math.radians(x) for x in r]; pb.location = loc; pb.scale = (s, s, s)
            pb.keyframe_insert("rotation_euler", frame=f)
            pb.keyframe_insert("location", frame=f)
            pb.keyframe_insert("scale", frame=f)
    a.use_fake_user = True
    tr = ao.animation_data.nla_tracks.new(); tr.name = name; tr.strips.new(name, 0, a)

def idx(n):
    return (head_bones.index(n) + 1) if n in head_bones else -(tail_bones.index(n) + 1) if n in tail_bones else 0

def walk(n, ph):
    i = idx(n)
    if n == "main":
        return (0, 0, 0), (0, 0, 0.04 * math.sin(ph * 4 * math.pi)), 1.0
    lag = abs(i) * 0.13
    w = (ph - lag) * 2 * math.pi
    up = math.sin(w) * (11 if i < 0 else 8) * (1 if i > 0 else -1)
    sway = math.cos(w + 0.6) * (4 + abs(i) * 2.5)
    return (up, 0, sway), (0, 0, 0), 1.0 + 0.04 * math.sin(w * 2)

def drain(n, ph):
    i = idx(n)
    pulse = math.sin(ph * 2 * math.pi)
    beat = max(0, math.sin(ph * 4 * math.pi)) ** 3
    if i == 1:
        return (-18 - 8 * pulse, 0, 2 * math.sin(ph * 6 * math.pi)), (0, 0, 0), 1.0 + 0.12 * beat
    if i > 1:
        return (10 + 4 * pulse, 0, 0), (0, 0, 0), 1.0 + 0.08 * beat
    return (3 * math.sin(ph * 2 * math.pi - abs(i) * 0.5), 0, 0), (0, 0, 0), 1.0 + 0.05 * math.sin(ph * 2 * math.pi - abs(i) * 0.7)

def death(n, ph):
    i = idx(n)
    e = 1 - (1 - min(1, ph * 1.3)) ** 3                     # snap in, settle
    shiver = math.sin(ph * 40) * (1 - ph) * 6
    if n == "main":
        return (0, 85 * e, 0), (0, 0, 0.3 * e), 1.0
    return (shiver, 0, (26 if i < 0 else 18) * e), (0, 0, 0), 1.0 - 0.1 * e

act("walk", 32, walk)
act("drain", 24, drain)
act("death", 28, death)
ao.animation_data.action = None
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "thaw_leech.blend"))
print("SAVED")
