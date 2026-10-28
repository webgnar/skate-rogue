# Builds Gnar Run's cars in Blender and exports public/models/cars.glb: a Prius-style hatchback (traffic and parked
# cars), the robotaxi on the same body, and the enforcer cruiser, a Tahoe-style sheriff SUV (zack's references,
# 2026-10-24).
#
#   blender -b -P art/cars.py            (or run it from Blender's Text Editor; it rebuilds the scene)
#
# Units are tiles (1 tile = 1 world unit). Blender +X is the front of the car, Y is across it (the game's depth),
# Z is up from the street. Each car is one object with its origin on the street under its middle. The hatchbacks
# match the physics hitbox in makeCar (src/render/kit.ts): 2.3 long, 1.6 wide, and the top of the roof exactly 1.25
# up, because the skater lands on it; the game stretches them to other hitbox sizes and swaps the `paint` material
# per car. The cruiser only chases, so it is its real, bigger size.
import math
import os

import bpy  # first: the bpy module provides bmesh and mathutils
import bmesh
from mathutils import Matrix

import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import car_damage  # noqa: E402  the dented, busted and wrecked copies

HERE = os.path.dirname(os.path.abspath(__file__)) if '__file__' in dir() else bpy.path.abspath('//')
ROOT = os.path.dirname(HERE)
GLB = os.path.join(ROOT, 'public', 'models', 'cars.glb')
DAMAGE_GLB = os.path.join(ROOT, 'public', 'models', 'cars-damage.glb')  # loaded after the game starts
BLEND = os.path.join(HERE, 'cars.blend')

# Prius-style hatchback: long raked windscreen into a roof that peaks over the front seats, a long slope down to the
# kammback tail with its spoiler bar, and tall tail lamps
PRIUS = {
    'len': 2.3,
    'wide': 1.6,
    'cabin_w': 1.4,
    'wheel_r': 0.24,
    'wheel_x': 0.74,
    'clear': 0.14,
    'lower': [(1.12, 0.14), (1.165, 0.22), (1.17, 0.42), (1.1, 0.53), (0.6, 0.68), (-0.95, 0.86), (-1.13, 0.9),
              (-1.165, 0.62), (-1.165, 0.22), (-1.12, 0.14)],
    'cabin': [(0.6, 0.68), (-0.04, 1.25), (-0.36, 1.24), (-0.98, 0.95), (-0.95, 0.86)],
    'pillars': [-0.27],
    'seams': [0.42, -0.3],
    'handles': [0.22, -0.48],
    'mirror_x': 0.45,
    'head': (1.06, 1.15, 0.46, 0.55, 0.45, 0.74),  # x0 x1 z0 z1 y0 y1
    'tail': (-1.17, -1.12, 0.6, 0.88, 0.48, 0.74),
}
# Tahoe-style SUV: tall flat hood and grille, upright windscreen, long flat roof, square back, three side windows
SUV = {
    'len': 2.7,
    'wide': 1.75,
    'cabin_w': 1.6,
    'wheel_r': 0.3,
    'wheel_x': 0.86,
    'clear': 0.2,
    'lower': [(1.31, 0.2), (1.37, 0.3), (1.37, 0.86), (1.3, 0.95), (0.62, 0.99), (-1.32, 0.99), (-1.36, 0.95),
              (-1.36, 0.3), (-1.31, 0.2)],
    'cabin': [(0.62, 0.99), (0.33, 1.6), (-1.27, 1.62), (-1.33, 0.99)],
    'pillars': [-0.2, -0.82],
    'seams': [0.5, -0.22, -0.84],
    'handles': [0.3, -0.42],
    'mirror_x': 0.5,
    'head': (1.3, 1.385, 0.72, 0.84, 0.5, 0.82),
    'tail': (-1.375, -1.33, 0.95, 1.4, 0.68, 0.84),
}

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
    'badge': 0xD9A92E,  # sheriff gold
    'darkrim': 0x2A2C33,
    'busWhite': 0xEEEEF2,
    'ctaBlue': 0x1F5FBF,
    'ctaRed': 0xC8312B,
    'sign': 0xFFB020,  # destination sign, glows
    'frame': 0xB8BCC4,  # truck box rails and corner posts
    'inside': 0x15151C,
}
# a CTA bus and a box truck, at their hitbox sizes (src/traffic/traffic.ts): the roofs are exactly at the hitbox roof
BUS = {'len': 6.0, 'wide': 1.9, 'roof': 2.25, 'wheel_r': 0.32, 'axles': (1.7, -1.3), 'clear': 0.25}
TRUCK = {'len': 4.0, 'wide': 1.9, 'roof': 2.0, 'floor': 0.45, 'cab': 1.1, 'wheel_r': 0.3, 'axles': (1.45, -1.25)}


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


