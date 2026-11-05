"""Render each action of a rigged model to an animated GIF (zack judges motion, not stills).
usage: python anim_gif.py -- file.blend out_prefix [action,action] [step]"""
import bpy, sys, math, mathutils, os
from PIL import Image
a = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.open_mainfile(filepath=a[0]); out = a[1]
acts = a[2].split(',') if len(a) > 2 and a[2] else None
step = int(a[3]) if len(a) > 3 else 2
sc = bpy.context.scene
ao = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
for tr in ao.animation_data.nla_tracks: tr.mute = True
meshes = [o for o in sc.objects if o.type == 'MESH']
pts = [o.matrix_world @ mathutils.Vector(c) for o in meshes for c in o.bound_box]
mn = mathutils.Vector([min(p[i] for p in pts) for i in range(3)]); mx = mathutils.Vector([max(p[i] for p in pts) for i in range(3)])
ctr = (mn + mx) / 2; rad = (mx - mn).length / 2
w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
w.node_tree.nodes['Background'].inputs[0].default_value = (0.35, 0.37, 0.42, 1)
ld = bpy.data.lights.new("sun", 'SUN'); ld.energy = 3.5; lo = bpy.data.objects.new("sun", ld); sc.collection.objects.link(lo)
lo.rotation_euler = (math.radians(50), 0, math.radians(30))
cd = bpy.data.cameras.new("c"); cd.type = 'ORTHO'; cd.ortho_scale = rad * 2.6
cam = bpy.data.objects.new("c", cd); sc.collection.objects.link(cam); sc.camera = cam
cam.location = ctr + mathutils.Vector((-0.85, -0.75, 0.55)).normalized() * rad * 5
cam.rotation_euler = (ctr - cam.location).to_track_quat('-Z', 'Y').to_euler(); cd.clip_end = rad * 12
sc.render.engine = 'CYCLES'; sc.cycles.samples = 12; sc.cycles.use_denoising = False
sc.render.resolution_x = sc.render.resolution_y = 320; sc.view_settings.view_transform = 'Standard'
tmp = out + "_frames"; os.makedirs(tmp, exist_ok=True)
for act in bpy.data.actions:
    if acts and act.name not in acts: continue
    ao.animation_data.action = act
    f0, f1 = (int(x) for x in act.frame_range)
    frames = []
    for f in range(f0, f1 + 1, step):
        sc.frame_set(f); p = f"{tmp}/{act.name}_{f:03d}.png"
        sc.render.filepath = p; bpy.ops.render.render(write_still=True)
        frames.append(Image.open(p).convert("RGB"))
    loops = 3 if act.name != "death" else 1
    dur = int(1000 / 24 * step)
    frames[0].save(f"{out}_{act.name}.gif", save_all=True, append_images=frames[1:], duration=dur, loop=0)
    print("GIF", f"{out}_{act.name}.gif", len(frames))
