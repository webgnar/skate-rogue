# Builds Gnar Run's cars in Blender and exports public/models/cars.glb: a sedan (traffic and parked cars), the
# robotaxi and the enforcer cruiser.
#
#   blender -b -P art/cars.py            (or run it from Blender's Text Editor; it rebuilds the scene)
#
# Units are tiles (1 tile = 1 world unit). Blender +X is the front of the car, Y is across it (the game's depth),
# Z is up from the street. Each car is one object with its origin on the street under its middle. The size matches
# the physics hitbox in makeCar (src/render/kit.ts): 2.3 long, 1.6 wide, and the flat roof exactly 1.25 up, because
# the skater lands on it. The game stretches a car to other hitbox sizes and swaps the `paint` material per car.
import math
import os

import bpy  # first: the bpy module provides bmesh and mathutils
import bmesh
from mathutils import Matrix

HERE = os.path.dirname(os.path.abspath(__file__)) if '__file__' in dir() else bpy.path.abspath('//')
ROOT = os.path.dirname(HERE)
GLB = os.path.join(ROOT, 'public', 'models', 'cars.glb')
BLEND = os.path.join(HERE, 'cars.blend')

LEN = 2.3
WIDE = 1.6
ROOF = 1.25
FRONT = LEN / 2
WHEEL_R = 0.24
WHEEL_X = 0.72
BELT = 0.72  # where the windows start
CABIN_W = 1.38

COLORS = {
    'paint': 0xD94A4A,  # replaced per car in game
    'glass': 0x1C2333,
    'trim': 0x2A2A30,
    'tire': 0x111114,
    'rim': 0xB9BDC4,
    'lamp': 0xFFF2B0,
    'tail': 0xFF3030,
    'white': 0xF0F0F0,
    'black': 0x1C1C24,
    'sensor': 0x2E3440,
    'accent': 0x3FE0F0,
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
    bsdf.inputs['Roughness'].default_value = 0.2 if name == 'glass' else 0.6
    return m


def link(name, bm, mat):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def prism(bm, pts, y0, y1):
    """Extrude a side profile (x, z) across the car from y0 to y1."""
    a = [bm.verts.new((x, y0, z)) for x, z in pts]
    b = [bm.verts.new((x, y1, z)) for x, z in pts]
    n = len(pts)
    faces = [bm.faces.new(a[::-1]), bm.faces.new(b)]
    faces += [bm.faces.new((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i])) for i in range(n)]
    bmesh.ops.recalc_face_normals(bm, faces=faces)


def box(bm, x0, x1, y0, y1, z0, z1):
    prism(bm, [(x0, z0), (x1, z0), (x1, z1), (x0, z1)], y0, y1)


def cyl(bm, r, depth, at, segs=14):
    vs = bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=r, radius2=r, depth=depth)['verts']
    bmesh.ops.rotate(bm, verts=vs, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, 'X'))
    bmesh.ops.translate(bm, verts=vs, vec=at)


def lower_profile():
    """Body below the windows, with the wheel arches cut out, front to back along the bottom."""
    pts = [(FRONT - 0.04, 0.14), (FRONT + 0.01, 0.22), (FRONT + 0.01, 0.46), (FRONT - 0.06, 0.6), (0.42, BELT)]
    pts += [(-0.98, BELT), (-FRONT + 0.03, BELT - 0.02), (-FRONT - 0.01, 0.5), (-FRONT - 0.01, 0.22), (-FRONT + 0.04, 0.14)]
    arch = WHEEL_R + 0.06
    for cx in (-WHEEL_X, WHEEL_X):  # back arch first, walking forward along the bottom
        pts.append((cx - arch, 0.14))
        for i in range(9):
            a = math.pi - i / 8 * math.pi
            pts.append((cx + arch * math.cos(a), WHEEL_R + arch * math.sin(a) * 0.95))
        pts.append((cx + arch, 0.14))
    return pts


CABIN = [(0.42, BELT), (0.05, ROOF), (-0.62, ROOF), (-0.98, BELT)]


def inset(pts, d):
    cx = sum(p[0] for p in pts) / len(pts)
    cz = sum(p[1] for p in pts) / len(pts)
    return [(cx + (x - cx) * (1 - d), cz + (z - cz) * (1 - d * 1.6)) for x, z in pts]


