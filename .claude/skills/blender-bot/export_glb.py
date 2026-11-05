"""Export a finished blender-bot model to a .glb Godot imports.

    /opt/bpyenv/bin/python tools/blender_bot/export_glb.py -- <name>.blend <out>.glb

Writes one clip per G.act NLA track, plus an "idle" rest clip (every bone at
rest, two frames) when the model has none. Godot falls back to that clip when
nothing else is playing. The texture is embedded, and Godot extracts it on
import as <glb name>_<image name>.png beside the .glb.

Scale and facing are set in Godot, not here: the wrapper scene's instance of
the .glb carries them (SKILL.md section 6). With export_yup, Blender (x, y, z)
becomes glTF (x, z, -y), so a model built facing -Y faces +Z.
"""
import bpy, sys

argv = sys.argv[sys.argv.index("--") + 1:]
src, out = argv[0], argv[1]
bpy.ops.wm.open_mainfile(filepath=src)

ao = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
ad = ao.animation_data or ao.animation_data_create()
names = [t.name for t in ad.nla_tracks]
if "idle" not in names:
    a = bpy.data.actions.new("idle"); ad.action = a
    for f in (0, 1):
        for pb in ao.pose.bones:
            pb.rotation_mode = 'XYZ'
            pb.rotation_euler = (0, 0, 0); pb.location = (0, 0, 0)
            pb.keyframe_insert("rotation_euler", frame=f); pb.keyframe_insert("location", frame=f)
    a.use_fake_user = True
    tr = ad.nla_tracks.new(); tr.name = "idle"; tr.strips.new("idle", 0, a)
    names.append("idle")
ad.action = None

bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_animations=True,
                          export_animation_mode='NLA_TRACKS', export_image_format='AUTO',
                          export_yup=True)
print("GLB", out, "clips", names)
