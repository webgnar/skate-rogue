"""Export the built Wasp to the game: wasp.blend -> wasp.glb, texture embedded, both clips.

usage: python export_wasp_glb.py -- <wasp.blend> <out.glb>

Blender's -Y (the way every bot model faces) lands on glTF/Godot +Z, the way
wasp.gd turns the Wasp (atan2(x, z)). Every action is exported from its NLA
track by name ("fly", "bomb"), which is what wasp.gd plays.
"""
import bpy, sys
a = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.open_mainfile(filepath=a[0])
ao = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
ao.animation_data.action = None
for tr in ao.animation_data.nla_tracks: tr.mute = False
bpy.ops.export_scene.gltf(filepath=a[1], export_format='GLB', export_apply=False,
                          export_animations=True, export_animation_mode='NLA_TRACKS',
                          export_force_sampling=True, export_frame_step=1,
                          export_image_format='AUTO', export_yup=True)
print("GLB", a[1])
