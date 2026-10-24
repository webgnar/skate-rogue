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
import random
import sys

import bpy  # first: the bpy module provides bmesh and mathutils
import bmesh
from mathutils import Matrix, Vector

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
    'bottleGreen': 0x2E7D3A,
    'bottleBrown': 0x7A4A1E,
    'label': 0xE9D9A8,
    'crate': 0xB88A55,
    'concrete': 0x9C9AA0,
    'soil': 0x3B2A1E,
    'leaf': 0x3E8E3A,
    'leafDark': 0x2C6B2C,
    'board': 0x1E1E22,  # chalkboard
    'chalk': 0xEDEDED,
    'can': 0xC8312B,
    'canTop': 0xC9CDD4,
    'barrel': 0xFF6A1A,
    'cardboard': 0xB98B57,
    'tape': 0xD8C089,
    'cartBody': 0xC9CDD4,
    'awning1': 0xD9302E,
    'awning2': 0xF4F4F4,
    'aiPanel': 0x101018,
    'aiRed': 0xFF2A2A,  # glows
    'aiText': 0xF4F4F4,
    'bot': 0xE8E8EC,
    'flag': 0xFF6A1A,
    'flock': 0xF0F0F0,
    # the other QFS worlds' smashables
    'terracotta': 0xC8622E,
    'blackFigure': 0x1E1612,
    'coral': 0xFF6F86,
    'coralDeep': 0xD8435E,
    'rock': 0x5A6A72,
    'shell': 0xF6D9C8,
    'chestWood': 0x6B4426,
    'gold': 0xE8B830,
    'porcelain': 0xF4F4F0,
    'cobalt': 0x2A4AB8,
    'marble': 0xECE8E0,
    'plinth': 0xD8D4CC,
    'mug': 0xF0EEE8,
    'cup': 0xD8312B,
    'lid': 0xF4F4F4,
    'pumpkin': 0xF07A1E,
    'stem': 0x4A6A2A,
    'hay': 0xD8B860,
    'twine': 0x8A6A3A,
    'cell': 0x1A1E28,
    'holo': 0x3AF0FF,  # glows
    'rack': 0x16181E,
    'crystal': 0xB86AF0,
    'crystalPale': 0xE0B8FF,
    'tank': 0xEDEDED,
    'tankBand': 0xFF8A1A,
}
# break pieces per prop (art/props.py fracture): more for the ones that should burst
PIECES = {'Hydrant': 4, 'Bench': 5, 'Cone': 3, 'TrashCan': 4, 'NewsBoxRed': 4, 'NewsBoxBlue': 4, 'NewsBoxYellow': 4,
          'SignPole': 3, 'Mailbox': 4, 'Meter': 3, 'Bottle': 5, 'Crate': 6, 'Planter': 5, 'SandwichBoard': 4,
          'Can': 3, 'Barrel': 4, 'CardboardBox': 4, 'FoodCart': 6, 'AIKiosk': 5, 'DeliveryBot': 5, 'FlockPole': 4,
          # small, medium and large smashables for each of the other worlds (src/render/props.ts WORLD_PROPS)
          'OilJug': 4, 'Urn': 5, 'Amphora': 6, 'Shell': 3, 'Coral': 5, 'Chest': 6, 'Mug': 3, 'Vase': 5, 'Bust': 5,
          'SodaCup': 3, 'Pumpkin': 5, 'HayBale': 6, 'Battery': 3, 'HoloCube': 4, 'ServerRack': 6, 'Crystal': 3,
          'FuelCell': 4, 'CrystalCluster': 6}


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


def bottle(m):
    """A 40 left on the sidewalk: green glass, a paper label."""
    parts = []
    bm = bmesh.new()
    vcyl(bm, 0.07, 0.24, 0.0, segs=10)
    vcyl(bm, 0.07, 0.06, 0.24, r2=0.028, segs=10)
    vcyl(bm, 0.026, 0.09, 0.3, segs=8)
    parts.append(link('glassBottle', bm, m['bottleGreen']))
    bm = bmesh.new()
    vcyl(bm, 0.073, 0.1, 0.07, segs=10)
    parts.append(link('label', bm, m['label']))
    return join(parts, 'Bottle')


