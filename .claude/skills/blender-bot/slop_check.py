"""Find the slop on a model and paint it HUGE RED, so it can be seen at a glance
(zack, 2026-11-04: "fix Slop. huge red to see these"). Prints a count per kind
and renders a front, side and back sheet with every offending face in red.

Kinds:
  intersect   two body faces that are not neighbours pass through each other
              (a knifed feature or a scar pushed through the other side)
  poke        an accent edge that crosses the body skin twice: in at its seat
              and out again (a tooth through the jaw, a claw through a toe)
  open        an edge with one face (a hole) or more than two (a fin)
  flipped     a face turned inside out (wound against its neighbours, or a
              shell with negative volume): invisible from outside in game
  sliver      a face with almost no area (a knife cut left a crumb)
Exit status 1 when anything is found.

usage: python slop_check.py -- file.blend out_prefix [px]
"""
import bpy, bmesh, sys, os, math, mathutils
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from PIL import Image, ImageDraw

a = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.open_mainfile(filepath=a[0]); out = a[1]; px = int(a[2]) if len(a) > 2 else 640
sc = bpy.context.scene
ob = [o for o in sc.objects if o.type == 'MESH'][0]
me = ob.data
bm = bmesh.new(); bm.from_mesh(me)
bm.verts.ensure_lookup_table(); bm.faces.ensure_lookup_table()
acc_layer = bm.verts.layers.int.get("acc")
def is_acc(f): return acc_layer is not None and any(v[acc_layer] for v in f.verts)

bad = {}
def flag(kind, f):
    bad.setdefault(f.index, kind)

# open edges
for e in bm.edges:
    if len(e.link_faces) != 2:
        for f in e.link_faces: flag('open', f)
# slivers
for f in bm.faces:
    if f.calc_area() < 1e-4: flag('sliver', f)
# intersections: overlap the mesh with itself
tree = BVHTree.FromBMesh(bm)
body_faces = [f for f in bm.faces if not is_acc(f)]
body = BVHTree.FromPolygons([v.co for v in bm.verts], [[v.index for v in f.verts] for f in body_faces])
for i, j in tree.overlap(tree):
    if i >= j: continue
    fi, fj = bm.faces[i], bm.faces[j]
    if set(fi.verts) & set(fj.verts): continue
    ai, aj = is_acc(fi), is_acc(fj)
    if not ai and not aj:
        flag('intersect', fi); flag('intersect', fj)
# pokes: a seated accent crosses the body skin once along each of its edges
# (base in, tip out). An edge that crosses twice has gone in and out again: a
# tooth through the jaw, a claw through a toe, a spike through the far side.
for e in bm.edges:
    if not (is_acc(e.link_faces[0]) if e.link_faces else False): continue
    a0, a1 = e.verts[0].co, e.verts[1].co
    d = a1 - a0; L = d.length
    if L < 1e-6: continue
    d = d / L; o = a0.copy(); ts = []; t = 0.0
    while len(ts) < 5 and t < L:
        h = body.ray_cast(o, d, L - t)
        if h[0] is None: break
        t += (h[0] - o).length; ts.append(t); t += 1e-3; o = h[0] + d * 1e-3
    # in and out again further apart than a graze at the seat (a base corner
    # just breaking the skin is how a seated cone sits on a curved surface)
    if any(b - a > 0.2 for a, b in zip(ts, ts[1:])):
        for f in e.link_faces: flag('poke', f)
# flipped: in Godot a face is drawn from its front only, so a face turned inward
# is a hole you see the far wall through (zack's "gray through the back").
# Two tests, both exact: a face whose winding disagrees with a neighbour across
# a shared edge, and a whole shell whose signed volume is negative (inside out).
for e in bm.edges:
    if len(e.link_faces) != 2: continue
    f1, f2 = e.link_faces
    def walks(f):
        for l in f.loops:
            if l.edge is e: return l.vert
    if walks(f1) is walks(f2):              # both faces run the edge the same way
        flag('flipped', f1 if f1.calc_area() < f2.calc_area() else f2)
seen = set()
for f0 in bm.faces:
    if f0 in seen: continue
    shell, stack = [], [f0]; seen.add(f0)
    while stack:
        f = stack.pop(); shell.append(f)
        for e in f.edges:
            for g in e.link_faces:
                if g not in seen: seen.add(g); stack.append(g)
    vol = 0.0
    for f in shell:
        vs = [v.co for v in f.verts]
        for k in range(1, len(vs) - 1): vol += vs[0].dot(vs[k].cross(vs[k + 1])) / 6
    if vol < 0:
        for f in shell: flag('flipped', f)

counts = {}
for k in bad.values(): counts[k] = counts.get(k, 0) + 1
print("SLOP", counts if counts else "none")

