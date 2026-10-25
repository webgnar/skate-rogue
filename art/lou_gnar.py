# Builds Lou Gnar's astronaut (the Gnar Run player model) in Blender and exports public/models/lou-gnar.glb.
#
#   blender -b -P art/lou_gnar.py            (or run it from Blender's Text Editor; it rebuilds the scene)
#   blender -b art/lou-gnar.blend -P art/lou_gnar.py -- --export-only
#                                            (after editing the actions in Blender: writes the GLB from the file)
#
# The clips: art/bake_clips.cjs records them from the game into art/anim/clips.json, this script keys them as one
# action per clip, and the GLB carries them to the game, which plays them in place of the code clips. Rebuilding
# from scratch re-keys every action from clips.json, so after hand edits in Blender use --export-only.
#
# Everything is in the skater rig's own units (see openspec/changes/m6-skinned-skater/design.md): Blender +X is the
# way you skate (the lead, left side), Blender -Y faces the game camera, Z is up. The model is in the bind pose:
# every rig joint at zero, legs and arms hanging straight down, toes toward the camera.
import math
import os
import sys

import bpy  # first: the bpy module provides bmesh and mathutils
import bmesh
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__)) if '__file__' in dir() else bpy.path.abspath('//')
ROOT = os.path.dirname(HERE)
GLB = os.path.join(ROOT, 'public', 'models', 'lou-gnar.glb')
BLEND = os.path.join(HERE, 'lou-gnar.blend')
BOARD_GLB = os.path.join(ROOT, 'public', 'models', 'board.glb')
CLIPS = os.path.join(HERE, 'anim', 'clips.json')  # baked from the game by art/bake_clips.cjs
BOARD_TOP = 0.12  # deck top above the ground with the board flat (poses.ts BOARD.deckTop)

# rig joints (skater-rig.ts) in Blender coordinates
PELVIS = 0.9
SPINE = PELVIS + 0.06
SHOULDER_Z = SPINE + 0.46
HEAD_Z = SPINE + 0.58
HIP_X = 0.11
HIP_Z = PELVIS - 0.04
KNEE_Z = HIP_Z - 0.4
ANKLE_Z = KNEE_Z - 0.4
ARM_X = 0.25
ELBOW_Z = SHOULDER_Z - 0.29
HAND_Z = ELBOW_Z - 0.28

COLORS = {
    'suit': 0xF1F0EA,
    'suitShade': 0xD5D6DC,
    'trim': 0x8A93A6,
    'belt': 0x23232E,
    'visor': 0x0D0D14,
    'shoe': 0x17171B,
    'sole': 0xEEEEEE,
    'VisorGlint': 0xFFFFFF,
}

# name: (head, tail, parent)
BONES = {
    'Hips': ((0, 0, PELVIS), (0, 0, SPINE), None),
    'Spine': ((0, 0, SPINE), (0, 0, SPINE + 0.24), 'Hips'),
    'Spine1': ((0, 0, SPINE + 0.24), (0, 0, SPINE + 0.52), 'Spine'),
    'Neck': ((0, 0, SPINE + 0.52), (0, 0, HEAD_Z), 'Spine1'),
    'Head': ((0, 0, HEAD_Z), (0, 0, HEAD_Z + 0.36), 'Neck'),
}
for side, s in (('Left', 1), ('Right', -1)):
    BONES[f'{side}Arm'] = ((s * ARM_X, 0, SHOULDER_Z), (s * ARM_X, 0, ELBOW_Z), 'Spine1')
    BONES[f'{side}ForeArm'] = ((s * ARM_X, 0, ELBOW_Z), (s * ARM_X, 0, HAND_Z + 0.04), f'{side}Arm')
    BONES[f'{side}Hand'] = ((s * ARM_X, 0, HAND_Z + 0.04), (s * ARM_X, 0, HAND_Z - 0.08), f'{side}ForeArm')
    BONES[f'{side}UpLeg'] = ((s * HIP_X, 0, HIP_Z), (s * HIP_X, 0, KNEE_Z), 'Hips')
    BONES[f'{side}Leg'] = ((s * HIP_X, 0, KNEE_Z), (s * HIP_X, 0, ANKLE_Z), f'{side}UpLeg')
    BONES[f'{side}Foot'] = ((s * HIP_X, 0, ANKLE_Z), (s * HIP_X, -0.12, 0.0), f'{side}Leg')
    BONES[f'{side}ToeBase'] = ((s * HIP_X, -0.12, 0.0), (s * HIP_X, -0.2, 0.0), f'{side}Foot')
