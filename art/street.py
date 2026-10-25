# Builds Gnar Run's street structures and exports public/models/street.glb: the Chicago L (the elevated train
# tracks you hide under on the helicopter escape), the traffic signal at each cross street and the bounty's
# wanted board.
#
#   blender -b -P art/street.py            (or run it from Blender's Text Editor; it rebuilds the scene)
#
# Units are tiles, the same axes as the cars: +X along the street, -Y toward the game camera, Z up. The game's z
# (toward the camera) is Blender -Y. Objects:
#   ElSpan        3 tiles of track structure, x 0..3, origin at the underside on the line the game calls z = 0:
#                 two riveted lattice girders, the deck between them, ties and running rails on top
#   ElColumn      a column 1 tall (the game stretches it to the street), origin at its foot, in the back lane
#   ElColumnCap   the bracket at the top of a column reaching out under the girder, origin at the column's top
#   TrafficSignal the pole and three-lamp head, origin at the foot of the pole, lenses unlit
#   SignalRed / SignalGreen   the lit lenses, in place over the unlit ones (the game shows one at a time)
#   OverpassPillar  a concrete pillar 1 tall (stretched to the deck), origin at its foot, behind the lane
#   OverpassCap     the flared head under the deck, origin at the pillar's top
#   OverpassRail    2 tiles of railing along the back of the deck, origin at the deck top
#   ElCar         an L car (CTA 5000-series style) 4 long, x 0..4 running +x, origin at the bottom of its wheels on
#                 the running rail heads, centred between the rails (game z 0.2): stainless body, a blue and red
#                 stripe, the dark window band, two door pairs a side, low roof gear, a plain end at each end
#   ElCarFront    the same car with the cab at its +x end: windshield, destination sign, headlights
#   CableCar      a San Francisco cable car, 4.2 long, origin at the middle of its wheels' bottoms: maroon and cream,
#                 a windowed saloon in the middle, open bench sections with brass poles at both ends, the "60" and
#                 the Municipal Railway band on the sides, gold-lettered roof boards and the clerestory on top
#   WantedBoard   the bounty's notice board: two posts, a framed plank panel and a little roof, origin on the ground;
#                 the game pins its poster (a canvas texture) over the panel, 1.2 x 1.6 centred 1.95 up
import math
import os
import sys

import bpy  # first: the bpy module provides bmesh and mathutils
import bmesh
from mathutils import Matrix

HERE = os.path.dirname(os.path.abspath(__file__)) if '__file__' in dir() else bpy.path.abspath('//')
sys.path.insert(0, HERE)
from cars import box, cyl, join, link, material, prism  # noqa: E402  (shared helpers)
from props import vcyl  # noqa: E402

ROOT = os.path.dirname(HERE)
GLB = os.path.join(ROOT, 'public', 'models', 'street.glb')
BLEND = os.path.join(HERE, 'street.blend')

SPAN = 3.0
GIRDERS = (1.35, -1.75)  # Blender y of the back and front girders (game z -1.35 and 1.75)
DECK_Y = (-1.8, 1.4)
COLUMN_Y = 2.4  # game z -2.4: the back lane

COLORS = {
    'elSteel': 0x2F3A33,  # the L's dark green
    'elRust': 0x5A3A2A,
    'elRivet': 0x46524A,
    'elTie': 0x3A2A20,
    'elRail': 0x8A8E92,
    'sigPole': 0x2B3A30,
    'sigHead': 0x1C2420,
    'sigLens': 0x2A2622,  # an unlit lens
    'sigAmber': 0x5A4418,
    'opConcrete': 0x8C8794,
    'opMetal': 0xB8BCC8,
    'boardWood': 0x6A4428,
    'boardPlank': 0x7E5634,
    'boardRoof': 0x3A2A1E,
    'elCarSteel': 0xB4BAC2,
    'elCarDoor': 0x9EA4AC,
    'elCarGlass': 0x1C2228,
    'elCarBlue': 0x2A4FB0,
    'elCarRed': 0xC8282E,
    'elCarUnder': 0x30333A,
    'elCarSign': 0xFFB030,
    'elCarLamp': 0xFFF4D0,
    'ccMaroon': 0x7A1F26,
    'ccCream': 0xEFE3C4,
    'ccWood': 0xA8682E,
    'ccBrass': 0xD8B048,
    'ccGold': 0xE6BE48,
    'ccGlass': 0x26323E,
    'ccUnder': 0x26232A,
    'ccRoof': 0xD9CFB6,
    'sigRed': 0xFF2A2A,  # glow
    'sigGreen': 0x3AFF7A,  # glow
}