def crate(m):
    """A wooden produce crate: slatted sides with gaps, corner posts."""
    parts = []
    bm = bmesh.new()
    W, D, H = 0.6, 0.45, 0.42
    for z in (0.02, 0.16, 0.3):
        for y in (-1, 1):
            box(bm, -W / 2, W / 2, y * D / 2 - 0.015, y * D / 2 + 0.015, z, z + 0.1)
        for x in (-1, 1):
            box(bm, x * W / 2 - 0.015, x * W / 2 + 0.015, -D / 2, D / 2, z, z + 0.1)
    box(bm, -W / 2, W / 2, -D / 2, D / 2, 0.0, 0.02)
    parts.append(link('crate', bm, m['crate']))
    bm = bmesh.new()
    for x in (-1, 1):
        for y in (-1, 1):
            box(bm, x * W / 2 - 0.03, x * W / 2 + 0.01 * x, y * D / 2 - 0.03, y * D / 2 + 0.01 * y, 0.0, H)
    parts.append(link('wood', bm, m['wood']))
    return join(parts, 'Crate')


def planter(m):
    """A concrete sidewalk planter with a round shrub."""
    parts = []
    bm = bmesh.new()
    box(bm, -0.45, 0.45, -0.32, 0.32, 0.0, 0.55)
    for v in bm.verts:  # flared top
        if v.co.z > 0.3:
            v.co.x *= 1.08
            v.co.y *= 1.1
    parts.append(link('concrete', bm, m['concrete']))
    bm = bmesh.new()
    box(bm, -0.42, 0.42, -0.3, 0.3, 0.5, 0.56)
    parts.append(link('soil', bm, m['soil']))
    bm = bmesh.new()
    for (x, y, r) in ((0, 0, 0.32), (-0.2, 0.05, 0.22), (0.22, -0.04, 0.24)):
        vs = bmesh.ops.create_icosphere(bm, subdivisions=1, radius=r)['verts']
        bmesh.ops.translate(bm, verts=vs, vec=(x, y, 0.62 + r * 0.6))
    parts.append(link('leaf', bm, m['leaf']))
    return join(parts, 'Planter')


def sandwich_board(m):
    """A café's A-frame chalkboard sign on the sidewalk, open toward the street."""
    parts = []
    bm = bmesh.new()
    for y in (-1, 1):
        box(bm, -0.3, 0.3, -0.02, 0.02, 0.0, 1.0)
        bmesh.ops.rotate(bm, verts=bm.verts[-8:], cent=(0, 0, 1.0), matrix=Matrix.Rotation(y * 0.2, 3, 'X'))
    parts.append(link('wood', bm, m['wood']))
    bm = bmesh.new()  # the chalkboard on the camera side, and a chalk scrawl
    box(bm, -0.25, 0.25, -0.03, -0.02, 0.12, 0.92)
    bmesh.ops.rotate(bm, verts=bm.verts[:], cent=(0, 0, 1.0), matrix=Matrix.Rotation(-0.2, 3, 'X'))
    parts.append(link('board', bm, m['board']))
    bm = bmesh.new()
    for z in (0.75, 0.62, 0.5, 0.3):
        box(bm, -0.18, 0.18 if z > 0.6 else 0.1, -0.036, -0.03, z, z + 0.04)
    bmesh.ops.rotate(bm, verts=bm.verts[:], cent=(0, 0, 1.0), matrix=Matrix.Rotation(-0.2, 3, 'X'))
    parts.append(link('chalk', bm, m['chalk']))
    return join(parts, 'SandwichBoard')


def can(m):
    parts = []
    bm = bmesh.new()
    vcyl(bm, 0.06, 0.2, 0.0, segs=10)
    parts.append(link('can', bm, m['can']))
    bm = bmesh.new()
    vcyl(bm, 0.055, 0.015, 0.2, segs=10)
    parts.append(link('canTop', bm, m['canTop']))
    return join(parts, 'Can')


