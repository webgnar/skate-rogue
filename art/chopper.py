# Builds the AI's helicopter in Blender and exports public/models/chopper.glb. It hunts the skater on the
# helicopter escape, high over the street with its searchlight on them: a dark gunship-ish pod with a tinted canopy,
# the AI's red eye slit across its nose, a searchlight pod under the chin, skids, a tail boom with a fin and
# stabiliser, and nav lights.
#
#   blender -b -P art/chopper.py            (or run it from Blender's Text Editor; it rebuilds the scene)
#
# Units are tiles, at the size the game draws it (no scaling in game). Axes as the other models: +X is the way the
# skater rolls and the nose points that way, -Y faces the game camera, Z is up. Objects: `Chopper` (the body, origin
# at the middle of the cabin), `ChopperRotor` (the main rotor, origin at its hub, spun about Z) and `ChopperTail`
# (the tail rotor on the camera side of the fin, origin at its hub, spun about Y).
import math
import os

import bpy  # first: the bpy module provides bmesh and mathutils
import bmesh
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__)) if '__file__' in dir() else bpy.path.abspath('//')
ROOT = os.path.dirname(HERE)
GLB = os.path.join(ROOT, 'public', 'models', 'chopper.glb')
BLEND = os.path.join(HERE, 'chopper.blend')

HUB = (0.0, 0.0, 0.86)  # main rotor hub
TAIL_HUB = (-2.82, -0.14, 0.42)  # tail rotor hub, camera side of the fin
BLADE = 2.35  # main rotor radius