def bar(bm, p0, p1, w, y0, y1):
    """A flat bar from (x, z) p0 to p1, w wide, through y0..y1 (a lattice strip on a girder's face)."""
    dx, dz = p1[0] - p0[0], p1[1] - p0[1]
    n = math.hypot(dx, dz)
    ox, oz = -dz / n * w / 2, dx / n * w / 2
    prism(bm, [(p0[0] - ox, p0[1] - oz), (p1[0] - ox, p1[1] - oz), (p1[0] + ox, p1[1] + oz), (p0[0] + ox, p0[1] + oz)], y0, y1)


def el_span(m):
    parts = []
    steel, rust, rivet = bmesh.new(), bmesh.new(), bmesh.new()
    box(steel, 0, SPAN, DECK_Y[0], DECK_Y[1], 0.0, 0.25)  # the deck
    for gy in GIRDERS:
        out = -1 if gy < 0 else 1  # the girder's outer face is away from the deck
        y0, y1 = gy - 0.06, gy + 0.06
        box(steel, 0, SPAN, y0, y1, -0.05, 0.65)  # web
        for z in (-0.05, 0.57):  # top and bottom flanges, wider than the web
            box(steel, 0, SPAN, gy - 0.12, gy + 0.12, z, z + 0.08)
        face = gy + out * 0.06
        fy = (face, face + out * 0.03) if out > 0 else (face + out * 0.03, face)
        # lattice: X bracing between stiffeners every half tile, on the outer face
        for i in range(6):
            x0, x1 = i * 0.5, i * 0.5 + 0.5
            bar(rust, (x0 + 0.04, 0.05), (x1 - 0.04, 0.55), 0.05, *fy)
            bar(rust, (x0 + 0.04, 0.55), (x1 - 0.04, 0.05), 0.05, *fy)
        for i in range(7):  # stiffeners (the ends land on the joints between spans)
            x = min(SPAN - 0.04, max(0.04, i * 0.5))
            box(steel, x - 0.04, x + 0.04, *fy, 0.03, 0.57)
        for i in range(12):  # rivet heads along the flanges
            x = 0.125 + i * 0.25
            for z in (0.0, 0.61):
                box(rivet, x - 0.02, x + 0.02, *fy, z, z + 0.04)
    parts += [link('elSteel', steel, m['elSteel']), link('elRust', rust, m['elRust']), link('elRivet', rivet, m['elRivet'])]
    ties, rails = bmesh.new(), bmesh.new()
    for i in range(6):
        x = 0.2 + i * 0.5
        box(ties, x - 0.09, x + 0.09, -0.9, 1.3, 0.26, 0.34)
    for gy in (0.3, -0.7):  # running rails (game z -0.3 and 0.7), with a little head
        box(rails, 0, SPAN, gy - 0.03, gy + 0.03, 0.34, 0.4)
        box(rails, 0, SPAN, gy - 0.05, gy + 0.05, 0.4, 0.44)
    box(rails, 0, SPAN, -0.24, -0.16, 0.34, 0.4)  # the third rail, between them
    parts += [link('elTie', ties, m['elTie']), link('elRail', rails, m['elRail'])]
    return join(parts, 'ElSpan')


def el_column(m):
    """A riveted H column: two flanges and a web, 1 tall, origin at its foot."""
    steel, rivet = bmesh.new(), bmesh.new()
    for x in (-0.17, 0.13):
        box(steel, x, x + 0.04, COLUMN_Y - 0.17, COLUMN_Y + 0.17, 0, 1)
    box(steel, -0.13, 0.13, COLUMN_Y - 0.03, COLUMN_Y + 0.03, 0, 1)
    for z in (0.25, 0.75):  # batten bands
        box(rivet, -0.18, 0.18, COLUMN_Y - 0.18, COLUMN_Y + 0.18, z - 0.02, z + 0.02)
    return join([link('elSteel', steel, m['elSteel']), link('elRivet', rivet, m['elRivet'])], 'ElColumn')


