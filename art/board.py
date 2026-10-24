# Builds Lou Gnar's skateboard in Blender and exports public/models/board.glb.
#
#   blender -b -P art/board.py            (or run it from Blender's Text Editor; it rebuilds the scene)
#
# Same units and axes as art/lou_gnar.py: Blender +X is the nose (the way you skate), -Y faces the game camera, Z is
# up. The origin is the middle of the deck's top surface, and the shape matches BOARD in src/render/poses.ts (the
# tricks depend on it): 0.95 long, kicks of 0.3 rad from 0.33 out, truck bolts at ±0.27, deck top 0.12 off the
# ground. Proportions follow a real popsicle setup: an 8.25" by 32" deck, mellow concave, standard trucks, 53-60 mm
# wheels.
import math
import os

import bpy  # first: the bpy module provides bmesh and mathutils
import bmesh
from mathutils import Matrix

HERE = os.path.dirname(os.path.abspath(__file__)) if '__file__' in dir() else bpy.path.abspath('//')
ROOT = os.path.dirname(HERE)
GLB = os.path.join(ROOT, 'public', 'models', 'board.glb')
BLEND = os.path.join(HERE, 'board.blend')

# BOARD in poses.ts
TAIL = 0.475
FLAT = 0.33
KICK = 0.3
BOLTS = 0.27
DECK_TOP = 0.12

WIDTH = 0.245  # 8.25 / 32 of the length
THICK = 0.024  # 7 plies, a touch thick so it reads from the game camera
CONCAVE = 0.007  # rails rise this much over the centre
KICK_LEN = (TAIL - FLAT) / math.cos(KICK)
WHEEL_R = 0.032
WHEEL_W = 0.034
TRACK = 0.105  # wheel centres from the middle, across the board
AXLE_Z = WHEEL_R - DECK_TOP  # relative to the deck top
BASE_Z = -THICK  # underside of the deck

COLORS = {
    'grip': 0x1C1C20,
    'deck': 0xC8312B,
    'ply': 0xB52E28,  # dyed veneer edge: red from the side, like the sprite's deck
    'truck': 0xA7ADB6,
    'bushing': 0xE8C33A,
    'wheel': 0xF3E6C4,
    'bearing': 0x2A2A30,
}


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


def link(name, bm, mats):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(m)
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def along(u):
    """Point on the deck's centreline u along its length (0 = middle): flat out to FLAT, then up the kick."""
    a = abs(u)
    s = 1 if u >= 0 else -1
    if a <= FLAT:
        return s * a, 0.0
    k = a - FLAT
    return s * (FLAT + k * math.cos(KICK)), k * math.sin(KICK)


def deck(mats):
    """The grip surface as a grid, popsicle outline and concave, then solidified down into the wood."""
    half = FLAT + KICK_LEN
    r = WIDTH / 2
    cols = [i / 24 * 2 * (half - r) - (half - r) for i in range(25)]
    cols += [s * (half - r + r * math.sin(a / 6 * math.pi / 2)) for s in (1, -1) for a in range(1, 7)]
    cols.sort()
    rows = 8
    bm = bmesh.new()
    grid = []
    for u in cols:
        over = max(0.0, abs(u) - (half - r))
        hw = math.sqrt(max(r * r - over * over, 0.0)) if over else r
        hw = max(hw, 0.012)
        x, z = along(u)
        line = []
        for j in range(rows + 1):
            v = (j / rows * 2 - 1) * hw
            # concave in the middle, fading out up the kicks
            c = CONCAVE * (v / r) ** 2 * max(0.0, 1 - max(0.0, abs(u) - FLAT) / KICK_LEN)
            line.append(bm.verts.new((x, v, z + c)))
        grid.append(line)
    for a, b in zip(grid, grid[1:]):
        for j in range(rows):
            bm.faces.new((a[j], b[j], b[j + 1], a[j + 1]))
    ob = link('deck', bm, [mats['grip'], mats['deck'], mats['ply']])
    sol = ob.modifiers.new('wood', 'SOLIDIFY')
    sol.thickness = THICK
    sol.offset = -1
    sol.use_even_offset = True
    sol.material_offset = 1
    sol.material_offset_rim = 2
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.modifier_apply(modifier=sol.name)
    # the solidified shell can face either way: keep the grip (material 0) on top
    for p in ob.data.polygons:
        if p.material_index == 0 and p.normal.z < 0:
            p.flip()
        if p.material_index == 1 and p.normal.z > 0:
            p.flip()
    return ob


