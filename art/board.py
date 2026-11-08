# Builds Lou Gnar's skateboard in Blender and exports public/models/board.glb.
#
#   blender -b -P art/board.py            (or run it from Blender's Text Editor; it rebuilds the scene)
#
# Same units and axes as art/lou_gnar.py: Blender +X is the nose (the way you skate), -Y faces the game camera, Z is
# up. The origin is the middle of the deck's top surface, and the shape matches BOARD in src/render/poses.ts (the
# tricks depend on it): 0.95 long, kicks of 0.3 rad reaching out to ±0.475, truck bolts at ±0.27, deck top 0.12
# off the ground.
#
# From zack's references (2026-10-24): a popsicle deck with curved kicks and real concave, colored plies on the
# edge and hardware bolt heads in the grip; Venture-style trucks (polished baseplate and hanger, purple bushings,
# gold washers and nuts, bronze kingpin and axle, a red V on the outside of the hanger); Spitfire-style cream wheels with the black
# and silver swirl on the outer face. 1 unit is about 0.85 m (the deck is 32" long).
import math
import os

import bpy  # first: the bpy module provides bmesh and mathutils
import bmesh
from mathutils import Matrix, Vector

import sys

HERE = os.path.dirname(os.path.abspath(__file__)) if '__file__' in dir() else bpy.path.abspath('//')
ROOT = os.path.dirname(HERE)
# The four decks (src/run/meta.ts), each from zack's references (2026-11-08). All share the trucks, wheels, length,
# truck bolts and the seven coloured plies on the edge; they differ in outline, width, nose kick and extras.
#   blender -b -P art/board.py -- cruiser      (one deck; no name builds all four)
# popsicle -> public/models/board.glb, the others -> public/models/board-<id>.glb
SHAPES = {
    # the stock deck: a long rounded rectangle, both kicks
    'popsicle': {'width': 1.0, 'nose_kick': 0.3},
    # a Zip Zinger style cruiser: wide, a pointed nose with a flat tip, a square tail with round corners
    'cruiser': {'width': 1.12, 'nose_kick': 0.14, 'wheel': 0xF1E6CF},
    # Downhill: a slalom deck, narrow, the nose tapering straight to a point, a round tail, nearly flat, amber wheels
    'bombhill': {'width': 0.88, 'nose_kick': 0.07, 'wheel': 0xF2B233},
    # Slab: an 80s pool deck, wide, a waist above the tail, a round nose, two grip patches with the deck bare
    # between them, and blue plastic under it: a nose guard, two rails and a tail skid (zack: "with the plastic
    # accents on the bottom")
    'slab': {'width': 1.25, 'nose_kick': 0.16, 'wheel': 0x2F5BD0, 'split_grip': True, 'plastics': True},
}
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
SHAPE = 'popsicle'


def glb_path(name):
    return os.path.join(ROOT, 'public', 'models', 'board.glb' if name == 'popsicle' else f'board-{name}.glb')


BLEND = os.path.join(HERE, 'board.blend')

# BOARD in poses.ts
TAIL = 0.475
FLAT = 0.33
KICK = 0.3
BOLTS = 0.27
DECK_TOP = 0.12

INCH = 0.95 / 32
WIDTH = 8.25 * INCH
THICK = 0.017  # 7 plies, a little thick so it reads from the game camera
CONCAVE = 0.01  # the rails rise this much over the centre
BEND = 0.05  # half the length of the curve from flat into each kick
WHEEL_R = 27 * INCH / 25.4  # 54 mm
WHEEL_W = 32 * INCH / 25.4
TRACK = 0.105  # wheel centres from the middle, across the board
AXLE_Z = WHEEL_R - DECK_TOP  # relative to the deck top
BASE_Z = -THICK  # underside of the deck
HOLES = (2.125 * INCH / 2, 1.625 * INCH / 2)  # the old-school bolt pattern, half spacing along and across
# the bar across the grip just inside the back truck's bolts, so the tail reads at a glance (zack, 2026-10-30)
BAR = (-BOLTS + HOLES[0] + 0.012, -BOLTS + HOLES[0] + 0.077)

