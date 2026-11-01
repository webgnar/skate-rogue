# Puts a skater's Meshy model (zack's redesigns from art/reference/characters/, Nov 2026) on the game's rig, in the
# skater's .blend, ready to paint and export.
#
#   blender -b -P art/meshy_skater.py -- webster --src <folder with the Meshy .glb files>
#
# The Meshy files (20-40 MB each) stay out of git; they're in the project's shared files under meshy/. Each one goes:
#
#   1. Reduced and baked by art/game_ready.py (underground-LA's pass, copied): welded, cut to TRIS triangles, unwrapped
#      fresh, and the full-detail model's colours baked onto a TEX_SIZE texture.
#   2. Fitted to the rig. The game plays Lou's clips on one 20-bone rig with its joints in fixed places (art/lou_gnar.py;
#      skater-rig.ts drives the bones from the same numbers), so the mesh moves to the rig, not the other way round. A
#      temporary armature is built at the model's own joints (JOINTS below, picked off front and side renders, then
#      centred in the limb), the mesh is skinned to it with automatic weights in Meshy's A-pose, and that armature is
#      posed onto the rig's bind pose: arms straight down, legs straight, each limb stretched or squashed to the rig's
#      bone lengths. The head, hands and feet only move, they keep their size. The weights carry over by bone name.
#   3. Hair: Spring chains (src/render/springs.ts) at the biggest spikes and clumps, found as the hair points furthest
#      from the skull; the hair round each is weighted along its chain. Keanu's drawstrings get theirs too.
#   4. Saved over art/<name>.blend (rig and Board bone kept, the old mesh and its Spring bones replaced), the bake as
#      art/tex/<name>.png (the paint texture), then exported like the other skaters (art/skaters.py).
#
# After this the .blend is the source again (docs/painting-models.md): paint and edit it there. Running this again
# throws those edits away.
import json
import math
import os
import subprocess
import sys
import tempfile

import bpy  # first: the bpy module provides bmesh and mathutils
from mathutils import Matrix, Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lou_gnar as lg  # noqa: E402
import paint  # noqa: E402
import skaters  # noqa: E402

TRIS = 6000  # the old built skaters were 2.5-4k; the Meshy detail holds up at 6k, and only the player's skater is drawn
TEX_SIZE = paint.TEX_SIZE

# The model's joints (left side, +X; mirrored), in Meshy's units as game_ready.py leaves it (1.904 tall, feet at 0,
# facing -Y): (x, z), the depth found from the mesh. neck: where the neck meets the shoulders; head: the jaw hinge,
# where the head turns; skull: the middle of the skull and its radius (for the hair); spikes: how many hair chains;
# locks: chains hanging down (falling hair) are SpringLock, the rest stiff SpringSpike; strings: Keanu's drawstrings;
# voxels: the remesh sizes tried for the weights (finer for hands hanging against the hips); ray: how far the bake
# looks for the full model, as a share of its height (shorter where a hand touches the trousers, or the inside of
# the forearm bakes in denim).
MESHY = {
    'webster': {
        'shoulder': (0.20, 1.37), 'elbow': (0.31, 1.13), 'wrist': (0.40, 0.90), 'fingers': (0.45, 0.77),
        'hip': (0.10, 0.94), 'knee': (0.13, 0.53), 'ankle': (0.17, 0.09),
        'neck': 1.44, 'head': 1.52, 'skull': (1.62, 0.1), 'spikes': 6,
    },
    'keanu': {
        'shoulder': (0.20, 1.45), 'elbow': (0.29, 1.18), 'wrist': (0.32, 0.99), 'fingers': (0.33, 0.82),
        'hip': (0.10, 0.88), 'knee': (0.14, 0.50), 'ankle': (0.18, 0.08),
        'neck': 1.55, 'head': 1.62, 'skull': (1.74, 0.1), 'spikes': 0, 'strings': True,
    },
    'roxy': {
        'shoulder': (0.13, 1.47), 'elbow': (0.18, 1.21), 'wrist': (0.20, 0.99), 'fingers': (0.21, 0.88),
        'hip': (0.08, 0.98), 'knee': (0.10, 0.55), 'ankle': (0.12, 0.08),
        'neck': 1.52, 'head': 1.56, 'skull': (1.66, 0.09), 'spikes': 7, 'voxels': (0.006, 0.007, 0.0065, 0.0075, 0.0055, 0.008),
    },
    'goldie': {
        'shoulder': (0.15, 1.50), 'elbow': (0.21, 1.23), 'wrist': (0.24, 1.00), 'fingers': (0.24, 0.87),
        'hip': (0.08, 1.00), 'knee': (0.11, 0.55), 'ankle': (0.13, 0.08),
        'neck': 1.57, 'head': 1.62, 'skull': (1.72, 0.09), 'spikes': 6, 'voxels': (0.0055, 0.005, 0.006, 0.0075, 0.0045, 0.007),
        'ray': 0.03,
    },
    # Lou: a neon glint streak over his painted visor (visor-glint.ts); the red scarf tail behind the backpack swings
    # on a SpringScarf chain
    'lou-gnar': {
        'shoulder': (0.20, 1.44), 'elbow': (0.30, 1.18), 'wrist': (0.33, 0.99), 'fingers': (0.33, 0.83),
        'hip': (0.10, 0.93), 'knee': (0.12, 0.50), 'ankle': (0.17, 0.08),
        'neck': 1.57, 'head': 1.63, 'skull': (1.76, 0.16), 'visor': True, 'scarf': True,
        'rig': 'LouGnarRig', 'object': 'LouGnar',
    },
}