def barrel(m):
    """An orange road-work drum with white reflective bands."""
    parts = []
    bm = bmesh.new()
    vcyl(bm, 0.28, 0.95, 0.0, segs=14)
    parts.append(link('barrel', bm, m['barrel']))
    bm = bmesh.new()
    for z in (0.3, 0.62):
        vcyl(bm, 0.285, 0.12, z, segs=14)
    parts.append(link('reflect', bm, m['reflect']))
    bm = bmesh.new()
    vcyl(bm, 0.36, 0.05, 0.0, segs=14)  # rubber base ring
    parts.append(link('iron', bm, m['iron']))
    return join(parts, 'Barrel')


def cardboard(m):
    parts = []
    bm = bmesh.new()
    box(bm, -0.3, 0.3, -0.25, 0.25, 0.0, 0.42)
    for y in (-1, 1):  # flaps folded half open
        box(bm, -0.3, 0.3, y * 0.25 - 0.005, y * 0.25 + 0.005, 0.42, 0.6)
        bmesh.ops.rotate(bm, verts=bm.verts[-8:], cent=(0, y * 0.25, 0.42), matrix=Matrix.Rotation(y * -0.6, 3, 'X'))
    parts.append(link('cardboard', bm, m['cardboard']))
    bm = bmesh.new()
    box(bm, -0.06, 0.06, -0.255, 0.255, 0.3, 0.421)
    parts.append(link('tape', bm, m['tape']))
    return join(parts, 'CardboardBox')


def food_cart(m):
    """A street vendor's cart: steel box on two wheels, a striped awning on poles, a handle."""
    parts = []
    L, D = 1.3, 0.7
    bm = bmesh.new()
    box(bm, -L / 2, L / 2, -D / 2, D / 2, 0.25, 0.95)
    box(bm, L / 2, L / 2 + 0.35, -0.02, 0.02, 0.8, 0.84)  # handle bar
    for y in (-0.25, 0.25):
        box(bm, L / 2, L / 2 + 0.35, y - 0.02, y + 0.02, 0.8, 0.84)
    parts.append(link('cartBody', bm, m['cartBody']))
    bm = bmesh.new()
    for x in (-L / 2 + 0.05, L / 2 - 0.05):
        for y in (-D / 2 + 0.05, D / 2 - 0.05):
            vcyl(bm, 0.02, 0.75, 0.95, at=(x, y), segs=6)
    for y in (-1, 1):
        cyl(bm, 0.22, 0.06, (-0.25, y * (D / 2 + 0.04), 0.22), segs=12)
    parts.append(link('iron', bm, m['iron']))
    for i, color in enumerate(('awning1', 'awning2', 'awning1', 'awning2', 'awning1')):
        bm = bmesh.new()
        x0 = -L / 2 - 0.1 + i * (L + 0.2) / 5
        box(bm, x0, x0 + (L + 0.2) / 5, -D / 2 - 0.12, D / 2 + 0.12, 1.7, 1.76)
        box(bm, x0, x0 + (L + 0.2) / 5, -D / 2 - 0.13, -D / 2 - 0.11, 1.55, 1.7)  # valance toward the camera
        parts.append(link(color, bm, m[color]))
    bm = bmesh.new()  # a menu panel
    box(bm, -0.4, 0.4, -D / 2 - 0.01, -D / 2, 0.45, 0.85)
    parts.append(link('board', bm, m['board']))
    return join(parts, 'FoodCart')


def ai_kiosk(m):
    """The AI's sidewalk kiosk: a black slab with a glowing red eye and a REPORT ALL SKATERS strip."""
    parts = []
    bm = bmesh.new()
    box(bm, -0.3, 0.3, -0.15, 0.15, 0.0, 1.5)
    for v in bm.verts:
        if v.co.z > 1:
            v.co.x *= 0.85
    parts.append(link('aiPanel', bm, m['aiPanel']))
    bm = bmesh.new()
    vs = bmesh.ops.create_circle(bm, cap_ends=True, segments=12, radius=0.1)['verts']
    bmesh.ops.rotate(bm, verts=vs, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, 'X'))
    bmesh.ops.translate(bm, verts=vs, vec=(0, -0.155, 1.22))
    box(bm, -0.22, 0.22, -0.16, -0.15, 0.25, 0.3)  # red strip at the foot
    parts.append(link('aiRed', bm, m['aiRed']))
    bm = bmesh.new()  # text lines
    for z in (0.95, 0.85, 0.75, 0.6, 0.5):
        box(bm, -0.2, 0.2 if z > 0.7 else 0.12, -0.158, -0.152, z, z + 0.05)
    parts.append(link('aiText', bm, m['aiText']))
    return join(parts, 'AIKiosk')