COLORS = {
    'grip': 0x1C1C20,
    'deck': 0xC8312B,
    'bolt': 0xB9BDC4,
    'metal': 0xE4E7EC,  # polished aluminium
    'steel': 0x8A7550,  # kingpin and axles
    'bushing': 0x3A2FA8,
    'gold': 0xD7A93A,
    'logo': 0xD12A2A,
    'wheel': 0xF1E6CF,
    'gripbar': 0xE2C08D,  # bare maple; wear.ts paintGrip picks a colour that stands out from the grip
    'decktop': 0xC8312B,  # the Slab's bare top between its grip patches
    'plastic': 0x2F5BD0,  # the Slab's rails, nose guard and tail skid
}
PLIES = [0xB52E28, 0xE2C08D, 0xE8B830, 0xB52E28, 0xE8B830, 0xE2C08D, 0xB52E28]  # top to bottom


def hex_rgba(h):
    srgb = [((h >> sh) & 255) / 255 for sh in (16, 8, 0)]
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb]
    return (*lin, 1.0)


def material(name, color, rough=0.8):
    m = bpy.data.materials.new(name)
    m.diffuse_color = hex_rgba(color)
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = hex_rgba(color)
    bsdf.inputs['Roughness'].default_value = rough
    return m


def textured(name, img):
    m = bpy.data.materials.new(name)
    nt = m.node_tree
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = img
    tex.interpolation = 'Closest'
    nt.links.new(tex.outputs['Color'], nt.nodes['Principled BSDF'].inputs['Base Color'])
    nt.nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.8
    return m


def image(name, w, h, color_at):
    img = bpy.data.images.new(name, w, h)
    px = []
    for y in range(h):
        for x in range(w):
            c = color_at(x, y)
            px += [((c >> sh) & 255) / 255 for sh in (16, 8, 0)] + [1.0]
    img.pixels = px
    img.pack()
    return img


def swirl(x, y, n=128):
    """Spitfire-style face: a black and silver swirl ring round a cream centre (the deck's own wheel colour)."""
    u, v = (x + 0.5) / n * 2 - 1, (y + 0.5) / n * 2 - 1
    r = math.hypot(u, v)
    if r < 0.4 or r > 0.82:
        return SHAPES[SHAPE].get('wheel', COLORS['wheel'])
    a = math.atan2(v, u) / (2 * math.pi)
    return 0x16161A if int(math.floor(a * 22 + r * 4.5)) % 2 == 0 else 0xC9CCD2


def link(name, bm, mats):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(m)
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def centreline():
    """The deck's profile: flat, a curve of 2·BEND into the kick, then straight out to x = ±TAIL. The tail always
    kicks KICK (the pop poses strike it on the ground); the nose kicks the deck's own nose_kick. Returns
    (arc length of each half: (nose, tail), f(u) -> (x, z, angle)), u + toward the nose."""
    ends = {}
    for side, kick in ((1, SHAPES[SHAPE]['nose_kick']), (-1, KICK)):
        ends[side] = half_line(kick)

    def at(u):
        x, z, ang = ends[1 if u >= 0 else -1][1](abs(u))
        return (x if u >= 0 else -x), z, ang

    return (ends[1][0], ends[-1][0]), at


def half_line(KICK):
    def walk(straight, u=None, step=0.0005):
        x = z = s = 0.0
        while True:
            if s < FLAT - BEND:
                ang = 0.0
            elif s < FLAT + BEND:
                t = (s - (FLAT - BEND)) / (2 * BEND)
                ang = KICK * t * t * (3 - 2 * t)
            else:
                ang = KICK
            if u is not None and s >= u:
                return x, z, ang
            if u is None and s >= FLAT + BEND + straight:
                return x, z, ang
            x += math.cos(ang) * step
            z += math.sin(ang) * step
            s += step

    lo, hi = 0.0, 0.3
    for _ in range(30):  # the straight part of the kick that puts the tip at TAIL
        mid = (lo + hi) / 2
        lo, hi = (mid, hi) if walk(mid)[0] < TAIL else (lo, mid)
    return FLAT + BEND + lo, lambda u: walk(0.0, u)