def lower_profile(spec):
    """Body below the windows with the wheel arches cut out: the outline from the spec, then along the bottom."""
    pts = list(spec['lower'][:-1])
    r, wx, clear = spec['wheel_r'], spec['wheel_x'], spec['clear']
    arch = r + 0.06
    for cx in (-wx, wx):  # back arch first, walking forward along the bottom
        pts.append((cx - arch, clear))
        for i in range(9):
            a = math.pi - i / 8 * math.pi
            pts.append((cx + arch * math.cos(a), r + arch * math.sin(a) * 0.95))
        pts.append((cx + arch, clear))
    return pts


def inset(pts, d):
    cx = sum(p[0] for p in pts) / len(pts)
    cz = sum(p[1] for p in pts) / len(pts)
    return [(cx + (x - cx) * (1 - d), cz + (z - cz) * (1 - d * 1.6)) for x, z in pts]


def pane(bm, pts, i, half, frame=0.06, proud=0.012):
    """A window in the panel of the side profile `pts` from point i to i + 1 (x, z), across the car to +-half: a
    frame's width in from both ends, standing just proud of the panel on the outside."""
    a, b = pts[i], pts[i + 1]
    cx = sum(p[0] for p in pts) / len(pts)
    cz = sum(p[1] for p in pts) / len(pts)
    dx, dz = b[0] - a[0], b[1] - a[1]
    n = math.hypot(dx, dz)
    ux, uz = dx / n, dz / n
    nx, nz = uz, -ux
    if nx * ((a[0] + b[0]) / 2 - cx) + nz * ((a[1] + b[1]) / 2 - cz) < 0:  # away from the middle of the profile
        nx, nz = -nx, -nz
    p0 = (a[0] + ux * frame, a[1] + uz * frame)
    p1 = (b[0] - ux * frame, b[1] - uz * frame)
    out = lambda p, d: (p[0] + nx * d, p[1] + nz * d)
    prism(bm, [out(p0, -0.01), out(p1, -0.01), out(p1, proud), out(p0, proud)], -half, half)


