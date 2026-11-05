"""Front, side and back orthographic sheet of a model, one shared scale, labelled.
A flat creature (a ray, a flyer: height under 0.4 of its length or span) also
gets a second row, TOP and BELOW, since that is how the game's camera sees it;
pass "top" as the fourth argument to force that row.
usage: python turnaround.py -- file.blend out.png [size_px] [top]"""
import bpy, sys, math, mathutils, os
from PIL import Image, ImageDraw
a = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.open_mainfile(filepath=a[0]); out = a[1]; px = int(a[2]) if len(a) > 2 else 768
sc = bpy.context.scene
meshes = [o for o in sc.objects if o.type == 'MESH' and not o.hide_render]
dg = bpy.context.evaluated_depsgraph_get()
pts = [o.matrix_world @ mathutils.Vector(c) for o in meshes for c in o.evaluated_get(dg).bound_box]
mn = mathutils.Vector([min(p[i] for p in pts) for i in range(3)]); mx = mathutils.Vector([max(p[i] for p in pts) for i in range(3)])
ctr = (mn + mx) / 2; size = mx - mn
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
w.node_tree.nodes['Background'].inputs[0].default_value = (0.35, 0.37, 0.42, 1)
for rot, e in (((50, 0, 30), 3.0), ((60, 0, 210), 1.2)):
    ld = bpy.data.lights.new("l", 'SUN'); ld.energy = e; lo = bpy.data.objects.new("l", ld); sc.collection.objects.link(lo)
    lo.rotation_euler = [math.radians(v) for v in rot]
cd = bpy.data.cameras.new("c"); cd.type = 'ORTHO'
cam = bpy.data.objects.new("c", cd); sc.collection.objects.link(cam); sc.camera = cam
span = max(size.x, size.y, size.z) * 1.08
cd.ortho_scale = span; cd.clip_end = span * 20
sc.render.engine = 'CYCLES'; sc.cycles.samples = 32; sc.cycles.use_denoising = False
sc.render.resolution_x = sc.render.resolution_y = px; sc.view_settings.view_transform = 'Standard'
views = [("FRONT", (0, -1, 0)), ("SIDE", (1, 0, 0)), ("BACK", (0, 1, 0))]
flat = (len(a) > 3 and a[3] == "top") or size.z < 0.4 * max(size.x, size.y)
if flat: views += [("TOP", (0, 0, 1)), ("BELOW", (0, 0, -1))]
tiles = []
for name, d in views:
    d = mathutils.Vector(d)
    cam.location = ctr + d * span * 5
    q = (-d).to_track_quat('-Z', 'Y')
    if name == "BELOW": q = q @ mathutils.Quaternion((0, 0, 1), math.pi)   # head up the frame, as in TOP
    cam.rotation_euler = q.to_euler()
    p = out + f"_{name.lower()}.png"; sc.render.filepath = p; bpy.ops.render.render(write_still=True)
    tiles.append((name, Image.open(p).convert("RGB")))
rows = 2 if flat else 1
sheet = Image.new("RGB", (px * 3, (px + 36) * rows), (30, 30, 30)); dr = ImageDraw.Draw(sheet)
for i, (name, im) in enumerate(tiles):
    x, y = (i % 3) * px, (i // 3) * (px + 36)
    sheet.paste(im, (x, y + 36)); dr.text((x + 12, y + 10), name, fill=(255, 255, 255))
dr.text((px * 3 - 260, 10), f"{size.x:.1f} x {size.y:.1f} x {size.z:.1f} units", fill=(200, 200, 200))
sheet.save(out)
print("SHEET", out)