# the board rides its own bone (a root, like Hips): origin at the middle of the deck top, along the nose
BONES['Board'] = ((0, 0, BOARD_TOP), (0.3, 0, BOARD_TOP), None)


def hex_rgba(h):
    srgb = [((h >> sh) & 255) / 255 for sh in (16, 8, 0)]
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb]
    return (*lin, 1.0)


def material(name, color, rough=0.9):
    m = bpy.data.materials.new(name)
    m.diffuse_color = hex_rgba(color)
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = hex_rgba(color)
    bsdf.inputs['Roughness'].default_value = rough
    return m


def flag_material():
    img = bpy.data.images.new('flag', 19, 13)
    px = []
    for row in range(13):
        y = 12 - row  # Blender images start at the bottom
        for x in range(19):
            if y < 7 and x < 8:
                c = 0x2B3A8C
            else:
                c = 0xC22A2A if row % 2 == 0 else 0xFFFFFF
            px += [((c >> sh) & 255) / 255 for sh in (16, 8, 0)] + [1.0]
    img.pixels = px
    img.pack()
    m = bpy.data.materials.new('flag')
    nt = m.node_tree
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = img
    tex.interpolation = 'Closest'
    nt.links.new(tex.outputs['Color'], nt.nodes['Principled BSDF'].inputs['Base Color'])
    return m


def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def armature():
    data = bpy.data.armatures.new('LouGnarRig')
    ob = bpy.data.objects.new('LouGnarRig', data)
    bpy.context.scene.collection.objects.link(ob)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode='EDIT')
    for name, (head, tail, parent) in BONES.items():
        b = data.edit_bones.new(name)
        b.head, b.tail = head, tail
        b.roll = 0
        b.use_deform = name != 'Board'  # the suit doesn't skin to the board
        if parent:
            b.parent = data.edit_bones[parent]
            b.use_connect = Vector(head) == data.edit_bones[parent].tail
    bpy.ops.object.mode_set(mode='OBJECT')
    data.display_type = 'STICK'
    ob.show_in_front = True
    return ob


def link(name, bm, mats):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(m)
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def body(mats):
    """One continuous suit from a skin-modifier skeleton: puffy, with soft joints."""
    # (position, radius across x, radius in depth y)
    verts = [
        ((0, 0, PELVIS - 0.02), 0.18, 0.13),  # 0 pelvis
        ((0, 0, SPINE + 0.06), 0.18, 0.13),  # 1 waist
        ((0, 0, SPINE + 0.28), 0.225, 0.155),  # 2 chest
        ((0, 0, SPINE + 0.44), 0.2, 0.14),  # 3 upper chest
        ((0, 0, SPINE + 0.54), 0.1, 0.1),  # 4 neck
    ]
    edges = [(0, 1), (1, 2), (2, 3), (3, 4)]
    for s in (1, -1):
        i = len(verts)
        verts += [
            ((s * (ARM_X - 0.02), 0, SHOULDER_Z - 0.01), 0.1, 0.1),  # shoulder
            ((s * ARM_X, 0, ELBOW_Z), 0.085, 0.085),  # elbow
            ((s * ARM_X, 0, HAND_Z + 0.06), 0.07, 0.07),  # wrist (cuff)
            ((s * HIP_X, 0, HIP_Z - 0.04), 0.115, 0.11),  # hip
            ((s * HIP_X, 0, KNEE_Z), 0.1, 0.1),  # knee
            ((s * HIP_X, 0, ANKLE_Z + 0.01), 0.085, 0.085),  # ankle (cuff into the shoe)
        ]
        edges += [(3, i), (i, i + 1), (i + 1, i + 2), (0, i + 3), (i + 3, i + 4), (i + 4, i + 5)]
    me = bpy.data.meshes.new('suit')
    me.from_pydata([v[0] for v in verts], edges, [])
    ob = bpy.data.objects.new('suit', me)
    bpy.context.scene.collection.objects.link(ob)
    skin = ob.modifiers.new('skin', 'SKIN')
    skin.use_smooth_shade = False
    for sv, (_, rx, ry) in zip(me.skin_vertices[0].data, verts):
        sv.radius = (rx, ry)
    me.skin_vertices[0].data[0].use_root = True
    sub = ob.modifiers.new('sub', 'SUBSURF')
    sub.levels = sub.render_levels = 1
    bpy.context.view_layer.objects.active = ob
    for m in list(ob.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)
    me.materials.append(mats['suit'])
    return ob