def car(name, mats, kind):
    spec = SUV if kind == 'cruiser' else PRIUS
    L, W, CW = spec['len'], spec['wide'], spec['cabin_w']
    front, back = spec['lower'][2][0], spec['lower'][-3][0]
    r, wx = spec['wheel_r'], spec['wheel_x']
    belt = min(z for _, z in spec['cabin'])
    roof = max(z for _, z in spec['cabin'])
    paint = mats['white'] if kind == 'robotaxi' else mats['black'] if kind == 'cruiser' else mats['paint']
    parts = []

    bm = bmesh.new()
    prism(bm, lower_profile(spec), -W / 2, W / 2)
    prism(bm, spec['cabin'], -CW / 2, CW / 2)
    for px in spec['pillars']:  # B and C pillars split the side glass
        box(bm, px - 0.05, px + 0.05, -CW / 2 - 0.012, CW / 2 + 0.012, belt, roof - 0.03)
    for y in (-1, 1):  # mirrors on little stalks
        mx = spec['mirror_x']
        box(bm, mx - 0.06, mx + 0.06, y * (W / 2), y * (W / 2 + 0.11), belt + 0.03, belt + 0.13)
    parts.append(link('body', bm, paint))

    bm = bmesh.new()  # the glasshouse: dark band just proud of the cabin sides, windscreen and back glass
    prism(bm, inset(spec['cabin'], 0.07), -CW / 2 - 0.006, CW / 2 + 0.006)
    # the windscreen and the back glass, just proud of the raked panels they sit in (zack, 2026-10-28: the inset
    # glasshouse left them inside the body)
    pane(bm, spec['cabin'], 0, CW / 2 - 0.07)
    pane(bm, spec['cabin'], 2, CW / 2 - 0.07)
    parts.append(link('glass', bm, mats['glass']))

    bm = bmesh.new()  # bumpers, grille, door seams, handles
    clear = spec['clear']
    box(bm, front - 0.03, front + 0.04, -W / 2 + 0.02, W / 2 - 0.02, clear, clear + 0.16)
    box(bm, back - 0.04, back + 0.03, -W / 2 + 0.02, W / 2 - 0.02, clear, clear + 0.16)
    hz = spec['head']
    if kind == 'cruiser':  # tall grille between the lamps
        box(bm, front - 0.01, front + 0.02, -hz[4], hz[4], hz[2] - 0.2, hz[3] + 0.04)
    else:  # Prius: a low intake under the nose
        box(bm, front - 0.01, front + 0.02, -0.45, 0.45, 0.3, 0.4)
    for y in (-1, 1):
        for sx in spec['seams']:
            box(bm, sx - 0.008, sx + 0.008, y * (W / 2 - 0.002), y * (W / 2 + 0.006), clear + 0.1, belt - 0.03)
        for hx in spec['handles']:
            box(bm, hx - 0.07, hx, y * (W / 2), y * (W / 2 + 0.012), belt - 0.14, belt - 0.1)
    if kind == 'cruiser':
        # grille guard: two uprights and three cross bars out in front
        gx = front + 0.1
        for y in (-0.38, 0.38):
            box(bm, gx - 0.03, gx + 0.03, y - 0.04, y + 0.04, 0.25, 0.95)
        for z in (0.3, 0.62, 0.9):
            box(bm, gx - 0.025, gx + 0.025, -0.5, 0.5, z - 0.03, z + 0.03)
        for y in (-0.38, 0.38):
            box(bm, front, gx, y - 0.03, y + 0.03, 0.4, 0.46)
        # running boards
        for y in (-1, 1):
            box(bm, -wx + r + 0.08, wx - r - 0.08, y * (W / 2 - 0.05), y * (W / 2 + 0.07), clear + 0.04, clear + 0.08)
    else:  # spoiler bar across the back glass
        box(bm, -1.02, -0.9, -CW / 2, CW / 2, 0.93, 0.97)
    parts.append(link('trim', bm, mats['trim']))

    bm = bmesh.new()
    for y in (-1, 1):
        box(bm, hz[0], hz[1], y * hz[4], y * hz[5], hz[2], hz[3])
    parts.append(link('lamp', bm, mats['lamp']))
    bm = bmesh.new()
    tz = spec['tail']
    for y in (-1, 1):
        box(bm, tz[0], tz[1], y * tz[4], y * tz[5], tz[2], tz[3])
    parts.append(link('tail', bm, mats['tail']))

    bm = bmesh.new()
    for x in (-wx, wx):
        for y in (-1, 1):
            cyl(bm, r, 0.24, (x, y * (W / 2 - 0.11), r), segs=16)
    parts.append(link('tire', bm, mats['tire']))
    bm = bmesh.new()  # Prius aero wheel covers, the SUV's black rims
    for x in (-wx, wx):
        for y in (-1, 1):
            cyl(bm, r * 0.66, 0.02, (x, y * (W / 2 + 0.012), r), segs=12)
    parts.append(link('rim', bm, mats['darkrim'] if kind == 'cruiser' else mats['rim']))

    if kind == 'cruiser':
        # gold swoosh along the doors, rising toward the back like the sheriff livery, and a star on the front door
        bm = bmesh.new()
        for y in (-1, 1):
            yy = y * (W / 2 + 0.008)
            band = [(0.55, 0.42), (0.55, 0.5), (-0.6, 0.62), (-1.22, 0.9), (-1.22, 0.78), (-0.6, 0.52)]
            vs = [bm.verts.new((x, yy, z)) for x, z in band]
            bm.faces.new(vs if y < 0 else vs[::-1])  # facing out of the side it's on
            vs = bmesh.ops.create_circle(bm, cap_ends=True, segments=10, radius=0.085)['verts']
            bmesh.ops.rotate(bm, verts=vs, cent=(0, 0, 0), matrix=Matrix.Rotation(y * -math.pi / 2, 3, 'X'))
            bmesh.ops.translate(bm, verts=vs, vec=(0.3, y * (W / 2 + 0.01), belt - 0.25))
        parts.append(link('badge', bm, mats['badge']))
        # spotlight on the A pillar
        bm = bmesh.new()
        for y in (-1,):
            box(bm, 0.52, 0.62, y * (CW / 2 + 0.02), y * (CW / 2 + 0.1), belt + 0.08, belt + 0.16)
        parts.append(link('spot', bm, mats['trim']))

    if kind == 'robotaxi':  # lidar puck at the back of the roof, sensor pods on the fenders, a cyan light strip
        bm = bmesh.new()
        vs = bmesh.ops.create_cone(bm, cap_ends=True, segments=12, radius1=0.12, radius2=0.1, depth=0.07)['verts']
        bmesh.ops.translate(bm, verts=vs, vec=(-0.5, 0, 1.22))
        for y in (-1, 1):
            box(bm, 0.62, 0.74, y * (W / 2 - 0.01), y * (W / 2 + 0.04), 0.58, 0.68)
        parts.append(link('sensor', bm, mats['sensor']))
        bm = bmesh.new()
        for y in (-1, 1):
            box(bm, -0.95, 0.5, y * (W / 2), y * (W / 2 + 0.008), 0.34, 0.37)
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


