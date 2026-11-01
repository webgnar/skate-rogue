# Builds the QFS skaters (Webster, Keanu, Roxy, Goldie) on Lou Gnar's rig and exports public/models/<name>.glb.
#
#   blender -b -P art/skaters.py                 (all four, from their .blend files)
#   blender -b -P art/skaters.py -- roxy         (one)
#   blender -b -P art/skaters.py -- --rebuild roxy
#                                                (from this script, over the .blend: hand edits there are lost)
#
# Once a skater's .blend exists it is the source (zack, 2026-10-31: "i might modify the meshes a bit too"): edit or
# paint it in Blender, and the export writes the GLB from it as it is. Change a skater's look in this script only with
# --rebuild, and only for a skater nobody has edited by hand; otherwise make the change in the .blend.
#
# Each skater is one skinned mesh on the same 20-bone armature and bind pose as art/lou_gnar.py, so the game plays
# Lou's clips (the actions in lou-gnar.glb) on them unchanged; their GLBs carry no animation. Looks follow the QFS
# title cast art (QFSHIVE art_source/title_cast), minus the swords and shields: Gnar Run has no combat.
import math
import os
import random
import sys

import bpy  # first: the bpy module provides bmesh and mathutils
import bmesh
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lou_gnar as lg  # noqa: E402  (the rig, the bind pose and the mesh helpers)
import paint  # noqa: E402  (art/tex/<skater>.png on the model)
from lou_gnar import ANKLE_Z, ARM_X, ELBOW_Z, HAND_Z, HEAD_Z, HIP_X, HIP_Z, KNEE_Z, PELVIS, SHOULDER_Z, SPINE  # noqa: E402

OUT = os.path.join(lg.ROOT, 'public', 'models')
HEAD_C = Vector((0, 0, HEAD_Z + 0.14))  # middle of the head
HEAD_R = 0.12

# top: what covers the chest ('skin' for none); crop: the top stops above the navel; sleeves: none, short or long;
# flare: how far the trouser legs widen at the ankle; hair: 'spiky', 'long' (spiky up top, long behind) or 'hood' (hood up over spiky bangs)
SKATERS = {
    'webster': {
        'skin': 0xD9945A, 'top': 'skin', 'sleeves': 'none', 'pants': 0x25252B, 'shoe': 0x18181D, 'sole': 0x2B44C8,
        'hair': 'spiky', 'hairColor': 0xE8C25A, 'shades': 0xE0322E, 'build': 1.08,
    },
    'keanu': {
        'skin': 0x6B4128, 'top': 0x8C8C92, 'sleeves': 'long', 'pants': 0x2E2E34, 'shoe': 0x1C1C22, 'sole': 0x2B44C8,
        'hair': 'hood', 'hairColor': 0x1A1410, 'build': 1.04, 'smooth': True,
    },
    'roxy': {
        'skin': 0xF0C29E, 'top': 0x7A2FB8, 'crop': True, 'sleeves': 'none', 'pants': 0x2D4E9A, 'shoe': 0x6C2FA8,
        'sole': 0xF2F2F2, 'hair': 'long', 'hairColor': 0x9A4A22, 'build': 0.94,
    },
    # Goldie skates quads in QFS. Gnar Run's moves are all board tricks, so she rides a board here, in purple
    # high-tops with orange soles, her skates' colours (docs/overnight-decisions.md)
    'goldie': {
        'skin': 0x5E3A22, 'top': 0xB9A6E0, 'crop': True, 'sleeves': 'none', 'pants': 0x7EC4EC, 'flare': 0.05,
        'shoe': 0x6C2FA8, 'sole': 0xF07A1E, 'hair': 'long', 'hairColor': 0xF2D25A, 'build': 0.94,
    },
}


