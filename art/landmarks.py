# Builds the big landmarks that stand behind the street in the other QFS worlds and exports
# public/models/landmarks.glb: a Greek temple front, Atlantis's sunken arch, Clemente Park's ballpark light tower, a
# giant museum bust, High-Tech City's data spire, a rocket on its gantry in space, and the AI's tower in the Hive.
# And two of downtown Chicago's plaza sculptures for the city's own quarters (zack): Calder's red Flamingo and the
# Chicago Picasso.
# The kit stands one every few screens behind the back wall, in place of a building (src/render/kit.ts).
#
#   blender -b -P art/landmarks.py            (or run it from Blender's Text Editor; it rebuilds the scene)
#
# Units are tiles (Lou is about 2 tall), same axes as the props: +X along the street, -Y toward the game camera,
# Z up. Each landmark is one object with its origin on the ground under its middle. They are built to be seen from
# the front, over a 2 tile wall: big, simple shapes with the detail on the front.
import math
import os
import sys

import bpy  # first: the bpy module provides bmesh and mathutils
import bmesh
from mathutils import Matrix

HERE = os.path.dirname(os.path.abspath(__file__)) if '__file__' in dir() else bpy.path.abspath('//')
sys.path.insert(0, HERE)
from cars import box, join, link, material  # noqa: E402  (shared helpers)
from props import lathe, vcyl  # noqa: E402

ROOT = os.path.dirname(HERE)
GLB = os.path.join(ROOT, 'public', 'models', 'landmarks.glb')
BLEND = os.path.join(HERE, 'landmarks.blend')

COLORS = {
    'marble': 0xECE8E0,
    'marbleShade': 0xCFC6B2,
    'frieze': 0x2E5AA8,  # temples were painted
    'friezeRed': 0xB8402E,
    'seaStone': 0x5E8C8A,
    'seaStoneDark': 0x3F6A6C,
    'coral': 0xFF6F86,
    'coralDeep': 0xD8435E,
    'kelp': 0x3E9A5A,
    'steel': 0x8A929E,
    'steelDark': 0x4E5560,
    'lamp': 0xFFF2B0,  # glows
    'plinth': 0xD8D4CC,
    'bronze': 0x8A6A3A,
    'spire': 0x161A24,
    'holo': 0x3AF0FF,  # glows
    'neon': 0xFF4AD8,  # glows
    'rocket': 0xF2F2F2,
    'rocketBand': 0xFF8A1A,
    'gantry': 0xC8322E,
    'hive': 0x14090C,
    'hiveRib': 0x2A1418,
    'eye': 0xFF2A2A,  # glows
    'amber': 0xFF8A3A,  # glows
    'calderRed': 0xE8432C,  # Calder red, vermilion
    'corten': 0x7C5A44,  # weathered Cor-ten steel
    'cortenDark': 0x4E3628,
    'plazaGranite': 0x9C7C74,
}


def tri(bm, pts, y0, y1):
    """A triangular slab (a pediment) from three (x, z) points, y0 to y1 deep."""
    a = [bm.verts.new((x, y0, z)) for x, z in pts]
    b = [bm.verts.new((x, y1, z)) for x, z in pts]
    bm.faces.new(a)
    bm.faces.new(list(reversed(b)))
    for i in range(3):
        j = (i + 1) % 3
        bm.faces.new((a[j], a[i], b[i], b[j]))


def column(bm, x, y, z0, h, r, segs=12, capital=True):
    """A Doric column: a tapering shaft, an echinus and an abacus on top."""
    lathe(bm, [(r, z0), (r * 0.82, z0 + h - 0.12)], segs, at=(x, y, 0))
    if capital:
        lathe(bm, [(r * 0.82, z0 + h - 0.12), (r * 1.15, z0 + h - 0.04)], segs, at=(x, y, 0))
        box(bm, x - r * 1.25, x + r * 1.25, y - r * 1.25, y + r * 1.25, z0 + h - 0.04, z0 + h + 0.08)