def join(parts, name):
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


def arches(r, axles, clear):
    """Points along a body's bottom edge, back to front, with an arch over each wheel."""
    pts = []
    arch = r + 0.07
    for cx in sorted(axles):
        pts.append((cx - arch, clear))
        for i in range(9):
            a = math.pi - i / 8 * math.pi
            pts.append((cx + arch * math.cos(a), r + 0.02 + arch * math.sin(a)))
        pts.append((cx + arch, clear))
    return pts


def wheels(bm_tire, bm_rim, r, axles, W, dual=()):
    for x in axles:
        for y in (-1, 1):
            cyl(bm_tire, r, 0.26 if x in dual else 0.22, (x, y * (W / 2 - 0.13), r), segs=16)
            cyl(bm_rim, r * 0.6, 0.02, (x, y * (W / 2 - 0.01), r), segs=12)
            cyl(bm_rim, r * 0.18, 0.06, (x, y * (W / 2 + 0.01), r), segs=8)  # hub


def bus(mats):
    """CTA-style city bus: white, a black window band with the doors cut through it, blue and red stripes,
    the amber destination sign, and the bike rack folded up on the front."""
    L, W, H, r, clear = BUS['len'], BUS['wide'], BUS['roof'], BUS['wheel_r'], BUS['clear']
    fx, bx = L / 2, -L / 2
    fdoor, rdoor = (2.15, 2.8), (-0.35, 0.3)
    parts = []
    bm = bmesh.new()
    outline = [(bx + 0.05, clear), (bx, clear + 0.08), (bx, H - 0.1), (bx + 0.08, H), (fx - 0.12, H), (fx - 0.02, H - 0.12),
               (fx, H - 0.35), (fx, clear + 0.1), (fx - 0.05, clear)]
    prism(bm, outline + list(reversed(arches(r, BUS['axles'], clear))), -W / 2, W / 2)
    for y in (-1, 1):  # mirrors out front on arms
        box(bm, fx - 0.05, fx + 0.2, y * (W / 2 - 0.05), y * (W / 2 + 0.02), H - 0.42, H - 0.38)
        box(bm, fx + 0.14, fx + 0.22, y * (W / 2 + 0.02), y * (W / 2 + 0.1), H - 0.75, H - 0.38)
    parts.append(link('busbody', bm, mats['busWhite']))

    bm = bmesh.new()  # window band down both sides and the big windscreen, just proud of the body
    for y in (-1, 1):
        yy = y * (W / 2 + 0.006)
        box(bm, bx + 0.25, fx - 0.25, y * (W / 2 - 0.01), yy, 1.15, H - 0.3)
    box(bm, fx - 0.01, fx + 0.006, -W / 2 + 0.12, W / 2 - 0.12, 0.95, H - 0.45)
    box(bm, bx - 0.006, bx + 0.01, -W / 2 + 0.25, W / 2 - 0.25, 1.55, H - 0.4)  # small back window
    for door in (fdoor, rdoor):  # doors on the curb side (the camera's side): glass top to bottom, split down the middle
        box(bm, door[0], door[1], -W / 2 - 0.008, -W / 2 + 0.01, clear + 0.12, H - 0.3)
    parts.append(link('busglass', bm, mats['glass']))

    bm = bmesh.new()  # pillars between the side windows, door frames, bumpers, rear grille, bike rack
    xs = [x / 100 for x in range(int((bx + 0.95) * 100), int((fx - 0.4) * 100), 85)]
    for y in (-1, 1):
        for x in xs:
            if not any(d[0] - 0.05 < x < d[1] + 0.05 for d in (fdoor, rdoor)) or y > 0:
                box(bm, x - 0.035, x + 0.035, y * (W / 2 + 0.005), y * (W / 2 + 0.012), 1.15, H - 0.3)
    for door in (fdoor, rdoor):
        mid = (door[0] + door[1]) / 2
        for x0, x1 in ((door[0] - 0.03, door[0] + 0.02), (door[1] - 0.02, door[1] + 0.03), (mid - 0.02, mid + 0.02)):
            box(bm, x0, x1, -W / 2 - 0.016, -W / 2, clear + 0.12, H - 0.3)
        box(bm, door[0] - 0.03, door[1] + 0.03, -W / 2 - 0.016, -W / 2, H - 0.32, H - 0.28)
    box(bm, fx - 0.03, fx + 0.07, -W / 2 + 0.03, W / 2 - 0.03, clear + 0.02, clear + 0.28)
    box(bm, bx - 0.07, bx + 0.03, -W / 2 + 0.03, W / 2 - 0.03, clear + 0.02, clear + 0.28)
    for z in (0.7, 0.82, 0.94, 1.06):  # engine louvres on the back
        box(bm, bx - 0.012, bx, -0.6, 0.6, z, z + 0.05)
    # bike rack folded up against the front: a frame of tubes
    for y in (-0.55, 0.55):
        box(bm, fx + 0.07, fx + 0.11, y - 0.025, y + 0.025, clear + 0.25, 1.0)
    for z in (clear + 0.3, 0.95):
        box(bm, fx + 0.07, fx + 0.11, -0.6, 0.6, z - 0.02, z + 0.02)
    box(bm, fx, fx + 0.09, -0.06, 0.06, clear + 0.22, clear + 0.32)
    parts.append(link('bustrim', bm, mats['trim']))

    bm = bmesh.new()  # the livery: a blue band and a thin red line under the windows, broken by the doors
    for y in (-1, 1):
        yy0, yy1 = y * (W / 2), y * (W / 2 + 0.008)
        cuts = [bx + 0.05] + ([c for d in (rdoor, fdoor) for c in d] if y < 0 else []) + [fx - 0.05]
        for x0, x1 in zip(cuts[::2], cuts[1::2]):
            box(bm, x0, x1, yy0, yy1, 0.8, 1.0)
    box(bm, fx, fx + 0.008, -W / 2 + 0.05, W / 2 - 0.05, 0.8, 0.9)
    parts.append(link('ctaBlue', bm, mats['ctaBlue']))
    bm = bmesh.new()
    for y in (-1, 1):
        yy0, yy1 = y * (W / 2), y * (W / 2 + 0.009)
        cuts = [bx + 0.05] + ([c for d in (rdoor, fdoor) for c in d] if y < 0 else []) + [fx - 0.05]
        for x0, x1 in zip(cuts[::2], cuts[1::2]):
            box(bm, x0, x1, yy0, yy1, 1.03, 1.09)
    parts.append(link('ctaRed', bm, mats['ctaRed']))

    bm = bmesh.new()  # destination signs: over the windscreen and over the front door
    box(bm, fx - 0.005, fx + 0.012, -W / 2 + 0.2, W / 2 - 0.2, H - 0.36, H - 0.14)
    box(bm, fdoor[0] - 0.45, fdoor[0] - 0.05, -W / 2 - 0.012, -W / 2 + 0.01, H - 0.27, H - 0.12)
    parts.append(link('sign', bm, mats['sign']))
    bm = bmesh.new()
    for y in (-1, 1):
        box(bm, fx, fx + 0.02, y * (W / 2 - 0.32), y * (W / 2 - 0.08), clear + 0.35, clear + 0.5)
    parts.append(link('lamp', bm, mats['lamp']))
    bm = bmesh.new()
    for y in (-1, 1):
        box(bm, bx - 0.02, bx, y * (W / 2 - 0.25), y * (W / 2 - 0.08), clear + 0.4, clear + 0.9)
    parts.append(link('tail', bm, mats['tail']))

    tire, rim = bmesh.new(), bmesh.new()
    wheels(tire, rim, r, BUS['axles'], W, dual=(BUS['axles'][1],))
    parts.append(link('tire', tire, mats['tire']))
    parts.append(link('rim', rim, mats['rim']))
    return join(parts, 'Bus')


