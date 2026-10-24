# Builds Gnar Run's street props in Blender and exports public/models/props.glb: a Chicago fire hydrant, a bench,
# a traffic cone, a city trash can, newspaper boxes, a street-name sign pole, a USPS mailbox and a parking meter.
# They are scenery along the back of the sidewalk, merged into one mesh per floor by the game (src/render/props.ts).
#
#   blender -b -P art/props.py            (or run it from Blender's Text Editor; it rebuilds the scene)
#
# Units are tiles (1 tile is about 0.85 m: Lou Gnar stands about 2 tiles tall). Same axes as the cars: +X along the
# street, -Y toward the game camera, Z up. Each prop is one object with its origin on the ground under its middle.
import math
import os
import sys

import bpy  # first: the bpy module provides bmesh and mathutils
import bmesh
from mathutils import Matrix

HERE = os.path.dirname(os.path.abspath(__file__)) if '__file__' in dir() else bpy.path.abspath('//')
sys.path.insert(0, HERE)
from cars import box, cyl, join, link, material  # noqa: E402  (shared helpers)

ROOT = os.path.dirname(HERE)
GLB = os.path.join(ROOT, 'public', 'models', 'props.glb')
BLEND = os.path.join(HERE, 'props.blend')

COLORS = {
    'hydrant': 0xD8392B,
    'cap': 0xC9CDD4,
    'wood': 0x9A6A3C,
    'iron': 0x26272C,
    'cone': 0xFF6A1A,
    'reflect': 0xF2F2F2,
    'bin': 0x2B4F8C,  # Chicago blue cart
    'binLid': 0x1E3A68,
    'news1': 0xD9302E,
    'news2': 0x2F7BD9,
    'news3': 0xF2C230,
    'paper': 0xE8E4D8,
    'glass': 0x1C2333,
    'pole': 0x5B6066,
    'streetSign': 0x1F7A3F,  # green street-name blades
    'signText': 0xF4F4F4,
    'noParking': 0xF4F4F4,
    'red': 0xC8312B,
    'usps': 0x1F4E9A,
    'meter': 0x7A808A,
}


def vcyl(bm, r, h, z0, at=(0, 0), segs=12, r2=None):
    """An upright cylinder (or cone, with r2) from z0 up h."""
    vs = bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=r, radius2=r if r2 is None else r2, depth=h)['verts']
    bmesh.ops.translate(bm, verts=vs, vec=(at[0], at[1], z0 + h / 2))


def hydrant(m):
    parts = []
    bm = bmesh.new()
    vcyl(bm, 0.13, 0.55, 0.06)  # barrel
    vcyl(bm, 0.15, 0.05, 0.58)  # top flange
    vcyl(bm, 0.12, 0.12, 0.63, r2=0.05)  # bonnet
    for y in (-1, 1):  # side nozzles
        cyl(bm, 0.055, 0.12, (0, y * 0.17, 0.42), segs=10)
    cyl(bm, 0.08, 0.1, (0, -0.16, 0.3), segs=10)  # pumper nozzle toward the street
    parts.append(link('hydrant', bm, m['hydrant']))
    bm = bmesh.new()
    vcyl(bm, 0.17, 0.06, 0.0)  # base flange
    vcyl(bm, 0.03, 0.06, 0.75, segs=6)  # operating nut
    for y in (-1, 1):
        cyl(bm, 0.06, 0.03, (0, y * 0.24, 0.42), segs=10)
    cyl(bm, 0.09, 0.03, (0, -0.22, 0.3), segs=10)
    parts.append(link('cap', bm, m['cap']))
    return join(parts, 'Hydrant')


def bench(m):
    parts = []
    L = 2.0
    bm = bmesh.new()  # seat and back slats
    for i in range(3):
        box(bm, -L / 2, L / 2, -0.28 + i * 0.13, -0.18 + i * 0.13, 0.5, 0.55)
    for i in range(3):
        z = 0.68 + i * 0.13
        box(bm, -L / 2, L / 2, 0.16 + i * 0.025, 0.21 + i * 0.025, z, z + 0.09)
    parts.append(link('wood', bm, m['wood']))
    bm = bmesh.new()  # cast-iron ends with arm rests
    for x in (-L / 2 + 0.1, L / 2 - 0.1):
        box(bm, x - 0.04, x + 0.04, -0.28, -0.22, 0.0, 0.5)
        box(bm, x - 0.04, x + 0.04, 0.14, 0.2, 0.0, 1.05)
        box(bm, x - 0.04, x + 0.04, -0.3, 0.2, 0.44, 0.5)
        box(bm, x - 0.04, x + 0.04, -0.3, 0.2, 0.74, 0.79)  # arm rest
        box(bm, x - 0.04, x + 0.04, -0.3, -0.25, 0.5, 0.79)
    parts.append(link('iron', bm, m['iron']))
    return join(parts, 'Bench')


def cone(m):
    parts = []
    bm = bmesh.new()
    vcyl(bm, 0.16, 0.7, 0.04, r2=0.03, segs=14)
    parts.append(link('cone', bm, m['cone']))
    bm = bmesh.new()
    box(bm, -0.22, 0.22, -0.22, 0.22, 0.0, 0.04)  # square base
    vcyl(bm, 0.122, 0.12, 0.3, r2=0.098, segs=14)  # reflective collar
    bmesh.ops.scale(bm, vec=(1.02, 1.02, 1), verts=bm.verts[8:])
    parts.append(link('reflect', bm, m['reflect']))
    # base in black: a separate thin plate under the collar would z-fight, so the base is the iron colour
    parts[-1].data.materials.append(m['iron'])
    for p in parts[-1].data.polygons:
        if p.center.z < 0.05:
            p.material_index = 1
    return join(parts, 'Cone')