def smooth(t):
    t = min(1.0, max(0.0, t))
    return t * t * (3 - 2 * t)


def half_width(u, halves):
    """The deck's half width at arc length u along it (+ toward the nose), from the deck's outline."""
    r = WIDTH * SHAPES[SHAPE]['width'] / 2
    end = halves[0] if u >= 0 else halves[1]
    a = abs(u)

    def cap(c, rad):  # a round end of radius rad on a body of half width c
        over = a - (end - rad)
        return c if over <= 0 else (c - rad) + math.sqrt(max(rad * rad - over * over, 0.0))

    if SHAPE == 'cruiser':
        if u < 0:  # narrowing a little to a square tail
            return cap(r * (1 - 0.1 * smooth((a - 0.2) / 0.25)), 0.35 * r)
        t = max(0.0, (a - 0.17) / (end - 0.17))
        return 0.16 * r + (r - 0.16 * r) * (1 - t ** 1.25)
    if SHAPE == 'bombhill':
        if u < 0:
            return cap(r, 0.75 * r)
        t = max(0.0, (a - 0.24) / (end - 0.24))
        return 0.26 * r + (r - 0.26 * r) * (1 - t)
    if SHAPE == 'slab':
        if u >= 0:  # tapering a little into a round nose
            c = r * (1 - 0.1 * smooth((a - 0.02) / 0.36))
            return cap(c, c)
        waist = 0.07 * math.exp(-(((a - 0.18) / 0.1) ** 2))  # pinched in above the back truck, then a wide tail
        return cap(r * (1 - waist), 0.3 * r)
    return cap(r, r)


def deck(mats):
    """The grip surface as a grid, popsicle outline and concave, then solidified down into the plies."""
    halves, at = centreline()
    shape = SHAPES[SHAPE]
    r = WIDTH * shape['width'] / 2
    cols = [-halves[1] + i / 40 * (halves[0] + halves[1]) for i in range(41)]
    for side, end in ((1, halves[0]), (-1, halves[1])):  # finer toward each end, where the outline turns
        cols += [side * (end - r * (1 - math.sin(a / 8 * math.pi / 2))) for a in range(1, 8)]
    split = shape.get('split_grip')
    GRIP_GAP = (-0.11, 0.1)  # the Slab's bare top between its two grip patches
    if split:
        cols += list(GRIP_GAP)
    cols += list(BAR)
    cols = sorted(c for c in cols if not any(0 < abs(c - b) < 0.006 for b in BAR))
    rows = 10
    bm = bmesh.new()
    grid = []
    for u in cols:
        hw = max(half_width(u, halves), 0.012)
        end = halves[0] if u >= 0 else halves[1]
        x, z, _ = at(u)
        line = []
        for j in range(rows + 1):
            v = (j / rows * 2 - 1) * hw
            # concave across the middle, fading out up the kicks
            fade = max(0.0, 1 - max(0.0, abs(u) - (FLAT - BEND)) / (end - FLAT + BEND))
            c = CONCAVE * (v / r) ** 2 * fade
            line.append(bm.verts.new((x, v, z + c)))
        grid.append(line)
    for a, b in zip(grid, grid[1:]):
        for j in range(rows):
            bm.faces.new((a[j], b[j], b[j + 1], a[j + 1]))
    n = len(bm.verts)
    ply = textured('plies', image('plies', 1, len(PLIES), lambda x, y: PLIES[len(PLIES) - 1 - y]))
    ob = link('deck', bm, [mats['grip'], mats['deck'], ply, mats['gripbar'], mats['decktop']])
    sol = ob.modifiers.new('wood', 'SOLIDIFY')
    sol.thickness = THICK
    sol.offset = -1
    sol.use_even_offset = SHAPE == 'popsicle'  # even offset spikes out at the pointed noses' sharp corners
    sol.material_offset = 1
    sol.material_offset_rim = 2
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.modifier_apply(modifier=sol.name)
    me = ob.data
    for p in me.polygons:  # keep the grip (material 0) facing up
        if (p.material_index == 0 and p.normal.z < 0) or (p.material_index == 1 and p.normal.z > 0):
            p.flip()
    for p in me.polygons:  # the bar: the grip faces across it
        if p.material_index == 0 and BAR[0] < p.center.x < BAR[1]:
            p.material_index = 3
        if split and p.material_index == 0 and GRIP_GAP[0] < p.center.x < GRIP_GAP[1]:
            p.material_index = 4
    # the edge shows the plies: v runs from the bottom veneer to the top one
    uv = me.uv_layers.new(name='UVMap')
    for p in me.polygons:
        for li in p.loop_indices:
            vi = me.loops[li].vertex_index
            uv.data[li].uv = (0.5, 0.99 if vi < n else 0.01) if p.material_index == 2 else (0.5, 0.5)
    return ob, at, halves


