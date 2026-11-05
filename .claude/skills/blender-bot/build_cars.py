"""Three street cars for Skate Escape, built with the blender bot (zack, 2026-11-05:
"use blender bot to make some cars"), to ride beside the Prius (art/cars.py)
in traffic and the parked rows.

  Wagon   an 80s boxy station wagon: long flat roof to an upright tailgate,
          a wood-grain strip down the flanks, a roof rack. Personality: its
          front fender on the camera's side is a primer-grey replacement.
  Coupe   a 70s fastback: long hood with a scoop, short cabin, the roof
          sloping all the way to a ducktail, chrome bumpers, two stripes over
          the top. Personality: it sits nose down, rear up on jacked springs.
  KeiVan  a bread-loaf microvan: almost no nose, a huge windscreen, a tall
          box to the back, a sliding-door track, a roof sign that glows.
          Personality: a ladder on the back and a mismatched (spare) wheel.

How (STYLE_GUIDE.md, a prop): each body grows out of ONE cube, the middle of
the car between the axles: the nose and tail are runs out of its front and
back faces, the cabin is the top knifed out and pulled up, the windows are
the cabin's walls inset, the arches, grille, stripes and wood strip are
knifed in. Wheels, lamps, bumpers, mirrors and the personality pieces are
primitive accents, last. Flat shaded, hard facets.

Not a painted texture: a car is coloured by named materials, the same names
as the Prius (paint, glass, trim, tire, rim, lamp, tail), because the game
repaints `paint` per car and merges the parked cars into one vertex-coloured
mesh (src/render/car-damage.ts), and art/car_damage.py builds each car's
dented, busted and wrecked copies from those names.

Every car fits the 2-tile car hitbox the way the Prius does (src/render/kit.ts
makeCar): 2.3 long, 1.6 wide, the roof top exactly 1.25 up (the skater lands
on it), wheels 0.24 at +-0.74. The game stretches it to other hitboxes.

usage: /opt/bpyenv/bin/python build_cars.py -- <out dir>
  writes <out>/cars.blend, <out>/bot-cars.glb (clean) and
  <out>/bot-cars-damage.glb (<Name>_dent/_bust/_wreck); copy them to
  art/bot/cars.blend, public/models/bot/cars.glb, public/models/bot/cars-damage.glb
"""
import sys, os, math
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'art'))
from bb_lib import Creature, _u
import bpy, bmesh
from mathutils import Vector, Matrix
import car_damage

args = sys.argv[sys.argv.index('--') + 1:]
OUT = args[0]
os.makedirs(OUT, exist_ok=True)

# the Prius's colours (art/cars.py) for the shared names, so the game's shared materials match
COLORS = {
    'paint': 0xD94A4A, 'glass': 0x1C2333, 'trim': 0x2A2A30, 'tire': 0x111114, 'rim': 0xB9BDC4,
    'lamp': 0xFFF2B0, 'tail': 0xFF3030, 'chrome': 0xD8DCE2, 'wood': 0x8A5A34, 'primer': 0x8E9196,
    'stripe': 0xF2F0E8, 'sign': 0xFFB020,
}
ORDER = list(COLORS)           # material index = position here; paint first (car_damage reads slot 0 as the body)
M = {k: i for i, k in enumerate(ORDER)}

L, W, ROOF, WR, AX = 2.3, 1.6, 1.25, 0.24, 0.74
HW = W / 2


def hex_rgba(h):
    srgb = [((h >> sh) & 255) / 255 for sh in (16, 8, 0)]
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb]
    return (*lin, 1.0)


def material(name, color):
    m = bpy.data.materials.get(name)
    if m: return m
    m = bpy.data.materials.new(name)
    m.diffuse_color = hex_rgba(color)
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = hex_rgba(color)
    bsdf.inputs['Roughness'].default_value = 0.6
    return m


