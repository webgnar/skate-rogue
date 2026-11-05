"""Export blender files/bot/tyrant_egg.blend to the game: a .glb with both actions (warm, hatch).
usage: python export_tyrant_egg.py -- tyrant_egg.blend godot-sandbox/resources/models/characters/boss/tyrant_egg.glb"""
import bpy, sys
a = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.open_mainfile(filepath=a[0])
ao = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
for tr in ao.animation_data.nla_tracks: tr.mute = False
ao.animation_data.action = None
bpy.ops.export_scene.gltf(filepath=a[1], export_format='GLB', export_animations=True, export_animation_mode='ACTIONS',
                          export_force_sampling=True, export_yup=True, export_apply=False)
print("EXPORTED", a[1])