def helmet(mats):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=14, v_segments=10, radius=0.215)
    bmesh.ops.translate(bm, verts=bm.verts, vec=(0, 0, HEAD_Z + 0.17))
    ob = link('helmet', bm, [mats['suit']])
    # visor: the front of a slightly bigger sphere, wide like the sprite's
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=14, v_segments=10, radius=0.222)
    c = Vector((0, 0, HEAD_Z + 0.17))
    drop = [f for f in bm.faces if not (f.calc_center_median().y < -0.07 and -0.13 < f.calc_center_median().z < 0.15)]
    bmesh.ops.delete(bm, geom=drop, context='FACES')
    bmesh.ops.translate(bm, verts=bm.verts, vec=c)
    visor = link('visor', bm, [mats['visor']])
    # a glint across the visor: a thin diagonal streak just proud of it, which the game lights up with the neon
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=40, v_segments=30, radius=0.226)
    def streak(p):
        return p.y < -0.12 and -0.15 < p.x < 0.02 and abs((p.z - 0.075) + 0.45 * (p.x + 0.06)) < 0.016
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if not streak(f.calc_center_median())], context='FACES')
    bmesh.ops.translate(bm, verts=bm.verts, vec=c)
    glint = link('VisorGlint', bm, [mats['VisorGlint']])
    rim = bmesh.new()  # trim ring where the helmet meets the suit
    bmesh.ops.create_cone(rim, cap_ends=False, segments=12, radius1=0.14, radius2=0.12, depth=0.06)
    bmesh.ops.translate(rim, verts=rim.verts, vec=(0, 0, HEAD_Z + 0.0))
    collar = link('collar', rim, [mats['trim']])
    return [(ob, 'Head'), (visor, 'Head'), (glint, 'Head'), (collar, 'Neck')]


def box(name, size, at, mat, bevel=0.0):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    bmesh.ops.scale(bm, vec=size, verts=bm.verts)
    if bevel:
        bmesh.ops.bevel(bm, geom=bm.edges[:], offset=bevel, segments=1, affect='EDGES')
    bmesh.ops.translate(bm, verts=bm.verts, vec=at)
    return link(name, bm, [mat])


BALL_Y = -0.12  # the ball of the foot: the ToeBase bone's head


def shoe_parts(name, side, size, at, mat, bevel=0.0):
    """A shoe box split at the ball of the foot: the heel part rides {side}Foot, the toe cap {side}ToeBase, so the
    toes bend with the bone and a heel lift doesn't push the toe through the deck. The halves overlap a little at
    the seam so a bend never opens a gap."""
    w, length, h = size
    x, y, z = at
    front, back = y - length / 2, y + length / 2
    heel_y0, toe_y1 = BALL_Y - 0.006, BALL_Y + 0.006
    heel = box(f'{name}Heel', (w, back - heel_y0, h), (x, (back + heel_y0) / 2, z), mat, bevel)
    toe = box(f'{name}Toe', (w, toe_y1 - front, h), (x, (toe_y1 + front) / 2, z), mat, bevel)
    return [(heel, f'{side}Foot'), (toe, f'{side}ToeBase')]


