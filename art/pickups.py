# Builds the pickups floating along each floor's lines and exports public/models/pickups.glb: a cash coin and a
# Stoken gem. The game instances them by the hundred, so they stay small (src/render/pickups.ts bakes each
# material's colour into the vertices and draws every coin, and every gem, in one call).
#
#   blender -b -P art/pickups.py            (or run it from Blender's Text Editor; it rebuilds the scene)
#
# Units are tiles, the same axes as the other models: -Y toward the game camera, Z up. Both are centred on the
# origin, the coin's face toward the camera (the game spins them about Z, its vertical).
#   Coin    a gold coin with a raised rim and a raised $ on both faces
#   Stoken  a brilliant-cut gem, table up: crown facets over the girdle, the pavilion down to a point
import math
import os
import sys

import bpy  # first: the bpy module provides bmesh and mathutils
import bmesh

HERE = os.path.dirname(os.path.abspath(__file__)) if '__file__' in dir() else bpy.path.abspath('//')
sys.path.insert(0, HERE)
from cars import box, cyl, join, link, material  # noqa: E402  (shared helpers)

ROOT = os.path.dirname(HERE)
GLB = os.path.join(ROOT, 'public', 'models', 'pickups.glb')
BLEND = os.path.join(HERE, 'pickups.blend')

R = 0.2  # coin radius
T = 0.06  # coin thickness

COLORS = {
    'coinGold': 0xFFCF3A,
    'coinRim': 0xE0A820,
    'coinMark': 0xB07A10,
    'gemCrown': 0xD2B0FF,
    'gemTable': 0xF0E4FF,
    'gemPavilion': 0x9A66F0,
}


def ring(bm, r0, r1, y0, y1, segs=12):
    """A flat ring (washer) facing the camera, from radius r0 to r1, through y0..y1."""
    def circle(r, y):
        return [bm.verts.new((r * math.cos(2 * math.pi * i / segs), y, r * math.sin(2 * math.pi * i / segs))) for i in range(segs)]
    oi, oo, ii, io = circle(r1, y0), circle(r1, y1), circle(r0, y0), circle(r0, y1)
    for i in range(segs):
        j = (i + 1) % segs
        bm.faces.new((oi[i], oi[j], oo[j], oo[i]))  # outside
        bm.faces.new((ii[j], ii[i], io[i], io[j]))  # inside
        bm.faces.new((oi[j], oi[i], ii[i], ii[j]))  # front
        bm.faces.new((oo[i], oo[j], io[j], io[i]))  # back


def dollar(bm, y0, y1, back=False):
    """A blocky $ standing proud of a face, through y0..y1: three bars, two half-uprights, the stroke through it.
    back: mirrored, so it reads right from behind."""
    w, h, s = 0.065, 0.1, 0.022
    f = -1 if back else 1
    for z in (h, 0, -h):
        box(bm, -w, w, y0, y1, z - s / 2, z + s / 2)
    box(bm, *sorted((f * (-w - s / 2), f * (-w + s / 2))), y0, y1, 0, h)  # top left
    box(bm, *sorted((f * (w - s / 2), f * (w + s / 2))), y0, y1, -h, 0)  # bottom right
    box(bm, -s / 3, s / 3, y0, y1, -h - 0.035, h + 0.035)  # the stroke


def coin(m):
    parts = []
    bm = bmesh.new()
    cyl(bm, R * 0.86, T * 0.8, (0, 0, 0), segs=12)
    parts.append(link('coinGold', bm, m['coinGold']))
    bm = bmesh.new()
    ring(bm, R * 0.84, R, -T / 2, T / 2)
    parts.append(link('coinRim', bm, m['coinRim']))
    bm = bmesh.new()
    dollar(bm, -T / 2, -T * 0.4)  # front (toward the camera)
    dollar(bm, T * 0.4, T / 2, back=True)  # back
    parts.append(link('coinMark', bm, m['coinMark']))
    return join(parts, 'Coin')


def stoken(m, segs=8):
    """Table at the top, crown down to the girdle, pavilion to a point; flat shading gives the facets."""
    girdle, table, crown_h, pav = 0.3, 0.17, 0.12, 0.3
    z0 = (pav - crown_h) / 2  # centre the gem's height on the origin
    parts = []

    def ring_at(r, z, twist=0.0):
        return [(r * math.cos(2 * math.pi * (i + twist) / segs), r * math.sin(2 * math.pi * (i + twist) / segs), z - z0 + 0.0) for i in range(segs)]

    top = ring_at(table, crown_h, 0.5)
    mid = ring_at(girdle, 0)
    bm = bmesh.new()
    tv = [bm.verts.new(p) for p in top]
    bm.faces.new(tv)
    parts.append(link('gemTable', bm, m['gemTable']))
    bm = bmesh.new()
    tv = [bm.verts.new(p) for p in top]
    mv = [bm.verts.new(p) for p in mid]
    for i in range(segs):
        j = (i + 1) % segs
        bm.faces.new((mv[i], mv[j], tv[i]))  # crown: a triangle up to the table, and one down to the girdle
        bm.faces.new((tv[i], mv[j], tv[j]))
    parts.append(link('gemCrown', bm, m['gemCrown']))
    bm = bmesh.new()
    mv = [bm.verts.new(p) for p in mid]
    tip = bm.verts.new((0, 0, -pav - z0))
    for i in range(segs):
        bm.faces.new((mv[(i + 1) % segs], mv[i], tip))
    parts.append(link('gemPavilion', bm, m['gemPavilion']))
    return join(parts, 'Stoken')


def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    m = {k: material(k, v) for k, v in COLORS.items()}
    obs = [coin(m), stoken(m)]
    obs[1].location = (0.6, 0, 0)  # side by side in the file
    return obs


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