def paint(faces, name):
    for f in faces:
        if f.is_valid: f.material_index = M[name]


def tops(bm, nz=0.6):
    bm.normal_update()
    return [f for f in bm.faces if f.normal.z > nz]


def sides(bm, nx=0.7, side=None):
    bm.normal_update()
    return [f for f in bm.faces if abs(f.normal.x) > nx and (side is None or f.normal.x * side > 0)]


def slab(x, y, z):
    """planes keeping |x| < x, y0 < y < y1, z0 < z < z1 (None skips)"""
    p = []
    if x is not None: p += [((x, 0, 0), (1, 0, 0)), ((-x, 0, 0), (-1, 0, 0))]
    if y is not None: p += [((0, y[0], 0), (0, -1, 0)), ((0, y[1], 0), (0, 1, 0))]
    if z is not None: p += [((0, 0, z[0]), (0, 0, -1)), ((0, 0, z[1]), (0, 0, 1))]
    return p


def body(C, s):
    """the lower body: one cube between the axles, the nose and tail run out of it"""
    m0, m1, zb, zt = s['mid']
    C.start_cube((2 * HW, m1 - m0, zt - zb), (0, (m0 + m1) / 2, (zb + zt) / 2), round_long=s.get('bevel', 0.07))
    C.run(C.face_where((0, -1, 0)), s['nose'], name='nose', region='nose')
    C.run(C.face_where((0, 1, 0)), s['tail'], name='tail', region='tail')


def cabin(C, s):
    """knife the top out and pull it up into the greenhouse; the roof line is s['roof'](y),
    the front and back edges raked to s['glass'] = (y front at roof, y back at roof)"""
    bm = C.bm
    c0, c1 = s['cab']
    fs = C.knife(tops(C.bm), slab(s['cab_w'], (c0, c1), None))
    nv = C.pull(fs, (0, 0, 1), 0.3, region='cabin')
    g0, g1 = s['glass']
    for v in nv:
        t = (v.co.y - c0) / (c1 - c0)
        v.co.y = g0 + t * (g1 - g0)
        v.co.x *= s.get('tumble', 0.93)
        v.co.z = s['roof'](v.co.y)
    bm.normal_update()
    return set(nv)


def windows(C, roofv, s):
    """the greenhouse walls: each side cut at the pillars and inset to glass, the screens inset"""
    bm = C.bm
    walls = [f for f in bm.faces if any(v in roofv for v in f.verts) and f.normal.z < 0.75]
    for side in (-1, 1):
        sw = [f for f in walls if f.is_valid and f.normal.x * side > 0.5]
        if len(sw) > 1:
            sw = bmesh.ops.dissolve_faces(bm, faces=sw)['region']
        for y in s['pillars']:
            g = _u(sw + [e for f in sw for e in f.edges] + [v for f in sw for v in f.verts])
            r = bmesh.ops.bisect_plane(bm, geom=g, plane_co=(0, y, 0), plane_no=(0, 1, 0))
            sw = _u([e for e in r['geom'] if isinstance(e, bmesh.types.BMFace)] + [f for f in sw if f.is_valid])
        sw = [f for f in sw if f.is_valid]
        r = bmesh.ops.inset_individual(bm, faces=sw, thickness=s.get('frame', 0.05), depth=-0.012)
        paint([f for f in sw if f.is_valid], 'glass')
    bm.normal_update()
    for n in (-1, 1):
        sc = [f for f in walls if f.is_valid and f.normal.y * n > 0.45]
        if not sc: continue
        if len(sc) > 1: sc = bmesh.ops.dissolve_faces(bm, faces=sc)['region']
        bmesh.ops.inset_region(bm, faces=sc, thickness=0.055, depth=-0.012)
        paint(sc, 'glass')