def temple(m):
    """A Doric temple front, Parthenon style: three steps, six columns, an architrave, a painted frieze and a
    pediment."""
    parts = []
    bm = bmesh.new()
    for i in range(3):  # the stylobate
        d = 0.25 * i
        box(bm, -3.6 + d, 3.6 - d, -1.3 + d, 1.3 - d, 0.25 * i, 0.25 * (i + 1))
    for i in range(6):
        column(bm, -3.0 + i * 1.2, -0.75, 0.75, 3.6, 0.3)
    for i in (0, 5):  # the back row's corners, seen past the front
        column(bm, -3.0 + i * 1.2, 0.75, 0.75, 3.6, 0.3)
    box(bm, -3.45, 3.45, -1.12, 1.12, 4.43, 4.85)  # architrave
    box(bm, -3.45, 3.45, -1.12, 1.12, 5.3, 5.42)  # cornice
    tri(bm, [(-3.55, 5.42), (3.55, 5.42), (0, 6.5)], -1.18, 1.12)  # pediment
    parts.append(link('marble', bm, m['marble']))
    bm = bmesh.new()  # the frieze: triglyphs in blue, metopes in red
    box(bm, -3.45, 3.45, -1.13, 1.1, 4.85, 5.3)
    parts.append(link('friezeRed', bm, m['friezeRed']))
    bm = bmesh.new()
    for i in range(15):
        x = -3.3 + i * 0.47
        box(bm, x - 0.09, x + 0.09, -1.16, -1.12, 4.87, 5.28)
    parts.append(link('frieze', bm, m['frieze']))
    bm = bmesh.new()  # the pediment's shadowed tympanum
    tri(bm, [(-3.0, 5.5), (3.0, 5.5), (0, 6.3)], -1.21, -1.18)
    parts.append(link('marbleShade', bm, m['marbleShade']))
    return join(parts, 'Temple')


def sunken_arch(m):
    """Atlantis: a ruined arch on the sea floor, one column whole and one snapped, overgrown with coral and kelp."""
    parts = []
    bm = bmesh.new()
    box(bm, -2.6, 2.6, -0.9, 0.9, 0, 0.35)  # the broken plinth
    column(bm, -1.7, -0.2, 0.35, 4.4, 0.42)
    column(bm, 1.7, -0.2, 0.35, 2.3, 0.42, capital=False)  # snapped
    # the arch springs from the whole column and breaks off past the middle
    for i in range(6):
        a0 = math.pi - i * math.pi / 9
        a1 = math.pi - (i + 1) * math.pi / 9
        cx, r, z = 0.0, 1.7, 4.9
        x0, x1 = cx + r * math.cos(a0), cx + r * math.cos(a1)
        z0, z1 = z + r * math.sin(a0), z + r * math.sin(a1)
        mx, mz = (x0 + x1) / 2, (z0 + z1) / 2
        seg = math.hypot(x1 - x0, z1 - z0) / 2 + 0.05
        tmp = bmesh.new()
        box(tmp, -seg, seg, -0.45, 0.45, -0.28, 0.28)
        bmesh.ops.rotate(tmp, verts=tmp.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(-math.atan2(z1 - z0, x1 - x0), 3, 'Y'))
        bmesh.ops.translate(tmp, verts=tmp.verts, vec=(mx, -0.2, mz))
        me = bpy.data.meshes.new('tmp')
        tmp.to_mesh(me)
        tmp.free()
        bm.from_mesh(me)
        bpy.data.meshes.remove(me)
    # the fallen drum of the snapped column, lying at its foot
    vs = bmesh.ops.create_cone(bm, cap_ends=True, segments=12, radius1=0.38, radius2=0.38, depth=1.2)['verts']
    bmesh.ops.rotate(bm, verts=vs, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, 'Y') @ Matrix.Rotation(0.3, 3, 'X'))
    bmesh.ops.translate(bm, verts=vs, vec=(2.5, -0.9, 0.38))
    parts.append(link('seaStone', bm, m['seaStone']))
    bm = bmesh.new()  # the snapped top, rough
    lathe(bm, [(0.4, 2.65), (0.3, 2.85), (0.12, 2.75)], 7, at=(1.7, -0.2, 0))
    parts.append(link('seaStoneDark', bm, m['seaStoneDark']))
    bm = bmesh.new()  # coral: branching fans and lumps
    for x, z, s in ((-2.2, 0.35, 0.5), (-1.2, 0.35, 0.35), (1.1, 0.35, 0.45), (-1.7, 2.6, 0.3), (1.9, 2.8, 0.3)):
        for k in range(4):
            a = k * 1.3
            lathe(bm, [(s * 0.18, 0), (s * 0.12, s * 0.9), (s * 0.2, s * 1.1)], 6, at=(x + math.cos(a) * s * 0.4, -0.75, z))
    parts.append(link('coral', bm, m['coral']))
    bm = bmesh.new()
    for x, z in ((-2.0, 0.35), (2.2, 0.35), (0.3, 0.35)):
        bmesh.ops.create_uvsphere(bm, u_segments=8, v_segments=5, radius=0.32)
        for v in bm.verts:
            if abs(v.co.x) < 0.33 and abs(v.co.y) < 0.33 and abs(v.co.z) < 0.33 and not getattr(v, 'tag', False):
                v.co.x += x
                v.co.y -= 0.85
                v.co.z += z + 0.15
                v.tag = True
    parts.append(link('coralDeep', bm, m['coralDeep']))
    bm = bmesh.new()  # kelp: tall wavy ribbons
    for x, h in ((-2.5, 3.6), (-0.6, 2.4), (0.9, 3.0), (2.4, 2.0)):
        for i in range(8):
            z = 0.35 + i * h / 8
            dx = math.sin(i * 0.9 + x) * 0.18
            box(bm, x + dx - 0.07, x + dx + 0.07, -0.95, -0.9, z, z + h / 8 + 0.02)
    parts.append(link('kelp', bm, m['kelp']))
    return join(parts, 'SunkenArch')