def body(spec, mats):
    """Skin-modifier figure like Lou's suit but slimmer, then coloured by region: skin, top, sleeves, trousers."""
    b = spec['build']
    flare = spec.get('flare', 0)
    # (position, radius across x, radius in depth y)
    verts = [
        ((0, 0, PELVIS - 0.02), 0.15 * b, 0.11),  # 0 pelvis
        ((0, 0, SPINE + 0.06), 0.13 * b, 0.095),  # 1 waist
        ((0, 0, SPINE + 0.28), 0.165 * b, 0.11),  # 2 chest
        ((0, 0, SPINE + 0.44), 0.17 * b, 0.1),  # 3 shoulders
        ((0, 0, SPINE + 0.54), 0.055, 0.055),  # 4 neck
    ]
    edges = [(0, 1), (1, 2), (2, 3), (3, 4)]
    for s in (1, -1):
        i = len(verts)
        verts += [
            ((s * (ARM_X - 0.03), 0, SHOULDER_Z - 0.01), 0.078 * b, 0.075),  # shoulder
            ((s * ARM_X, 0, ELBOW_Z), 0.06 * b, 0.058),  # elbow
            ((s * ARM_X, 0, HAND_Z + 0.05), 0.047, 0.047),  # wrist
            ((s * HIP_X, 0, HIP_Z - 0.04), 0.1, 0.1),  # hip
            ((s * HIP_X, 0, KNEE_Z), 0.08 + flare * 0.3, 0.08 + flare * 0.3),  # knee
            ((s * HIP_X, 0, ANKLE_Z + 0.03), 0.065 + flare, 0.065 + flare),  # ankle (the trouser cuff)
        ]
        edges += [(3, i), (i, i + 1), (i + 1, i + 2), (0, i + 3), (i + 3, i + 4), (i + 4, i + 5)]
    me = bpy.data.meshes.new('body')
    me.from_pydata([v[0] for v in verts], edges, [])
    ob = bpy.data.objects.new('body', me)
    bpy.context.scene.collection.objects.link(ob)
    skin = ob.modifiers.new('skin', 'SKIN')
    skin.use_smooth_shade = False
    for sv, (_, rx, ry) in zip(me.skin_vertices[0].data, verts):
        sv.radius = (rx, ry)
    me.skin_vertices[0].data[0].use_root = True
    sub = ob.modifiers.new('sub', 'SUBSURF')
    sub.levels = sub.render_levels = 1
    bpy.context.view_layer.objects.active = ob
    for m in list(ob.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)

    top = mats['skin'] if spec['top'] == 'skin' else mats['top']
    slots = [mats['skin'], top, mats['pants']]
    for m in slots:
        me.materials.append(m)
    waist = SPINE + 0.03  # trousers up to here
    crop = SPINE + 0.2 if spec.get('crop') else waist  # a crop top stops here, the midriff shows below
    sleeve = {'none': 99, 'short': SHOULDER_Z - 0.12, 'long': -99}[spec['sleeves']]
    for p in me.polygons:
        c = p.center
        if abs(c.x) > 0.205 and c.z > HIP_Z:  # arm, down to the wrist
            p.material_index = 1 if c.z > sleeve else 0
        elif c.z > SPINE + 0.5 and math.hypot(c.x, c.y) < 0.075:  # neck (not the tops of the shoulders round it)
            p.material_index = 0
        elif c.z > crop:
            p.material_index = 1
        elif c.z > waist:
            p.material_index = 0
        else:
            p.material_index = 2
    return ob


def sphere(name, r, at, mat, scale=(1, 1, 1), keep=None, seg=(14, 10)):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg[0], v_segments=seg[1], radius=r)
    bmesh.ops.scale(bm, vec=scale, verts=bm.verts)
    if keep:
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if not keep(f.calc_center_median())], context='FACES')
    bmesh.ops.translate(bm, verts=bm.verts, vec=at)
    return lg.link(name, bm, [mat])