# named apart from the drone's and the cars' colours: the game shares materials by name (src/render/models.ts)
COLORS = {
    'chShell': 0x1D1F28,
    'chArmor': 0x343846,
    'chTrim': 0x0E0F14,
    'chGlass': 0x22324A,
    'stripe': 0xD9302E,
    'eye': 0xFF2A2A,  # glows
    'lamp': 0xFFF2B0,  # glows: the searchlight's lens
    'navRed': 0xFF3030,  # glows
    'navBlue': 0x2F6BFF,  # glows
    'chBlade': 0x5A5F6C,
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


def blob(bm, scale, at, u=14, v=9, keep=None):
    """A squashed sphere; keep(co) drops the faces whose middle fails it (to cut a canopy out of one)."""
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


ALONG_X = Matrix.Rotation(math.pi / 2, 3, 'Y')  # a cylinder's Z axis turned to run along X
ALONG_Y = Matrix.Rotation(math.pi / 2, 3, 'X')


def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    mats = {k: material(k, v) for k, v in COLORS.items()}
    parts = []

    # the cabin pod, nose to +X, and the boom tapering back to the tail
    bm = bmesh.new()
    blob(bm, (1.05, 0.5, 0.52), (0, 0, 0))
    cyl(bm, 0.2, 2.0, (-1.75, 0, 0.18), segs=10, r2=0.09, rot=Matrix.Rotation(-math.pi / 2, 3, 'Y'))
    boxv(bm, (0.7, 0.42, 0.24), (-0.05, 0, 0.5), bevel=0.06)  # engine housing on the roof
    cyl(bm, 0.07, 0.3, (0, 0, 0.7), segs=8)  # rotor mast
    parts.append(link('chShell', bm, mats['chShell']))

    # the tinted canopy: the front-top of a slightly bigger blob
    bm = bmesh.new()
    blob(bm, (1.07, 0.52, 0.54), (0.02, 0, 0.0), keep=lambda c: c.x > 0.35 and c.z > -0.1)
    parts.append(link('chGlass', bm, mats['chGlass']))

    # armour: engine intakes, the stub wings, the fin and stabiliser, the searchlight pod, the hub
    bm = bmesh.new()
    for sy in (1, -1):
        cyl(bm, 0.11, 0.18, (0.28, sy * 0.2, 0.5), segs=10, rot=ALONG_X)  # intakes
        boxv(bm, (0.36, 0.5, 0.05), (-0.25, sy * 0.68, -0.08), bevel=0.015)  # stub wings
        cyl(bm, 0.07, 0.36, (-0.25, sy * 0.86, -0.17), segs=8, rot=ALONG_X)  # wing pods
    boxv(bm, (0.12, 0.05, 0.62), (-2.68, 0, 0.42), bevel=0.02, rot=Matrix.Rotation(-0.35, 3, 'Y'))  # fin, raked
    boxv(bm, (0.26, 0.7, 0.04), (-2.35, 0, 0.18), bevel=0.01)  # stabiliser
    cyl(bm, 0.13, 0.22, (0.66, 0, -0.5), segs=12)  # searchlight pod under the chin
    cyl(bm, 0.05, 0.14, (0.66, 0, -0.38), segs=8)
    cyl(bm, 0.12, 0.08, HUB, segs=10)  # main hub
    parts.append(link('chArmor', bm, mats['chArmor']))

    # skids on struts
    bm = bmesh.new()
    for sy in (1, -1):
        cyl(bm, 0.035, 1.7, (0.05, sy * 0.48, -0.78), segs=6, rot=ALONG_X)
        boxv(bm, (0.12, 0.035, 0.035), (0.95, sy * 0.48, -0.74), rot=Matrix.Rotation(-0.5, 3, 'Y'))  # upturned toes
        for sx in (0.42, -0.38):
            boxv(bm, (0.04, 0.04, 0.42), (sx, sy * 0.4, -0.58), rot=Matrix.Rotation(sy * 0.35, 3, 'X'))
    parts.append(link('chTrim', bm, mats['chTrim']))

    # the AI's livery: a red stripe down each flank and on the fin
    bm = bmesh.new()
    for sy in (1, -1):
        boxv(bm, (1.2, 0.02, 0.07), (-0.2, sy * 0.47, -0.12))
    boxv(bm, (0.14, 0.06, 0.12), (-2.72, 0, 0.62), rot=Matrix.Rotation(-0.35, 3, 'Y'))
    parts.append(link('stripe', bm, mats['stripe']))

    # its red eye: a slit across the nose under the canopy, and the searchlight's lens looking down
    bm = bmesh.new()
    blob(bm, (1.075, 0.44, 0.09), (0.0, 0, -0.17), keep=lambda c: c.x > 0.5)
    parts.append(link('eye', bm, mats['eye']))
    bm = bmesh.new()
    cyl(bm, 0.1, 0.02, (0.66, 0, -0.62), segs=12)
    parts.append(link('lamp', bm, mats['lamp']))

    bm = bmesh.new()  # nav lights: red to port (away from the camera), blue to starboard, on the stabiliser tips
    cyl(bm, 0.035, 0.05, (-2.35, 0.36, 0.18), segs=8, rot=ALONG_Y)
    parts.append(link('navRed', bm, mats['navRed']))
    bm = bmesh.new()
    cyl(bm, 0.035, 0.05, (-2.35, -0.36, 0.18), segs=8, rot=ALONG_Y)
    parts.append(link('navBlue', bm, mats['navBlue']))

    bpy.ops.object.select_all(action='DESELECT')
    for ob in parts:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    body = parts[0]
    body.name = body.data.name = 'Chopper'

    # the main rotor: four long blades with a little droop and twist
    bm = bmesh.new()
    for i in range(4):
        vs = bmesh.ops.create_cube(bm, size=1)['verts']
        bmesh.ops.scale(bm, vec=(BLADE - 0.1, 0.13, 0.02), verts=vs)
        bmesh.ops.rotate(bm, verts=vs, cent=(0, 0, 0), matrix=Matrix.Rotation(0.12, 3, 'X') @ Matrix.Rotation(0.02, 3, 'Y'))
        bmesh.ops.translate(bm, verts=vs, vec=((BLADE + 0.1) / 2, 0, -0.02))
        bmesh.ops.rotate(bm, verts=vs, cent=(0, 0, 0), matrix=Matrix.Rotation(i * math.pi / 2, 3, 'Z'))
    cyl(bm, 0.09, 0.08, (0, 0, 0.05), segs=8)
    rotor = link('ChopperRotor', bm, mats['chBlade'])
    rotor.location = HUB

    # the tail rotor: two blades turning about Y, beside the fin
    bm = bmesh.new()
    for a in (0, math.pi):
        vs = bmesh.ops.create_cube(bm, size=1)['verts']
        bmesh.ops.scale(bm, vec=(0.06, 0.015, 0.3), verts=vs)
        bmesh.ops.translate(bm, verts=vs, vec=(0, 0, 0.16))
        bmesh.ops.rotate(bm, verts=vs, cent=(0, 0, 0), matrix=Matrix.Rotation(a, 3, 'Y'))
    cyl(bm, 0.04, 0.05, (0, 0, 0), segs=8, rot=ALONG_Y)
    tail = link('ChopperTail', bm, mats['chBlade'])
    tail.location = TAIL_HUB

    for ob in (body, rotor, tail):
        for p in ob.data.polygons:
            p.use_smooth = False
    return body, rotor, tail


def export():
    os.makedirs(os.path.dirname(GLB), exist_ok=True)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=GLB, export_format='GLB', use_selection=True, export_yup=True, export_apply=True)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)


if __name__ == '__main__':
    obs = build()
    tris = sum(len(p.vertices) - 2 for ob in obs for p in ob.data.polygons)
    print(f'Chopper: {tris} tris')
    export()
    print('wrote', GLB)