RIG_BONES = ['Hips', 'Spine', 'Spine1', 'Neck', 'Head'] + [f'{s}{b}' for s in ('Left', 'Right') for b in (
    'Arm', 'ForeArm', 'Hand', 'UpLeg', 'Leg', 'Foot', 'ToeBase')]
KEEP_SIZE = ('Head', 'Hand', 'Foot', 'ToeBase')  # these move and turn but don't stretch


def reduce(name, src, work, blender):
    """Step 1: art/game_ready.py in its own Blender, into `work`: <name>.glb and albedo.png."""
    cfg = {'source': os.path.join(src, f'{name}.glb'), 'name': name, 'target_tris': TRIS,
           'bake_sizes': [TEX_SIZE, 256, 256], 'bake_dir': work, 'out': os.path.join(work, f'{name}.glb'),
           'height': 1.904, 'turn': 0, 'ray': MESHY[name].get('ray', 0.08)}
    path = os.path.join(work, 'cfg.json')
    json.dump(cfg, open(path, 'w'))
    run = subprocess.run([blender, '-b', '-P', os.path.join(lg.HERE, 'game_ready.py'), '--', path],
                         capture_output=True, text=True)
    if run.returncode or 'GAME_READY' not in run.stdout:
        sys.exit(f'game_ready.py failed:\n{run.stdout[-3000:]}\n{run.stderr[-3000:]}')
    print(next(l for l in run.stdout.splitlines() if l.startswith('GAME_READY')))


def verts_of(ob):
    return [ob.matrix_world @ v.co for v in ob.data.vertices]


def middle(pts, axis):
    vals = [p[axis] for p in pts]
    return (min(vals) + max(vals)) / 2 if vals else None


def joints(spec, pts, s):
    """The model's joints, scaled by s: the guesses centred in the limb's cross-section (depth for all, and across for
    the elbow, wrist, knee and ankle), for both sides."""
    def at(x, z, across, r=0.05):
        x, z = x * s, z * s
        near = [p for p in pts if abs(p.z - z) < 0.015 and abs(p.x - x) < r]
        if across and near:
            x = middle(near, 0)
            near = [p for p in near if abs(p.x - x) < r]
        y = middle([p for p in near if abs(p.x - x) < 0.03], 1)
        return Vector((x, y if y is not None else 0.0, z))

    out = {}
    for side, k in (('Left', 1), ('Right', -1)):
        def j(key, across, r=0.05):
            x, z = spec[key]
            p = at(k * x, z, across, r)
            return p
        out[side] = {
            'shoulder': j('shoulder', False), 'elbow': j('elbow', True), 'wrist': j('wrist', True, 0.06),
            'fingers': j('fingers', False, 0.04), 'hip': j('hip', False, 0.06), 'knee': j('knee', True, 0.09),
            'ankle': Vector((0, 0, 0)),
        }
        a = at(k * spec['ankle'][0], 0.16 / s, True, 0.08)  # the leg just above the shoe, for the ankle's x and y
        out[side]['ankle'] = Vector((a.x, a.y, lg.ANKLE_Z))  # as high off the ground as the rig's, so soles meet it
    def trunk(z):
        y = middle([p for p in pts if abs(p.z - z) < 0.015 and abs(p.x) < 0.05], 1)
        return Vector((0, y or 0.0, z))
    hip_z = (out['Left']['hip'].z + out['Right']['hip'].z) / 2
    pelvis = trunk(hip_z + 0.04 * s)
    neck = trunk(spec['neck'] * s)
    out['trunk'] = [pelvis, neck, trunk(spec['head'] * s)]
    return out