def head(spec, mats):
    parts = [(sphere('head', HEAD_R, HEAD_C, mats['skin'], (0.9, 1, 1.12)), 'Head')]
    # eyes, or Webster's red shades
    if spec.get('shades'):
        parts.append((lg.box('shades', (0.2, 0.03, 0.045), HEAD_C + Vector((0, -0.115, 0.02)), mats['shades'], 0.01), 'Head'))
    else:
        for s in (1, -1):
            parts.append((lg.box(f'eye{s}', (0.028, 0.02, 0.03), HEAD_C + Vector((s * 0.042, -0.115, 0.02)), mats['eye']), 'Head'))
    hair = mats['hair']
    if spec['hair'] == 'hood':
        # the grey hood up over the head is fabric (hood_mesh, on its own bones); spiky dark bangs poke out over the brow
        parts.append((sphere('fringe', HEAD_R + 0.008, HEAD_C, hair, (0.9, 1, 1.12), lambda p: p.z > 0.07), 'Head'))
        parts.append((spikes('bangs', bangs(spec, 5, 0.1, 0.05, 36), hair), 'Head'))
    else:
        # comic book anime hair (zack's reference, 2026-10-30): a cap over the scalp bristling with sharp gelled
        # spikes, and bangs hanging over the brow in points. The big spikes and long clumps swing (chains below).
        def crown(p):
            return p.z > 0.04 or p.y > 0.0
        parts.append((sphere('hair', HEAD_R + 0.012, HEAD_C, hair, (0.95, 1.02, 1.12), crown), 'Head'))
        parts.append((spikes('spikes', crown_spikes(spec), hair), 'Head'))
        parts.append((spikes('bangs', bangs(spec, 6, 0.13, 0.08), hair), 'Head'))
    return parts


def scalp(az, el, out=0.0):
    """A point on the head's surface: az 0 at the back (+Y), 90 the lead side (+X), 180 the face; el up from level."""
    a, e = math.radians(az), math.radians(el)
    d = Vector((math.cos(e) * math.sin(a) * 0.9, math.cos(e) * math.cos(a), math.sin(e) * 1.12))
    return HEAD_C + d * (HEAD_R + out), d.normalized()


def blade(bm, root, d, length, w, t, bend=Vector(), radial=None):
    """One anime hair spike into `bm`: a flat diamond section, broad across the scalp, tapering to a sharp tip and
    curling along `bend` toward it. Returns the new verts."""
    d = d.normalized()
    radial = (radial or Vector((0, 0, 1))).normalized()
    a = radial.cross(d)
    a = a.normalized() if a.length > 1e-4 else Vector((1, 0, 0))
    b = d.cross(a).normalized()
    out = []
    rings = []
    for k, f in ((0.0, 1.0), (0.4, 0.85), (0.75, 0.5)):
        c = root + d * length * k + bend * (k * k)
        rings.append([bm.verts.new(c + a * w * f * x + b * t * f * y) for x, y in ((1, 0), (0, 1), (-1, 0), (0, -1))])
    tip = bm.verts.new(root + d * length + bend)
    for r0, r1 in zip(rings, rings[1:]):
        for i in range(4):
            j = (i + 1) % 4
            bm.faces.new((r0[i], r0[j], r1[j], r1[i]))
    for i in range(4):
        bm.faces.new((rings[-1][i], rings[-1][(i + 1) % 4], tip))
    bm.faces.new(rings[0][::-1])
    for r in rings:
        out += r
    return out + [tip]


def spikes(name, specs, mat):
    bm = bmesh.new()
    for root, d, length, w, t, bend, radial in specs:
        blade(bm, root, d, length, w, t, bend, radial)
    return lg.link(name, bm, [mat])


def crown_spikes(spec):
    """Spikes all over the crown, swept up and back, the ones at the sides flaring out: the anime silhouette."""
    rnd = random.Random(spec['hairColor'])
    long = spec['hair'] == 'long'
    out = []
    for el, n, length, span in ((15, 9, 0.15, 250), (42, 8, 0.17, 230), (68, 5, 0.15, 200)):
        for i in range(n):
            az = -span / 2 + span * (i + 0.5) / n + rnd.uniform(-8, 8)  # round the back and sides, not over the face
            root, radial = scalp(az, el + rnd.uniform(-5, 5), -0.015)
            # out from the scalp, pushed back and up so the sides flare; long hair lies flatter, sweeping back
            d = radial * 1.2 + Vector((0, 0.6 if long else 0.3, 0.1 if long else 0.45))
            l = length * rnd.uniform(0.8, 1.2) * (0.7 if long else 1)
            bend = Vector((0, 0.035, -0.025 if long else 0.03)) + radial * 0.015
            out.append((root, d, l, 0.06, 0.018, bend, radial))
    return out


