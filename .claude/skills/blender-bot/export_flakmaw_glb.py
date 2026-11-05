"""Export the finished Flakmaw (blender files/bot/flakmaw.blend) to the game's
glb, with every action as its own clip (walk, idle, fire).

usage: python export_flakmaw_glb.py -- <flakmaw.blend> <out.glb>
"""
import bpy, sys
a = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.open_mainfile(filepath=a[0])
ao = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
ao.animation_data.action = None
for tr in ao.animation_data.nla_tracks:
    tr.mute = False
for act in bpy.data.actions:
    act.use_fake_user = True
bpy.ops.export_scene.gltf(filepath=a[1], export_format='GLB', export_animations=True,
                          export_animation_mode='ACTIONS', export_force_sampling=True,
                          export_frame_step=1, export_apply=False, export_yup=True,
                          export_image_format='AUTO')
print("GLB", a[1])