def rig_bones(rig):
    return {b.name: (b.head_local.copy(), b.tail_local.copy()) for b in rig.data.bones}


def fit_bones(J, rig):
    """Head and tail of each rig bone at the model's joints."""
    target = rig_bones(rig)
    pelvis, neck, head = J['trunk']
    # the spine split between pelvis and neck as the rig's is between its pelvis and neck
    rz = [target['Hips'][0].z, target['Spine'][0].z, target['Spine1'][0].z, target['Neck'][0].z]
    def along(z):
        return pelvis.lerp(neck, (z - rz[0]) / (rz[3] - rz[0]))
    sp = [along(z) for z in (rz[0], target['Hips'][1].z, rz[2])]
    up = Vector((0, 0, 1))
    out = {
        'Hips': (pelvis, sp[1]), 'Spine': (sp[1], sp[2]), 'Spine1': (sp[2], neck), 'Neck': (neck, head),
        'Head': (head, head + up * (target['Head'][1] - target['Head'][0]).length),
    }
    for side in ('Left', 'Right'):
        j = J[side]
        out[f'{side}Arm'] = (j['shoulder'], j['elbow'])
        out[f'{side}ForeArm'] = (j['elbow'], j['wrist'])
        hand = target[f'{side}Hand']
        out[f'{side}Hand'] = (j['wrist'], j['wrist'] + (j['fingers'] - j['wrist']).normalized() * (hand[1] - hand[0]).length)
        out[f'{side}UpLeg'] = (j['hip'], j['knee'])
        out[f'{side}Leg'] = (j['knee'], j['ankle'])
        for b in ('Foot', 'ToeBase'):  # the foot as the rig's, from the ankle
            h, t = target[f'{side}{b}']
            off = j['ankle'] - target[f'{side}Foot'][0]
            out[f'{side}{b}'] = (h + off, t + off)
    return out


def build_fit_armature(bones, rig):
    data = bpy.data.armatures.new('Fit')
    fit = bpy.data.objects.new('Fit', data)
    bpy.context.scene.collection.objects.link(fit)
    bpy.context.view_layer.objects.active = fit
    bpy.ops.object.mode_set(mode='EDIT')
    for name in RIG_BONES:
        eb = data.edit_bones.new(name)
        eb.head, eb.tail = bones[name]
        eb.roll = 0
    for name in RIG_BONES:
        parent = rig.data.bones[name].parent
        if parent:
            data.edit_bones[name].parent = data.edit_bones[parent.name]
    bpy.ops.object.mode_set(mode='OBJECT')
    for b in data.bones:
        b.inherit_scale = 'NONE'
    return fit


def pose_onto_rig(fit, rig):
    """Poses the fit armature so every bone lies on the rig's: limbs stretched to the rig's lengths."""
    target = rig_bones(rig)
    bpy.context.view_layer.objects.active = fit
    bpy.ops.object.mode_set(mode='POSE')
    for name in RIG_BONES:  # parents first
        rest = fit.data.bones[name].matrix_local
        th, tt = target[name]
        fy = rest.to_3x3().col[1].normalized()
        ty = (tt - th).normalized()
        rot = fy.rotation_difference(ty).to_matrix() @ rest.to_3x3().normalized()
        sy = 1.0 if name.endswith(KEEP_SIZE) else (tt - th).length / fit.data.bones[name].length
        m = (rot @ Matrix.Diagonal((1, sy, 1))).to_4x4()
        m.translation = th
        fit.pose.bones[name].matrix = m
        bpy.context.view_layer.update()
    bpy.ops.object.mode_set(mode='OBJECT')