def delivery_bot(m):
    """A six-wheeled sidewalk delivery robot with a lid, a flag on a whip and a little screen."""
    parts = []
    bm = bmesh.new()
    box(bm, -0.3, 0.3, -0.22, 0.22, 0.12, 0.52)
    box(bm, -0.28, 0.28, -0.2, 0.2, 0.52, 0.6)
    parts.append(link('bot', bm, m['bot']))
    bm = bmesh.new()
    for x in (-0.22, 0, 0.22):
        for y in (-1, 1):
            cyl(bm, 0.08, 0.06, (x, y * 0.23, 0.08), segs=10)
    vcyl(bm, 0.008, 0.6, 0.6, at=(-0.22, 0.12), segs=4)  # whip
    parts.append(link('iron', bm, m['iron']))
    bm = bmesh.new()
    box(bm, -0.22, -0.08, 0.115, 0.125, 1.08, 1.2)  # flag
    parts.append(link('flag', bm, m['flag']))
    bm = bmesh.new()
    box(bm, 0.3, 0.31, -0.12, 0.12, 0.34, 0.46)  # face screen at the front
    parts.append(link('aiRed', bm, m['aiRed']))
    return join(parts, 'DeliveryBot')


def flock_pole(m):
    """A Flock license-plate camera: a short pole with a white camera box and a solar panel on top."""
    parts = []
    bm = bmesh.new()
    vcyl(bm, 0.035, 2.4, 0.0, segs=8)
    parts.append(link('pole', bm, m['pole']))
    bm = bmesh.new()
    box(bm, -0.12, 0.2, -0.1, 0.1, 2.0, 2.2)
    parts.append(link('flock', bm, m['flock']))
    bm = bmesh.new()
    box(bm, -0.25, 0.25, -0.18, 0.18, 2.4, 2.43)  # solar panel, tilted
    bmesh.ops.rotate(bm, verts=bm.verts[:], cent=(0, 0, 2.4), matrix=Matrix.Rotation(0.4, 3, 'X'))
    parts.append(link('glass', bm, m['glass']))
    bm = bmesh.new()
    vs = bmesh.ops.create_circle(bm, cap_ends=True, segments=8, radius=0.04)['verts']
    bmesh.ops.rotate(bm, verts=vs, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, 'Y'))
    bmesh.ops.translate(bm, verts=vs, vec=(0.205, 0, 2.1))
    parts.append(link('aiRed', bm, m['aiRed']))
    return join(parts, 'FlockPole')


def lathe(bm, prof, segs=12, at=(0, 0, 0)):
    """A turned shape (a pot, a vase) from (radius, height) pairs, bottom to top; capped at both ends."""
    rings = []
    for r, z in prof:
        rings.append([bm.verts.new((at[0] + r * math.cos(2 * math.pi * i / segs), at[1] + r * math.sin(2 * math.pi * i / segs), at[2] + z))
                      for i in range(segs)])
    for a, b in zip(rings, rings[1:]):
        for i in range(segs):
            bm.faces.new((a[i], a[(i + 1) % segs], b[(i + 1) % segs], b[i]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])


def handles(bm, r, z0, z1, out):
    """Two loop handles either side (along x), from the shoulder at z1 out to `out` and down to the body at z0."""
    for s in (1, -1):
        for a, b in (((r, z1), (out, z1)), ((out, z1), (out, z0)), ((out, z0), (r * 0.9, z0))):
            x0, x1 = sorted((a[0] * s, b[0] * s))
            zl, zh = sorted((a[1], b[1]))
            box(bm, x0 - 0.012, x1 + 0.012, -0.015, 0.015, zl - 0.012, zh + 0.012)