def arches(C, s):
    """the wheel wells: the flank knifed round each axle and pushed in, dark"""
    bm = C.bm
    for ay in (-AX, AX):
        for side in (-1, 1):
            fs = [f for f in sides(bm, 0.6, side) if f.calc_center_median().z < 0.62]
            fs = C.knife(fs, slab(None, (ay - WR - 0.07, ay + WR + 0.07), (-1, WR + 0.3)))
            if not fs: continue
            nv = C.pull(fs, (-side, 0, 0), 0.06, shrink=0.94)
            paint([f for f in bm.faces if all(v in set(nv) for v in f.verts)], 'trim')


def wheel(C, ay, side, rim='rim', r=WR, key='w'):
    x = side * (HW - 0.09)
    rot = Matrix.Rotation(math.pi / 2, 4, 'Y')
    for k, rad, depth, sg in (('tire' + key, r, 0.2, 10), (rim + key, r * 0.58, 0.214, 8)):
        made = bmesh.ops.create_cone(C.bm, cap_ends=True, segments=sg, radius1=rad, radius2=rad, depth=depth,
                                     matrix=Matrix.Translation((x, ay, r)) @ rot)
        C._tag(made, k, 0)


def acc(C, key, at, size, rot=None):
    m = Matrix.Translation(Vector(at)) @ (rot or Matrix.Identity(4)) @ Matrix.Diagonal((*size, 1))
    C.box(m, key)


def face_y(bm, n):
    """the outermost cap facing -y (n=-1, the nose) or +y (the tail)"""
    bm.normal_update()
    return max((f for f in bm.faces if f.normal.y * n > 0.9), key=lambda f: f.calc_center_median().y * n)


def lamps(C, s):
    ny, ty = -L / 2, L / 2
    hz, tz = s['lamp_z'], s['tail_z']
    for side in (-1, 1):
        acc(C, 'lamp', (side * (HW - 0.2), ny - 0.005, hz), (0.26, 0.04, s.get('lamp_h', 0.11)))
        acc(C, 'tail', (side * (HW - 0.14), ty + 0.005, tz), (0.2, 0.04, s.get('tail_h', 0.14)))
        # mirrors at the foot of the windscreen
        mx, my, mz = s['mirror']
        acc(C, 'trimM', (side * (mx + 0.05), my, mz), (0.1, 0.05, 0.08))
    b = s.get('bumper', 'trim')
    acc(C, b + 'F', (0, ny - 0.01, s['bump_z']), (W - 0.06, 0.08, 0.1))
    acc(C, b + 'B', (0, ty + 0.01, s['bump_z']), (W - 0.06, 0.08, 0.1))
    # the grille: the nose knifed between the lamps and pushed in
    nose = face_y(C.bm, -1)
    g = C.knife([nose], slab(HW - 0.36, None, (s['grille'][0], s['grille'][1])))
    if g:
        C.inset(g, 0.025, depth=-0.02)
        paint(g, 'trim')


def finish(C, name, accent_mats, spec):
    """materials onto the accents, then out as one object facing +X (the game's front), camera side -Y"""
    bm = C.bm
    inv = {code: key for key, code in C.acc_codes.items()}
    for f in bm.faces:
        code = f.verts[0][C.ACCL]
        if code:
            key = inv[code]
            for prefix, mat in accent_mats:
                if key.startswith(prefix):
                    f.material_index = M[mat]; break
    ob, me = C.to_object(name)
    while me.uv_layers: me.uv_layers.remove(me.uv_layers[0])
    me.transform(Matrix.Rotation(math.pi / 2, 4, 'Z'))   # -Y front -> +X front; x<0 (left) -> -Y, the camera's side
    for k in ORDER: me.materials.append(material(k, COLORS[k]))
    # drop slots nobody uses (keeps slot 0, paint)
    used = {p.material_index for p in me.polygons}
    for i in reversed(range(len(me.materials))):
        if i and i not in used:
            for p in me.polygons:
                if p.material_index > i: p.material_index -= 1
            me.materials.pop(index=i)
    me.update()
    zs = [v.co.z for v in me.vertices]
    xs = [v.co.x for v in me.vertices]
    ys = [v.co.y for v in me.vertices]
    print(f"{name}: len {max(xs) - min(xs):.3f} wide {max(ys) - min(ys):.3f} roof {max(zs):.3f} "
          f"tris {sum(len(p.vertices) - 2 for p in me.polygons)} mats {[m.name for m in me.materials]}")
    return ob


