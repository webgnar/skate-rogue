# Builds the people on the sidewalk and exports public/models/peds.glb. They stand and stroll along the back of the
# street and react to the skater (src/render/peds.ts): turn to watch, hold a phone up to film, cheer a landing,
# flinch at a slam. The game recolours them per person and skins the parts to a little skeleton of its own.
#
#   blender -b -P art/pedestrians.py            (or run it from Blender's Text Editor; it rebuilds the scene)
#
# Units are tiles (Lou is about 2 tall), same axes as the other models: -Y faces the game camera (the people face
# it), Z is up. Each part is its own object with its origin at its joint, so the game can turn it there:
#   PedTorso      hips to shoulders, origin at the hips
#   PedLeg        one leg and shoe, origin at the hip joint (the game uses it for both)
#   PedArmL/R     arm and hand, origin at the shoulder; the right hand holds a phone
#   PedHeadShort / PedHeadLong / PedHeadCap   neck, head and hair, origin at the base of the neck
#   PedHeadWreath (Greece: short hair and a laurel wreath), PedHeadHelmet (space: a white helmet with a dark visor)
# Materials are named for what the game recolours: pedTop, pedPants, pedSkin, pedHair, pedShoe (and pedPhone,
# pedScreen, pedLeaf, pedHelm, pedVisor, which keep their colour).
import math
import os
import sys

import bpy  # first: the bpy module provides bmesh and mathutils
import bmesh

HERE = os.path.dirname(os.path.abspath(__file__)) if '__file__' in dir() else bpy.path.abspath('//')
sys.path.insert(0, HERE)
from cars import box, join, link, material  # noqa: E402  (shared helpers)

ROOT = os.path.dirname(HERE)
GLB = os.path.join(ROOT, 'public', 'models', 'peds.glb')
BLEND = os.path.join(HERE, 'pedestrians.blend')

HIP_Z = 0.95
SHOULDER = (0.26, 1.5)  # x out from the middle, z
NECK_Z = 1.56
HIP_X = 0.1

COLORS = {
    'pedTop': 0x3A7BE8,
    'pedPants': 0x2A2A34,
    'pedSkin': 0xC8946A,
    'pedHair': 0x2A1A10,
    'pedShoe': 0xF0F0F0,
    'pedPhone': 0x16161C,
    'pedScreen': 0x8AD8FF,  # glows
    'pedLeaf': 0x5A9A3A,
    'pedHelm': 0xF2F2F4,
    'pedVisor': 0x1A2A48,
}


def blob(bm, scale, at, u=10, v=7, keep=None):
    tmp = bmesh.new()
    bmesh.ops.create_uvsphere(tmp, u_segments=u, v_segments=v, radius=1)
    bmesh.ops.scale(tmp, vec=scale, verts=tmp.verts)
    if keep:
        bmesh.ops.delete(tmp, geom=[f for f in tmp.faces if not keep(f.calc_center_median())], context='FACES')
    bmesh.ops.translate(tmp, verts=tmp.verts, vec=at)
    me = bpy.data.meshes.new('tmp')
    tmp.to_mesh(me)
    tmp.free()
    bm.from_mesh(me)
    bpy.data.meshes.remove(me)


def torso(m):
    """Hips to shoulders, origin at the hips: a top over a pelvis in the pants colour."""
    parts = []
    bm = bmesh.new()
    box(bm, -0.2, 0.2, -0.12, 0.12, 0.04, 0.5)  # chest, a little broad at the shoulders
    box(bm, -0.25, 0.25, -0.12, 0.12, 0.38, 0.6)
    parts.append(link('pedTop', bm, m['pedTop']))
    bm = bmesh.new()
    box(bm, -0.19, 0.19, -0.11, 0.11, -0.08, 0.06)
    parts.append(link('pedPants', bm, m['pedPants']))
    return join(parts, 'PedTorso')


def leg(m):
    """One leg, origin at the hip joint, the shoe's toe toward the camera."""
    parts = []
    bm = bmesh.new()
    box(bm, -0.075, 0.075, -0.085, 0.085, -HIP_Z + 0.08, 0.0)
    parts.append(link('pedPants', bm, m['pedPants']))
    bm = bmesh.new()
    box(bm, -0.08, 0.08, -0.17, 0.09, -HIP_Z, -HIP_Z + 0.09)
    parts.append(link('pedShoe', bm, m['pedShoe']))
    return join(parts, 'PedLeg')


def arm(m, side):
    """An arm hanging from the shoulder, sleeve then forearm then hand; the right hand holds a phone."""
    s = 1 if side == 'R' else -1
    parts = []
    bm = bmesh.new()
    box(bm, -0.06, 0.06, -0.065, 0.065, -0.3, 0.04)  # sleeve
    parts.append(link('pedTop', bm, m['pedTop']))
    bm = bmesh.new()
    box(bm, -0.05, 0.05, -0.055, 0.055, -0.58, -0.3)  # forearm
    blob(bm, (0.06, 0.06, 0.07), (0, 0, -0.63), 6, 4)  # hand
    parts.append(link('pedSkin', bm, m['pedSkin']))
    if side == 'R':
        bm = bmesh.new()
        box(bm, -0.035, 0.035, -0.09, -0.07, -0.74, -0.58)  # held in front of the hand, its back to the camera
        parts.append(link('pedPhone', bm, m['pedPhone']))
        bm = bmesh.new()
        box(bm, -0.028, 0.028, -0.07, -0.065, -0.725, -0.595)  # screen, facing the hand (the person)
        parts.append(link('pedScreen', bm, m['pedScreen']))
    ob = join(parts, f'PedArm{side}')
    return ob


