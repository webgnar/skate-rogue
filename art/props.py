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
}
# break pieces per prop (art/props.py fracture): more for the ones that should burst
PIECES = {'Hydrant': 4, 'Bench': 5, 'Cone': 3, 'TrashCan': 4, 'NewsBoxRed': 4, 'NewsBoxBlue': 4, 'NewsBoxYellow': 4,
          'SignPole': 3, 'Mailbox': 4, 'Meter': 3, 'Bottle': 5, 'Crate': 6, 'Planter': 5, 'SandwichBoard': 4,
          'Can': 3, 'Barrel': 4, 'CardboardBox': 4, 'FoodCart': 6, 'AIKiosk': 5, 'DeliveryBot': 5, 'FlockPole': 4}


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
             flock_pole(m)]
    for i, ob in enumerate(props):  # in a row in the file; the game reads each from its origin
        ob.location.x = i * 2.5
    for i, ob in enumerate(props):  # break pieces, a row behind
        for p in fracture(ob, PIECES[ob.name], i):
            p.location.y += 3
    return props


def export():
    os.makedirs(os.path.dirname(GLB), exist_ok=True)
    locs = {}
    for ob in bpy.data.objects:  # props at the origin; pieces keep their offset in the prop
        locs[ob.name] = ob.location.copy()
        if '_piece' in ob.name:
            whole = bpy.data.objects[ob.name.split('_piece')[0]]
            ob.location = ob.location - whole.location - Vector((0, 3, 0))
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