def light_tower(m):
    """Clemente Park: a ballpark light tower, a steel lattice mast with a bank of floodlights on top."""
    parts = []
    bm = bmesh.new()
    H = 8.0
    for sx in (-1, 1):  # two legs tapering in, braced across
        for sy in (-1, 1):
            x0, x1 = sx * 0.7, sx * 0.25
            y0, y1 = sy * 0.5, sy * 0.2
            n = 6
            for i in range(n):
                za, zb = i * H / n, (i + 1) * H / n
                xa, xb = x0 + (x1 - x0) * i / n, x0 + (x1 - x0) * (i + 1) / n
                ya = y0 + (y1 - y0) * i / n
                box(bm, min(xa, xb) - 0.05, max(xa, xb) + 0.05, ya - 0.05, ya + 0.05, za, zb)
    for i in range(1, 8):  # cross braces on the front
        z = i * H / 8
        w = 0.7 - 0.45 * z / H
        box(bm, -w, w, -0.55 + 0.3 * z / H, -0.48 + 0.3 * z / H, z - 0.04, z + 0.04)
        tmp = H / 8
        for s in (-1, 1):
            vs = bmesh.ops.create_cube(bm, size=1)['verts']
            bmesh.ops.scale(bm, vec=(0.05, 0.05, math.hypot(2 * w, tmp)), verts=vs)
            bmesh.ops.rotate(bm, verts=vs, cent=(0, 0, 0), matrix=Matrix.Rotation(s * math.atan2(2 * w, tmp), 3, 'Y'))
            bmesh.ops.translate(bm, verts=vs, vec=(0, -0.52 + 0.3 * z / H, z - tmp / 2))
    box(bm, -1.6, 1.6, -0.15, 0.15, H, H + 0.12)  # the catwalk under the lights
    parts.append(link('steel', bm, m['steel']))
    bm = bmesh.new()  # the light frame
    box(bm, -1.6, 1.6, -0.05, 0.25, H + 0.12, H + 2.1)
    parts.append(link('steelDark', bm, m['steelDark']))
    bm = bmesh.new()  # the floodlights, four rows of five
    for r in range(4):
        for c in range(5):
            x = -1.28 + c * 0.64
            z = H + 0.4 + r * 0.46
            box(bm, x - 0.24, x + 0.24, -0.1, -0.04, z - 0.18, z + 0.18)
    parts.append(link('lamp', bm, m['lamp']))
    return join(parts, 'LightTower')