def prism(bm, pts, y0, y1):
    """Extrude a polygon in the XZ plane between y0 and y1."""
    a = [bm.verts.new((x, y0, z)) for x, z in pts]
    b = [bm.verts.new((x, y1, z)) for x, z in pts]
    bm.faces.new(a[::-1])
    bm.faces.new(b)
    n = len(pts)
    for i in range(n):
        bm.faces.new((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]))


def cyl(bm, r, depth, at, axis='Y', segs=10):
    geom = bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=r, radius2=r, depth=depth)
    vs = geom['verts']
    if axis == 'Y':
        bmesh.ops.rotate(bm, verts=vs, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, 'X'))
    bmesh.ops.translate(bm, verts=vs, vec=at)
    return vs


def truck(mats, x, nose):
    """Baseplate on the deck, kingpin and bushings angled toward the middle, hanger, axle."""
    s = 1 if nose else -1  # the kingpins face the middle of the board
    parts = []
    bm = bmesh.new()
    # baseplate
    prism(bm, [(x - 0.04, BASE_Z), (x + 0.04, BASE_Z), (x + 0.04, BASE_Z - 0.012), (x - 0.04, BASE_Z - 0.012)], -0.03, 0.03)
    # pivot cup block, toward the outside, sloping down to the hanger
    prism(
        bm,
        [(x + s * 0.01, BASE_Z - 0.012), (x + s * 0.045, BASE_Z - 0.012), (x + s * 0.02, AXLE_Z + 0.012)][:: s],
        -0.012,
        0.012,
    )
    # hanger: wide at the axle, narrowing up to the pivot
    prism(
        bm,
        [(x - 0.022, AXLE_Z - 0.012), (x + 0.022, AXLE_Z - 0.012), (x + 0.012, AXLE_Z + 0.02), (x - 0.012, AXLE_Z + 0.02)],
        -0.085,
        0.085,
    )
    cyl(bm, 0.006, 2 * (TRACK + WHEEL_W / 2 + 0.004), (x, 0, AXLE_Z), segs=6)  # axle
    cyl(bm, 0.005, 0.01, (x - s * 0.018, 0, BASE_Z - 0.04), axis='Z', segs=6)  # kingpin nut
    parts.append(link('truck', bm, [mats['truck']]))
    bm = bmesh.new()
    cyl(bm, 0.014, 0.02, (x - s * 0.018, 0, BASE_Z - 0.022), axis='Z', segs=8)  # bushings
    parts.append(link('bushing', bm, [mats['bushing']]))
    for y in (TRACK, -TRACK):
        bm = bmesh.new()
        vs = cyl(bm, WHEEL_R, WHEEL_W, (x, y, AXLE_Z), segs=14)
        bmesh.ops.bevel(bm, geom=[e for e in bm.edges if all(v in vs for v in e.verts) and e.is_boundary is False and abs(e.verts[0].co.y - e.verts[1].co.y) < 1e-6], offset=0.007, segments=1, affect='EDGES')
        parts.append(link('wheel', bm, [mats['wheel']]))
        bm = bmesh.new()
        out = 1 if y > 0 else -1
        cyl(bm, 0.013, 0.004, (x, y + out * (WHEEL_W / 2), AXLE_Z), segs=8)  # bearing showing in the core
        parts.append(link('bearing', bm, [mats['bearing']]))
    return parts


def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    mats = {k: material(k, v, 0.3 if k == 'truck' else 0.85) for k, v in COLORS.items()}
    board = deck(mats)
    parts = []
    for x, nose in ((BOLTS, True), (-BOLTS, False)):
        parts += truck(mats, x, nose)
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


def export():
    os.makedirs(os.path.dirname(GLB), exist_ok=True)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=GLB, export_format='GLB', use_selection=True, export_yup=True, export_apply=True)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)


if __name__ == '__main__':
    ob = build()
    tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
    print(f'Board: {len(ob.data.vertices)} verts, {tris} tris')
    export()
    print('wrote', GLB)
