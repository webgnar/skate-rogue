"""Export the Tyrant Raptor's .blend to the game's glb: the skinned mesh, its
painted texture and the four clips (run, bite, idle, hatch) as glTF animations.
Blender units go across 1:1; scenes/tyrant_raptor.tscn scales and turns it.

usage: python export_tyrant_raptor_glb.py -- <in.blend> <out.glb>
"""
import bpy, sys
a = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.open_mainfile(filepath=a[0])
ao = bpy.data.objects['Armature']
ao.animation_data.action = None
for tr in ao.animation_data.nla_tracks: tr.mute = False
bpy.ops.export_scene.gltf(filepath=a[1], export_format='GLB', export_animation_mode='ACTIONS',
                          export_force_sampling=True, export_frame_step=1, export_yup=True,
                          export_apply=False, export_skins=True, export_image_format='AUTO')
print("GLB", a[1])