def trash(m):
    """Chicago's blue garbage cart: a tapered tub, a lid hinged at the back, wheels and a handle."""
    parts = []
    bm = bmesh.new()
    box(bm, -0.32, 0.32, -0.36, 0.36, 0.08, 1.05)
    for v in bm.verts:  # taper toward the bottom
        if v.co.z < 0.5:
            v.co.x *= 0.85
            v.co.y *= 0.85
    parts.append(link('bin', bm, m['bin']))
    bm = bmesh.new()
    box(bm, -0.36, 0.36, -0.4, 0.4, 1.05, 1.12)
    box(bm, -0.3, 0.3, 0.36, 0.44, 0.95, 1.08)  # handle at the back
    parts.append(link('binLid', bm, m['binLid']))
    bm = bmesh.new()
    for x in (-0.24, 0.24):
        cyl(bm, 0.09, 0.06, (x, 0.32, 0.09), segs=10)
    parts.append(link('iron', bm, m['iron']))
    return join(parts, 'TrashCan')


def newsbox(m, color, name):
    parts = []
    bm = bmesh.new()
    box(bm, -0.3, 0.3, -0.28, 0.28, 0.35, 1.15)  # the box
    box(bm, -0.32, 0.32, -0.3, 0.3, 1.15, 1.2)  # lid
    parts.append(link('news', bm, m[color]))
    bm = bmesh.new()  # pedestal legs and coin slot
    for x in (-0.22, 0.22):
        box(bm, x - 0.03, x + 0.03, -0.2, 0.2, 0.0, 0.35)
    box(bm, -0.25, 0.25, -0.22, 0.22, 0.0, 0.04)
    box(bm, 0.12, 0.22, -0.3, -0.28, 0.98, 1.08)
    parts.append(link('iron', bm, m['iron']))
    bm = bmesh.new()  # window with the paper behind it
    box(bm, -0.24, 0.24, -0.29, -0.28, 0.62, 0.95)
    parts.append(link('glass', bm, m['glass']))
    bm = bmesh.new()
    box(bm, -0.18, 0.18, -0.285, -0.27, 0.66, 0.9)
    parts.append(link('paper', bm, m['paper']))
    return join(parts, name)


def sign_pole(m):
    """A street-name sign: a pole with two green blades crossed at the top and a no-parking sign below."""
    parts = []
    bm = bmesh.new()
    vcyl(bm, 0.035, 3.0, 0.0, segs=8)
    parts.append(link('pole', bm, m['pole']))
    bm = bmesh.new()
    box(bm, -0.55, 0.55, -0.015, 0.015, 2.78, 2.98)  # along the street: faces the camera
    box(bm, -0.015, 0.015, -0.45, 0.45, 3.0, 3.2)  # the cross street
    parts.append(link('streetSign', bm, m['streetSign']))
    bm = bmesh.new()  # white letters as a strip on the camera-facing blade, and the white border
    box(bm, -0.42, 0.42, -0.02, -0.015, 2.84, 2.92)
    box(bm, -0.18, 0.18, -0.06, -0.04, 1.75, 2.2)  # no-parking sign
    parts.append(link('noParking', bm, m['noParking']))
    bm = bmesh.new()
    box(bm, -0.13, 0.13, -0.065, -0.06, 1.95, 2.13)  # the red P-in-a-circle, as a block
    parts.append(link('red', bm, m['red']))
    return join(parts, 'SignPole')


def mailbox(m):
    parts = []
    bm = bmesh.new()
    box(bm, -0.3, 0.3, -0.26, 0.26, 0.25, 1.0)
    vs = bmesh.ops.create_cone(bm, cap_ends=True, segments=14, radius1=0.26, radius2=0.26, depth=0.6)['verts']
    bmesh.ops.rotate(bm, verts=vs, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, 'Y'))
    for v in vs:  # half-round top
        v.co.z = max(v.co.z, 0)
    bmesh.ops.translate(bm, verts=vs, vec=(0, 0, 1.0))
    parts.append(link('usps', bm, m['usps']))
    bm = bmesh.new()
    for x in (-0.24, 0.24):
        for y in (-0.2, 0.2):
            box(bm, x - 0.03, x + 0.03, y - 0.03, y + 0.03, 0.0, 0.25)
    box(bm, -0.18, 0.18, -0.27, -0.26, 1.0, 1.08)  # pull-down slot
    parts.append(link('iron', bm, m['iron']))
    return join(parts, 'Mailbox')


def meter(m):
    parts = []
    bm = bmesh.new()
    vcyl(bm, 0.04, 1.1, 0.0, segs=8)
    parts.append(link('pole', bm, m['pole']))
    bm = bmesh.new()
    box(bm, -0.13, 0.13, -0.1, 0.1, 1.1, 1.45)
    vcyl(bm, 0.12, 0.08, 1.45, segs=10)
    parts.append(link('meter', bm, m['meter']))
    bm = bmesh.new()
    box(bm, -0.08, 0.08, -0.105, -0.1, 1.28, 1.4)
    parts.append(link('glass', bm, m['glass']))
    return join(parts, 'Meter')


def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    m = {k: material(k, v) for k, v in COLORS.items()}
    props = [hydrant(m), bench(m), cone(m), trash(m), newsbox(m, 'news1', 'NewsBoxRed'), newsbox(m, 'news2', 'NewsBoxBlue'),
             newsbox(m, 'news3', 'NewsBoxYellow'), sign_pole(m), mailbox(m), meter(m)]
    for i, ob in enumerate(props):  # in a row in the file; the game reads each from its origin
        ob.location.x = i * 2.5
    return props


def export():
    os.makedirs(os.path.dirname(GLB), exist_ok=True)
    locs = {}
    for ob in bpy.data.objects:
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