def box_truck(mats):
    """Box truck with the roll-up door open at the back: the cab at the front (+X), the box behind it on the
    chassis. The tailgate ramp behind it is built by the game (its length comes from the level)."""
    L, W, H, r, floor, cabL = TRUCK['len'], TRUCK['wide'], TRUCK['roof'], TRUCK['wheel_r'], TRUCK['floor'], TRUCK['cab']
    fx, bx = L / 2, -L / 2
    boxF = fx - cabL - 0.05
    parts = []
    bm = bmesh.new()  # the box (paint): a shell open at the back
    box(bm, bx, boxF, -W / 2, W / 2, floor, H)
    # cab: short hood, upright windscreen, a fairing on the roof up toward the box
    cab = [(boxF + 0.05, 0.42), (fx - 0.05, 0.42), (fx, 0.55), (fx, 0.95), (fx - 0.2, 1.05), (fx - 0.42, 1.08),
           (fx - 0.62, 1.72), (boxF + 0.08, 1.76)]
    prism(bm, cab, -W / 2 + 0.05, W / 2 - 0.05)
    fairing = [(boxF + 0.05, 1.76), (fx - 0.62, 1.72), (boxF + 0.25, 1.95), (boxF + 0.05, 1.95)]
    prism(bm, fairing, -W / 2 + 0.15, W / 2 - 0.15)
    parts.append(link('truckpaint', bm, mats['paint']))

    bm = bmesh.new()  # the open back: dark inside, set into the box
    box(bm, bx - 0.005, bx + 0.02, -W / 2 + 0.07, W / 2 - 0.07, floor + 0.05, H - 0.12)
    parts.append(link('inside', bm, mats['inside']))

    bm = bmesh.new()  # aluminium rails top and bottom, corner posts, the rolled-up door's drum, rear frame
    for y in (-1, 1):
        yy0, yy1 = y * (W / 2 - 0.01), y * (W / 2 + 0.012)
        box(bm, bx - 0.01, boxF + 0.01, yy0, yy1, H - 0.07, H)
        box(bm, bx - 0.01, boxF + 0.01, yy0, yy1, floor, floor + 0.08)
        for x in (bx + 0.03, boxF - 0.03):
            box(bm, x - 0.035, x + 0.035, yy0, yy1, floor, H)
        for x in [bx + 0.03 + i * (boxF - bx - 0.06) / 4 for i in (1, 2, 3)]:  # side posts
            box(bm, x - 0.015, x + 0.015, y * (W / 2), y * (W / 2 + 0.008), floor + 0.08, H - 0.07)
    box(bm, bx - 0.025, bx + 0.02, -W / 2, W / 2, H - 0.14, H)  # header with the door rolled up in it
    for y in (-1, 1):
        box(bm, bx - 0.025, bx + 0.02, y * (W / 2 - 0.08), y * W / 2, floor, H)
    parts.append(link('frame', bm, mats['frame']))

    bm = bmesh.new()  # chassis rails, fuel tank, underride bar, steps, bumper, grille, mirror
    box(bm, bx + 0.2, fx - 0.1, -0.45, 0.45, 0.3, floor)
    box(bm, -0.1, 0.5, -W / 2 + 0.12, -W / 2 + 0.4, 0.22, 0.48)  # fuel tank
    box(bm, bx + 0.05, bx + 0.12, -W / 2 + 0.1, W / 2 - 0.1, 0.25, 0.33)
    for y in (-1, 1):
        box(bm, bx + 0.08, bx + 0.12, y * 0.7, y * 0.75, 0.3, floor)
        box(bm, boxF + 0.12, boxF + 0.4, y * (W / 2 - 0.08), y * (W / 2 + 0.02), 0.32, 0.37)  # cab step
        box(bm, fx - 0.55, fx - 0.5, y * (W / 2 - 0.05), y * (W / 2 + 0.12), 1.2, 1.24)  # mirror arm
        box(bm, fx - 0.58, fx - 0.5, y * (W / 2 + 0.1), y * (W / 2 + 0.16), 1.05, 1.4)  # mirror
    box(bm, fx - 0.02, fx + 0.08, -W / 2 + 0.05, W / 2 - 0.05, 0.4, 0.6)
    box(bm, fx - 0.01, fx + 0.015, -0.55, 0.55, 0.65, 0.92)
    parts.append(link('trucktrim', bm, mats['trim']))

    bm = bmesh.new()  # windscreen and side windows
    box(bm, fx - 0.6, fx - 0.42, -W / 2 + 0.12, W / 2 - 0.12, 1.12, 1.68)
    bmesh.ops.rotate(bm, verts=bm.verts[:], cent=(fx - 0.52, 0, 1.4), matrix=Matrix.Rotation(-0.29, 3, 'Y'))
    for y in (-1, 1):
        prism(bm, [(boxF + 0.3, 1.12), (fx - 0.5, 1.12), (fx - 0.66, 1.66), (boxF + 0.3, 1.68)],
              y * (W / 2 - 0.06), y * (W / 2 - 0.045))
    parts.append(link('truckglass', bm, mats['glass']))
    bm = bmesh.new()
    for y in (-1, 1):
        box(bm, fx, fx + 0.02, y * (W / 2 - 0.35), y * (W / 2 - 0.1), 0.68, 0.84)
        box(bm, fx - 0.4, fx - 0.3, y * (W / 2 - 0.12), y * (W / 2 - 0.02), 1.76, 1.8)  # marker lights over the cab
    parts.append(link('lamp', bm, mats['lamp']))
    bm = bmesh.new()
    for y in (-1, 1):
        box(bm, bx - 0.02, bx, y * (W / 2 - 0.08), y * (W / 2 - 0.02), floor + 0.1, floor + 0.35)
    parts.append(link('tail', bm, mats['tail']))
    tire, rim = bmesh.new(), bmesh.new()
    wheels(tire, rim, r, TRUCK['axles'], W, dual=(TRUCK['axles'][1],))
    parts.append(link('tire', tire, mats['tire']))
    parts.append(link('rim', rim, mats['rim']))
    return join(parts, 'BoxTruck')


