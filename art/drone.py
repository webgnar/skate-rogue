# Builds the enforcer drone in Blender and exports public/models/drone.glb. It drops in ahead of the skater at high
# Heat and watches them: an armoured quad with ducted rotors, a camera gimbal with a red eye looking back at the
# skater, and police nav lights.
#
#   blender -b -P art/drone.py            (or run it from Blender's Text Editor; it rebuilds the scene)
#
# Units are tiles, same axes as the other models: +X is the way the skater rolls (the drone faces -X, back at
# them), -Y faces the game camera, Z is up. Objects: `Drone` (the body, origin at its middle) and `Rotor0`..`Rotor3`
# (one propeller each, origin at its hub, so the game can spin them about Z).
import math
import os

import bpy  # first: the bpy module provides bmesh and mathutils
import bmesh
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__)) if '__file__' in dir() else bpy.path.abspath('//')
ROOT = os.path.dirname(HERE)
GLB = os.path.join(ROOT, 'public', 'models', 'drone.glb')
BLEND = os.path.join(HERE, 'drone.blend')

ARM = 0.5  # hub distance from the middle, on the diagonals
DUCT_R = 0.24
HUB_Z = 0.04

COLORS = {
    'shell': 0x23252D,
    'armor': 0x3A3E4A,
    'trim': 0x101116,
    'stripe': 0xD9302E,
    'eye': 0xFF2A2A,  # glows
    'navRed': 0xFF3030,  # glows
    'navBlue': 0x2F6BFF,  # glows
    'lens': 0x07070A,
    'blade': 0x9AA0B0,
}


def hex_rgba(h):
    srgb = [((h >> sh) & 255) / 255 for sh in (16, 8, 0)]
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb]
    return (*lin, 1.0)


def material(name, color):
    m = bpy.data.materials.new(name)
    m.diffuse_color = hex_rgba(color)
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = hex_rgba(color)
    bsdf.inputs['Roughness'].default_value = 0.35
    return m


def link(name, bm, mat):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def boxv(bm, size, at, bevel=0.0, rot=None):
    """A box (chamfered if bevel) built on its own, then appended to bm."""
    tmp = bmesh.new()
    bmesh.ops.create_cube(tmp, size=1)
    bmesh.ops.scale(tmp, vec=size, verts=tmp.verts)
    if bevel:
        bmesh.ops.bevel(tmp, geom=tmp.edges[:], offset=bevel, segments=1, affect='EDGES')
    if rot:
        bmesh.ops.rotate(tmp, verts=tmp.verts, cent=(0, 0, 0), matrix=rot)
    bmesh.ops.translate(tmp, verts=tmp.verts, vec=at)
    me = bpy.data.meshes.new('tmp')
    tmp.to_mesh(me)
    tmp.free()
    bm.from_mesh(me)
    bpy.data.meshes.remove(me)


def cyl(bm, r, depth, at, segs=12, r2=None, rot=None):
    vs = bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=r, radius2=r if r2 is None else r2, depth=depth)['verts']
    if rot:
        bmesh.ops.rotate(bm, verts=vs, cent=(0, 0, 0), matrix=rot)
    bmesh.ops.translate(bm, verts=vs, vec=at)


def ring(bm, r, width, height, at, segs=20):
    """A duct: a short open tube inside a shorter, wider band."""
    for rr, h, z in ((r, height, 0.0), (r + width, height * 0.6, 0.0)):
        vs = bmesh.ops.create_cone(bm, cap_ends=False, segments=segs, radius1=rr, radius2=rr, depth=h)['verts']
        bmesh.ops.translate(bm, verts=vs, vec=Vector(at) + Vector((0, 0, z)))