# the animation: slop a pose makes (zack: "none of these slop sections of holes
# in the geometry... WHEN ANIMATIONS PLAY"), the worst frame of every action
arm = [o for o in sc.objects if o.type == 'ARMATURE']
posed = {}
if arm and arm[0].animation_data:
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from bb_lib import posed_slop
    posed = posed_slop(ob, arm[0])
    for act, (f, fb, anyb) in posed.items():
        print("SLOP", act, "worst frame", f, "faces", len(fb), "bad in some frame", len(anyb))
    for tr in arm[0].animation_data.nla_tracks: tr.mute = True
    arm[0].animation_data.action = None
anim_bad = sum(len(v[1]) for v in posed.values())

# render: the offending faces in a red that cannot be missed, the rest in plain
# matte clay so no paint colour (the Tyrant's own red, orange) hides the slop
red = bpy.data.materials.new("SLOP_RED"); red.use_nodes = True
b = red.node_tree.nodes['Principled BSDF']
b.inputs['Base Color'].default_value = (1, 0, 0, 1)
b.inputs['Emission Color'].default_value = (1, 0, 0, 1); b.inputs['Emission Strength'].default_value = 3.0
me.materials.append(red); ri = len(me.materials) - 1
clay = bpy.data.materials.new("SLOP_CLAY"); clay.use_nodes = True
cb = clay.node_tree.nodes['Principled BSDF']
cb.inputs['Base Color'].default_value = (0.55, 0.55, 0.52, 1)
cb.inputs['Roughness'].default_value = 1.0
if 'Specular IOR Level' in cb.inputs: cb.inputs['Specular IOR Level'].default_value = 0.0
me.materials.append(clay); ci = len(me.materials) - 1
def paint_red(faces):
    for p in me.polygons: p.material_index = ri if p.index in faces else ci
    me.update()

sc.frame_set(0)
dg = bpy.context.evaluated_depsgraph_get()
pts = [ob.matrix_world @ Vector(c) for c in ob.evaluated_get(dg).bound_box]
mn = Vector([min(p[i] for p in pts) for i in range(3)]); mx = Vector([max(p[i] for p in pts) for i in range(3)])
ctr = (mn + mx) / 2; span = max(mx - mn) * 1.15
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
w.node_tree.nodes['Background'].inputs[0].default_value = (0.35, 0.37, 0.42, 1)
for rot, e in (((50, 0, 30), 3.0), ((60, 0, 210), 1.2)):
    ld = bpy.data.lights.new("l", 'SUN'); ld.energy = e; lo = bpy.data.objects.new("l", ld); sc.collection.objects.link(lo)
    lo.rotation_euler = [math.radians(v) for v in rot]
cd = bpy.data.cameras.new("c"); cd.type = 'ORTHO'; cd.ortho_scale = span; cd.clip_end = span * 20
cam = bpy.data.objects.new("c", cd); sc.collection.objects.link(cam); sc.camera = cam
sc.render.engine = 'CYCLES'; sc.cycles.samples = 16; sc.cycles.use_denoising = False
sc.render.resolution_x = sc.render.resolution_y = px; sc.view_settings.view_transform = 'Standard'
def shot(label, d, tag):
    d = Vector(d).normalized(); cam.location = ctr + d * span * 5
    cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
    p = out + f"_{tag}.png"; sc.render.filepath = p; bpy.ops.render.render(write_still=True)
    im = Image.open(p).convert("RGB"); ImageDraw.Draw(im).text((8, 8), label, fill=(255, 255, 255)); return im
paint_red(set(bad))
rows = [[shot(n, d, n.lower()) for n, d in (("FRONT", (0, -1, 0)), ("SIDE", (1, 0, 0)), ("BACK", (0, 1, 0)))]]
heads = ["REST: " + (", ".join(f"{k} {v}" for k, v in sorted(counts.items())) or "clean")]
if posed:
    tiles = []
    for act, (f, fb, anyb) in posed.items():
        arm[0].animation_data.action = bpy.data.actions[act]; sc.frame_set(f)
        paint_red(fb)
        tiles.append(shot(f"{act.upper()} frame {f}: {len(fb)} red", (0.75, -0.9, 0.35), f"anim_{act}"))
    arm[0].animation_data.action = None; sc.frame_set(0)
    rows.append(tiles)
    heads.append("ANIMATION, worst frame of each: " + ", ".join(f"{a} {len(v[1])}" for a, v in posed.items()))
cols = max(len(r) for r in rows)
sheet = Image.new("RGB", (px * cols, (px + 28) * len(rows)), (20, 20, 20))
for ri_, (row, hd) in enumerate(zip(rows, heads)):
    y = ri_ * (px + 28)
    ImageDraw.Draw(sheet).text((8, y + 8), hd, fill=(255, 80, 80))
    for i, t in enumerate(row): sheet.paste(t, (i * px, y + 28))
sheet.save(out + ".png"); print("SLOPSHEET", out + ".png")
sys.exit(1 if counts or anim_bad else 0)