def car_door(mats):
    """A parked car's driver door, swung open into the bike lane (src/traffic/street.ts CarDoor). Origin at the
    hinge, on the ground: the door runs back from the hinge to -X, the window's front edge raked like the cars'."""
    W, T = 0.95, 0.035
    parts = []
    bm = bmesh.new()
    prism(bm, [(-W, 0.28), (0, 0.28), (0, 0.83), (-W, 0.83)], -T, T)  # the skin, in the car's paint
    box(bm, -W, -W + 0.06, -T, T, 0.83, 1.17)  # the window frame: back post, top rail, front rake
    box(bm, -W, -0.32, -T, T, 1.13, 1.19)
    prism(bm, [(-0.32, 1.13), (-0.27, 1.19), (0.0, 0.83), (-0.06, 0.83)], -T, T)
    parts.append(link('paint', bm, mats['paint']))
    bm = bmesh.new()
    prism(bm, [(-W + 0.06, 0.83), (-0.06, 0.83), (-0.3, 1.13), (-W + 0.06, 1.13)], -T * 0.6, T * 0.6)
    parts.append(link('glass', bm, mats['glass']))
    bm = bmesh.new()  # the inside: the trim panel and the armrest, and the mirror at the hinge
    box(bm, -W + 0.04, -0.04, T, T + 0.03, 0.32, 0.8)
    box(bm, -0.75, -0.2, T + 0.03, T + 0.1, 0.6, 0.66)
    box(bm, -0.02, 0.1, -T - 0.12, -T, 0.86, 0.98)
    parts.append(link('trim', bm, mats['trim']))
    bm = bmesh.new()  # the handle, outside, near the back edge
    box(bm, -W + 0.1, -W + 0.26, -T - 0.025, -T, 0.7, 0.74)
    parts.append(link('rim', bm, mats['rim']))
    return join(parts, 'CarDoor')