def car(name, mats, kind):
    paint = mats['white'] if kind == 'robotaxi' else mats['black'] if kind == 'cruiser' else mats['paint']
    parts = []

    bm = bmesh.new()
    prism(bm, lower_profile(), -WIDE / 2, WIDE / 2)
    prism(bm, CABIN, -CABIN_W / 2, CABIN_W / 2)
    box(bm, -0.24, -0.16, -CABIN_W / 2 - 0.012, CABIN_W / 2 + 0.012, BELT, ROOF - 0.02)  # B pillar
    for y in (-1, 1):  # mirrors
        box(bm, 0.3, 0.4, y * WIDE / 2, y * (WIDE / 2 + 0.1), BELT + 0.02, BELT + 0.1)
    parts.append(link('body', bm, paint))

    if kind == 'cruiser':  # white doors
        bm = bmesh.new()
        for y in (-1, 1):
            box(bm, -0.42, 0.38, y * (WIDE / 2 - 0.004), y * (WIDE / 2 + 0.008), 0.2, BELT - 0.04)
        parts.append(link('doors', bm, mats['white']))

    bm = bmesh.new()  # windows: a dark band just proud of the cabin sides, plus windscreen and back glass
    prism(bm, inset(CABIN, 0.08), -CABIN_W / 2 - 0.006, CABIN_W / 2 + 0.006)
    parts.append(link('glass', bm, mats['glass']))

    bm = bmesh.new()  # bumpers, grille, door seams and handles
    box(bm, FRONT - 0.02, FRONT + 0.05, -WIDE / 2 + 0.02, WIDE / 2 - 0.02, 0.14, 0.3)
    box(bm, -FRONT - 0.05, -FRONT + 0.02, -WIDE / 2 + 0.02, WIDE / 2 - 0.02, 0.14, 0.3)
    box(bm, FRONT, FRONT + 0.03, -0.35, 0.35, 0.34, 0.46)
    for y in (-1, 1):
        for sx in (0.4, -0.2):
            box(bm, sx - 0.008, sx + 0.008, y * (WIDE / 2 - 0.002), y * (WIDE / 2 + 0.006), 0.22, BELT - 0.03)
        for hx in (0.25, -0.35):
            box(bm, hx - 0.06, hx, y * (WIDE / 2), y * (WIDE / 2 + 0.012), 0.58, 0.61)
    if kind == 'cruiser':  # push bar
        box(bm, FRONT + 0.05, FRONT + 0.12, -0.5, 0.5, 0.18, 0.5)
        box(bm, FRONT + 0.05, FRONT + 0.12, -0.5, 0.5, 0.18, 0.24)
    parts.append(link('trim', bm, mats['trim']))

    bm = bmesh.new()
    for y in (-1, 1):
        box(bm, FRONT - 0.02, FRONT + 0.025, y * 0.5, y * 0.72, 0.4, 0.5)
    parts.append(link('lamp', bm, mats['lamp']))
    bm = bmesh.new()
    for y in (-1, 1):
        box(bm, -FRONT - 0.025, -FRONT + 0.02, y * 0.5, y * 0.74, 0.42, 0.56)
    parts.append(link('tail', bm, mats['tail']))

    bm = bmesh.new()
    for x in (-WHEEL_X, WHEEL_X):
        for y in (-1, 1):
            cyl(bm, WHEEL_R, 0.22, (x, y * (WIDE / 2 - 0.1), WHEEL_R))
    parts.append(link('tire', bm, mats['tire']))
    bm = bmesh.new()
    for x in (-WHEEL_X, WHEEL_X):
        for y in (-1, 1):
            cyl(bm, 0.14, 0.02, (x, y * (WIDE / 2 + 0.012), WHEEL_R), segs=10)
    parts.append(link('rim', bm, mats['rim']))

    if kind == 'robotaxi':  # lidar puck at the back of the roof, sensor pods on the fenders, a cyan light strip
        bm = bmesh.new()
        vs = bmesh.ops.create_cone(bm, cap_ends=True, segments=12, radius1=0.13, radius2=0.11, depth=0.08)['verts']
        bmesh.ops.translate(bm, verts=vs, vec=(-0.42, 0, ROOF + 0.04))
        for y in (-1, 1):
            box(bm, 0.55, 0.68, y * (WIDE / 2 - 0.01), y * (WIDE / 2 + 0.04), 0.62, 0.72)
        parts.append(link('sensor', bm, mats['sensor']))
        bm = bmesh.new()
        for y in (-1, 1):
            box(bm, -0.95, 0.4, y * (WIDE / 2), y * (WIDE / 2 + 0.008), 0.36, 0.39)
        parts.append(link('accent', bm, mats['accent']))

    bpy.ops.object.select_all(action='DESELECT')
    for ob in parts:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    ob = parts[0]
    ob.name = ob.data.name = name
    for p in ob.data.polygons:
        p.use_smooth = False
    return ob


def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    mats = {k: material(k, v) for k, v in COLORS.items()}
    cars = [car('Sedan', mats, 'sedan'), car('Robotaxi', mats, 'robotaxi'), car('Cruiser', mats, 'cruiser')]
    for i, ob in enumerate(cars):  # side by side in the file; the game reads each from its origin
        ob.location.y = i * 2.5
    return cars


def export():
    os.makedirs(os.path.dirname(GLB), exist_ok=True)
    locs = {}
    for ob in bpy.data.objects:  # export at the origin
        locs[ob.name] = ob.location.copy()
        ob.location = (0, 0, 0)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=GLB, export_format='GLB', use_selection=True, export_yup=True, export_apply=True)
    for ob in bpy.data.objects:
        ob.location = locs[ob.name]
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)


if __name__ == '__main__':
    for ob in build():
        tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
        print(f'{ob.name}: {tris} tris')
    export()
    print('wrote', GLB)