ACC_MATS = [('tire', 'tire'), ('rimS', 'trim'), ('rim', 'rim'), ('lamp', 'lamp'), ('tail', 'tail'),
            ('chrome', 'chrome'), ('trim', 'trim'), ('primer', 'primer'), ('sign', 'sign'), ('paint', 'paint')]


def flat_roof(z):
    return lambda y: z


# ---------------------------------------------------------------- the wagon
def wagon():
    C = Creature(11, jit=0)
    s = {
        'mid': (-0.5, 0.45, 0.17, 0.66),
        'nose': [((0, -1, 0), 0.3, 1.0, 0.97), ((0, -1, 0), 0.2, 1.0, 0.93, None, (0, 0, -0.012)),
                 ((0, -1, 0), 0.15, 0.97, 0.9)],
        'tail': [((0, 1, 0), 0.3, 1.0, 1.0), ((0, 1, 0), 0.25, 1.0, 1.0), ((0, 1, 0), 0.15, 0.97, 0.94)],
        'cab': (-0.42, 1.08), 'cab_w': HW - 0.08, 'glass': (-0.08, 1.05), 'roof': flat_roof(ROOF - 0.06),
        'pillars': [0.28, 0.66], 'tumble': 0.94,
        'lamp_z': 0.5, 'tail_z': 0.52, 'bump_z': 0.25, 'grille': (0.36, 0.56), 'mirror': (HW - 0.06, -0.38, 0.72),
        'tail_h': 0.2,
    }
    body(C, s)
    roofv = cabin(C, s)
    windows(C, roofv, s)
    arches(C, s)
    # the wood-grain strip down both flanks, knifed in and stood a hair proud
    for side in (-1, 1):
        fs = C.knife(sides(C.bm, 0.8, side), slab(None, (-0.82, 1.06), (0.36, 0.5)))
        paint(fs, 'wood')
    # personality: the replacement front fender on the camera's side (left, x<0), in primer
    fs = C.knife(sides(C.bm, 0.6, -1) + [f for f in tops(C.bm, 0.6) if f.calc_center_median().x < -0.45],
                 [((0, -AX + 0.42, 0), (0, 1, 0)), ((-0.3, 0, 0), (1, 0, 0))])
    paint([f for f in fs if f.material_index == M['paint'] and f.calc_center_median().y < -0.35], 'primer')
    lamps(C, s)
    # the roof: two rails and three crossbars, a lip proud of it
    z = ROOF - 0.06
    for side in (-1, 1):
        acc(C, 'trimR', (side * (HW - 0.2), 0.48, z + 0.03), (0.05, 1.0, 0.06))
    for y in (0.1, 0.5, 0.88):
        acc(C, 'chromeX', (0, y, z + 0.035), (W - 0.36, 0.04, 0.04))
    for ay in (-AX, AX):
        for side in (-1, 1):
            wheel(C, ay, side, key=f'{ay}{side}')
    for side in (-1, 1):
        for y in (-0.08, 0.42):
            acc(C, 'trimH', (side * (HW + 0.004), y, 0.6), (0.02, 0.1, 0.03))
    ob = finish(C, 'Wagon', ACC_MATS, s)
    return ob, {'belt': 0.66, 'roof_x': -0.48, 'seed': 21}


