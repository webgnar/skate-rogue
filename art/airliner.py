# Builds the airliner that crosses the sky over the top route and exports public/models/airliner.glb. It follows the
# airplane sprite in the QFS game's Chicago level (QFSHIVE sprites/s_airplane): a long twin-engine widebody in pale
# grey, a swept blue fin, grey wings and tailplane, blue engine cowls with grey exhaust cones under the wings, a row
# of cabin windows down each side and the cockpit windows at the nose.
#
#   blender -b -P art/airliner.py            (or run it from Blender's Text Editor; it rebuilds the scene)
#
# Units are tiles, at the size the game draws it (no scaling in game): 14 long, a 13 span. Axes as the other models:
# the nose points +X, -Y faces the game camera, Z is up. One object, `Airliner`, origin at the middle of the
# fuselage (the game turns it to fly left).
import math
import os

import bpy  # first: the bpy module provides bmesh and mathutils
import bmesh

HERE = os.path.dirname(os.path.abspath(__file__)) if '__file__' in dir() else bpy.path.abspath('//')
ROOT = os.path.dirname(HERE)
GLB = os.path.join(ROOT, 'public', 'models', 'airliner.glb')
BLEND = os.path.join(HERE, 'airliner.blend')

L = 14.0  # nose to tail
MID = L / 2  # built tail at x 0, nose at x L, then centred
R = 0.62  # fuselage radius

# the sprite's colours; named apart from the other models' (the game shares materials by name: src/render/models.ts)
COLORS = {
    'alHull': 0xE2E2E2,
    'alFin': 0x004D83,
    'alWing': 0x666666,
    'alStab': 0x898989,
    'alCowl': 0x004293,
    'alExhaust': 0xB7B7B7,
    'alWindow': 0x16161C,
}

# fuselage stations from the tail: (x, radius, centre height); the tail sweeps up to the fin, the nose rounds down
STATIONS = [
    (0.0, 0.1, 0.42), (0.6, 0.24, 0.36), (1.5, 0.4, 0.24), (2.6, 0.54, 0.1), (3.6, R, 0.0),
    (12.0, R, 0.0), (12.8, 0.56, -0.03), (13.4, 0.44, -0.07), (13.8, 0.28, -0.1), (14.0, 0.06, -0.12),
]


def material(name, color):
    m = bpy.data.materials.new(name)
    rgb = [((color >> s) & 0xFF) / 255 for s in (16, 8, 0)]
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in rgb]
    m.diffuse_color = (*lin, 1)
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*lin, 1)
    bsdf.inputs['Roughness'].default_value = 0.6
    return m


def link(name, bm, mat):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mat)
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    return ob


def join(parts, name):
    bpy.ops.object.select_all(action='DESELECT')
    for ob in parts:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = ob.data.name = name
    return ob


def loft(bm, stations, segs=12, cy=0.0):
    """Rings about the x axis through (x, radius, centre z), capped at both ends."""
    rings = []
    for x, r, cz in stations:
        rings.append([bm.verts.new((x, cy + r * math.cos(2 * math.pi * i / segs), cz + r * math.sin(2 * math.pi * i / segs))) for i in range(segs)])
    for a, b in zip(rings, rings[1:]):
        for i in range(segs):
            j = (i + 1) % segs
            bm.faces.new((a[i], a[j], b[j], b[i]))
    bm.faces.new(rings[0][::-1])
    bm.faces.new(rings[-1])


def slab(bm, outline, z0, z1):
    """A flat plate: an (x, y) outline extruded through z0..z1."""
    lo = [bm.verts.new((x, y, z0)) for x, y in outline]
    hi = [bm.verts.new((x, y, z1)) for x, y in outline]
    n = len(outline)
    bm.faces.new(lo[::-1])
    bm.faces.new(hi)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((lo[i], lo[j], hi[j], hi[i]))


def box(bm, x0, x1, y0, y1, z0, z1):
    slab(bm, [(x0, y0), (x1, y0), (x1, y1), (x0, y1)], z0, z1)