def el_column_cap(m):
    """The bent at the top of a column: a cap plate and a knee bracket out under the back girder."""
    steel, rust = bmesh.new(), bmesh.new()
    box(steel, -0.22, 0.22, COLUMN_Y - 0.22, COLUMN_Y + 0.22, -0.08, 0)  # cap plate
    box(steel, -0.15, 0.15, GIRDERS[0] - 0.1, COLUMN_Y + 0.15, -0.25, -0.05)  # the arm out under the girder
    return join([link('elSteel', steel, m['elSteel']), knee(m)], 'ElColumnCap')


def knee(m):
    """The knee brace: a triangular plate from the column's face out along the arm, in the y-z plane."""
    bm = bmesh.new()
    pts = [(COLUMN_Y - 0.16, -0.9), (COLUMN_Y - 0.16, -0.25), (GIRDERS[0] + 0.05, -0.25)]
    a = [bm.verts.new((-0.03, y, z)) for y, z in pts]
    b = [bm.verts.new((0.03, y, z)) for y, z in pts]
    bm.faces.new(a)
    bm.faces.new(b[::-1])
    for i in range(3):
        bm.faces.new((a[i], b[i], b[(i + 1) % 3], a[(i + 1) % 3]))
    return link('elSteel', bm, m['elSteel'])


def signal(m):
    parts = []
    pole, head = bmesh.new(), bmesh.new()
    vcyl(pole, 0.05, 3.0, 0, segs=8)
    vcyl(pole, 0.09, 0.12, 0, segs=8)  # base collar
    box(head, -0.15, 0.15, -0.12, 0.12, 2.75, 3.45)  # the head
    box(head, -0.21, 0.21, -0.02, 0.0, 2.69, 3.51)  # backplate, behind the lenses' faces
    visors = bmesh.new()
    lenses, amber = bmesh.new(), bmesh.new()
    for z, mesh in ((3.33, lenses), (3.1, amber), (2.87, lenses)):
        cyl(mesh, 0.085, 0.02, (0, -0.125, z), segs=12)
        # a hood over each lens: a thin curved sheet open at the bottom
        for i in range(6):
            a0, a1 = math.pi * i / 6, math.pi * (i + 1) / 6
            box(visors, 0.1 * math.cos(a1) - 0.012, 0.1 * math.cos(a0) + 0.012, -0.26, -0.12,
                z + 0.1 * math.sin(a0) - 0.01, z + 0.1 * math.sin(a1) + 0.01)
    parts += [link('sigPole', pole, m['sigPole']), link('sigHead', head, m['sigHead']), link('sigHead', visors, m['sigHead']),
              link('sigLens', lenses, m['sigLens']), link('sigAmber', amber, m['sigAmber'])]
    return join(parts, 'TrafficSignal')


def lens(m, name, mat, z):
    bm = bmesh.new()
    cyl(bm, 0.085, 0.02, (0, -0.14, z), segs=12)
    return join([link(mat, bm, m[mat])], name)


PILLAR_Y = 1.2  # game z -1.2
RAIL_Y = 1.4


def overpass_pillar(m):
    bm = bmesh.new()
    box(bm, -0.25, 0.25, PILLAR_Y - 0.25, PILLAR_Y + 0.25, 0, 1)
    for x in (-0.25, 0.25):  # chamfer strips standing proud at the front corners catch the ink
        box(bm, x - 0.03, x + 0.03, PILLAR_Y - 0.28, PILLAR_Y - 0.22, 0, 1)
    return join([link('opConcrete', bm, m['opConcrete'])], 'OverpassPillar')


