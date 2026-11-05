"""Close-up of one part of a model from three angles, to judge a feature (a head, a foot).
usage: python closeup.py -- file.blend out.png ymax [px] [xmin,xmax,ymin,ymax,zmin,zmax]
frames every vertex with y below ymax (the models face -Y, so a small ymax is
the head), or inside the box when one is given (a scar, a foot)"""
import bpy, sys, math, mathutils
from PIL import Image, ImageDraw
a = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.open_mainfile(filepath=a[0]); out = a[1]; ymax = float(a[2]); px = int(a[3]) if len(a) > 3 else 512
sc = bpy.context.scene
ob = [o for o in sc.objects if o.type == 'MESH'][0]
box = [float(x) for x in a[4].split(',')] if len(a) > 4 else None
inside = (lambda c: box[0] <= c.x <= box[1] and box[2] <= c.y <= box[3] and box[4] <= c.z <= box[5]) if box else (lambda c: c.y < ymax)
pts = [ob.matrix_world @ v.co for v in ob.data.vertices if inside(v.co)]
mn = mathutils.Vector([min(p[i] for p in pts) for i in range(3)]); mx = mathutils.Vector([max(p[i] for p in pts) for i in range(3)])
ctr = (mn + mx) / 2; span = (mx - mn).length * 0.85
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
w.node_tree.nodes['Background'].inputs[0].default_value = (0.35, 0.37, 0.42, 1)
for rot, e in (((50, 0, 30), 3.0), ((60, 0, 210), 1.2)):
    ld = bpy.data.lights.new("l", 'SUN'); ld.energy = e; lo = bpy.data.objects.new("l", ld); sc.collection.objects.link(lo)
    lo.rotation_euler = [math.radians(v) for v in rot]
cd = bpy.data.cameras.new("c"); cd.type = 'ORTHO'; cd.ortho_scale = span; cd.clip_end = span * 30
cam = bpy.data.objects.new("c", cd); sc.collection.objects.link(cam); sc.camera = cam
sc.render.engine = 'CYCLES'; sc.cycles.samples = 32; sc.cycles.use_denoising = False
sc.render.resolution_x = sc.render.resolution_y = px; sc.view_settings.view_transform = 'Standard'
tiles = []
VIEWS = (("3/4 FRONT", (-0.8, -1, 0.35)), ("SIDE", (1, 0, 0.05)), ("FRONT", (0, -1, 0.1))) if not box else \
        (("3/4 BACK", (0.8, 1, 0.35)), ("RIGHT", (1, 0, 0.05)), ("BACK", (0, 1, 0.1)))
for name, d in VIEWS:
    d = mathutils.Vector(d).normalized()
    cam.location = ctr + d * span * 8
    cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
    p = out + "_tmp.png"; sc.render.filepath = p; bpy.ops.render.render(write_still=True)
    im = Image.open(p).convert("RGB"); ImageDraw.Draw(im).text((8, 8), name, fill=(255, 255, 255)); tiles.append(im)
sheet = Image.new("RGB", (px * 3, px))
for i, t in enumerate(tiles): sheet.paste(t, (i * px, 0))
sheet.save(out); print("CLOSEUP", out)