def bangs(spec, n, length, spread, el=55):
    """Pointed bangs hanging over the brow, the middle ones longest, the outer ones curling out past the temples."""
    rnd = random.Random(spec['hairColor'] + 1)
    out = []
    for i in range(n):
        u = (i + 0.5) / n * 2 - 1  # -1 trailing side .. 1 lead side
        root, radial = scalp(180 - u * 60, el + 8 * abs(u), 0.0)
        d = Vector((u * 0.6, -0.9, -1))
        bend = Vector((u * spread * 0.6, -0.03, 0.015))
        l = length * (1.15 - 0.45 * abs(u)) * rnd.uniform(0.85, 1.1)
        out.append((root, d, l, 0.042, 0.014, bend, radial))
    return out


# Spring chains: hair clumps and loose cloth hang off a chain of extra bones ('Spring...') that the game swings with
# the skater's motion (src/render/springs.ts); Lou's clips leave them alone. Each chain: (name, parent bone, root,
# direction, length, root half-width, root half-depth, taper, bones).
def chains(spec):
    out = []
    if spec['hair'] in ('long', 'spiky'):
        # big spikes standing off the crown, gelled stiff (SpringSpike in springs.ts): they bob on a pop and lean
        # back with speed
        for i, az in enumerate((-60, -25, 5, 35, 70)):
            root, radial = scalp(az, 62 if abs(az) < 40 else 45, -0.01)
            d = radial + Vector((0, 0.45, 0.7))
            out.append((f'SpringSpike{i}', 'Head', root, d, 0.24 if abs(az) < 40 else 0.2, 0.07, 0.02, 1.0, 2))
    if spec['hair'] == 'long':
        # the long hair falling down the back past the shoulders, in five pointed clumps fanned across the back
        for i, x in enumerate((-0.085, -0.045, 0.0, 0.045, 0.085)):
            side = abs(x) / 0.085
            root = HEAD_C + Vector((x, 0.07 + 0.015 * (1 - side), 0.03 - 0.03 * side))
            out.append((f'SpringHair{i}', 'Head', root, Vector((x * 0.9, 0.12, -1)), 0.4 - 0.07 * side, 0.055, 0.02, 1.0, 3))
        # a lock either side of the face, down past the jaw
        for i, s in enumerate((1, -1)):
            root, _ = scalp(180 - s * 70, 20, -0.005)
            out.append((f'SpringLock{i}', 'Head', root, Vector((s * 0.15, -0.1, -1)), 0.2, 0.035, 0.014, 1.0, 2))
    if spec['hair'] == 'hood':
        # the hoodie's drawstrings (zack, 2026-10-31: "two drawstrings in the front by the collar"): white cords out
        # of the collar either side of the throat, hanging down the chest
        for i, x in enumerate((-0.05, 0.05)):
            out.append((f'SpringString{i}', 'Spine1', Vector((x, -0.112, SPINE + 0.49)), Vector((x * 0.6, -0.14, -1)), 0.26, 0.012, 0.012, 0.0, 3))
    return out


# Keanu's hood and sweatshirt as fabric (zack, 2026-10-31: "his hood on his head should be like the hair", then "not
# capped on the back", "show more of his face, only cover a little more than half the top of the head" and the
# sweatshirt "to have physics as well"). Each is a sheet cut into strips: held to a bone along one edge, and down each
# strip a chain of bones (SpringHood<i>, SpringShirt<i>). The game ties neighbouring chains together, all the way
# round where the strips close into a loop (springs.ts), so the sheet puffs out with speed and flops on landings.
def cloth_bones(rig, name, at, cols, us, anchor):
    """A chain per strip: bones from at(col, us[0]) to at(col, us[1]) and so on. The last bone only gives the one
    before it a tail to aim at."""
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='EDIT')
    eb = rig.data.edit_bones
    for i, col in enumerate(cols):
        prev = eb[anchor]
        for j, (u0, u1) in enumerate(zip(us, us[1:])):
            b = eb.new(f'{name}{i}_{j}')
            b.head, b.tail = at(col, u0), at(col, u1)
            b.parent = prev
            b.use_connect = j > 0
            b.use_deform = j < len(us) - 2
            prev = b
    bpy.ops.object.mode_set(mode='OBJECT')