def bus_stop(mats):
    """A CTA bus stop sign: a blue sign with the white band on a grey pole, the route plate under it. Origin at the
    foot of the pole."""
    parts = []
    bm = bmesh.new()
    box(bm, -0.08, 0.08, -0.08, 0.08, 0, 0.04)  # base plate
    vs = bmesh.ops.create_cone(bm, cap_ends=True, segments=8, radius1=0.035, radius2=0.035, depth=2.75)['verts']
    bmesh.ops.translate(bm, verts=vs, vec=(0, 0, 1.375))
    parts.append(link('frame', bm, mats['frame']))
    bm = bmesh.new()
    box(bm, -0.28, 0.28, -0.07, -0.03, 2.0, 2.7)  # the sign, on the camera side of the pole
    parts.append(link('ctaBlue', bm, mats['ctaBlue']))
    bm = bmesh.new()
    box(bm, -0.23, 0.23, -0.075, -0.025, 2.33, 2.5)  # the white band
    box(bm, -0.12, 0.12, -0.075, -0.025, 2.1, 2.24)  # the bus symbol's box
    parts.append(link('busWhite', bm, mats['busWhite']))
    bm = bmesh.new()
    box(bm, -0.2, 0.2, -0.065, -0.03, 1.72, 1.92)  # the route plate
    parts.append(link('ctaRed', bm, mats['ctaRed']))
    return join(parts, 'BusStop')