def head(m, hair):
    """Neck, head and hair, origin at the base of the neck. hair: 'short', 'long' or 'cap'."""
    parts = []
    bm = bmesh.new()
    box(bm, -0.055, 0.055, -0.05, 0.05, 0.0, 0.1)  # neck
    blob(bm, (0.14, 0.15, 0.17), (0, 0, 0.24), 10, 7)  # head
    box(bm, -0.025, 0.025, -0.19, -0.13, 0.2, 0.27)  # nose
    parts.append(link('pedSkin', bm, m['pedSkin']))
    bm = bmesh.new()
    if hair == 'cap':
        blob(bm, (0.155, 0.165, 0.12), (0, 0.0, 0.31), 10, 6, keep=lambda c: c.z > -0.01)  # crown
        box(bm, -0.11, 0.11, -0.31, -0.12, 0.3, 0.33)  # brim, toward the camera
        parts.append(link('pedTop', bm, m['pedTop']))
        bm = bmesh.new()
        blob(bm, (0.15, 0.16, 0.1), (0, 0.02, 0.24), 8, 5, keep=lambda c: c.y > 0.02)  # hair at the back
    elif hair == 'wreath':
        blob(bm, (0.155, 0.165, 0.15), (0, 0.015, 0.27), 10, 6, keep=lambda c: c.z > 0.02 or c.y > 0.05)
        parts.append(link('pedHair', bm, m['pedHair']))
        bm = bmesh.new()
        for i in range(14):  # leaves round the crown, a gap at the front
            a = 2 * math.pi * (i + 0.5) / 16 + math.pi / 2 + math.pi / 8
            c = (0.16 * math.cos(a), 0.17 * math.sin(a), 0.31 + 0.02 * (i % 2))
            box(bm, c[0] - 0.03, c[0] + 0.03, c[1] - 0.03, c[1] + 0.03, c[2] - 0.02, c[2] + 0.02)
        ob = join(parts + [link('pedLeaf', bm, m['pedLeaf'])], 'PedHeadWreath')
        return ob
    elif hair == 'helmet':
        blob(bm, (0.155, 0.165, 0.15), (0, 0.015, 0.27), 10, 6, keep=lambda c: c.z > 0.02 or c.y > 0.05)
        parts.append(link('pedHair', bm, m['pedHair']))
        bm = bmesh.new()
        blob(bm, (0.23, 0.23, 0.23), (0, 0, 0.25), 12, 8)  # the shell
        parts.append(link('pedHelm', bm, m['pedHelm']))
        bm = bmesh.new()
        blob(bm, (0.17, 0.06, 0.12), (0, -0.19, 0.26), 10, 6)  # the visor, a dark dome on the front
        parts.append(link('pedVisor', bm, m['pedVisor']))
        bm = bmesh.new()
        box(bm, -0.17, 0.17, -0.17, 0.17, 0.0, 0.06)  # the collar ring, in the top's colour
        parts.append(link('pedTop', bm, m['pedTop']))
        return join(parts, 'PedHeadHelmet')
    elif hair == 'long':
        blob(bm, (0.16, 0.17, 0.16), (0, 0.02, 0.27), 10, 6, keep=lambda c: c.z > 0.0 or c.y > 0.02)
        box(bm, -0.15, 0.15, 0.02, 0.16, -0.05, 0.25)  # down the back to the shoulders
    else:
        blob(bm, (0.155, 0.165, 0.15), (0, 0.015, 0.27), 10, 6, keep=lambda c: c.z > 0.02 or c.y > 0.05)
    parts.append(link('pedHair', bm, m['pedHair']))
    name = {'short': 'PedHeadShort', 'long': 'PedHeadLong', 'cap': 'PedHeadCap'}[hair]
    return join(parts, name)


def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    m = {k: material(k, v) for k, v in COLORS.items()}
    obs = [torso(m), leg(m), arm(m, 'L'), arm(m, 'R'), head(m, 'short'), head(m, 'long'), head(m, 'cap'),
           head(m, 'wreath'), head(m, 'helmet')]
    # assembled in the file as one person standing, for a look; the game reads each part from its origin
    at = {'PedTorso': (0, 0, HIP_Z), 'PedLeg': (HIP_X, 0, HIP_Z), 'PedArmL': (-SHOULDER[0], 0, SHOULDER[1]),
          'PedArmR': (SHOULDER[0], 0, SHOULDER[1]), 'PedHeadShort': (0, 0, NECK_Z), 'PedHeadLong': (1, 0, NECK_Z),
          'PedHeadCap': (2, 0, NECK_Z), 'PedHeadWreath': (3, 0, NECK_Z), 'PedHeadHelmet': (4, 0, NECK_Z)}
    for ob in obs:
        ob.location = at[ob.name]
    return obs


def export():
    os.makedirs(os.path.dirname(GLB), exist_ok=True)
    locs = {ob.name: ob.location.copy() for ob in bpy.data.objects}
    for ob in bpy.data.objects:
        ob.location = (0, 0, 0)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=GLB, export_format='GLB', use_selection=True, export_yup=True, export_apply=True)
    for ob in bpy.data.objects:
        ob.location = locs[ob.name]
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)


if __name__ == '__main__':
    for ob in build():
        bm = bmesh.new()
        bm.from_mesh(ob.data)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(ob.data)
        bm.free()
        for p in ob.data.polygons:
            p.use_smooth = False
        tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
        print(f'{ob.name}: {tris} tris')
    export()
    print('wrote', GLB)