def pot(m, name, prof, band, body='terracotta', ring='blackFigure', handle=None, segs=12):
    """A turned pot with a painted band (z0, z1) round it, a touch proud of the body."""
    bm = bmesh.new()
    lathe(bm, prof, segs)
    if handle:
        handles(bm, *handle)
    parts = [link(name.lower(), bm, m[body])]
    if band:
        z0, z1 = band
        r = max(rr for rr, z in prof if z0 - 0.05 <= z <= z1 + 0.05) + 0.004
        bm = bmesh.new()
        lathe(bm, [(r, z0), (r, z1)], segs)
        parts.append(link(name.lower() + 'Band', bm, m[ring]))
    return join(parts, name)


# Greece
def oil_jug(m):
    return pot(m, 'OilJug', [(0.05, 0), (0.09, 0.06), (0.1, 0.14), (0.07, 0.22), (0.035, 0.26), (0.035, 0.31), (0.05, 0.33)], (0.1, 0.16))


def urn(m):
    """A krater: a wide bowl on a foot, black-figure band round the belly."""
    prof = [(0.12, 0), (0.08, 0.04), (0.09, 0.1), (0.2, 0.28), (0.26, 0.48), (0.24, 0.6), (0.27, 0.68)]
    return pot(m, 'Urn', prof, (0.34, 0.5), handle=(0.2, 0.34, 0.5, 0.31), segs=14)


def amphora(m):
    """Tall, on a narrow foot, with two handles from neck to shoulder."""
    prof = [(0.07, 0), (0.05, 0.06), (0.1, 0.2), (0.22, 0.5), (0.24, 0.65), (0.18, 0.78), (0.08, 0.86), (0.07, 0.98), (0.1, 1.02)]
    return pot(m, 'Amphora', prof, (0.52, 0.66), handle=(0.08, 0.72, 0.94, 0.17), segs=14)


# Atlantis
def shell(m):
    bm = bmesh.new()
    for z, flip in ((0.0, 1), (0.05, -1)):
        lathe(bm, [(0.16, 0.03 * flip), (0.12, 0.08 * flip), (0.05, 0.11 * flip), (0.001, 0.12 * flip)], 10, (0, 0, z if flip > 0 else 0.1))
    return join([link('shell', bm, m['shell'])], 'Shell')


def coral(m):
    """A branching coral on a lump of rock."""
    rnd = random.Random(7)
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=1, radius=0.2)
    bmesh.ops.scale(bm, vec=(1.3, 1, 0.5), verts=bm.verts)
    rock = link('rock', bm, m['rock'])
    parts = [rock]
    for i, (dx, lean, h) in enumerate(((-0.1, -0.35, 0.55), (0.02, 0.1, 0.7), (0.12, 0.45, 0.5), (0.06, -0.1, 0.38))):
        bm = bmesh.new()
        vs = bmesh.ops.create_cone(bm, cap_ends=True, segments=6, radius1=0.05, radius2=0.025, depth=h)['verts']
        bmesh.ops.translate(bm, verts=vs, vec=(0, 0, h / 2))
        bmesh.ops.rotate(bm, verts=vs, cent=(0, 0, 0), matrix=Matrix.Rotation(lean, 3, 'Y') @ Matrix.Rotation(rnd.uniform(-0.3, 0.3), 3, 'X'))
        bmesh.ops.translate(bm, verts=vs, vec=(dx, rnd.uniform(-0.04, 0.04), 0.06))
        parts.append(link(f'coral{i}', bm, m['coral' if i % 2 == 0 else 'coralDeep']))
    return join(parts, 'Coral')