def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    mats = {k: material(k, v) for k, v in COLORS.items()}
    cars = [car('Sedan', mats, 'sedan'), car('Robotaxi', mats, 'robotaxi'), car('Cruiser', mats, 'cruiser'),
            bus(mats), box_truck(mats), car_door(mats), bus_stop(mats)]
    # car-hop damage (art/car_damage.py): each hoppable vehicle's dented, busted and wrecked copies
    dmg = car_damage.extra_materials(material)
    belt = min(z for _, z in PRIUS['cabin'])
    sedan = {'len': PRIUS['len'], 'wide': PRIUS['wide'], 'roof': 1.25, 'belt': belt, 'roof_x': -0.2, 'axle': PRIUS['wheel_x'], 'wheel_r': PRIUS['wheel_r']}
    specs = {
        'Sedan': {**sedan, 'seed': 1},
        'Robotaxi': {**sedan, 'seed': 2},
        'Cruiser': {'len': SUV['len'], 'wide': SUV['wide'], 'roof': 1.62, 'belt': 0.99, 'roof_x': -0.5, 'axle': SUV['wheel_x'], 'wheel_r': SUV['wheel_r'], 'seed': 3},
        'Bus': {'len': BUS['len'], 'wide': BUS['wide'], 'roof': BUS['roof'], 'belt': 1.0, 'roof_x': 0.0, 'axle': BUS['axles'][0], 'wheel_r': BUS['wheel_r'], 'seed': 4},
        'BoxTruck': {'len': TRUCK['len'], 'wide': TRUCK['wide'], 'roof': TRUCK['roof'], 'belt': 0.9, 'roof_x': -0.6, 'axle': TRUCK['axles'][0], 'wheel_r': TRUCK['wheel_r'], 'seed': 5},
    }
    by_name = {ob.name: ob for ob in cars}
    for name, spec in specs.items():
        cars += car_damage.variants(by_name[name], dmg, spec)
    for i, ob in enumerate(cars):  # side by side in the file; the game reads each from its origin
        ob.location.y = i * 2.5
    return cars


def export():
    os.makedirs(os.path.dirname(GLB), exist_ok=True)
    locs = {}
    for ob in bpy.data.objects:  # export at the origin
        locs[ob.name] = ob.location.copy()
        ob.location = (0, 0, 0)
    # the clean cars, and their car-hop damage in a file of its own (the game loads it once it's running)
    for path, damaged in ((GLB, False), (DAMAGE_GLB, True)):
        bpy.ops.object.select_all(action='DESELECT')
        for ob in bpy.data.objects:
            ob.select_set(ob.name.endswith(('_dent', '_bust', '_wreck')) == damaged)
        bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_yup=True, export_apply=True)
    for ob in bpy.data.objects:
        ob.location = locs[ob.name]
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)


if __name__ == '__main__':
    for ob in build():
        tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
        print(f'{ob.name}: {tris} tris')
    export()
    print('wrote', GLB, DAMAGE_GLB)