def overpass_cap(m):
    bm = bmesh.new()
    prism(bm, [(-0.25, -0.45), (0.25, -0.45), (0.45, -0.15), (0.45, 0), (-0.45, 0), (-0.45, -0.15)], PILLAR_Y - 0.4, PILLAR_Y + 0.4)
    box(bm, -0.3, 0.3, PILLAR_Y - 0.3, PILLAR_Y + 0.3, -0.55, -0.45)  # a plinth band where it meets the shaft
    return join([link('opConcrete', bm, m['opConcrete'])], 'OverpassCap')


def overpass_rail(m):
    bm = bmesh.new()
    box(bm, 0, 2, RAIL_Y - 0.05, RAIL_Y + 0.05, 0.68, 0.76)  # top rail
    box(bm, 0, 2, RAIL_Y - 0.03, RAIL_Y + 0.03, 0.08, 0.13)  # bottom rail
    for x in (0.0, 1.0):  # posts
        box(bm, x + 0.02, x + 0.1, RAIL_Y - 0.05, RAIL_Y + 0.05, 0, 0.72)
    for i in range(8):  # balusters
        x = 0.06 + i * 0.25
        if i % 4:
            box(bm, x - 0.015, x + 0.015, RAIL_Y - 0.015, RAIL_Y + 0.015, 0.13, 0.68)
    return join([link('opMetal', bm, m['opMetal'])], 'OverpassRail')


def wanted_board(m):
    wood, plank, roof = bmesh.new(), bmesh.new(), bmesh.new()
    for x in (-0.62, 0.62):  # posts, sunk in the sidewalk, up past the panel
        box(wood, x - 0.05, x + 0.05, -0.05, 0.05, 0, 2.95)
    for i in range(6):  # the panel's planks, behind the poster
        z = 1.1 + i * 1.7 / 6
        box(plank, -0.66, 0.66, -0.035 + (i % 2) * 0.005, 0.04, z + 0.008, z + 1.7 / 6 - 0.008)
    # a frame round the poster (1.2 x 1.6), standing just proud of it
    box(wood, -0.7, 0.7, -0.08, -0.02, 2.75, 2.83)
    box(wood, -0.7, 0.7, -0.08, -0.02, 1.07, 1.15)
    for x in (-0.66, 0.66):
        box(wood, x - 0.04, x + 0.04, -0.08, -0.02, 1.07, 2.83)
    # a little gabled roof over it
    prism(roof, [(-0.85, 2.92), (0.85, 2.92), (0, 3.18)], -0.2, 0.14)
    return join([link('boardWood', wood, m['boardWood']), link('boardPlank', plank, m['boardPlank']),
                 link('boardRoof', roof, m['boardRoof'])], 'WantedBoard')


CAR_L, CAR_H = 4.0, 1.7
CAR_Y = (-1.15, 0.75)  # 1.9 wide about Blender y -0.2 (game z 0.2), between the running rails


