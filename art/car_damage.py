# Car-hop damage (zack, 2026-10-25): a dented, a busted and a wrecked copy of each vehicle you can car-hop, built
# from the clean model by art/cars.py. They export into cars.glb next to it as <Name>_dent, <Name>_bust and
# <Name>_wreck, and the game swaps them in as a car takes hops (src/traffic/damage.ts, src/render/car-damage.ts).
#
#   dent   the roof caved in where you land and the glass under it cracked, door dings on the camera's side, a
#          scrape or two, the panels a little wavy
#   bust   the roof caved deeper, the side stoved in, cracked glass, scraped paint, the hood buckled, a front tyre flat
#          and the nose sagging on that corner, the bumper hanging
#   wreck  the cabin crushed down to the belt line, everything crumpled and scorched, all four tyres flat
#
# The roofs only sink a little (0.1 and 0.16 tiles) on dent and bust: the skater still lands on the hitbox roof.
# The wreck has no hitbox (it rolls out of the lane), so it can be crushed flat.
#
# The flat panels get cut into a grid first (bisect planes) so there are vertices to push. Every push is a smooth
# function of position, so the separate pieces of a car (body, glass, trim) that share a corner move together and
# no seams open up.
import math

import bpy
import bmesh
from mathutils import Vector, noise

WHEEL = {'tire', 'rim', 'darkrim'}
LIT = {'lamp', 'tail', 'accent', 'sign', 'badge'}
EXTRA = {'crackGlass': 0x7D90A6, 'scrape': 0x9EA2AA, 'soot': 0x2B2724}