def under(at, u, depth):
    """The point `depth` under the deck's top at arc length u (centre line), and the deck's angle there."""
    x, z, ang = at(u)
    s = 1 if u >= 0 else -1
    return Vector((x + s * math.sin(ang) * depth, 0, z - math.cos(ang) * depth)), ang * s


def plastics(mats, at, halves):
    """The Slab's blue plastic under the deck: two rails along the sides between the trucks, a guard round the nose
    and a skid on the tail (zack's 80s deck, 2026-11-08)."""
    bm = bmesh.new()
    rail_w, rail_h = 0.016, 0.014
    for side in (1, -1):  # rails: a strip under each edge, inset a little, square in section
        pts = [i / 12 * 0.34 - 0.17 for i in range(13)]
        ring = []
        for u in pts:
            p, _ = under(at, u, THICK)
            y = side * (half_width(u, halves) - 0.03)
            ring.append([bm.verts.new((p.x, y + dy, p.z + dz)) for dy, dz in ((-rail_w / 2, 0.001), (rail_w / 2, 0.001), (rail_w / 2, -rail_h), (-rail_w / 2, -rail_h))])
        for a, b in zip(ring, ring[1:]):
            for k in range(4):
                bm.faces.new((a[k], b[k], b[(k + 1) % 4], a[(k + 1) % 4]))
        bm.faces.new(ring[0][::-1])
        bm.faces.new(ring[-1])
    # nose guard: a band following the nose's outline under its edge
    end = halves[0]
    us = [end - 0.11 + i / 16 * 0.105 for i in range(17)]
    edge = []
    for u in us:
        p, _ = under(at, u, THICK)
        edge.append((u, p, half_width(u, halves)))
    path = [(p.x, -w, p.z) for u, p, w in edge] + [(p.x, w, p.z) for u, p, w in edge[::-1]]
    cx = under(at, end - 0.1, THICK)[0].x  # the nose's round end is about this far back: the band shrinks toward it
    band = []
    for px, py, pz in path:
        ix, iy = cx + (px - cx) * 0.8, py * 0.8
        band.append([bm.verts.new((px, py, pz + 0.001)), bm.verts.new((ix, iy, pz + 0.001)), bm.verts.new((ix, iy, pz - 0.009)), bm.verts.new((px, py, pz - 0.009))])
    for a, b in zip(band, band[1:]):
        for k in range(4):
            bm.faces.new((a[k], b[k], b[(k + 1) % 4], a[(k + 1) % 4]))
    bm.faces.new(band[0][::-1])
    bm.faces.new(band[-1])
    # tail skid: a squashed half capsule on the tail's underside, behind the back truck
    p, ang = under(at, -(halves[1] - 0.06), THICK)
    geom = bmesh.ops.create_uvsphere(bm, u_segments=14, v_segments=6, radius=1.0)
    vs = geom['verts']
    for v in vs:
        v.co = Vector((v.co.x * 0.034, v.co.y * 0.085, min(v.co.z, 0.0) * 0.016))
    bmesh.ops.rotate(bm, verts=vs, cent=(0, 0, 0), matrix=Matrix.Rotation(ang, 3, 'Y'))
    bmesh.ops.translate(bm, verts=vs, vec=p)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return link('plastic', bm, [mats['plastic']])