def gear(mats):
    parts = [
        (box('pack', (0.34, 0.14, 0.42), (0, 0.18, SPINE + 0.3), mats['suitShade'], 0.03), 'Spine1'),
        (box('panel', (0.16, 0.04, 0.1), (0, -0.155, SPINE + 0.32), mats['trim']), 'Spine1'),
    ]
    # belt line round the waist, as on the sprite
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=False, segments=14, radius1=1, radius2=1, depth=0.035)
    bmesh.ops.scale(bm, vec=(0.19, 0.138, 1), verts=bm.verts)
    bmesh.ops.translate(bm, verts=bm.verts, vec=(0, 0, SPINE + 0.04))
    parts.append((link('belt', bm, [mats['belt']]), 'Spine'))
    for side, s in (('Left', 1), ('Right', -1)):
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=8, v_segments=6, radius=0.068)
        bmesh.ops.scale(bm, vec=(0.9, 1, 1.15), verts=bm.verts)
        bmesh.ops.translate(bm, verts=bm.verts, vec=(s * ARM_X, 0, HAND_Z))
        parts.append((link(f'glove{side}', bm, [mats['suitShade']]), f'{side}Hand'))
        # shoe: toes toward the camera (-Y), ankle over the heel
        sole_y = -0.05
        parts += shoe_parts(f'shoe{side}', side, (0.12, 0.27, 0.1), (s * HIP_X, sole_y - 0.01, ANKLE_Z - 0.075 + 0.06), mats['shoe'], 0.015)
        parts += shoe_parts(f'sole{side}', side, (0.128, 0.285, 0.022), (s * HIP_X, sole_y - 0.01, ANKLE_Z - 0.075 + 0.011), mats['sole'])
    # flag patch on the outside of the lead upper arm, turned a little toward the camera
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=0.5)
    bmesh.ops.scale(bm, vec=(0.1, 0.065, 1), verts=bm.verts)
    uv = bm.loops.layers.uv.new()
    for f in bm.faces:
        for lp in f.loops:
            lp[uv].uv = (lp.vert.co.x / 0.1 + 0.5, lp.vert.co.y / 0.065 + 0.5)
    rot = Matrix.Rotation(-0.25, 4, 'Z') @ Matrix.Rotation(math.pi / 2, 4, 'Y') @ Matrix.Rotation(math.pi / 2, 4, 'Z')
    bmesh.ops.transform(bm, matrix=rot, verts=bm.verts)
    bmesh.ops.translate(bm, verts=bm.verts, vec=(ARM_X + 0.098, -0.025, SHOULDER_Z - 0.12))
    parts.append((link('flag', bm, [mats['flag']]), 'LeftArm'))
    return parts


def wear_decals(shoe_w=0.12, shoe_y=-0.06):
    """Gear wear on the lead (left) shoe, hidden in game till the shoes wear (src/render/wear.ts): a scuff on the
    outside of the toe box where the ollie drags it up the grip, and the hole it wears through to the sock."""
    side = HIP_X + shoe_w / 2  # the outside face of the left shoe
    mid = ANKLE_Z - 0.075 + 0.055
    scuff = box('WearScuff', (0.006, 0.1, 0.05), (side + 0.002, shoe_y - 0.075, mid), material('WearScuff', 0x8E8C90), 0.002)
    hole = box('WearHole', (0.008, 0.045, 0.024), (side + 0.003, shoe_y - 0.085, mid + 0.004), material('WearHole', 0xE8E4DA))
    return [(scuff, 'LeftFoot'), (hole, 'LeftToeBase')]  # the hole is worn through the toe cap


def rigid(ob, bone):
    vg = ob.vertex_groups.new(name=bone)
    vg.add(list(range(len(ob.data.vertices))), 1.0, 'REPLACE')


def build():
    clear()
    mats = {k: material(k, v, 0.25 if k == 'visor' else 0.9) for k, v in COLORS.items()}
    mats['flag'] = flag_material()
    rig = armature()

    suit = body(mats)
    bpy.ops.object.select_all(action='DESELECT')
    suit.select_set(True)
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')

    for ob, bone in helmet(mats) + gear(mats) + wear_decals():
        rigid(ob, bone)
        ob.select_set(True)
    suit.select_set(True)
    rig.select_set(False)
    bpy.context.view_layer.objects.active = suit
    bpy.ops.object.join()
    suit.name = suit.data.name = 'LouGnar'
    for p in suit.data.polygons:
        p.use_smooth = False
    return rig, suit