def skin(ob, fit, spec, J):
    """Automatic weights on the fit armature (Meshy's pose), the head rigid on the Head bone. The reduced mesh is
    shells crossing each other (shades, laces, the waistband), which Blender's heat weighting can't solve, so the
    weights are worked out on a clean closed copy (voxel remeshed, its loose specks such as earrings dropped) and
    copied across from its surface. The voxels are fine enough (spec 'voxels') to keep a gap between a hand and the
    hip it hangs against; fused, the trousers would follow the hand."""
    # the heat solve fails outright on some remeshes (every weight left empty), so a few voxel sizes are tried
    sizes = spec.get('voxels', (0.012, 0.016, 0.01, 0.008, 0.02))
    for k, size in enumerate(sizes):
        proxy = ob.copy()
        proxy.data = ob.data.copy()
        bpy.context.scene.collection.objects.link(proxy)
        mod = proxy.modifiers.new('Remesh', 'REMESH')
        mod.mode = 'VOXEL'
        mod.voxel_size = size
        bpy.context.view_layer.objects.active = proxy
        bpy.ops.object.modifier_apply(modifier=mod.name)
        drop_islands(proxy, 0.02)
        bpy.ops.object.select_all(action='DESELECT')
        proxy.select_set(True)
        fit.select_set(True)
        bpy.context.view_layer.objects.active = fit
        bpy.ops.object.parent_set(type='ARMATURE_AUTO')
        empty = sum(1 for v in proxy.data.vertices if not any(g.weight > 1e-4 for g in v.groups))
        if empty < len(proxy.data.vertices) * 0.01 or k == len(sizes) - 1:
            break
        print(f'heat weighting failed at voxel size {size}, trying another')
        bpy.data.objects.remove(proxy)
    for g in proxy.vertex_groups:
        ob.vertex_groups.new(name=g.name)
    xfer = ob.modifiers.new('weights', 'DATA_TRANSFER')
    xfer.object = proxy
    xfer.use_vert_data = True
    xfer.data_types_verts = {'VGROUP_WEIGHTS'}
    xfer.vert_mapping = 'POLYINTERP_NEAREST'
    xfer.layers_vgroup_select_src = 'ALL'
    xfer.layers_vgroup_select_dst = 'NAME'
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.modifier_apply(modifier=xfer.name)
    bpy.data.objects.remove(proxy)
    ob.parent = fit
    arm = ob.modifiers.new('Armature', 'ARMATURE')
    arm.object = fit
    head_z = J['trunk'][2].z
    groups = {g.name: g for g in ob.vertex_groups}
    loose = []
    for v in ob.data.vertices:
        w = [g for g in v.groups if g.weight > 1e-4]
        if v.co.z > head_z + 0.02:  # the head and its hair: on the Head bone only
            for g in list(v.groups):
                ob.vertex_groups[g.group].remove([v.index])
            groups['Head'].add([v.index], 1.0, 'REPLACE')
        elif not w:
            loose.append(v)
    if loose:
        # heat weighting can miss pieces (shades, laces): the nearest bone's
        print(f'{len(loose)} vertices with no weights: given to the nearest bone')
        segs = {b.name: (b.head_local, b.tail_local) for b in fit.data.bones}
        for v in loose:
            def dist(seg):
                a, b = seg
                ab = b - a
                t = max(0.0, min(1.0, (v.co - a).dot(ab) / ab.length_squared))
                return (v.co - (a + ab * t)).length
            groups[min(segs, key=lambda n: dist(segs[n]))].add([v.index], 1.0, 'REPLACE')


def drop_islands(ob, share):
    """Deletes the loose pieces under `share` of the mesh's vertices."""
    import bmesh
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    seen, drop = set(), []
    for v in bm.verts:
        if v in seen:
            continue
        piece, stack = [v], [v]
        seen.add(v)
        while stack:
            u = stack.pop()
            for e in u.link_edges:
                w = e.other_vert(u)
                if w not in seen:
                    seen.add(w)
                    piece.append(w)
                    stack.append(w)
        if len(piece) < len(bm.verts) * share:
            drop += piece
    bmesh.ops.delete(bm, geom=drop, context='VERTS')
    bm.to_mesh(ob.data)
    bm.free()


def albedo_at(ob, image):
    """Each vertex's colour, from the baked texture."""
    w, h = image.size
    px = list(image.pixels)
    uv = ob.data.uv_layers.active.data
    out = [None] * len(ob.data.vertices)
    for loop in ob.data.loops:
        if out[loop.vertex_index] is None:
            u, v = uv[loop.index].uv
            x, y = min(w - 1, max(0, int(u * w))), min(h - 1, max(0, int(v * h)))
            i = (y * w + x) * 4
            out[loop.vertex_index] = Vector(px[i:i + 3])
    return out