def giant_bust(m):
    """The museum: a giant classical bust on a tall plinth, like the one in the hall of casts."""
    parts = []
    bm = bmesh.new()
    box(bm, -1.3, 1.3, -1.0, 1.0, 0, 0.3)
    box(bm, -1.05, 1.05, -0.8, 0.8, 0.3, 2.6)
    box(bm, -1.25, 1.25, -0.95, 0.95, 2.6, 2.85)
    parts.append(link('plinth', bm, m['plinth']))
    bm = bmesh.new()
    lathe(bm, [(1.0, 2.85), (1.05, 3.1), (0.95, 3.6), (0.55, 4.0), (0.3, 4.15), (0.28, 4.45)], 14)  # shoulders, chest, neck
    bmesh.ops.scale(bm, vec=(1.25, 0.6, 1), verts=bm.verts)
    head = bmesh.new()
    bmesh.ops.create_uvsphere(head, u_segments=14, v_segments=10, radius=0.62)
    bmesh.ops.scale(head, vec=(0.82, 0.9, 1.05), verts=head.verts)
    bmesh.ops.translate(head, verts=head.verts, vec=(0, -0.08, 4.95))
    box(head, -0.1, 0.1, -0.75, -0.55, 4.8, 5.15)  # nose
    box(head, -0.22, 0.22, -0.66, -0.5, 4.38, 4.62)  # chin and beard
    me = bpy.data.meshes.new('tmp')
    head.to_mesh(me)
    head.free()
    bm.from_mesh(me)
    bpy.data.meshes.remove(me)
    parts.append(link('marble', bm, m['marble']))
    bm = bmesh.new()  # curls of hair, a laurel's worth of lumps
    for i in range(9):
        a = math.pi * (0.1 + 0.8 * i / 8)
        bmesh.ops.create_uvsphere(bm, u_segments=6, v_segments=4, radius=0.17)
        for v in bm.verts:
            if not v.tag:
                v.co.x += math.cos(a) * 0.5
                v.co.z += 5.15 + math.sin(a) * 0.45
                v.co.y -= 0.25
                v.tag = True
    parts.append(link('marbleShade', bm, m['marbleShade']))
    bm = bmesh.new()  # a bronze name plate on the plinth
    box(bm, -0.55, 0.55, -0.83, -0.8, 1.6, 1.95)
    parts.append(link('bronze', bm, m['bronze']))
    return join(parts, 'GiantBust')


def data_spire(m):
    """High-Tech City: a black data spire in stacked, narrowing blocks, ringed with glowing cyan bands, an antenna
    and a pink sign."""
    parts = []
    bm = bmesh.new()
    z = 0.0
    for w, h in ((1.6, 2.4), (1.25, 2.2), (0.95, 2.0), (0.65, 1.6)):
        box(bm, -w, w, -w * 0.7, w * 0.7, z, z + h)
        z += h
    vcyl(bm, 0.05, 1.6, z)  # antenna
    parts.append(link('spire', bm, m['spire']))
    bm = bmesh.new()
    z = 0.0
    for w, h in ((1.6, 2.4), (1.25, 2.2), (0.95, 2.0), (0.65, 1.6)):
        box(bm, -w - 0.03, w + 0.03, -w * 0.7 - 0.03, w * 0.7 + 0.03, z + h - 0.12, z + h)
        for k in range(1, 4):  # window slits up the front
            x = -w + 2 * w * k / 4
            box(bm, x - 0.04, x + 0.04, -w * 0.7 - 0.02, -w * 0.7, z + 0.3, z + h - 0.3)
        z += h
    vcyl(bm, 0.11, 0.18, z + 1.55, segs=8)  # beacon
    parts.append(link('holo', bm, m['holo']))
    bm = bmesh.new()  # a sign hung on the front
    box(bm, -0.6, 0.6, -1.15, -1.1, 3.0, 3.8)
    parts.append(link('neon', bm, m['neon']))
    return join(parts, 'DataSpire')