def prism(bm, pts, axis, a0, a1):
    """Extrude a closed outline between a0 and a1 along axis ('x' or 'y'). Outline points are (other, z)."""

    def v3(p, a):
        return (a, p[0], p[1]) if axis == 'x' else (p[0], a, p[1])

    a = [bm.verts.new(v3(p, a0)) for p in pts]
    b = [bm.verts.new(v3(p, a1)) for p in pts]
    n = len(pts)
    faces = [bm.faces.new(a[::-1]), bm.faces.new(b)]
    faces += [bm.faces.new((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i])) for i in range(n)]
    bmesh.ops.recalc_face_normals(bm, faces=faces)


def cyl(bm, r, depth, at, axis='Y', segs=10, r2=None):
    geom = bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=r, radius2=r if r2 is None else r2, depth=depth)
    vs = geom['verts']
    if axis == 'Y':
        bmesh.ops.rotate(bm, verts=vs, cent=(0, 0, 0), matrix=Matrix.Rotation(-math.pi / 2, 3, 'X'))
    bmesh.ops.translate(bm, verts=vs, vec=at)
    return vs


def truck(mats, x, s):
    """s = +1 for the front truck, -1 for the back. The kingpins face the middle of the board."""
    parts = []
    k = -s  # inward: toward the middle of the board, away from the nose or tail
    pivot_x = x - k * 0.022  # pivot cup toward the outside, kingpin toward the middle
    king_x = x + k * 0.016
    hang_top = AXLE_Z + 0.022

    bm = bmesh.new()
    # baseplate: flat plate with the mounting flanges, and a tapered pedestal holding the pivot cup and kingpin
    prism(bm, [(x - 0.042, BASE_Z), (x + 0.042, BASE_Z), (x + 0.04, BASE_Z - 0.006), (x - 0.04, BASE_Z - 0.006)], 'y', -0.034, 0.034)
    pedestal = [(x - 0.03, BASE_Z - 0.006), (x + 0.03, BASE_Z - 0.006), (x + 0.024, BASE_Z - 0.03), (x - 0.024, BASE_Z - 0.03)]
    prism(bm, pedestal, 'y', -0.016, 0.016)
    # pivot arm from the hanger up into the cup
    prism(bm, [(x - 0.007, hang_top - 0.004), (x + 0.007, hang_top - 0.004), (pivot_x + 0.005, BASE_Z - 0.024), (pivot_x - 0.005, BASE_Z - 0.024)], 'y', -0.008, 0.008)
    # hanger seen from the front: a long bar along the axle with a triangular body rising to the bushing seat
    front = [(-0.072, AXLE_Z - 0.008), (0.072, AXLE_Z - 0.008), (0.072, AXLE_Z + 0.008), (0.024, hang_top), (-0.024, hang_top), (-0.072, AXLE_Z + 0.008)]
    prism(bm, front, 'x', x - 0.011, x + 0.011)
    # bushing seat on top of the hanger, toward the kingpin
    prism(bm, [(king_x - 0.016, hang_top - 0.004), (king_x + 0.016, hang_top - 0.004), (king_x + 0.016, hang_top + 0.004), (king_x - 0.016, hang_top + 0.004)], 'y', -0.017, 0.017)
    parts.append(link('metal', bm, [mats['metal']]))

    bm = bmesh.new()  # the red V on the outside face of the hanger, its point toward the baseplate as on the real truck
    fx = x + s * 0.0115
    for dy in (-1, 1):
        arm = [(dy * 0.026, AXLE_Z - 0.002), (dy * 0.016, AXLE_Z - 0.002), (0, hang_top - 0.002), (dy * 0.007, hang_top - 0.002)]
        vs = [bm.verts.new((fx, py, pz)) for py, pz in arm]
        face = bm.faces.new((vs[0], vs[1], vs[2], vs[3]))
        if face.normal.x * s < 0:
            face.normal_flip()
    parts.append(link('logo', bm, [mats['logo']]))

    bm = bmesh.new()  # bushings above and below the seat
    cyl(bm, 0.013, 0.012, (king_x, 0, BASE_Z - 0.036), axis='Z', segs=8)
    cyl(bm, 0.012, 0.01, (king_x, 0, hang_top + 0.01), axis='Z', segs=8)
    parts.append(link('bushing', bm, [mats['bushing']]))

    bm = bmesh.new()  # kingpin and axle
    cyl(bm, 0.0045, hang_top + 0.03 - BASE_Z + 0.02, (king_x, 0, (hang_top + 0.03 + BASE_Z) / 2 - 0.01), axis='Z', segs=6)
    cyl(bm, 0.0045, 2 * (TRACK + WHEEL_W / 2 + 0.01), (x, 0, AXLE_Z), segs=6)
    parts.append(link('steel', bm, [mats['steel']]))

    bm = bmesh.new()  # gold washers, kingpin nut and axle nuts
    cyl(bm, 0.016, 0.003, (king_x, 0, BASE_Z - 0.044), axis='Z', segs=10)
    cyl(bm, 0.015, 0.003, (king_x, 0, hang_top + 0.017), axis='Z', segs=10)
    cyl(bm, 0.008, 0.008, (king_x, 0, hang_top + 0.023), axis='Z', segs=6)
    for y in (1, -1):
        cyl(bm, 0.0075, 0.007, (x, y * (TRACK + WHEEL_W / 2 + 0.006), AXLE_Z), segs=6)
    parts.append(link('gold', bm, [mats['gold']]))


    for y in (TRACK, -TRACK):
        parts.append(wheel(mats, x, y))
    return parts