def hair_chains(ob, rig, centre, r, count):
    """Spring chains at the `count` hair points furthest out from the skull (not over the face), each a chain from the
    scalp out to the tip, and the hair round it weighted along it."""
    pts = [v.co.copy() for v in ob.data.vertices]
    head_bone = rig.data.bones['Head'].head_local
    cand = []
    for i, p in enumerate(pts):
        d = p - centre
        if d.length < r * 1.25 or p.z < head_bone.z:
            continue
        if d.normalized().y < -0.55 and d.normalized().z < 0.5:  # in front of the face: bangs, shades
            continue
        cand.append((d.length, i))
    cand.sort(reverse=True)
    tips = []
    for _, i in cand:
        if all((pts[i] - pts[j]).length > 0.11 for j in tips):
            tips.append(i)
        if len(tips) == count:
            break
    specs = []
    for k, i in enumerate(tips):
        d = (pts[i] - centre).normalized()
        root = centre + d * r * 0.9
        length = (pts[i] - root).length
        kind = 'SpringLock' if d.z < -0.3 else 'SpringSpike'
        specs.append((f'{kind}{k}', 'Head', root, pts[i] - root, length, 0, 0, 1.0, 2))
    weigh_chains(ob, specs, [i for _, i in cand] + [i for i, p in enumerate(pts) if (p - centre).length >= r * 1.1 and p.z > head_bone.z])
    return specs


def weigh_chains(ob, specs, candidates, reach=0.35):
    """Each candidate vertex to the chain it lies along (if any): from its parent bone at the root, along the chain's
    bones toward the tip."""
    groups = {}
    for v_i in set(candidates):
        p = ob.data.vertices[v_i].co
        best = None
        for name, parent, root, d, length, *_r, n in specs:
            dn = d.normalized()
            t = (p - root).dot(dn) / length
            if t < 0.05 or t > 1.3:
                continue
            perp = ((p - root) - dn * (p - root).dot(dn)).length
            if perp > 0.03 + reach * t * length:
                continue
            if best is None or perp < best[0]:
                best = (perp, name, parent, t, n)
        if not best:
            continue
        _, name, parent, t, n = best
        head = max(0.0, 1 - t / 0.3)
        s = t * n
        w8 = [max(0.0, 1 - abs(s - (j + 0.5))) for j in range(n)]
        w8[0] = max(w8[0], 1.0 if s < 0.5 else 0.0)
        w8[-1] = max(w8[-1], 1.0 if s > n - 0.5 else 0.0)
        tot = sum(w8)
        for g in list(ob.data.vertices[v_i].groups):
            ob.vertex_groups[g.group].remove([v_i])
        if head > 0:
            ob.vertex_groups[parent].add([v_i], head, 'REPLACE')
        for j, x in enumerate(w8):
            if x > 0:
                key = f'{name}_{j}'
                g = groups.get(key) or ob.vertex_groups.get(key) or ob.vertex_groups.new(name=key)
                groups[key] = g
                g.add([v_i], (1 - head) * x / tot, 'REPLACE')


def string_chains(ob, colours):
    """Keanu's drawstrings: the white cords down the front of the hoodie, a chain each."""
    specs = []
    for k, side in enumerate((-1, 1)):
        idx = [i for i, v in enumerate(ob.data.vertices)
               if colours[i] and min(colours[i]) > 0.6 and 0 < side * v.co.x < 0.09 and 1.2 < v.co.z < 1.56 and v.co.y < -0.05]
        if not idx:
            continue
        top = max((ob.data.vertices[i].co for i in idx), key=lambda c: c.z)
        bottom = min((ob.data.vertices[i].co for i in idx), key=lambda c: c.z)
        specs.append((f'SpringString{k}', 'Spine1', top.copy(), bottom - top, (bottom - top).length, 0, 0, 0.0, 3))
        weigh_chains(ob, [specs[-1]], idx, reach=0.5)
    return specs