def export():
    os.makedirs(os.path.dirname(GLB), exist_ok=True)
    bpy.ops.object.select_all(action='DESELECT')
    for ob in bpy.data.objects:  # the rig and the suit; the board is its own GLB (board.glb)
        ob.select_set(ob.type == 'ARMATURE' or ob.name == 'LouGnar')
    bpy.ops.export_scene.gltf(
        filepath=GLB,
        export_format='GLB',
        use_selection=True,
        export_yup=True,
        export_skins=True,
        export_animations=True,
        export_animation_mode='ACTIONS',
        export_force_sampling=True,
        export_frame_step=1,
        export_apply=True,
        export_materials='EXPORT',
    )
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)


# three.js (Y up) to Blender (Z up). A baked bone matrix becomes a Blender bone matrix as A @ m: the exporter turns
# bone axes as well as positions. The board's is an object matrix, A @ m @ A^-1.
A = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))


def board(rig):
    """The board from board.glb, parented to the Board bone so it follows the clips in Blender (not exported here)."""
    if not os.path.exists(BOARD_GLB):
        return None
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=BOARD_GLB)
    parts = [o for o in bpy.data.objects if o not in before and o.type == 'MESH']
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts:
        o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    if len(parts) > 1:
        bpy.ops.object.join()
    ob = parts[0]
    ob.name = 'Board'
    for o in set(bpy.data.objects) - before - {ob}:
        bpy.data.objects.remove(o)
    ob.parent = None
    ob.matrix_world = Matrix.Translation((0, 0, BOARD_TOP))
    ob.parent = rig
    ob.parent_type = 'BONE'
    ob.parent_bone = 'Board'
    bpy.context.view_layer.update()
    ob.matrix_world = Matrix.Translation((0, 0, BOARD_TOP))
    return ob


def actions(rig):
    """One action per clip baked from the game (art/anim/clips.json): keys on every frame for every bone."""
    if not os.path.exists(CLIPS):
        return []
    import json
    data = json.load(open(CLIPS))
    bones = rig.data.bones
    mat = lambda e: Matrix([[e[c * 4 + r] for c in range(4)] for r in range(4)])
    scene = bpy.context.scene
    scene.render.fps = data['fps']
    rig.animation_data_create()
    made = []
    for name, clip in data['clips'].items():
        act = bpy.data.actions.new(name)
        act.use_fake_user = True
        rig.animation_data.action = act
        prev = {}
        for f, frame in enumerate(clip['frames']):
            posed = {}
            for bone in bones:  # parents come before children
                if bone.name == 'Board':
                    m = A @ mat(frame['Board']) @ A.inverted() @ bone.matrix_local
                else:
                    m = A @ mat(frame[bone.name])
                posed[bone.name] = m
                if bone.parent:
                    rest = bone.parent.matrix_local.inverted() @ bone.matrix_local
                    basis = rest.inverted() @ posed[bone.parent.name].inverted() @ m
                else:
                    basis = bone.matrix_local.inverted() @ m
                loc, rot, _ = basis.decompose()
                if bone.name in prev and rot.dot(prev[bone.name]) < 0:
                    rot.negate()  # the short way round between keys
                prev[bone.name] = rot
                pb = rig.pose.bones[bone.name]
                pb.rotation_mode = 'QUATERNION'
                pb.location, pb.rotation_quaternion = loc, rot
                pb.keyframe_insert('location', frame=f + 1, group=bone.name)
                pb.keyframe_insert('rotation_quaternion', frame=f + 1, group=bone.name)
        act.use_frame_range = True
        act.frame_range = (1, max(2, len(clip['frames'])))
        act.use_cyclic = clip['loop']
        track = rig.animation_data.nla_tracks.new()
        track.name = name
        track.strips.new(name, 1, act)
        track.mute = True
        made.append(act)
    rig.animation_data.action = data['clips'].get('ride') and bpy.data.actions.get('ride')
    return made


if __name__ == '__main__' and '--export-only' in sys.argv:
    export()
    print('wrote', GLB)
elif __name__ == '__main__':
    rig, suit = build()
    tris = sum(len(p.vertices) - 2 for p in suit.data.polygons)
    print(f'LouGnar: {len(suit.data.vertices)} verts, {tris} tris, {len(rig.data.bones)} bones')
    # the board (to see the clips in Blender) and the clips as actions, which the GLB carries to the game
    deck = board(rig)
    acts = actions(rig)
    print(f'{len(acts)} actions, board {"in" if deck else "missing"}')
    rig.animation_data.action = None
    export()
    print('wrote', GLB)
