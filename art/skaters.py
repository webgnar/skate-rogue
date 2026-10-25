# Builds the QFS skaters (Webster, Keanu, Roxy, Goldie) on Lou Gnar's rig and exports public/models/<name>.glb.
#
#   blender -b -P art/skaters.py                 (all four)
#   blender -b -P art/skaters.py -- roxy         (one)
#
# Each skater is one skinned mesh on the same 20-bone armature and bind pose as art/lou_gnar.py, so the game plays
# Lou's clips (the actions in lou-gnar.glb) on them unchanged; their GLBs carry no animation. Looks follow the QFS
# title cast art (QFSHIVE art_source/title_cast), minus the swords and shields: Gnar Run has no combat.
import math
import os
import sys

import bpy  # first: the bpy module provides bmesh and mathutils
import bmesh
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lou_gnar as lg  # noqa: E402  (the rig, the bind pose and the mesh helpers)
from lou_gnar import ANKLE_Z, ARM_X, ELBOW_Z, HAND_Z, HEAD_Z, HIP_X, HIP_Z, KNEE_Z, PELVIS, SHOULDER_Z, SPINE  # noqa: E402

OUT = os.path.join(lg.ROOT, 'public', 'models')
HEAD_C = Vector((0, 0, HEAD_Z + 0.14))  # middle of the head
HEAD_R = 0.12

# top: what covers the chest ('skin' for none); crop: the top stops above the navel; sleeves: none, short or long;
# flare: how far the trouser legs widen at the ankle; hair: 'long', 'hood' (hood up over short hair) or 'bun'
SKATERS = {
    'webster': {
        'skin': 0xD9945A, 'top': 'skin', 'sleeves': 'none', 'pants': 0x25252B, 'shoe': 0x18181D, 'sole': 0x2B44C8,
        'hair': 'long', 'hairColor': 0xE8C25A, 'shades': 0xE0322E, 'build': 1.08,
    },
    'keanu': {
        'skin': 0x6B4128, 'top': 0x8C8C92, 'sleeves': 'long', 'pants': 0x2E2E34, 'shoe': 0x1C1C22, 'sole': 0x2B44C8,
        'hair': 'hood', 'hairColor': 0x1A1410, 'build': 1.04,
    },
    'roxy': {
        'skin': 0xF0C29E, 'top': 0x7A2FB8, 'crop': True, 'sleeves': 'none', 'pants': 0x2D4E9A, 'shoe': 0x6C2FA8,
        'sole': 0xF2F2F2, 'hair': 'long', 'hairColor': 0x9A4A22, 'build': 0.94,
    },
    # Goldie skates quads in QFS. Gnar Run's moves are all board tricks, so she rides a board here, in purple
    # high-tops with orange soles, her skates' colours (docs/overnight-decisions.md)
    'goldie': {
        'skin': 0x5E3A22, 'top': 0xB9A6E0, 'crop': True, 'sleeves': 'none', 'pants': 0x7EC4EC, 'flare': 0.05,
        'shoe': 0x6C2FA8, 'sole': 0xF07A1E, 'hair': 'long', 'hairColor': 0xF2D25A, 'build': 0.94,
    },
}


def body(spec, mats):
    """Skin-modifier figure like Lou's suit but slimmer, then coloured by region: skin, top, sleeves, trousers."""
    b = spec['build']
    flare = spec.get('flare', 0)
    # (position, radius across x, radius in depth y)
    verts = [
        ((0, 0, PELVIS - 0.02), 0.15 * b, 0.11),  # 0 pelvis
        ((0, 0, SPINE + 0.06), 0.13 * b, 0.095),  # 1 waist
        ((0, 0, SPINE + 0.28), 0.165 * b, 0.11),  # 2 chest
        ((0, 0, SPINE + 0.44), 0.17 * b, 0.1),  # 3 shoulders
        ((0, 0, SPINE + 0.54), 0.055, 0.055),  # 4 neck
    ]
    edges = [(0, 1), (1, 2), (2, 3), (3, 4)]
    for s in (1, -1):
        i = len(verts)
        verts += [
            ((s * (ARM_X - 0.03), 0, SHOULDER_Z - 0.01), 0.078 * b, 0.075),  # shoulder
            ((s * ARM_X, 0, ELBOW_Z), 0.06 * b, 0.058),  # elbow
            ((s * ARM_X, 0, HAND_Z + 0.05), 0.047, 0.047),  # wrist
            ((s * HIP_X, 0, HIP_Z - 0.04), 0.1, 0.1),  # hip
            ((s * HIP_X, 0, KNEE_Z), 0.08 + flare * 0.3, 0.08 + flare * 0.3),  # knee
            ((s * HIP_X, 0, ANKLE_Z + 0.03), 0.065 + flare, 0.065 + flare),  # ankle (the trouser cuff)
        ]
        edges += [(3, i), (i, i + 1), (i + 1, i + 2), (0, i + 3), (i + 3, i + 4), (i + 4, i + 5)]
    me = bpy.data.meshes.new('body')
    me.from_pydata([v[0] for v in verts], edges, [])
    ob = bpy.data.objects.new('body', me)
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

    top = mats['skin'] if spec['top'] == 'skin' else mats['top']
    slots = [mats['skin'], top, mats['pants']]
    for m in slots:
        me.materials.append(m)
    waist = SPINE + 0.03  # trousers up to here
    crop = SPINE + 0.2 if spec.get('crop') else waist  # a crop top stops here, the midriff shows below
    sleeve = {'none': 99, 'short': SHOULDER_Z - 0.12, 'long': -99}[spec['sleeves']]
    for p in me.polygons:
        c = p.center
        if abs(c.x) > 0.205 and c.z > HIP_Z:  # arm, down to the wrist
            p.material_index = 1 if c.z > sleeve else 0
        elif c.z > SPINE + 0.5:  # neck
            p.material_index = 0
        elif c.z > crop:
            p.material_index = 1
        elif c.z > waist:
            p.material_index = 0
        else:
            p.material_index = 2
    return ob