def visor(ob, centre, mats):
    """Lou's visor glint: a thin streak laid just proud of the visor (the dark faces across the front of the helmet),
    like the one on the old helmet (lou_gnar.helmet), scaled to this visor. The game lights it with the neon
    (visor-glint.ts). The visor itself stays painted, with Meshy's pixel highlights."""
    import bmesh
    me = ob.data
    uv = me.uv_layers.active.data
    image = me.materials[0].node_tree.nodes.active.image
    w, h = image.size
    px = image.pixels[:]

    def dark(p):
        u, v = 0.0, 0.0
        for li in p.loop_indices:
            u += uv[li].uv[0] / p.loop_total
            v += uv[li].uv[1] / p.loop_total
        i = (min(h - 1, max(0, int(v * h))) * w + min(w - 1, max(0, int(u * w)))) * 4
        return sum(px[i:i + 3]) / 3 < 0.2
    faces = [p for p in me.polygons if (p.center - centre).y < -0.06 and abs((p.center - centre).z) < 0.14 and dark(p)]
    if not faces:
        return None
    # the sphere the visor lies on (least squares), for the glint to follow
    import numpy as np
    pts = np.array([tuple(me.vertices[i].co) for i in {i for p in faces for i in p.vertices}])
    A = np.hstack([2 * pts, np.ones((len(pts), 1))])
    sol = np.linalg.lstsq(A, (pts ** 2).sum(1), rcond=None)[0]
    centre = Vector(sol[:3])
    r = math.sqrt(sol[3] + centre.length_squared)
    k = r / 0.222  # the old visor's radius
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=40, v_segments=30, radius=r + 0.004)

    def streak(p):
        p = p / k
        return p.y < -0.12 and -0.15 < p.x < 0.02 and abs((p.z - 0.075) + 0.45 * (p.x + 0.06)) < 0.016
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if not streak(f.calc_center_median())], context='FACES')
    bmesh.ops.translate(bm, verts=bm.verts, vec=centre)
    glint = lg.link('VisorGlint', bm, [mats['VisorGlint']])
    print(f'visor: {len(faces)} faces, sphere at {tuple(round(x, 3) for x in centre)} radius {r:.3f}')
    return glint


def scarf_chain(ob, colours, rig):
    """Lou's scarf tail: the red cloth hanging behind the backpack, on one chain from the knot down."""
    neck = rig.data.bones['Neck'].head_local
    idx = [i for i, v in enumerate(ob.data.vertices) if colours[i] and colours[i][0] > 0.35 and colours[i][1] < 0.2
           and colours[i][2] < 0.2 and v.co.y > neck.y + 0.18 and v.co.z < neck.z]
    if not idx:
        return []
    top = max((ob.data.vertices[i].co for i in idx), key=lambda c: c.z)
    bottom = min((ob.data.vertices[i].co for i in idx), key=lambda c: c.z)
    spec = ('SpringScarf0', 'Spine1', top.copy(), bottom - top, (bottom - top).length, 0, 0, 0.0, 3)
    weigh_chains(ob, [spec], idx, reach=0.8)
    print(f'scarf: {len(idx)} vertices')
    return [spec]


def drop_springs(rig):
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='EDIT')
    for eb in [b for b in rig.data.edit_bones if b.name.startswith('Spring')]:
        rig.data.edit_bones.remove(eb)
    bpy.ops.object.mode_set(mode='OBJECT')


def shoe_box(ob):
    """The left shoe's outside face (x) and the middle of its toe box (y), for the wear decals."""
    shoe = [v.co for v in ob.data.vertices if v.co.x > 0.02 and v.co.z < 0.08]
    toe = min(c.y for c in shoe) + 0.075  # the scuff's middle, back from the rounded tip
    front = [c for c in shoe if abs(c.y - toe) < 0.03 and 0.02 < c.z < 0.06]
    side = max(c.x for c in front)
    return side, toe