def cloth_mesh(name, at, cols, us, rows, anchor, mat, centre, cap=None, thickness=0.014):
    """The sheet over the strips (closed round into a loop), skinned to `anchor` down to the chains' roots and to the
    chains below, with a strip between each pair of chains; `cap` closes the far end on one point. Faces turn out
    from centre(point); then it is given thickness."""
    n = len(cols)
    step = 360 / n
    mid = [cols[0] + step * k / 2 for k in range(2 * n)]
    bm = bmesh.new()
    grid = [[bm.verts.new(at(c, u)) for u in rows] for c in mid]
    tip = bm.verts.new(cap) if cap is not None else None
    for k in range(2 * n):
        a, b = grid[k], grid[(k + 1) % (2 * n)]
        for j in range(len(rows) - 1):
            bm.faces.new((a[j], b[j], b[j + 1], a[j + 1]))
        if tip is not None:
            bm.faces.new((a[-1], b[-1], tip))
    for f in bm.faces:
        c = f.calc_center_median()
        if f.normal.dot(c - centre(c)) < 0:
            f.normal_flip()
    bm.normal_update()
    bones = len(us) - 2  # deforming bones per chain
    span = us[1] - us[0]
    weights = {}  # vert -> {bone: weight}
    for k in range(2 * n):
        i, half = divmod(k, 2)
        side = [(i, 1.0)] if not half else [(i, 0.5), ((i + 1) % n, 0.5)]
        for j, u in enumerate(rows):
            w = {}
            if u <= us[0]:
                w[anchor] = 1.0
            else:
                s = (u - us[0]) / span  # how far down the chain, in bones
                along = [max(0.0, 1 - abs(s - (m + 0.5))) for m in range(bones)]
                along[0] = max(along[0], 1.0 if s < 0.5 else 0.0)
                along[-1] = max(along[-1], 1.0 if s > bones - 0.5 else 0.0)
                tot = sum(along)
                for col, cw in side:
                    for m, x in enumerate(along):
                        if x:
                            key = f'{name}{col}_{m}'
                            w[key] = w.get(key, 0) + cw * x / tot
            weights[grid[k][j]] = w
    if tip is not None:
        weights[tip] = {f'{name}{i}_{bones - 1}': 1 / n for i in range(n)}
    ob = lg.link(name.lower(), bm, [mat])
    index = {v: k for k, v in enumerate(weights)}  # verts were made in this order, so their indices match
    groups = {}
    for v, w in weights.items():
        for g_name, x in w.items():
            g = groups.get(g_name) or ob.vertex_groups.new(name=g_name)
            groups[g_name] = g
            g.add([index[v]], x, 'REPLACE')
    solid = ob.modifiers.new('solid', 'SOLIDIFY')
    solid.thickness = thickness
    solid.offset = 1
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.modifier_apply(modifier=solid.name)
    return ob


# the hood: pushed back on the head, so the face and the front of the hair show. Its opening runs over the top of
# the head a little behind the middle, down behind the ears, and under to the back of the neck, and it closes at the
# back on a point. A strip's `u` runs from the opening (0) to the back (1).
HOOD_C = HEAD_C + Vector((0, 0.012, 0.01))
HOOD_R = HEAD_R + 0.035
HOOD_S = Vector((1.0, 1.1, 1.1))  # a little baggy
HOOD_COLS = [-180 + 360 * i / 14 for i in range(14)]  # strips, degrees round from the top (+ to the lead side)
HOOD_US = (0.25, 0.5, 0.75, 1.0, 1.15)  # chain bones' ends along a strip
HOOD_ROWS = (0, 0.12, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1.0)


def hood_open(col):
    """How far round from the front of the head (degrees) the opening is on strip `col`."""
    a = abs((col + 180) % 360 - 180)
    return 80 + 15 * min(a, 90) / 90 + 35 * max(0, a - 90) / 90