def el_car(m, cab=False):
    """An L car on the running rails: bogies and wheels under a stainless body. Its faces are the camera side
    (Blender -y) and the back; both get the stripe, windows and doors. cab: the +x end is the driver's end."""
    y0, y1 = CAR_Y
    mid = (y0 + y1) / 2
    steel, door, glass, blue, red, under = (bmesh.new() for _ in range(6))
    # running gear: two bogies, each two axles over the rails (Blender y 0.3 and -0.7)
    for bx in (0.75, 3.25):
        box(under, bx - 0.42, bx + 0.42, -0.85, 0.45, 0.1, 0.3)
        for ax in (bx - 0.25, bx + 0.25):
            cyl(under, 0.14, 1.2, (ax, -0.2, 0.14), segs=8)
    box(under, 0.1, 3.9, y0 + 0.1, y1 - 0.1, 0.3, 0.44)  # underframe, set in from the sides
    box(steel, 0.02, 3.98, y0, y1, 0.44, 1.58)  # the body
    box(steel, 0.08, 3.92, y0 + 0.1, y1 - 0.1, 1.58, 1.64)  # the roof, a little narrower
    box(under, 1.3, 2.7, mid - 0.5, mid + 0.5, 1.64, 1.7)  # roof gear (air conditioning), kept low
    for fy, out in ((y0, -1), (y1, 1)):
        face = (fy, fy + out * 0.015) if out > 0 else (fy + out * 0.015, fy)
        proud = (fy, fy + out * 0.025) if out > 0 else (fy + out * 0.025, fy)
        prouder = (fy, fy + out * 0.035) if out > 0 else (fy + out * 0.035, fy)  # over the door leaves
        box(blue, 0.02, 3.98, *face, 0.74, 0.8)  # the stripe under the windows
        box(red, 0.02, 3.98, *face, 0.68, 0.74)
        box(glass, 0.15, 3.85, *face, 0.95, 1.35)  # the window band
        for x in (0.15, 0.95, 1.55, 2.45, 3.05, 3.85):  # pillars between the windows
            box(steel, x - 0.05, x + 0.05, *proud, 0.93, 1.37)
        for dx in (1.0, 2.5):  # door pairs: steel leaves with tall windows, a dark seam down the middle
            box(door, dx, dx + 0.5, *proud, 0.46, 1.48)
            for lx in (dx + 0.06, dx + 0.29):
                box(glass, lx, lx + 0.15, *prouder, 0.98, 1.36)
            box(glass, dx + 0.245, dx + 0.255, *prouder, 0.46, 1.48)
    parts = []
    lamps = sign = None
    for ex, out in ((0.02, -1), (3.98, 1)):
        face = (ex, ex + out * 0.015) if out > 0 else (ex + out * 0.015, ex)
        if cab and out > 0:  # the driver's end: a wide windshield, the destination sign over it, headlights
            box(glass, *face, y0 + 0.15, y1 - 0.15, 0.98, 1.4)
            sign, lamps = bmesh.new(), bmesh.new()
            box(sign, *face, mid - 0.45, mid + 0.45, 1.43, 1.55)
            for ly in (y0 + 0.25, y1 - 0.25):
                box(lamps, *face, ly - 0.08, ly + 0.08, 0.55, 0.65)
            box(red, *face, y0, y1, 0.68, 0.74)
            box(blue, *face, y0, y1, 0.74, 0.8)
        else:  # a plain end: the door through to the next car, a window each side of it
            box(glass, *face, mid - 0.22, mid + 0.22, 0.5, 1.45)
            for wy in (y0 + 0.3, y1 - 0.3):
                box(glass, *face, wy - 0.18, wy + 0.18, 0.98, 1.35)
    parts += [link('elCarSteel', steel, m['elCarSteel']), link('elCarDoor', door, m['elCarDoor']),
              link('elCarGlass', glass, m['elCarGlass']), link('elCarBlue', blue, m['elCarBlue']),
              link('elCarRed', red, m['elCarRed']), link('elCarUnder', under, m['elCarUnder'])]
    if sign:
        parts += [link('elCarSign', sign, m['elCarSign']), link('elCarLamp', lamps, m['elCarLamp'])]
    return join(parts, 'ElCarFront' if cab else 'ElCar')


CC_L, CC_W = 4.2, 1.3

# seven-segment digits for the car's number, lit segments a..g (top, top right, bottom right, bottom, bottom left,
# top left, middle)
SEGMENTS = {'6': 'acdefg', '0': 'abcdef'}


def digits(bm, text, x0, y0, y1, z0, h):
    """Gold numerals on a side or end, h tall from z0, starting at x0 (along x), through y0..y1."""
    w, t = h * 0.5, h * 0.14
    for i, ch in enumerate(text):
        x = x0 + i * (w + t * 1.6)
        segs = {
            'a': (x, x + w, z0 + h - t, z0 + h), 'd': (x, x + w, z0, z0 + t), 'g': (x, x + w, z0 + h / 2 - t / 2, z0 + h / 2 + t / 2),
            'b': (x + w - t, x + w, z0 + h / 2, z0 + h), 'c': (x + w - t, x + w, z0, z0 + h / 2),
            'e': (x, x + t, z0, z0 + h / 2), 'f': (x, x + t, z0 + h / 2, z0 + h),
        }
        for k in SEGMENTS[ch]:
            a, b, c, d = segs[k]
            box(bm, a, b, y0, y1, c, d)