def chest(m):
    """A sunken treasure chest: planked box, curved lid, gold bands and lock."""
    parts = []
    bm = bmesh.new()
    box(bm, -0.38, 0.38, -0.24, 0.24, 0, 0.42)
    lid = [(-0.38 + 0.76 * i / 6, 0.42 + 0.14 * math.sin(math.pi * i / 6)) for i in range(7)]
    from cars import prism
    prism(bm, [(-0.38, 0.42)] + lid[1:-1] + [(0.38, 0.42)], -0.24, 0.24)
    parts.append(link('chestWood', bm, m['chestWood']))
    bm = bmesh.new()
    for x in (-0.26, 0.26):
        box(bm, x - 0.035, x + 0.035, -0.245, 0.245, 0, 0.5)
    box(bm, -0.05, 0.05, -0.255, -0.24, 0.3, 0.42)
    parts.append(link('chestGold', bm, m['gold']))
    return join(parts, 'Chest')


# the Art Museum
def mug(m):
    bm = bmesh.new()
    lathe(bm, [(0.065, 0), (0.07, 0.16)], 10)
    for a, b in (((0.07, 0.04), (0.11, 0.04)), ((0.11, 0.04), (0.11, 0.13)), ((0.11, 0.13), (0.07, 0.13))):
        box(bm, min(a[0], b[0]) - 0.012, max(a[0], b[0]) + 0.012, -0.012, 0.012, min(a[1], b[1]) - 0.012, max(a[1], b[1]) + 0.012)
    return join([link('mug', bm, m['mug'])], 'Mug')


def vase(m):
    """Blue-and-white porcelain on a little black stand."""
    prof = [(0.06, 0.06), (0.14, 0.22), (0.17, 0.36), (0.12, 0.52), (0.06, 0.6), (0.07, 0.68)]
    ob = pot(m, 'Vase', prof, (0.24, 0.42), body='porcelain', ring='cobalt', segs=14)
    bm = bmesh.new()
    vcyl(bm, 0.12, 0.06, 0.0, segs=10)
    stand = link('vaseStand', bm, m['iron'])
    return join([ob, stand], 'Vase')


def bust(m):
    """A marble bust on a plinth."""
    parts = []
    bm = bmesh.new()
    box(bm, -0.2, 0.2, -0.2, 0.2, 0, 0.62)
    parts.append(link('plinth', bm, m['plinth']))
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=10, v_segments=7, radius=0.12)
    bmesh.ops.scale(bm, vec=(0.85, 0.95, 1.15), verts=bm.verts)
    bmesh.ops.translate(bm, verts=bm.verts, vec=(0, 0, 0.92))
    lathe(bm, [(0.17, 0.62), (0.16, 0.7), (0.05, 0.78), (0.045, 0.82)], 10)
    parts.append(link('marble', bm, m['marble']))
    return join(parts, 'Bust')


# Clemente Park in the autumn
def soda_cup(m):
    bm = bmesh.new()
    lathe(bm, [(0.05, 0), (0.07, 0.2)], 10)
    parts = [link('cup', bm, m['cup'])]
    bm = bmesh.new()
    lathe(bm, [(0.074, 0.2), (0.074, 0.22)], 10)
    box(bm, 0.0, 0.012, -0.006, 0.006, 0.22, 0.32)
    parts.append(link('lid', bm, m['lid']))
    return join(parts, 'SodaCup')


def pumpkin(m):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=8, radius=0.25)
    for v in bm.verts:  # ribs: pinch every other column in
        a = math.atan2(v.co.y, v.co.x)
        k = 1 - 0.08 * (0.5 + 0.5 * math.cos(6 * a))
        v.co.x *= k
        v.co.y *= k
    bmesh.ops.scale(bm, vec=(1.15, 1.15, 0.8), verts=bm.verts)
    bmesh.ops.translate(bm, verts=bm.verts, vec=(0, 0, 0.2))
    parts = [link('pumpkin', bm, m['pumpkin'])]
    bm = bmesh.new()
    vcyl(bm, 0.03, 0.1, 0.38, segs=6, r2=0.02)
    parts.append(link('stem', bm, m['stem']))
    return join(parts, 'Pumpkin')


def hay_bale(m):
    parts = []
    bm = bmesh.new()
    box(bm, -0.45, 0.45, -0.28, 0.28, 0, 0.55)
    parts.append(link('hay', bm, m['hay']))
    bm = bmesh.new()
    for x in (-0.22, 0.22):
        box(bm, x - 0.02, x + 0.02, -0.285, 0.285, -0.005, 0.555)
    parts.append(link('twine', bm, m['twine']))
    return join(parts, 'HayBale')