# ---------------------------------------------------------------- the coupe
def coupe():
    C = Creature(12, jit=0)
    def roof(y):   # peak over the front seats, a long fastback down to the ducktail
        return ROOF - 0.0 - max(0.0, y - 0.0) * 0.38 if y > 0 else ROOF - max(0.0, -y - 0.05) * 0.4
    s = {
        'mid': (-0.48, 0.42, 0.15, 0.6),
        'nose': [((0, -1, 0), 0.32, 1.0, 0.98), ((0, -1, 0), 0.2, 1.0, 0.92, None, (0, 0, -0.02)),
                 ((0, -1, 0), 0.15, 0.96, 0.86)],
        'tail': [((0, 1, 0), 0.3, 1.0, 1.0), ((0, 1, 0), 0.26, 1.0, 0.98, None, (0, 0, 0.01)),
                 ((0, 1, 0), 0.17, 0.97, 0.92, None, (0, 0, 0.02))],
        'cab': (-0.3, 0.98), 'cab_w': HW - 0.1, 'glass': (-0.06, 0.62), 'roof': roof,
        'pillars': [0.32], 'tumble': 0.9,
        'lamp_z': 0.44, 'tail_z': 0.5, 'bump_z': 0.24, 'grille': (0.3, 0.48), 'mirror': (HW - 0.08, -0.3, 0.66),
        'bumper': 'chrome', 'lamp_h': 0.1, 'tail_h': 0.09,
    }
    body(C, s)
    roofv = cabin(C, s)
    windows(C, roofv, s)
    arches(C, s)
    # two stripes over the top, nose to tail, knifed in
    bm = C.bm
    for x0 in (-0.2, 0.08):
        fs = C.knife(tops(bm, 0.3), [((x0 + 0.12, 0, 0), (1, 0, 0)), ((x0, 0, 0), (-1, 0, 0))])
        paint([f for f in fs if f.material_index == M['paint']], 'stripe')
    lamps(C, s)
    # the hood scoop: a primitive on the hood, open face black
    acc(C, 'paintS', (0, -0.62, 0.62), (0.34, 0.36, 0.08))
    acc(C, 'trimS', (0, -0.8, 0.625), (0.26, 0.012, 0.05))
    # chrome side trim along the sills
    for side in (-1, 1):
        acc(C, 'chromeS', (side * (HW + 0.003), 0.0, 0.3), (0.02, 0.9, 0.035))
        acc(C, 'trimH', (side * (HW + 0.004), -0.02, 0.55), (0.02, 0.1, 0.03))
    for ay in (-AX, AX):
        for side in (-1, 1):
            # fat rears
            wheel(C, ay, side, r=WR if ay < 0 else WR * 1.06, key=f'{ay}{side}')
    ob = finish(C, 'Coupe', ACC_MATS, s)
    # personality: nose down, tail up (jacked springs) - a rake of the whole body, wheels stay on the street
    me = ob.data
    wheel_mats = {i for i, m in enumerate(me.materials) if m.name in ('tire', 'rim')}
    wheel_v = {v for p in me.polygons if p.material_index in wheel_mats for v in p.vertices}
    for v in me.vertices:
        if v.index in wheel_v: continue
        v.co.z += -v.co.x * 0.035          # +X is the front now: front lower, back higher
    top = max(v.co.z for v in me.vertices)
    for v in me.vertices:                  # the roof back to exactly the hitbox roof
        if v.index not in wheel_v: v.co.z += ROOF - top
    me.update()
    return ob, {'belt': 0.6, 'roof_x': 0.0, 'seed': 22}