def hood_at(col, u):
    t0 = hood_open(col)
    a, t = math.radians(col), math.radians(t0 + u * (165 - t0))
    d = Vector((math.sin(t) * math.sin(a), -math.cos(t), math.sin(t) * math.cos(a)))
    return HOOD_C + Vector((d.x * HOOD_S.x, d.y * HOOD_S.y, d.z * HOOD_S.z)) * HOOD_R


def hood_bones(rig):
    cloth_bones(rig, 'SpringHood', hood_at, HOOD_COLS, HOOD_US, 'Head')


def hood_mesh(mat):
    tip = HOOD_C + Vector((0, HOOD_R * HOOD_S.y + 0.035, 0.015))  # the hood's point, sticking out behind
    return cloth_mesh('SpringHood', hood_at, HOOD_COLS, HOOD_US, HOOD_ROWS, 'Head', mat, lambda p: HOOD_C, tip)


def cowl_mesh(mat, build):
    """Where the hood meets the sweatshirt (zack: "connect the bottom of the hood to more the shoulders"): a skirt of
    fabric from the hood's opening behind the ears and under the back of the head, down over the neck onto the
    shoulders. Its top rides the head, its bottom the chest, so it stretches and twists between them as the head
    turns."""
    cols = [100 + 10 * k for k in range(17)]  # round the hood's opening from behind one ear, under the back, to the other
    bm = bmesh.new()
    grid = []
    for a in cols:
        top = hood_at(a, 0)
        side = 180 - a  # + toward the lead side
        t = math.radians(side * 1.45)  # round the shoulders, from the back (0) toward the collarbones
        bottom = Vector((math.sin(t) * 0.158 * build, math.cos(t) * 0.098 * build, SPINE + 0.43))
        mid = (top + bottom) / 2
        out = Vector((mid.x, mid.y, 0))
        mid += out.normalized() * 0.022 if out.length > 1e-4 else Vector()
        grid.append([bm.verts.new(top), bm.verts.new(mid), bm.verts.new(bottom)])
    for a, b in zip(grid, grid[1:]):
        for j in range(2):
            bm.faces.new((a[j], b[j], b[j + 1], a[j + 1]))
    for f in bm.faces:
        c = f.calc_center_median()
        if f.normal.dot(c - Vector((0, 0, c.z))) < 0:
            f.normal_flip()
    bm.normal_update()
    ob = lg.link('cowl', bm, [mat])
    groups = {b: ob.vertex_groups.new(name=b) for b in ('Head', 'Neck', 'Spine1')}
    for k in range(len(cols)):
        groups['Head'].add([3 * k], 1.0, 'REPLACE')
        groups['Neck'].add([3 * k + 1], 1.0, 'REPLACE')
        groups['Spine1'].add([3 * k + 2], 1.0, 'REPLACE')
    solid = ob.modifiers.new('solid', 'SOLIDIFY')
    solid.thickness = 0.012
    solid.offset = 1
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.modifier_apply(modifier=solid.name)
    return ob


# A shirt's body: a loose band round the torso, tucked into the body at the top so there is no seam, then out to hang
# loose over the skin-tight figure underneath. It swings out with speed and flaps on landings. Keanu's sweatshirt
# hangs from the chest down past the waistband; Roxy's and Goldie's crop tops from under the arms to above the navel.
SHIRT_COLS = [30 * i for i in range(12)]  # degrees round the torso from the back (+ to the lead side)
SHIRT_US = (0.4, 0.7, 1.0, 1.3)
SHIRT_ROWS = (0, 0.2, 0.4, 0.55, 0.7, 0.85, 1.0)
SHIRTS = {
    # top and hem heights, the band's half-width and half-depth tucked in at the top, how far it flares, the bone
    'sweatshirt': {'top': SPINE + 0.22, 'hem': SPINE - 0.04, 'r': (0.142, 0.096), 'flare': (0.026, 0.024), 'bone': 'Spine'},
    'crop': {'top': SPINE + 0.36, 'hem': SPINE + 0.17, 'r': (0.146, 0.097), 'flare': (0.022, 0.022), 'bone': 'Spine1'},
}


def shirt_of(spec):
    return 'sweatshirt' if spec['hair'] == 'hood' else 'crop' if spec.get('crop') and spec['top'] != 'skin' else None