# High-Tech City (and the Hive)
def battery(m):
    bm = bmesh.new()
    vcyl(bm, 0.06, 0.24, 0.0, segs=10)
    parts = [link('cell', bm, m['cell'])]
    bm = bmesh.new()
    vcyl(bm, 0.062, 0.04, 0.16, segs=10)
    vcyl(bm, 0.02, 0.03, 0.24, segs=6)
    parts.append(link('holo', bm, m['holo']))
    return join(parts, 'Battery')


def holo_cube(m):
    """A dark cube with glowing edges: the AI's delivery boxes."""
    s = 0.3
    parts = []
    bm = bmesh.new()
    box(bm, -s, s, -s, s, 0, 2 * s)
    parts.append(link('cell', bm, m['cell']))
    bm = bmesh.new()
    e, t = s + 0.01, 0.025
    for x in (-e, e):
        for y in (-e, e):
            box(bm, x - t, x + t, y - t, y + t, 0, 2 * s)
    for z in (0, 2 * s):
        for y in (-e, e):
            box(bm, -e, e, y - t, y + t, z - t, z + t)
        for x in (-e, e):
            box(bm, x - t, x + t, -e, e, z - t, z + t)
    parts.append(link('holo', bm, m['holo']))
    return join(parts, 'HoloCube')


def server_rack(m):
    parts = []
    bm = bmesh.new()
    box(bm, -0.3, 0.3, -0.3, 0.3, 0, 1.05)
    parts.append(link('rack', bm, m['rack']))
    bm = bmesh.new()
    for i in range(6):
        z = 0.12 + i * 0.15
        box(bm, -0.24, 0.1, -0.31, -0.3, z, z + 0.025)
        box(bm, 0.16, 0.22, -0.31, -0.3, z, z + 0.04)
    parts.append(link('holo', bm, m['holo']))
    return join(parts, 'ServerRack')


# Outer Space
def spike(bm, r, h, at, lean=(0, 0)):
    vs = bmesh.ops.create_cone(bm, cap_ends=True, segments=5, radius1=r, radius2=0.0, depth=h)['verts']
    bmesh.ops.translate(bm, verts=vs, vec=(0, 0, h / 2))
    bmesh.ops.rotate(bm, verts=vs, cent=(0, 0, 0), matrix=Matrix.Rotation(lean[0], 3, 'Y') @ Matrix.Rotation(lean[1], 3, 'X'))
    bmesh.ops.translate(bm, verts=vs, vec=at)


def crystal(m):
    bm = bmesh.new()
    spike(bm, 0.07, 0.34, (0, 0, 0))
    spike(bm, 0.05, 0.2, (0.06, 0, 0), (0.5, 0))
    return join([link('crystal', bm, m['crystal'])], 'Crystal')


def fuel_cell(m):
    parts = []
    bm = bmesh.new()
    vcyl(bm, 0.17, 0.6, 0.0, segs=12)
    vcyl(bm, 0.06, 0.08, 0.6, segs=8)
    parts.append(link('tank', bm, m['tank']))
    bm = bmesh.new()
    for z in (0.12, 0.42):
        vcyl(bm, 0.175, 0.06, z, segs=12)
    parts.append(link('tankBand', bm, m['tankBand']))
    return join(parts, 'FuelCell')


def crystal_cluster(m):
    parts = []
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=1, radius=0.22)
    bmesh.ops.scale(bm, vec=(1.4, 1, 0.45), verts=bm.verts)
    parts.append(link('rock', bm, m['rock']))
    for i, (x, h, lean) in enumerate(((-0.14, 0.7, (-0.35, 0.1)), (0.02, 1.0, (0.05, -0.1)), (0.16, 0.6, (0.45, 0.15)), (0.06, 0.45, (0.2, -0.4)))):
        bm = bmesh.new()
        spike(bm, 0.09, h, (x, 0, 0.05), lean)
        parts.append(link(f'crystal{i}', bm, m['crystal' if i % 2 else 'crystalPale']))
    return join(parts, 'CrystalCluster')