def sphere(name, r, at, mat, scale=(1, 1, 1), keep=None, seg=(14, 10)):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg[0], v_segments=seg[1], radius=r)
    bmesh.ops.scale(bm, vec=scale, verts=bm.verts)
    if keep:
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if not keep(f.calc_center_median())], context='FACES')
    bmesh.ops.translate(bm, verts=bm.verts, vec=at)
    return lg.link(name, bm, [mat])


def head(spec, mats):
    parts = [(sphere('head', HEAD_R, HEAD_C, mats['skin'], (0.9, 1, 1.12)), 'Head')]
    # eyes, or Webster's red shades
    if spec.get('shades'):
        parts.append((lg.box('shades', (0.2, 0.03, 0.045), HEAD_C + Vector((0, -0.115, 0.02)), mats['shades'], 0.01), 'Head'))
    else:
        for s in (1, -1):
            parts.append((lg.box(f'eye{s}', (0.028, 0.02, 0.03), HEAD_C + Vector((s * 0.042, -0.115, 0.02)), mats['eye']), 'Head'))
    hair = mats['hair']
    if spec['hair'] == 'hood':
        # a grey hood up over the head, open round the face, and short dark hair showing at the brow
        def open_face(p):
            return not (p.y < -0.05 and -0.13 < p.z < 0.1 and abs(p.x) < 0.11)
        parts.append((sphere('hood', HEAD_R + 0.035, HEAD_C + Vector((0, 0.012, 0.01)), mats['top'], (0.95, 1.05, 1.1), open_face), 'Head'))
        parts.append((sphere('fringe', HEAD_R + 0.008, HEAD_C, hair, (0.9, 1, 1.12), lambda p: p.z > 0.07), 'Head'))
    else:
        # a cap over the crown and back of the head, and the long hair falling down the back past the shoulders
        def crown(p):
            return p.z > 0.04 or p.y > 0.0
        parts.append((sphere('hair', HEAD_R + 0.015, HEAD_C, hair, (0.95, 1.02, 1.12), crown), 'Head'))
        parts.append((sphere('mane', 0.15, HEAD_C + Vector((0, 0.06, -0.2)), hair, (1.05, 0.5, 1.5)), 'Head'))
    return parts


def feet(spec, mats):
    parts = []
    for side, s in (('Left', 1), ('Right', -1)):
        parts.append((sphere(f'hand{side}', 0.045, (s * ARM_X, 0, HAND_Z), mats['skin'], (0.9, 1, 1.3), seg=(8, 6)), f'{side}Hand'))
        # sneakers: the same box as Lou's shoes, a touch slimmer
        y = -0.06
        parts += lg.shoe_parts(f'shoe{side}', side, (0.11, 0.26, 0.095), (s * HIP_X, y, ANKLE_Z - 0.075 + 0.058), mats['shoe'], 0.015)
        parts += lg.shoe_parts(f'sole{side}', side, (0.118, 0.272, 0.024), (s * HIP_X, y, ANKLE_Z - 0.075 + 0.012), mats['sole'])
    return parts


def build(name, spec):
    lg.clear()
    colors = {k: spec[k] for k in ('skin', 'pants', 'shoe', 'sole', 'hairColor')}
    if spec['top'] != 'skin':
        colors['top'] = spec['top']
    if spec.get('shades'):
        colors['shades'] = spec['shades']
    colors['eye'] = 0x16121A
    mats = {('hair' if k == 'hairColor' else k): lg.material(k, v) for k, v in colors.items()}
    rig = lg.armature()
    rig.name = rig.data.name = f'{name}Rig'
    ob = body(spec, mats)
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    for part, bone in head(spec, mats) + feet(spec, mats) + lg.wear_decals(0.11, -0.06):
        lg.rigid(part, bone)
        part.select_set(True)
    ob.select_set(True)
    rig.select_set(False)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.join()
    ob.name = ob.data.name = name.capitalize()
    for p in ob.data.polygons:
        p.use_smooth = False
    return rig, ob


def export(name):
    path = os.path.join(OUT, f'{name}.glb')
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format='GLB',
        use_selection=True,
        export_yup=True,
        export_skins=True,
        export_animations=False,  # they play Lou's clips
        export_apply=True,
        export_materials='EXPORT',
    )
    return path


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    for name in args or SKATERS:
        rig, ob = build(name, SKATERS[name])
        tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
        print(f'{name}: {len(ob.data.vertices)} verts, {tris} tris -> {export(name)}')