def lettering(bm, x0, x1, y0, y1, z0, z1, seed=0):
    """A line of lettering too small to read: word-length runs of little strokes."""
    x, i = x0, seed
    while x < x1:
        word = 3 + (i * 7) % 6
        for _ in range(word):
            if x + 0.035 > x1:
                break
            box(bm, x, x + 0.035, y0, y1, z0, z1)
            x += 0.055
        x += 0.09
        i += 1


def cable_car(m):
    L, W = CC_L, CC_W
    hl, hw = L / 2, W / 2
    maroon, cream, wood, brass, gold, glass, under, roof = (bmesh.new() for _ in range(8))
    # running gear and frame
    for tx in (-1.15, 1.15):
        box(under, tx - 0.4, tx + 0.4, -0.5, 0.5, 0.12, 0.3)
        for wx in (tx - 0.25, tx + 0.25):
            cyl(under, 0.12, 1.1, (wx, 0, 0.12), segs=8)
    box(under, -hl + 0.1, hl - 0.1, -hw + 0.15, hw - 0.15, 0.26, 0.36)
    # the floor and the cream sill band with the Municipal Railway line on each side
    box(cream, -hl, hl, -hw - 0.06, hw + 0.06, 0.36, 0.56)
    for fy in (-hw - 0.06, hw + 0.06):
        f = sorted((fy, fy + (0.01 if fy > 0 else -0.01)))
        lettering(maroon, -1.0, 1.05, *f, 0.43, 0.49)
    # the saloon in the middle: maroon panels under a band of windows, a cream letter board over them
    sx = 1.0
    box(maroon, -sx, sx, -hw, hw, 0.56, 0.95)
    box(cream, -sx, sx, -hw, hw, 0.95, 1.43)  # the window frames
    box(cream, -sx, sx, -hw - 0.005, hw + 0.005, 1.43, 1.55)  # letter board
    for fy, out in ((-hw, -1), (hw, 1)):
        f = sorted((fy, fy + out * 0.015))
        for i in range(4):
            x0 = -sx + 0.08 + i * 0.49
            box(glass, x0, x0 + 0.41, *f, 1.0, 1.38)
        box(gold, -0.36, 0.4, *f, 0.66, 0.68)  # the panel's gold lining and the number in it
        box(gold, -0.36, 0.4, *f, 0.86, 0.88)
        digits(gold, '60', -0.13, *sorted((fy, fy + out * 0.022)), 0.7, 0.13)
    # the open sections: benches facing out along both sides, brass grab poles, maroon corner posts
    for side in (-1, 1):
        x0, x1 = (sx, hl - 0.18) if side > 0 else (-hl + 0.18, -sx)
        for by in (-hw + 0.2, hw - 0.2):
            box(wood, x0, x1, by - 0.16, by + 0.16, 0.74, 0.8)  # the seat
            box(wood, x0, x1, by - 0.03 * (1 if by > 0 else -1) - 0.03, by - 0.03 * (1 if by > 0 else -1) + 0.03, 0.8, 1.12)  # its back
            box(maroon, x0, x1, by - 0.12, by + 0.12, 0.56, 0.74)  # the bench box under it
        for px in [x0 + (x1 - x0) * k / 3 for k in range(4)]:
            for py in (-hw + 0.03, hw - 0.03):
                vcyl(brass, 0.025, 1.0, 0.56, at=(px, py), segs=6)
        # the end: a maroon dash with the number, windows over it
        ex = side * (hl - 0.09)
        box(maroon, ex - 0.09, ex + 0.09, -hw, hw, 0.56, 0.98)
        box(cream, ex - 0.07, ex + 0.07, -hw, hw, 0.98, 1.43)
        f = sorted((side * hl, side * (hl + 0.015)))
        for wy in (-0.42, 0.0, 0.42):
            box(glass, *f, wy - 0.17, wy + 0.17, 1.03, 1.38)
        box(gold, *f, -0.45, 0.45, 0.62, 0.64)
        box(gold, *f, -0.45, 0.45, 0.9, 0.92)
        # the number on the dash, reading across the end (built along x, turned onto the end below)
        dash = bmesh.new()
        digits(dash, '60', -0.13, -0.011, 0.0, 0.69, 0.15)
        bmesh.ops.rotate(dash, verts=dash.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(-side * math.pi / 2, 3, 'Z'))
        bmesh.ops.translate(dash, verts=dash.verts, vec=(side * hl, 0, 0))
        dm = bpy.data.meshes.new('ccDash')
        dash.to_mesh(dm)
        dash.free()
        gold.from_mesh(dm)
        bpy.data.meshes.remove(dm)
        box(cream, ex - 0.05, ex + 0.05, -0.32, 0.32, 1.68, 1.86)  # the route sign on the roof
        box(glass, *sorted((side * (hl - 0.04), side * (hl - 0.06))), -0.27, 0.27, 1.71, 1.83)
    # posts holding the roof up over the open sections
    for px in (-hl + 0.12, hl - 0.12, -sx - 0.04, sx + 0.04):
        for py in (-hw + 0.04, hw - 0.04):
            box(maroon, px - 0.04, px + 0.04, py - 0.04, py + 0.04, 0.56, 1.55)
    # the roof: maroon boards with the gold-lettered routes, the cream deck, the clerestory down the middle
    box(roof, -hl - 0.08, hl + 0.08, -hw - 0.06, hw + 0.06, 1.62, 1.68)
    for fy, out in ((-hw - 0.06, -1), (hw + 0.06, 1)):
        box(maroon, -hl - 0.08, hl + 0.08, *sorted((fy, fy - out * 0.04)), 1.5, 1.66)
        lettering(gold, -hl + 0.2, hl - 0.2, *sorted((fy, fy + out * 0.008)), 1.55, 1.61, seed=3)
    box(cream, -1.5, 1.5, -0.4, 0.4, 1.68, 1.82)
    box(roof, -1.55, 1.55, -0.45, 0.45, 1.82, 1.86)
    for fy, out in ((-0.4, -1), (0.4, 1)):
        for i in range(8):
            x0 = -1.4 + i * 0.36
            box(glass, x0, x0 + 0.24, *sorted((fy, fy + out * 0.012)), 1.71, 1.79)
    parts = [link(n, bm, m[n]) for n, bm in (('ccMaroon', maroon), ('ccCream', cream), ('ccWood', wood), ('ccBrass', brass),
                                             ('ccGold', gold), ('ccGlass', glass), ('ccUnder', under), ('ccRoof', roof))]
    return join(parts, 'CableCar')