def rocket(m):
    """Space: a rocket on its pad with a red launch gantry beside it."""
    parts = []
    bm = bmesh.new()
    lathe(bm, [(0.55, 0.6), (0.55, 5.6), (0.45, 6.3), (0.2, 7.0), (0.02, 7.3)], 14)
    parts.append(link('rocket', bm, m['rocket']))
    bm = bmesh.new()
    for z0, z1 in ((1.4, 1.75), (4.6, 4.9)):
        lathe(bm, [(0.565, z0), (0.565, z1)], 14)
    for a in range(4):  # fins
        tmp = bmesh.new()
        tri(tmp, [(0.5, 0.4), (1.15, 0.4), (0.5, 2.0)], -0.04, 0.04)
        bmesh.ops.rotate(tmp, verts=tmp.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 4 + a * math.pi / 2, 3, 'Z'))
        me = bpy.data.meshes.new('tmp')
        tmp.to_mesh(me)
        tmp.free()
        bm.from_mesh(me)
        bpy.data.meshes.remove(me)
    parts.append(link('rocketBand', bm, m['rocketBand']))
    bm = bmesh.new()  # the pad and the engine bell
    box(bm, -1.6, 1.6, -1.1, 1.1, 0, 0.3)
    lathe(bm, [(0.42, 0.3), (0.3, 0.6)], 12)
    parts.append(link('steelDark', bm, m['steelDark']))
    bm = bmesh.new()  # the gantry: a lattice tower behind and to the side, with two arms to the rocket
    gx = 1.5
    for sx in (-0.3, 0.3):
        for sy in (0.0, 0.6):
            box(bm, gx + sx - 0.06, gx + sx + 0.06, sy - 0.06, sy + 0.06, 0.3, 6.4)
    for i in range(1, 13):
        z = 0.3 + i * 0.5
        box(bm, gx - 0.36, gx + 0.36, -0.06, 0.06, z - 0.04, z + 0.04)
    for z in (3.2, 5.4):
        box(bm, 0.45, gx - 0.3, -0.08, 0.08, z - 0.06, z + 0.06)
    parts.append(link('gantry', bm, m['gantry']))
    return join(parts, 'Rocket')


def hive_tower(m):
    """The Hive: the AI's tower, a black monolith ribbed like a server, with its red eye near the top and amber
    lights running up the ribs."""
    parts = []
    bm = bmesh.new()
    box(bm, -1.5, 1.5, -1.0, 1.0, 0, 0.4)
    lathe(bm, [(1.1, 0.4), (1.0, 6.5), (0.75, 7.6), (0.05, 8.6)], 6)  # a six-sided shaft to a point
    parts.append(link('hive', bm, m['hive']))
    bm = bmesh.new()
    for x in (-0.75, 0.0, 0.75):
        box(bm, x - 0.08, x + 0.08, -1.04, -0.9, 0.5, 6.4)
    parts.append(link('hiveRib', bm, m['hiveRib']))
    bm = bmesh.new()  # the eye: a slit with a bright pupil
    box(bm, -0.7, 0.7, -0.98, -0.9, 6.7, 6.95)
    parts.append(link('eye', bm, m['eye']))
    bm = bmesh.new()
    for x in (-0.75, 0.0, 0.75):
        for i in range(7):
            z = 0.9 + i * 0.8
            box(bm, x - 0.05, x + 0.05, -1.06, -1.04, z, z + 0.25)
    parts.append(link('amber', bm, m['amber']))
    return join(parts, 'HiveTower')


def catmull(pts, n=6):
    """A smooth path through the points (Catmull-Rom), n steps a span."""
    p = [pts[0]] + list(pts) + [pts[-1]]
    out = []
    for i in range(1, len(p) - 2):
        for k in range(n):
            t = k / n
            out.append(tuple(0.5 * ((2 * p[i][j]) + (-p[i - 1][j] + p[i + 1][j]) * t + (2 * p[i - 1][j] - 5 * p[i][j] + 4 * p[i + 1][j] - p[i + 2][j]) * t * t
                                    + (-p[i - 1][j] + 3 * p[i][j] - 3 * p[i + 1][j] + p[i + 2][j]) * t ** 3) for j in range(3)))
    out.append(tuple(pts[-1]))
    return out