def build(name, src, blender):
    spec = MESHY[name]
    work = tempfile.mkdtemp(prefix=f'meshy_{name}_')
    reduce(name, src, work, blender)

    blend = os.path.join(lg.HERE, f'{name}.blend')
    bpy.ops.wm.open_mainfile(filepath=blend)
    rig = bpy.data.objects[spec.get('rig', f'{name}Rig')]
    obname = spec.get('object', name.capitalize())
    old = bpy.data.objects.get(obname)
    mats = {}
    if old:
        for m in old.data.materials:  # Lou's visor glint, which the game shades itself
            if m and m.name == 'VisorGlint':
                m.use_fake_user = True
                mats[m.name] = m
        bpy.data.objects.remove(old)
    drop_springs(rig)
    bpy.data.orphans_purge(do_recursive=True)

    bpy.ops.import_scene.gltf(filepath=os.path.join(work, f'{name}.glb'))
    ob = next(o for o in bpy.context.selected_objects if o.type == 'MESH')
    ob.parent = None
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    # the .glb comes split at every UV seam: weld it shut again (the UVs stay), so the seams can't open as it bends
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.remove_doubles(threshold=1e-5)
    bpy.ops.object.mode_set(mode='OBJECT')
    for o in [o for o in bpy.data.objects if o.type == 'EMPTY']:
        bpy.data.objects.remove(o)

    # scaled so the shoulders sit at the rig's; the limbs are fitted in length after
    s = lg.SHOULDER_Z / spec['shoulder'][1]
    ob.data.transform(Matrix.Scale(s, 4))
    J = joints(spec, verts_of(ob), s)
    fit = build_fit_armature(fit_bones(J, rig), rig)

    image = bpy.data.images.load(os.path.join(work, 'albedo.png'))
    ob.data.uv_layers[0].name = 'paint'
    colours = albedo_at(ob, image)
    # the skull, followed onto the rig as the head moves
    centre = Vector((0, middle([p for p in verts_of(ob) if abs(p.z - spec['skull'][0] * s) < 0.02 and abs(p.x) < 0.03], 1) or 0.0, spec['skull'][0] * s))

    skin(ob, fit, spec, J)
    pose_onto_rig(fit, rig)
    head_move = fit.pose.bones['Head'].matrix @ fit.data.bones['Head'].matrix_local.inverted()
    centre = head_move @ centre
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.modifier_apply(modifier=ob.modifiers[0].name)
    ob.parent = None
    bpy.data.objects.remove(fit)

    # onto the rig
    ob.name = ob.data.name = obname
    ob.parent = rig
    mod = ob.modifiers.new('Armature', 'ARMATURE')
    mod.object = rig

    specs = hair_chains(ob, rig, centre, spec['skull'][1] * s, spec['spikes']) if spec.get('spikes') else []
    if spec.get('strings'):
        specs += string_chains(ob, colours)
    if spec.get('scarf'):
        specs += scarf_chain(ob, colours, rig)
    skaters.chain_bones(rig, specs)
    print(f'{name}: chains', [c[0] for c in specs])

    # the paint texture: the bake, as art/tex/<name>.png
    path = os.path.join(paint.TEX, f'{name}.png')
    image.filepath_raw = path
    image.file_format = 'PNG'
    image.save()
    image.name = f'{name}Paint'
    image.filepath = f'//tex/{name}.png'
    ob.data.materials.clear()
    ob.data.materials.append(paint.paint_material(name, image))

    # the gear wear decals, on the new left shoe
    side, toe = shoe_box(ob)
    parts = lg.wear_decals((side - lg.HIP_X) * 2, toe + 0.075)
    if spec.get('visor'):
        glint = visor(ob, centre, mats)
        if glint:
            parts.append((glint, 'Head'))
    bpy.ops.object.select_all(action='DESELECT')
    for part, bone in parts:
        lg.rigid(part, bone)
        part.select_set(True)
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.join()
    for m in mats.values():
        m.use_fake_user = False
    bpy.data.orphans_purge(do_recursive=True)
    bpy.ops.wm.save_as_mainfile(filepath=blend, compress=True)
    return ob


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    src = args[args.index('--src') + 1] if '--src' in args else None
    blender = args[args.index('--blender') + 1] if '--blender' in args else (bpy.app.binary_path or 'blender')
    names = [a for a in args if not a.startswith('--') and a not in (src, blender)]
    if not src:
        sys.exit('--src <folder with the Meshy .glb files> is needed')
    for name in names or MESHY:
        ob = build(name, src, blender)
        paint.check(ob)
        tris = sum(len(p.vertices) - 2 for p in ob.data.polygons)
        if name == 'lou-gnar':
            lg.export()  # with his clips, as art/lou_gnar.py does
            print(f'{name}: {len(ob.data.vertices)} verts, {tris} tris -> {lg.GLB}')
        else:
            print(f'{name}: {len(ob.data.vertices)} verts, {tris} tris -> {skaters.export(name)}')