def wing(bm, root, tip, span, z_root, z_tip, t):
    """A swept surface, both sides: root (LE x, TE x) at the body, tip (LE x, TE x) out at +-span, rising z_root
    to z_tip (dihedral), t thick."""
    for s in (1, -1):
        pts = [(root[1], 0.0, z_root), (root[0], 0.0, z_root), (tip[0], s * span, z_tip), (tip[1], s * span, z_tip)]
        lo = [bm.verts.new((x, y, z - t / 2)) for x, y, z in pts]
        hi = [bm.verts.new((x, y, z + t / 2)) for x, y, z in pts]
        for q in (lo[::-1], hi):
            bm.faces.new(q)
        for i in range(4):
            j = (i + 1) % 4
            bm.faces.new((lo[i], lo[j], hi[j], hi[i]))


def airliner(m):
    parts = []
    bm = bmesh.new()
    loft(bm, STATIONS)
    parts.append(link('alHull', bm, m['alHull']))

    bm = bmesh.new()  # the fin: swept back from the top of the tail
    pts = [(0.5, 0.25), (3.2, 0.25), (1.2, 2.6), (0.15, 2.6)]
    lo = [bm.verts.new((x, -0.05, z)) for x, z in pts]
    hi = [bm.verts.new((x, 0.05, z)) for x, z in pts]
    bm.faces.new(lo)
    bm.faces.new(hi[::-1])
    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new((lo[j], lo[i], hi[i], hi[j]))
    parts.append(link('alFin', bm, m['alFin']))

    bm = bmesh.new()
    wing(bm, (8.8, 5.4), (4.7, 3.9), 6.5, -0.3, 0.25, 0.14)
    parts.append(link('alWing', bm, m['alWing']))
    bm = bmesh.new()
    wing(bm, (2.4, 0.7), (0.9, 0.2), 2.4, 0.3, 0.45, 0.08)
    parts.append(link('alStab', bm, m['alStab']))

    cowl, exhaust = bmesh.new(), bmesh.new()
    for y in (2.4, -2.4):  # under each wing, hung a little ahead of it
        loft(cowl, [(8.0, 0.36, -0.72), (8.4, 0.42, -0.72), (9.4, 0.42, -0.72), (9.5, 0.36, -0.72)], cy=y)
        loft(exhaust, [(7.3, 0.14, -0.74), (8.0, 0.34, -0.72)], cy=y)
        box(exhaust, 7.9, 8.6, y - 0.05, y + 0.05, -0.45, -0.28)  # the pylon up to the wing
    parts += [link('alCowl', cowl, m['alCowl']), link('alExhaust', exhaust, m['alExhaust'])]

    win = bmesh.new()
    zw = 0.16
    yw = math.sqrt(R * R - zw * zw)
    for s in (1, -1):  # cabin windows down both sides, a gap at each door
        x = 3.2
        while x < 12.3:
            if not (5.9 < x < 6.3 or 10.6 < x < 11.0):
                box(win, x, x + 0.1, *sorted((s * (yw - 0.02), s * (yw + 0.02))), zw - 0.05, zw + 0.05)
            x += 0.24
        for dx in (6.0, 10.7, 12.4):  # doors: a dark outline would be lost at this size, so a tall window
            box(win, dx, dx + 0.16, *sorted((s * (yw - 0.02), s * (yw + 0.025))), -0.25, 0.32)
        box(win, 13.35, 13.62, *sorted((s * 0.3, s * 0.42)), 0.1, 0.2)  # the cockpit windows
    parts.append(link('alWindow', win, m['alWindow']))
    ob = join(parts, 'Airliner')
    for v in ob.data.vertices:  # origin at the middle
        v.co.x -= MID
    return ob


def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    m = {k: material(k, v) for k, v in COLORS.items()}
    return [airliner(m)]


def export():
    os.makedirs(os.path.dirname(GLB), exist_ok=True)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=GLB, export_format='GLB', use_selection=True, export_yup=True, export_apply=True)
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