def shirt_at(kind, col, u, build=1.0):
    k = SHIRTS[kind]
    a = math.radians(col)
    out = min(1.0, u / 0.35)
    rx = (k['r'][0] + k['flare'][0] * out + 0.006 * u) * build
    ry = (k['r'][1] + k['flare'][1] * out + 0.005 * u) * build
    return Vector((math.sin(a) * rx, math.cos(a) * ry, k['top'] + (k['hem'] - k['top']) * u))


def shirt_bones(rig, kind, build):
    cloth_bones(rig, 'SpringShirt', lambda c, u: shirt_at(kind, c, u, build), SHIRT_COLS, SHIRT_US, SHIRTS[kind]['bone'])


def shirt_mesh(mat, kind, build):
    at = lambda c, u: shirt_at(kind, c, u, build)
    return cloth_mesh('SpringShirt', at, SHIRT_COLS, SHIRT_US, SHIRT_ROWS, SHIRTS[kind]['bone'], mat, lambda p: Vector((0, 0, p.z)), thickness=0.012)


def chain_bones(rig, specs):
    """Adds each chain's bones to the rig: equal links from the root along its direction, the first off its parent."""
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='EDIT')
    eb = rig.data.edit_bones
    for name, parent, root, d, length, *_rest, n in specs:
        d = d.normalized()
        prev = eb[parent]
        for j in range(n):
            b = eb.new(f'{name}_{j}')
            b.head, b.tail = root + d * length * j / n, root + d * length * (j + 1) / n
            b.parent = prev
            b.use_connect = j > 0
            prev = b
    bpy.ops.object.mode_set(mode='OBJECT')


def chain_mesh(spec, mat):
    """A chain's mesh, skinned along its bones so it bends with them: a sharp hair blade (taper 1), or a tapered tube."""
    name, _parent, root, d, length, w, dep, taper, n = spec
    d = d.normalized()
    bm = bmesh.new()
    if taper >= 1:
        # hair: a blade broad across the head, its tip curling out away from it
        out = root - HEAD_C
        out.z = 0
        blade(bm, root, d, length, w, dep, out.normalized() * 0.025, root - HEAD_C)
    else:
        side = Vector((1, 0, 0)).cross(d).normalized()  # across the clump's depth
        across = d.cross(side).normalized()
        rings, seg = 8, 6
        loops = []
        for r in range(rings + 1):
            t = r / rings
            k = 1 - taper * t
            c = root + d * length * t
            loops.append([bm.verts.new(c + across * w * k * math.cos(2 * math.pi * a / seg) + side * dep * k * math.sin(2 * math.pi * a / seg)) for a in range(seg)])
        for a, b in zip(loops, loops[1:]):
            for i in range(seg):
                j = (i + 1) % seg
                bm.faces.new((a[i], a[j], b[j], b[i]))
        bm.faces.new(loops[0][::-1])
        bm.faces.new(loops[-1])
    ob = lg.link(name, bm, [mat])
    groups = [ob.vertex_groups.new(name=f'{name}_{j}') for j in range(n)]
    for v in ob.data.vertices:
        s = max(0.0, (v.co - root).dot(d)) / length * n  # how far along the chain, in bones
        w8 = [max(0.0, 1 - abs(s - (j + 0.5))) for j in range(n)]
        w8[0] = max(w8[0], 1.0 if s < 0.5 else 0.0)
        w8[-1] = max(w8[-1], 1.0 if s > n - 0.5 else 0.0)
        tot = sum(w8)
        for g, x in zip(groups, w8):
            if x > 0:
                g.add([v.index], x / tot, 'REPLACE')
    return ob


def feet(spec, mats):
    parts = []
    for side, s in (('Left', 1), ('Right', -1)):
        parts.append((sphere(f'hand{side}', 0.045, (s * ARM_X, 0, HAND_Z), mats['skin'], (0.9, 1, 1.3), seg=(8, 6)), f'{side}Hand'))
        # sneakers: the same box as Lou's shoes, a touch slimmer
        y = -0.06
        parts += lg.shoe_parts(f'shoe{side}', side, (0.11, 0.26, 0.095), (s * HIP_X, y, ANKLE_Z - 0.075 + 0.058), mats['shoe'], 0.015)
        parts += lg.shoe_parts(f'sole{side}', side, (0.118, 0.272, 0.024), (s * HIP_X, y, ANKLE_Z - 0.075 + 0.012), mats['sole'])
    return parts