def sweep(bm, path, size):
    """A bar along a path, its section size(t) = (thick, deep): thick across the path in the x-z plane, deep along y."""
    rings = []
    for i, (x, y, z) in enumerate(path):
        a, b = path[max(0, i - 1)], path[min(len(path) - 1, i + 1)]
        tx, tz = b[0] - a[0], b[2] - a[2]
        ln = math.hypot(tx, tz) or 1
        nx, nz = -tz / ln, tx / ln
        th, dp = size(i / (len(path) - 1))
        rings.append([bm.verts.new((x + sx * nx * th / 2, y + sy * dp / 2, z + sx * nz * th / 2)) for sx, sy in ((1, 1), (-1, 1), (-1, -1), (1, -1))])
    for r0, r1 in zip(rings, rings[1:]):
        for k in range(4):
            j = (k + 1) % 4
            bm.faces.new((r0[k], r0[j], r1[j], r1[k]))
    bm.faces.new(rings[0])
    bm.faces.new(rings[-1][::-1])


def plate(bm, pts, t):
    """A flat plate through 3D points (a polygon), t thick along its normal."""
    from mathutils import Vector
    v = [Vector(p) for p in pts]
    nrm = (v[1] - v[0]).cross(v[2] - v[0]).normalized() * (t / 2)
    lo = [bm.verts.new(p - nrm) for p in v]
    hi = [bm.verts.new(p + nrm) for p in v]
    bm.faces.new(lo[::-1])
    bm.faces.new(hi)
    n = len(v)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((lo[i], lo[j], hi[j], hi[i]))


def profile(bm, pts, y0, y1):
    """An (x, z) outline extruded through y0..y1."""
    a = [bm.verts.new((x, y0, z)) for x, z in pts]
    b = [bm.verts.new((x, y1, z)) for x, z in pts]
    bm.faces.new(a)
    bm.faces.new(b[::-1])
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((a[j], a[i], b[i], b[j]))


def arc(cx, cz, r, a0, a1, n=8):
    return [(cx + r * math.cos(a0 + (a1 - a0) * k / n), cz + r * math.sin(a0 + (a1 - a0) * k / n)) for k in range(n + 1)]


def flamingo(m):
    """Calder's Flamingo in Federal Plaza: arches of vermilion plate, one tall arch striding over, a second rising
    out of it and down to the right, and a knot of flared triangular fins where they meet over a third leg."""
    bm = bmesh.new()
    taper = lambda t: (0.6 - 0.25 * abs(2 * t - 1) ** 3, 0.55)  # bars thin a little toward their feet
    # the big arch, striding from the left foot over to a foot near the middle
    sweep(bm, catmull([(-3.4, 0.5, 0), (-3.1, 0.35, 3.4), (-2.3, 0.15, 7.2), (-1.2, 0, 9.0), (-0.3, 0, 8.6), (0.0, 0, 6.2), (0.1, 0.1, 3.0), (0.0, 0.25, 0)]), taper)
    # the second arch, rising out of the first's crown and over to the far right foot
    sweep(bm, catmull([(-0.5, 0, 8.4), (0.8, -0.25, 7.9), (2.0, -0.4, 6.0), (2.9, -0.5, 3.2), (3.5, -0.6, 0)]), lambda t: (0.55 - 0.2 * t, 0.5))
    # the third leg, down from the knot where the plates meet
    sweep(bm, catmull([(1.5, -0.35, 5.6), (1.5, 0.2, 3.0), (1.6, 0.8, 0)]), lambda t: (0.45 - 0.2 * t, 0.45))
    plate(bm, [(0.9, -0.3, 6.6), (3.2, -0.55, 4.2), (1.7, -0.45, 3.5)], 0.14)  # the wing out to the right
    plate(bm, [(0.1, -0.1, 6.4), (1.6, -0.4, 5.8), (1.0, -0.3, 1.2)], 0.14)  # the long fin hung from the knot
    plate(bm, [(1.7, -0.45, 3.5), (2.6, -0.5, 3.0), (2.3, 0.1, 0.3)], 0.14)  # a plate down toward the ground
    for fx, fy, fw in ((-3.4, 0.5, 2.4), (0.0, 0.25, 2.0), (1.6, 0.8, 1.6), (3.5, -0.6, 2.2)):  # the feet flare where they're bolted down
        plate(bm, [(fx - 0.45, fy, 0), (fx + 0.45, fy, 0), (fx, fy, fw)], 0.12)
    red = link('calderRed', bm, m['calderRed'])
    bm = bmesh.new()
    box(bm, -4.0, 4.0, -1.2, 1.4, -0.02, 0.06)  # the plaza's granite under it
    return join([red, link('plazaGranite', bm, m['plazaGranite'])], 'Flamingo')