def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    mats = {k: material(k, v) for k, v in COLORS.items()}
    parts = []

    bm = bmesh.new()  # the fuselage: a flattened, chamfered pod, nose toward -X
    boxv(bm, (0.62, 0.4, 0.16), (0, 0, 0), bevel=0.05)
    boxv(bm, (0.36, 0.3, 0.08), (0.04, 0, 0.11), bevel=0.03)  # dorsal hump with the battery
    hubs = [(sx * ARM * 0.72, sy * ARM * 0.72) for sx in (1, -1) for sy in (1, -1)]
    for hx, hy in hubs:  # arms out to the motor pods
        ang = math.atan2(hy, hx)
        length = math.hypot(hx, hy)
        boxv(bm, (length, 0.07, 0.05), (hx / 2, hy / 2, 0.0), rot=Matrix.Rotation(ang, 3, 'Z'))
    parts.append(link('shell', bm, mats['shell']))

    bm = bmesh.new()  # armour plates on the flanks and a skid on each side
    for sy in (1, -1):
        boxv(bm, (0.5, 0.03, 0.1), (0.02, sy * 0.21, -0.01), bevel=0.01)
        boxv(bm, (0.5, 0.03, 0.025), (0.0, sy * 0.17, -0.2))
        for sx in (0.15, -0.15):
            boxv(bm, (0.025, 0.025, 0.12), (sx, sy * 0.17, -0.14))
    for hx, hy in hubs:
        cyl(bm, 0.055, 0.1, (hx, hy, HUB_Z - 0.02), segs=10)  # motor pods
    parts.append(link('armor', bm, mats['armor']))

    bm = bmesh.new()  # ducts round the rotors
    for hx, hy in hubs:
        ring(bm, DUCT_R, 0.025, 0.07, (hx, hy, HUB_Z + 0.02))
    parts.append(link('duct', bm, mats['trim']))

    bm = bmesh.new()  # red enforcer stripe down the back
    boxv(bm, (0.38, 0.06, 0.012), (0.04, 0, 0.155))
    for sy in (1, -1):
        boxv(bm, (0.42, 0.006, 0.03), (0.02, sy * 0.2255, 0.03))
    parts.append(link('stripe', bm, mats['stripe']))

    # camera gimbal under the nose, its lens looking back at the skater (-X) and a little down
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=8, radius=0.085)
    bmesh.ops.translate(bm, verts=bm.verts, vec=(-0.22, 0, -0.12))
    cyl(bm, 0.03, 0.05, (-0.22, 0, -0.07), segs=8)  # mount
    parts.append(link('gimbal', bm, mats['trim']))
    tilt = Matrix.Rotation(-math.pi / 2 - 0.35, 3, 'Y')  # cylinder axis Z turned to point -X, dipped down
    bm = bmesh.new()
    cyl(bm, 0.05, 0.06, (-0.29, 0, -0.145), segs=12, rot=tilt)
    parts.append(link('lens', bm, mats['lens']))
    bm = bmesh.new()
    cyl(bm, 0.032, 0.012, (-0.322, 0, -0.157), segs=12, rot=tilt)
    # a slit of red sensor eyes across the nose too
    boxv(bm, (0.012, 0.22, 0.025), (-0.316, 0, 0.02))
    parts.append(link('eye', bm, mats['eye']))

    bm = bmesh.new()  # nav lights under the back arms (red, camera side blue)
    cyl(bm, 0.025, 0.03, (hubs[0][0], hubs[0][1], HUB_Z - 0.085), segs=8)
    cyl(bm, 0.025, 0.03, (hubs[2][0], hubs[2][1], HUB_Z - 0.085), segs=8)
    parts.append(link('navRed', bm, mats['navRed']))
    bm = bmesh.new()
    cyl(bm, 0.025, 0.03, (hubs[1][0], hubs[1][1], HUB_Z - 0.085), segs=8)
    cyl(bm, 0.025, 0.03, (hubs[3][0], hubs[3][1], HUB_Z - 0.085), segs=8)
    parts.append(link('navBlue', bm, mats['navBlue']))

    bpy.ops.object.select_all(action='DESELECT')
    for ob in parts:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    body = parts[0]
    body.name = body.data.name = 'Drone'

    rotors = []
    for i, (hx, hy) in enumerate(hubs):  # two-blade props with a pitch twist, spun in game
        bm2 = bmesh.new()
        for a in (0, math.pi):
            vs = bmesh.ops.create_cube(bm2, size=1)['verts']
            bmesh.ops.scale(bm2, vec=(0.2, 0.045, 0.008), verts=vs)
            bmesh.ops.rotate(bm2, verts=vs, cent=(0, 0, 0), matrix=Matrix.Rotation(0.25, 3, 'X'))
            bmesh.ops.translate(bm2, verts=vs, vec=(0.11, 0, 0))
            bmesh.ops.rotate(bm2, verts=vs, cent=(0, 0, 0), matrix=Matrix.Rotation(a, 3, 'Z'))
        cyl(bm2, 0.022, 0.03, (0, 0, 0), segs=8)
        ob = link(f'Rotor{i}', bm2, mats['blade'])
        ob.location = (hx, hy, HUB_Z + 0.03)
        rotors.append(ob)

    for ob in [body] + rotors:
        for p in ob.data.polygons:
            p.use_smooth = False
    return body, rotors


def export():
    os.makedirs(os.path.dirname(GLB), exist_ok=True)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=GLB, export_format='GLB', use_selection=True, export_yup=True, export_apply=True)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)


if __name__ == '__main__':
    body, rotors = build()
    tris = sum(len(p.vertices) - 2 for ob in [body] + rotors for p in ob.data.polygons)
    print(f'Drone: {tris} tris')
    export()
    print('wrote', GLB)