def wheel(mats, x, y):
    bm = bmesh.new()
    cyl(bm, WHEEL_R, WHEEL_W, (x, y, AXLE_Z), segs=16)
    bm.normal_update()
    rims = [e for e in bm.edges if any(abs(f.normal.y) > 0.9 for f in e.link_faces)]
    bmesh.ops.bevel(bm, geom=rims, offset=0.008, segments=2, affect='EDGES', profile=0.6)
    bm.normal_update()
    uv = bm.loops.layers.uv.new('UVMap')  # same name as the deck's, so they merge on join
    out = 1 if y > 0 else -1
    for f in bm.faces:
        face = f.normal.y * out > 0.9
        for lp in f.loops:
            co = lp.vert.co
            lp[uv].uv = ((co.x - x) / (2 * WHEEL_R) + 0.5, (co.z - AXLE_Z) / (2 * WHEEL_R) + 0.5) if face else (0.02, 0.02)
    return link('wheel', bm, [mats['wheel']])


def hardware(mats, x):
    bm = bmesh.new()
    for dx in (-1, 1):
        for dy in (-1, 1):
            cyl(bm, 0.0065, 0.002, (x + dx * HOLES[0], dy * HOLES[1], 0.0005), axis='Z', segs=8)
    return link('bolts', bm, [mats['bolt']])


def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    mats = {k: material(k, v, 0.25 if k in ('metal', 'gold') else 0.85) for k, v in COLORS.items()}
    bpy.data.materials.remove(mats['wheel'])
    mats['wheel'] = textured('wheel', image('swirl', 128, 128, swirl))
    board, at, halves = deck(mats)
    parts = [plastics(mats, at, halves)] if SHAPES[SHAPE].get('plastics') else []
    for x, s in ((BOLTS, 1), (-BOLTS, -1)):
        parts += truck(mats, x, s)
        parts.append(hardware(mats, x))
    bpy.ops.object.select_all(action='DESELECT')
    for ob in parts:
        ob.select_set(True)
    board.select_set(True)
    bpy.context.view_layer.objects.active = board
    bpy.ops.object.join()
    board.name = board.data.name = 'Board'
    for p in board.data.polygons:
        p.use_smooth = False
    return board


def export(glb, blend):
    os.makedirs(os.path.dirname(glb), exist_ok=True)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', use_selection=True, export_yup=True, export_apply=True)
    if blend:
        bpy.ops.wm.save_as_mainfile(filepath=BLEND)


if __name__ == '__main__':
    for name in [a for a in ARGS if a in SHAPES] or list(SHAPES):
        SHAPE = name
        ob = build()
        tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
        print(f'{name}: {len(ob.data.vertices)} verts, {tris} tris')
        export(glb_path(name), name == 'popsicle')  # board.blend stays the stock deck
        print('wrote', glb_path(name))