def picasso(m):
    """The Chicago Picasso in Daley Plaza, seen from the plaza: the long face in profile on its neck, the eyes
    and the nose, two great wings of plate behind it with the cables strung between them, the swept back sitting on
    the ground behind, all in weathered Cor-ten on a granite plinth."""
    steel, dark = bmesh.new(), bmesh.new()
    # the back: a long low sweep along the ground, rolling up at the right
    back = [(-1.4, 0.2)] + [(x, 0.2) for x in (0.4, 2.0, 3.0)] + arc(2.9, 1.0, 0.8, -math.pi / 2, math.pi / 2, 6)[1:] + [(1.4, 1.5), (0.0, 1.05), (-1.4, 0.7)]
    profile(steel, back, 0.2, 1.8)
    # the neck and the front leg: a broad foot narrowing up to the throat
    neck = [(-2.0, 0.2), (-0.4, 0.2), (-0.55, 1.4), (-0.75, 2.8), (-0.8, 4.2), (-1.15, 4.2), (-1.25, 2.6), (-1.6, 1.2)]
    profile(steel, neck, -0.45, -0.15)
    # the face in profile, the forehead jutting forward to the left at the top
    face = [(-0.8, 3.9), (-0.55, 5.3), (-0.4, 6.9), (-0.55, 7.4), (-1.1, 7.45), (-2.0, 7.2), (-2.15, 6.95), (-1.5, 6.8), (-1.25, 6.4),
            (-1.35, 5.6), (-1.2, 4.6), (-1.15, 3.9)]
    profile(steel, face, -0.62, -0.42)
    for ex, ez in ((-1.55, 6.95), (-1.0, 5.1)):  # the eye, and the nostrils under it
        w = 0.3 if ez > 6 else 0.12
        box(dark, ex - w, ex + w, -0.66, -0.6, ez - 0.05, ez + 0.05)
    box(dark, -1.08, -0.98, -0.66, -0.6, 5.05, 5.15)
    # the wings: a slim blade rising over the head on the left, a great leaf sweeping down to the right
    left = [(-0.6, 4.6)] + [(-0.6 - 0.35 * math.sin(math.pi * k / 8), 4.6 + 4.6 * k / 8) for k in range(1, 9)] + [(0.2, 9.0), (0.15, 7.0), (-0.1, 5.0)]
    profile(steel, left, 0.0, 0.14)
    leaf = [(0.1, 9.3)] + [(0.1 + 2.8 * math.sin(math.pi * k / 10) ** 0.8, 9.3 - 6.6 * k / 10) for k in range(1, 11)] + [(0.3, 4.4), (0.15, 7.0)]
    profile(steel, leaf, 0.35, 0.5)
    # the cables, strung from the face's edge out to the leaf
    for k in range(10):
        a = (-0.45, -0.4, 4.4 + 0.27 * k)
        b = (1.8 - 0.06 * k, 0.4, 3.6 + 0.48 * k)
        sweep(dark, [a, b], lambda t: (0.035, 0.035))
    plinth = bmesh.new()
    box(plinth, -2.6, 4.0, -1.2, 2.1, 0, 0.2)
    return join([link('corten', steel, m['corten']), link('cortenDark', dark, m['cortenDark']), link('plazaGranite', plinth, m['plazaGranite'])], 'Picasso')


def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    m = {k: material(k, v) for k, v in COLORS.items()}
    marks = [temple(m), sunken_arch(m), light_tower(m), giant_bust(m), data_spire(m), rocket(m), hive_tower(m), flamingo(m), picasso(m)]
    for i, ob in enumerate(marks):  # in a row in the file; the game reads each from its origin
        ob.location.x = i * 9
    return marks


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
        bm = bmesh.new()  # the arch's turned blocks and the lathed caps: all faces outward
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