# ---------------------------------------------------------------- the microvan
def keivan():
    C = Creature(13, jit=0)
    s = {
        'mid': (-0.55, 0.5, 0.17, 0.56),
        'nose': [((0, -1, 0), 0.4, 1.0, 0.96), ((0, -1, 0), 0.2, 0.98, 0.9)],
        'tail': [((0, 1, 0), 0.5, 1.0, 1.0), ((0, 1, 0), 0.15, 0.99, 0.98)],
        'cab': (-1.06, 1.12), 'cab_w': HW - 0.04, 'glass': (-0.7, 1.1), 'roof': flat_roof(ROOF - 0.07),
        'pillars': [-0.3, 0.2, 0.66], 'tumble': 0.96, 'frame': 0.045,
        'lamp_z': 0.44, 'tail_z': 0.5, 'bump_z': 0.24, 'grille': (0.3, 0.42), 'mirror': (HW - 0.03, -0.9, 0.7),
        'lamp_h': 0.12, 'tail_h': 0.28,
    }
    body(C, s)
    roofv = cabin(C, s)
    windows(C, roofv, s)
    arches(C, s)
    lamps(C, s)
    z = ROOF - 0.07
    # the roof sign box, glowing both sides
    acc(C, 'trimSb', (0, 0.1, z + 0.035), (0.08, 0.6, 0.07))
    acc(C, 'signL', (0, 0.1, z + 0.06), (0.6, 0.5, 0.012), Matrix.Rotation(math.pi / 2, 4, 'Z'))
    # the sliding-door track on both sides, a dark rail under the windows
    for side in (-1, 1):
        acc(C, 'trimT', (side * (HW + 0.003), 0.35, 0.62), (0.02, 0.7, 0.03))
        acc(C, 'trimH', (side * (HW + 0.004), -0.5, 0.52), (0.02, 0.1, 0.03))
    # personality: a ladder up the back, and a spare-wheel rim on the camera-side front
    for side in (-1, 1):
        acc(C, 'chromeL', (side * 0.22, L / 2 + 0.04, 0.85), (0.03, 0.03, 0.62))
    for z2 in (0.62, 0.78, 0.94, 1.1):
        acc(C, 'chromeR', (0, L / 2 + 0.04, z2), (0.44, 0.025, 0.025))
    for ay in (-AX, AX):
        for side in (-1, 1):
            wheel(C, ay, side, rim='rimS' if (ay < 0 and side < 0) else 'rim', key=f'{ay}{side}')
    ob = finish(C, 'KeiVan', ACC_MATS, s)
    return ob, {'belt': 0.6, 'roof_x': 0.0, 'seed': 23}


cars, specs = [], {}
for make in (wagon, coupe, keivan):
    ob, spec = make()
    # bb_lib's Creature resets the scene each time: keep each mesh as plain data
    me = ob.data
    cars.append((ob.name, [v.co.copy() for v in me.vertices], [(list(p.vertices), me.materials[p.material_index].name) for p in me.polygons], spec))

bpy.ops.wm.read_factory_settings(use_empty=True)
mats = {k: material(k, v) for k, v in COLORS.items()}
dmg = car_damage.extra_materials(material)
objs = []
for name, verts, polys, spec in cars:
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], [p for p, _ in polys])
    names = list(dict.fromkeys(['paint'] + [m for _, m in polys]))
    for n in names: me.materials.append(mats[n])
    for poly, (_, m) in zip(me.polygons, polys): poly.material_index = names.index(m); poly.use_smooth = False
    me.update()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    objs.append(ob)
    full = {'len': L, 'wide': W, 'roof': ROOF, 'axle': AX, 'wheel_r': WR, **spec}
    objs += car_damage.variants(ob, dmg, full)
for i, ob in enumerate(objs):
    ob.location.y = i * 2.5
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'cars.blend'))
for path, damaged in ((os.path.join(OUT, 'bot-cars.glb'), False), (os.path.join(OUT, 'bot-cars-damage.glb'), True)):
    locs = {o.name: o.location.copy() for o in objs}
    for o in objs: o.location = (0, 0, 0)
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(o.name.endswith(('_dent', '_bust', '_wreck')) == damaged)
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_yup=True,
                              export_apply=True, export_texcoords=False)
    for o in objs: o.location = locs[o.name]
    print('GLB', path, os.path.getsize(path))