def fracture(ob, k, seed):
    """Break a prop into k chunks: Voronoi cells round random points, each cut out with planes and capped.
    Each chunk is its own object '<prop>_piece<i>' with its origin at its middle."""
    rnd = random.Random(seed)
    vs = [v.co for v in ob.data.vertices]
    lo = Vector([min(v[i] for v in vs) for i in range(3)])
    hi = Vector([max(v[i] for v in vs) for i in range(3)])
    seeds = [Vector([lo[i] + (hi[i] - lo[i]) * (0.15 + 0.7 * rnd.random()) for i in range(3)]) for _ in range(k)]
    pieces = []
    for i, s in enumerate(seeds):
        bm = bmesh.new()
        bm.from_mesh(ob.data)
        for j, o in enumerate(seeds):
            if i == j:
                continue
            res = bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(s + o) / 2,
                                         plane_no=(o - s).normalized(), clear_outer=True)
            cut = [e for e in res['geom_cut'] if isinstance(e, bmesh.types.BMEdge)]
            if cut:
                bmesh.ops.holes_fill(bm, edges=cut, sides=0)
        if len(bm.verts) < 4:
            bm.free()
            continue
        mid = sum((v.co for v in bm.verts), Vector()) / len(bm.verts)
        bmesh.ops.translate(bm, verts=bm.verts, vec=-mid)
        me = bpy.data.meshes.new(f'{ob.name}_piece{len(pieces)}')
        bm.to_mesh(me)
        bm.free()
        for mat in ob.data.materials:
            me.materials.append(mat)
        piece = bpy.data.objects.new(me.name, me)
        bpy.context.scene.collection.objects.link(piece)
        piece.location = ob.location + mid
        for p in me.polygons:
            p.use_smooth = False
        pieces.append(piece)
    return pieces


def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    m = {k: material(k, v) for k, v in COLORS.items()}
    props = [hydrant(m), bench(m), cone(m), trash(m), newsbox(m, 'news1', 'NewsBoxRed'), newsbox(m, 'news2', 'NewsBoxBlue'),
             newsbox(m, 'news3', 'NewsBoxYellow'), sign_pole(m), mailbox(m), meter(m), bottle(m), crate(m), planter(m),
             sandwich_board(m), can(m), barrel(m), cardboard(m), food_cart(m), ai_kiosk(m), delivery_bot(m),
             flock_pole(m),
             oil_jug(m), urn(m), amphora(m), shell(m), coral(m), chest(m), mug(m), vase(m), bust(m),
             soda_cup(m), pumpkin(m), hay_bale(m), battery(m), holo_cube(m), server_rack(m), crystal(m), fuel_cell(m),
             crystal_cluster(m)]
    for i, ob in enumerate(props):  # in a row in the file; the game reads each from its origin
        ob.location.x = i * 2.5
    for i, ob in enumerate(props):  # break pieces, a row behind
        for p in fracture(ob, PIECES[ob.name], i):
            p.location.y += 3
    return props


def export():
    os.makedirs(os.path.dirname(GLB), exist_ok=True)
    locs = {}
    for ob in bpy.data.objects:
        locs[ob.name] = ob.location.copy()
    for ob in bpy.data.objects:  # props at the origin; pieces keep their offset in the prop
        if '_piece' in ob.name:
            whole = bpy.data.objects[ob.name.split('_piece')[0]]
            ob.location = locs[ob.name] - locs[whole.name] - Vector((0, 3, 0))
        else:
            ob.location = (0, 0, 0)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=GLB, export_format='GLB', use_selection=True, export_yup=True, export_apply=True)
    for ob in bpy.data.objects:
        ob.location = locs[ob.name]
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)


if __name__ == '__main__':
    for ob in build():
        tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
        n = len([o for o in bpy.data.objects if o.name.startswith(ob.name + '_piece')])
        print(f'{ob.name}: {tris} tris, {n} pieces')
    export()
    print('wrote', GLB)