def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    m = {k: material(k, v) for k, v in COLORS.items()}
    obs = [el_span(m), el_column(m), el_column_cap(m), signal(m), lens(m, 'SignalRed', 'sigRed', 3.33), lens(m, 'SignalGreen', 'sigGreen', 2.87), wanted_board(m),
           overpass_pillar(m), overpass_cap(m), overpass_rail(m), el_car(m), el_car(m, cab=True), cable_car(m)]
    # laid out in the file for a look: a span on a column, the signal beside it
    at = {'ElSpan': (0, 0, 4), 'ElColumn': (0.6, 0, 0), 'ElColumnCap': (0.6, 0, 3.9), 'TrafficSignal': (-2, 0, 0),
          'SignalRed': (-2, 0, 0), 'SignalGreen': (-2, 0, 0), 'WantedBoard': (-4, 0, 0),
          'OverpassPillar': (6, 0, 0), 'OverpassCap': (6, 0, 3), 'OverpassRail': (5, 0, 3.2),
          'ElCar': (-4, 0, 4.44), 'ElCarFront': (0, 0, 4.44), 'CableCar': (-8, 0, 0)}
    obs[1].scale = (1, 1, 3.9)
    for ob in obs:
        ob.location = at[ob.name]
    return obs


def export():
    os.makedirs(os.path.dirname(GLB), exist_ok=True)
    locs = {ob.name: (ob.location.copy(), ob.scale.copy()) for ob in bpy.data.objects}
    for ob in bpy.data.objects:
        ob.location = (0, 0, 0)
        ob.scale = (1, 1, 1)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=GLB, export_format='GLB', use_selection=True, export_yup=True, export_apply=True)
    for ob in bpy.data.objects:
        ob.location, ob.scale = locs[ob.name]
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
