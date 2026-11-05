"""Export the Reclaimer to the glb the game loads.

usage: python export_reclaimer.py -- "blender files/bot/reclaimer.blend" out.glb

The mesh, its armature (bones named after reclaimer_body.tscn's pivots) and
its painted texture, nearest sampled, with the four preview actions (walk,
stomp, laser, hop) as clips. The game does not play them: scripts/reclaimer.gd
turns the pivots and a PivotBoneBridge carries each turn to its bone. The
scene scales the model by 4 and turns it to face -Z.
"""
import bpy, sys

a = sys.argv[sys.argv.index('--') + 1:]
bpy.ops.wm.open_mainfile(filepath=a[0])
for ob in bpy.data.objects:
    ob.select_set(ob.type in ('MESH', 'ARMATURE'))
ao = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
for tr in ao.animation_data.nla_tracks:
    tr.mute = False
ao.animation_data.action = None
bpy.ops.export_scene.gltf(filepath=a[1], export_format='GLB', use_selection=True,
                          export_animations=True, export_animation_mode='ACTIONS',
                          export_skins=True, export_yup=True, export_apply=False)
print("EXPORTED", a[1])