def build(name, spec):
    lg.clear()
    colors = {k: spec[k] for k in ('skin', 'pants', 'shoe', 'sole', 'hairColor')}
    if spec['top'] != 'skin':
        colors['top'] = spec['top']
    if spec.get('shades'):
        colors['shades'] = spec['shades']
    colors['eye'] = 0x16121A
    if spec['hair'] == 'hood':
        colors['string'] = 0xF2F0EA
    mats = {('hair' if k == 'hairColor' else k): lg.material(k, v) for k, v in colors.items()}
    rig = lg.armature()
    rig.name = rig.data.name = f'{name}Rig'
    ob = body(spec, mats)
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.parent_set(type='ARMATURE_AUTO')
    bpy.ops.object.select_all(action='DESELECT')
    specs = chains(spec)
    chain_bones(rig, specs)  # after the body's automatic weights, so it never skins to them
    shirt = shirt_of(spec)
    if spec['hair'] == 'hood':
        hood_bones(rig)
    if shirt:
        shirt_bones(rig, shirt, spec['build'])
    # smooth shading on the body, the head and the clothes (zack, 2026-10-31: "clean up the texture on him"): the flat
    # facets of the low-poly figure lit up as blotches under the toon light. Hair, shoes and shades stay faceted.
    smooth = [ob] if spec.get('smooth') else []
    for part, bone in head(spec, mats) + feet(spec, mats) + lg.wear_decals(0.11, -0.06):
        lg.rigid(part, bone)
        part.select_set(True)
        if spec.get('smooth') and part.name.split('.')[0] in ('head', 'handLeft', 'handRight', 'fringe'):
            smooth.append(part)
    clothes = [hood_mesh(mats['top']), cowl_mesh(mats['top'], spec['build'])] if spec['hair'] == 'hood' else []
    if shirt:
        clothes.append(shirt_mesh(mats['top'], shirt, spec['build']))
    for part in clothes:
        part.select_set(True)
        if spec.get('smooth'):
            smooth.append(part)
    for c in specs:
        chain_mesh(c, mats['string'] if c[0].startswith('SpringString') else mats['hair']).select_set(True)
    for part in smooth:
        for p in part.data.polygons:
            p.use_smooth = True
    ob.select_set(True)
    rig.select_set(False)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.join()
    ob.name = ob.data.name = name.capitalize()
    return rig, ob


def export(name):
    path = os.path.join(OUT, f'{name}.glb')
    bpy.ops.object.select_all(action='DESELECT')
    for ob in bpy.data.objects:  # the rig and what hangs on it, not whatever else is in the file
        ob.select_set(ob.type == 'ARMATURE' or (ob.type == 'MESH' and ob.parent and ob.parent.type == 'ARMATURE'))
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format='GLB',
        use_selection=True,
        export_yup=True,
        export_skins=True,
        export_animations=False,  # they play Lou's clips
        export_apply=True,
        export_materials='EXPORT',
        # the paint texture goes in as a JPEG: the Meshy bakes are full of detail, 1.2 MB as PNG, ~150 KB as JPEG
        export_image_format='JPEG',
        export_jpeg_quality=88,
    )
    return path


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    rebuild = '--rebuild' in args
    for name in [a for a in args if not a.startswith('--')] or SKATERS:
        blend = os.path.join(lg.HERE, f'{name}.blend')
        if rebuild or not os.path.exists(blend):
            rig, ob = build(name, SKATERS[name])
            paint.texture(name, ob)
            bpy.ops.wm.save_as_mainfile(filepath=blend, compress=True)
        else:
            bpy.ops.wm.open_mainfile(filepath=blend)
            ob = bpy.data.objects[name.capitalize()]
        paint.check(ob)
        tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
        print(f'{name}: {len(ob.data.vertices)} verts, {tris} tris -> {export(name)}')
