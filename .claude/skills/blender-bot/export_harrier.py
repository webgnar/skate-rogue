"""Export the finished Harrier .blend to the GLB the game loads.

usage: python export_harrier.py -- harrier.blend texture.png out.glb

The texture is swapped for the final painted one (beads and sketch marks on),
both actions go out as animations named after them (fly, sting), and glTF's
+Y up turns the model's -Y nose into Godot's +Z, the way the game faces every
model (atan2(x, z)).
"""
import bpy, sys
a = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.open_mainfile(filepath=a[0])
img = bpy.data.images.load(a[1])
img.name = "harrier"
for m in bpy.data.materials:
    if not m.use_nodes: continue
    for n in m.node_tree.nodes:
        if n.type == 'TEX_IMAGE':
            n.image = img
            n.interpolation = 'Closest'
ao = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
for tr in ao.animation_data.nla_tracks: tr.mute = False
ao.animation_data.action = None
bpy.ops.export_scene.gltf(filepath=a[2], export_format='GLB', export_animations=True,
                          export_animation_mode='ACTIONS', export_force_sampling=True,
                          export_apply=False, export_yup=True, export_image_format='AUTO')
print("GLB", a[2])