def smooth(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def extra_materials(material):
    return {k: bpy.data.materials.get(k) or material(k, v) for k, v in EXTRA.items()}


def grid(bm, keep, L, W, H):
    """Cut the panels into a grid so the dents have vertices to push."""
    def geom():
        faces = [f for f in bm.faces if keep(f)]
        edges = {e for f in faces for e in f.edges}
        verts = {v for f in faces for v in f.verts}
        return list(verts) + list(edges) + faces
    n = 9 if L < 3 else 14
    for i in range(1, n):
        x = -L / 2 + i * L / n
        bmesh.ops.bisect_plane(bm, geom=geom(), plane_co=(x, 0, 0), plane_no=(1, 0, 0))
    for y in (-W * 0.3, W * 0.3):
        bmesh.ops.bisect_plane(bm, geom=geom(), plane_co=(0, y, 0), plane_no=(0, 1, 0))
    for k in range(1, 4):
        bmesh.ops.bisect_plane(bm, geom=geom(), plane_co=(0, 0, H * k / 4), plane_no=(0, 0, 1))


def dent(co, at, r, depth, axis):
    """A round dent at `at`, radius r, pushing `depth` along -axis (z: down; y: into the car from the camera side)."""
    d = Vector((co.x - at[0], co.y - at[1], co.z - at[2]))
    if axis == 'z':
        d.z = 0
    else:
        d.y = 0
    return depth * smooth(1 - d.length / r)


def damage(src, stage, mats, spec):
    """A copy of `src` dented to `stage`. spec: len, wide, roof, belt (the crush line), roof_x (where you land),
    axle (the front axle's x), wheel_r, seed."""
    L, W, top, belt = spec['len'], spec['wide'], spec['roof'], spec['belt']
    ob = src.copy()
    ob.data = src.data.copy()
    ob.name = ob.data.name = f'{src.name}_{stage}'
    bpy.context.scene.collection.objects.link(ob)
    names = [m.name for m in ob.data.materials]
    for k in ('crackGlass', 'scrape', 'soot'):
        if k not in names:
            ob.data.materials.append(mats[k])
            names.append(k)
    slot = {n: i for i, n in enumerate(names)}

    bm = bmesh.new()
    bm.from_mesh(ob.data)
    is_wheel = lambda f: names[f.material_index] in WHEEL
    grid(bm, lambda f: not is_wheel(f) and names[f.material_index] not in LIT, L, W, top)
    bm.verts.ensure_lookup_table()

    wheel_verts = {v for f in bm.faces if is_wheel(f) for v in f.verts}
    s = spec['seed'] + {'dent': 0, 'bust': 7, 'wreck': 13}[stage]
    off = Vector((s * 1.7, s * 3.1, s * 0.7))
    front, axle, r = L / 2, spec['axle'], spec['wheel_r']
    rx = spec['roof_x']
    cam = -W / 2  # Blender -Y is the side the game's camera sees

    for v in bm.verts:
        co = v.co.copy()
        if v in wheel_verts:
            flat = stage == 'wreck' or (stage == 'bust' and co.x > 0 and co.y < 0)
            if flat:  # a flat tyre: squashed down onto the street
                v.co.z = co.z * 0.72
            continue
        p = Vector(co)
        if stage == 'dent':
            # a sharp dip in the roof where you land, a crease along the door line, a ding in the back door
            p.z -= dent(co, (rx, 0, top), L * 0.2, 0.1, 'z')
            p.y += dent(co, (rx + L * 0.18, cam, top * 0.45), 0.36, 0.08, 'y') * (co.y < 0)
            p.z -= dent(co, (rx + L * 0.18, cam, belt), 0.3, 0.04, 'y') * (co.y < 0) * (co.z > belt * 0.6)
            p.y += dent(co, (rx - L * 0.22, cam, top * 0.35), 0.28, 0.06, 'y') * (co.y < 0)
            p += noise.noise_vector(co * 3.0 + off) * 0.015
        elif stage == 'bust':
            p.z -= dent(co, (rx, 0, top), L * 0.28, 0.16, 'z')
            p.z -= dent(co, (rx + L * 0.12, -W * 0.25, top), L * 0.14, 0.04, 'z')
            p.y += dent(co, (rx + L * 0.12, cam, top * 0.45), 0.45, 0.12, 'y') * (co.y < 0)
            p.y += dent(co, (rx - L * 0.25, cam, top * 0.3), 0.35, 0.08, 'y') * (co.y < 0)
            # the hood buckles up in ridges
            if co.x > axle - r and co.z > top * 0.3:
                p.z += 0.035 * max(0.0, math.sin((co.x - axle) * 14 + s)) * smooth((co.x - axle + r) / (L * 0.15))
            # the corner over the flat front tyre drops, and the bumper on it hangs
            corner = smooth((co.x - axle * 0.2) / (front - axle * 0.2)) * smooth((-co.y + W * 0.1) / (W * 0.6))
            p.z -= 0.07 * corner
            if co.x > front - 0.12 and co.z < top * 0.35:
                p.z -= 0.06 * smooth(-co.y / (W / 2))
            p += noise.noise_vector(co * 3.5 + off) * 0.024
        else:  # wreck
            if co.z > belt:
                p.z = belt + (co.z - belt) * 0.3
            p.z = p.z * 0.88 - 0.03 * smooth(co.x / front)  # sat down on its flat tyres
            p.y += dent(co, (rx, cam, belt * 0.6), L * 0.3, 0.16, 'y') * (co.y < 0)
            p += noise.noise_vector(co * 3.0 + off) * 0.05
            p.z = max(p.z, 0.02)
        v.co = p

    # glass cracks, the paint scrapes (bust) or scorches (wreck) in patches
    for f in bm.faces:
        n = names[f.material_index]
        c = f.calc_center_median()
        # dented, the glass cracks over where you landed; busted, all of it
        if n == 'glass' and (stage != 'dent' or abs(c.x - rx) < L * 0.2):
            f.material_index = slot['crackGlass']
        elif n == names[0]:  # the body's paint (the first piece joined)
            patch = noise.noise(c * 2.2 + off)
            low = c.y < 0 and c.z < belt * 1.05  # scrapes down the camera's side, under the windows
            if stage == 'dent' and patch > 0.5 and low:
                f.material_index = slot['scrape']
            elif stage == 'bust' and patch > 0.3 and low:
                f.material_index = slot['scrape']
            elif stage == 'wreck' and patch > 0.2:
                f.material_index = slot['soot' if patch > 0.38 else 'scrape']
    bm.normal_update()
    bm.to_mesh(ob.data)
    bm.free()
    for p in ob.data.polygons:
        p.use_smooth = False
    return ob


def variants(src, mats, spec):
    return [damage(src, stage, mats, spec) for stage in ('dent', 'bust', 'wreck')]
