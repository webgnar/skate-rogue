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
#   WantedBoard   the bounty's notice board: two posts, a framed plank panel and a little roof, origin on the ground;
#                 the game pins its poster (a canvas texture) over the panel, 1.2 x 1.6 centred 1.95 up
import math
import os
import sys

import bpy  # first: the bpy module provides bmesh and mathutils
import bmesh

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


def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    m = {k: material(k, v) for k, v in COLORS.items()}
    obs = [el_span(m), el_column(m), el_column_cap(m), signal(m), lens(m, 'SignalRed', 'sigRed', 3.33), lens(m, 'SignalGreen', 'sigGreen', 2.87), wanted_board(m),
           overpass_pillar(m), overpass_cap(m), overpass_rail(m)]
    # laid out in the file for a look: a span on a column, the signal beside it
    at = {'ElSpan': (0, 0, 4), 'ElColumn': (0.6, 0, 0), 'ElColumnCap': (0.6, 0, 3.9), 'TrafficSignal': (-2, 0, 0),
          'SignalRed': (-2, 0, 0), 'SignalGreen': (-2, 0, 0), 'WantedBoard': (-4, 0, 0),
          'OverpassPillar': (6, 0, 0), 'OverpassCap': (6, 0, 3), 'OverpassRail': (5, 0, 3.2)}
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
