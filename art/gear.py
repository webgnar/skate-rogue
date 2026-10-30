# Builds the shop's gear models in Blender and exports art/cards/gear.glb: a truck, a wheel and a shoe, in more
# detail than the game's board (art/board.py) can afford. They're only seen as card art (art/cards/render.ts bakes them
# to public/sprites/cards/*.png), so the triangle count costs nothing in game.
#
#   python3 art/gear.py            (pip bpy; or blender -b -P art/gear.py)
#
# From zack's photos (2026-10-30), in the same spirit but with our own marks, no real logos:
#   - Truck: a polished, Venture-style truck: a broad beam of a hanger rising to the bushing seat, the pivot arm up into
#     the baseplate's cup, red bushings, kingpin nut and cup washers, dark axle with speed rings and hex nuts.
#   - Wheel: a cream, Spitfire-style 54 mm wheel with rounded lips, the black and silver crescent swirl round the face
#     and a printed ring of text; the bore is left open (bearings are their own part).
#   - Shoe: a black suede, Half Cab-style mid top on a white vulc sole: foxing stripe, ridged toe cap, padded collar,
#     fat white laces, white stitching, a heel tab and side patch with the Gnar Run mark.
# Units are centimetres; Blender Z is up, -Y faces the camera.
import math
import os

import bpy  # first: the bpy module provides bmesh and mathutils
import bmesh
from mathutils import Matrix, Vector
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__)) if '__file__' in dir() else bpy.path.abspath('//')
GLB = os.path.join(HERE, 'cards', 'gear.glb')  # not in public/: only the card renderer loads it
BLEND = os.path.join(HERE, 'gear.blend')
FONT = next((f for f in ('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', '/Library/Fonts/Arial Bold.ttf') if os.path.exists(f)), None)


def hex_rgba(h):
    srgb = [((h >> sh) & 255) / 255 for sh in (16, 8, 0)]
    lin = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb]
    return (*lin, 1.0)


def material(name, color, rough=0.8, metal=0.0):
    m = bpy.data.materials.new(name)
    m.diffuse_color = hex_rgba(color)
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = hex_rgba(color)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    return m


def textured(name, pil, rough=0.8):
    img = bpy.data.images.new(name, pil.width, pil.height)
    px = pil.convert('RGBA').transpose(Image.FLIP_TOP_BOTTOM).tobytes()
    img.pixels = [b / 255 for b in px]
    img.pack()
    m = bpy.data.materials.new(name)
    nt = m.node_tree
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = img
    nt.links.new(tex.outputs['Color'], nt.nodes['Principled BSDF'].inputs['Base Color'])
    nt.nodes['Principled BSDF'].inputs['Roughness'].default_value = rough
    return m


def link(name, bm, mats, smooth=True, parent=None):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(m)
    for p in me.polygons:
        p.use_smooth = smooth
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    if parent:
        ob.parent = parent
    return ob


def modify(ob, kind, **kw):
    mod = ob.modifiers.new(kind.lower(), kind)
    for k, v in kw.items():
        setattr(mod, k, v)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return ob


def cyl(bm, r, depth, at, axis='Z', segs=16, r2=None, tilt=None):
    geom = bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=r, radius2=r if r2 is None else r2, depth=depth)
    vs = geom['verts']
    if axis == 'Y':
        bmesh.ops.rotate(bm, verts=vs, cent=(0, 0, 0), matrix=Matrix.Rotation(-math.pi / 2, 3, 'X'))
    if axis == 'X':
        bmesh.ops.rotate(bm, verts=vs, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, 'Y'))
    if tilt:
        bmesh.ops.rotate(bm, verts=vs, cent=(0, 0, 0), matrix=Matrix.Rotation(tilt, 3, 'Y'))
    bmesh.ops.translate(bm, verts=vs, vec=at)
    return vs


def rod(bm, a, b, r, segs=12, r2=None):
    """A cylinder from point a to point b."""
    a, b = Vector(a), Vector(b)
    d = b - a
    geom = bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=r, radius2=r if r2 is None else r2, depth=d.length)
    vs = geom['verts']
    q = Vector((0, 0, 1)).rotation_difference(d.normalized())
    bmesh.ops.rotate(bm, verts=vs, cent=(0, 0, 0), matrix=q.to_matrix())
    bmesh.ops.translate(bm, verts=vs, vec=(a + b) / 2)
    return vs


def loft(bm, rings, cap=True):
    """Join rings of verts (each a list of points, same length, closed) into a tube; cap the two ends."""
    vs = [[bm.verts.new(p) for p in ring] for ring in rings]
    n = len(rings[0])
    for a, b in zip(vs, vs[1:]):
        for i in range(n):
            bm.faces.new((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i]))
    if cap:
        bm.faces.new(vs[0][::-1])
        bm.faces.new(vs[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return vs


def smoothstep(a, b, x):
    t = min(1.0, max(0.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def superellipse(cx, cz, rx, rz, a, p=3.0):
    c, s = math.cos(a), math.sin(a)
    return cx + rx * math.copysign(abs(c) ** (2 / p), c), cz + rz * math.copysign(abs(s) ** (2 / p), s)


# ---------------------------------------------------------------- truck
# Axle along Y, the baseplate on top (it screws to the deck), the kingpin toward +X (the middle of the board).
AXLE_HALF = 10.4
HANGER_HALF = 6.6
BEAM_X = -0.5  # the hanger's beam sits behind the kingpin
KING_X = 1.25
PLATE_TOP = 6.4


def truck(mats):
    root = bpy.data.objects.new('Truck', None)
    bpy.context.scene.collection.objects.link(root)

    # the hanger: a loft along the axle, a round tube at the ends swelling into a deep beam in the middle, its
    # underside dipping into a V toward the ground and its top rising into the bushing seat
    bm = bmesh.new()
    rings = []
    stations = [i / 28 * 2 - 1 for i in range(29)]
    for t in stations:
        y = t * HANGER_HALF
        k = smoothstep(0.62, 0.0, abs(t))  # 0 at the tube ends, 1 in the middle
        top = 0.95 + 1.55 * k
        bot = -0.95 - 0.55 * smoothstep(0.35, 0.0, abs(t))
        rx = 0.95 + 0.45 * k
        ring = []
        for i in range(20):
            a = i / 20 * 2 * math.pi
            x, z = superellipse(BEAM_X * k, (top + bot) / 2, rx, (top - bot) / 2, a, 2.6)
            ring.append((x, y, z))
        rings.append(ring)
    loft(bm, rings)
    # the bushing seat: a ring round the kingpin on top of the beam
    cyl(bm, 1.25, 0.9, (KING_X, 0, 2.15), segs=24)
    ob = link('hanger', bm, [mats['chrome']], parent=root)
    modify(ob, 'SUBSURF', levels=2, render_levels=2)

    bm = bmesh.new()  # the pivot arm from the beam up into the baseplate's cup, and the seat's web joining the beam
    rod(bm, (BEAM_X - 0.3, 0, 1.6), (-2.05, 0, 4.7), 0.62, 16, r2=0.48)
    rod(bm, (BEAM_X, 0, 1.9), (KING_X - 0.4, 0, 2.15), 0.75, 16)
    link('pivot', bm, [mats['chrome']], parent=root)

    # the baseplate: a plate with four bolt holes and a cast body down to the pivot cup and the kingpin boss
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(5.6, 6.6, 0.5), verts=bm.verts)
    bmesh.ops.translate(bm, vec=(0, 0, PLATE_TOP - 0.25), verts=bm.verts)
    bm.to_mesh(me := bpy.data.meshes.new('plate'))
    bm.free()
    plate = bpy.data.objects.new('plate', me)
    bpy.context.scene.collection.objects.link(plate)
    plate.parent = root
    modify(plate, 'BEVEL', width=0.22, segments=3)
    bm = bmesh.new()
    body = [(-2.9, PLATE_TOP - 0.5), (2.5, PLATE_TOP - 0.5), (2.1, 4.1), (-2.7, 4.3)]
    a = [bm.verts.new((x, -1.5, z)) for x, z in body]
    b = [bm.verts.new((x, 1.5, z)) for x, z in body]
    bm.faces.new(a[::-1])
    bm.faces.new(b)
    for i in range(4):
        bm.faces.new((a[i], a[(i + 1) % 4], b[(i + 1) % 4], b[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    cyl(bm, 0.95, 1.5, (-2.05, 0, 4.4), segs=20)  # pivot cup housing
    cyl(bm, 1.1, 1.2, (KING_X, 0, 4.4), segs=20)  # kingpin boss
    ob = link('body', bm, [mats['chrome']], smooth=False, parent=root)
    modify(ob, 'BEVEL', width=0.18, segments=2, limit_method='ANGLE')
    for p in ob.data.polygons:
        p.use_smooth = True
    bm = bmesh.new()  # the bolt holes: dark wells in the plate's flanges
    for x in (-2.0, 2.0):
        for y in (-2.45, 2.45):
            cyl(bm, 0.38, 0.06, (x, y, PLATE_TOP - 0.5 - 0.02), segs=14)
    link('holes', bm, [mats['dark']], parent=root)

    # bushings: board side between the boss and the seat, road side under the seat; red urethane, barrel shaped
    bm = bmesh.new()
    for z0, z1 in ((2.6, 3.8), (0.35, 1.7)):
        rings = []
        for j in range(7):
            z = z0 + (z1 - z0) * j / 6
            r = 1.0 + 0.12 * math.sin(math.pi * j / 6)
            rings.append([(KING_X + r * math.cos(i / 20 * 2 * math.pi), r * math.sin(i / 20 * 2 * math.pi), z) for i in range(20)])
        loft(bm, rings)
    link('bushing', bm, [mats['bushing']], parent=root)

    # the kingpin, its cup washer and hex nut under the road-side bushing; pivot cup's red rim
    bm = bmesh.new()
    cyl(bm, 0.36, 4.6, (KING_X, 0, 2.0), segs=12)
    link('kingpin', bm, [mats['steel']], parent=root)
    bm = bmesh.new()
    cyl(bm, 1.25, 0.18, (KING_X, 0, 0.26), segs=24, r2=1.05)
    cyl(bm, 0.72, 0.62, (KING_X, 0, -0.15), segs=6)
    cyl(bm, 1.2, 0.16, (KING_X, 0, 3.86), segs=24)
    link('nut', bm, [mats['nut']], smooth=False, parent=root)
    bm = bmesh.new()
    cyl(bm, 0.66, 0.18, (-2.05, 0, 3.58), segs=18)
    link('cup', bm, [mats['bushing']], parent=root)

    # the axle: dark steel, threaded at the tips; speed rings and hex nuts where the wheels go
    bm = bmesh.new()
    cyl(bm, 0.4, 2 * AXLE_HALF, (0, 0, 0), axis='Y', segs=14)
    link('axle', bm, [mats['steel']], parent=root)
    bm = bmesh.new()
    for s in (1, -1):
        for j in range(6):  # thread ridges
            cyl(bm, 0.43, 0.08, (0, s * (AXLE_HALF - 1.6 - j * 0.22), 0), axis='Y', segs=14)
        cyl(bm, 0.62, 0.14, (0, s * (HANGER_HALF + 0.35), 0), axis='Y', segs=16)  # speed ring
        cyl(bm, 0.62, 0.14, (0, s * (AXLE_HALF - 1.05), 0), axis='Y', segs=16)
    link('rings', bm, [mats['steelhi']], smooth=False, parent=root)
    bm = bmesh.new()
    for s in (1, -1):
        cyl(bm, 0.75, 0.8, (0, s * (AXLE_HALF - 0.45), 0), axis='Y', segs=6)
    link('axlenuts', bm, [mats['nut']], smooth=False, parent=root)
    return root


# ---------------------------------------------------------------- wheel
WHEEL_R = 2.7  # 54 mm
WHEEL_W = 3.2
BORE_R = 1.12


def wheel_face():
    """The printed face: a cream disc, the crescent swirl round it and a ring of our own text (no real brand)."""
    n = 1024
    im = Image.new('RGB', (n, n), (241, 230, 207))
    px = im.load()
    c = n / 2
    r_in, r_out = 0.58, 0.95  # the swirl band, as a fraction of the face radius
    for y in range(n):
        for x in range(n):
            u, v = (x + 0.5 - c) / c, (y + 0.5 - c) / c
            r = math.hypot(u, v)
            if r_in <= r <= r_out:
                a = math.atan2(v, u) / (2 * math.pi) % 1
                # crescents: each stripe sweeps round as it goes out, fattest mid band
                rn = (r - r_in) / (r_out - r_in)
                k = (a * 22 + 0.75 * math.sin(math.pi * rn) + 0.35 * rn) % 1
                fat = 0.4 + 0.2 * math.sin(math.pi * rn)
                px[x, y] = (22, 22, 26) if k < fat else (206, 210, 216)
            elif r_out < r <= r_out + 0.018:
                px[x, y] = (22, 22, 26)
    d = ImageDraw.Draw(im)
    # a black ring inside the swirl, with white text round it
    rr = (r_in - 0.005) * c
    d.ellipse((c - rr, c - rr, c + rr, c + rr), fill=(22, 22, 26))
    rr2 = (r_in - 0.11) * c
    d.ellipse((c - rr2, c - rr2, c + rr2, c + rr2), fill=(241, 230, 207))
    text = '  GNAR RUN WHEELS  •  STREET FORMULA  •  54 MM  •  99 DURO  •'
    font = ImageFont.truetype(FONT, int(n * 0.034)) if FONT else ImageFont.load_default()
    rt = (r_in - 0.055) * c
    for i, ch in enumerate(text):
        ang = -math.pi / 2 + i / len(text) * 2 * math.pi
        g = Image.new('RGBA', (60, 60), (0, 0, 0, 0))
        ImageDraw.Draw(g).text((30, 30), ch, font=font, fill=(240, 240, 240), anchor='mm')
        g = g.rotate(-math.degrees(ang) - 90, resample=Image.BICUBIC)
        im.paste(g, (int(c + rt * math.cos(ang) - 30), int(c + rt * math.sin(ang) - 30)), g)
    return im


def wheel(mats):
    """A lathe: a flat tread with rounded lips, the faces dished in a little toward the core round the bore. The
    printed face is the one toward the camera (-Y)."""
    h = WHEEL_W / 2
    lip = 0.5
    # the profile as (radius, y) from the bore on the printed face, out over the tread, back in to the bore
    front = [(BORE_R, -h + 0.18), (BORE_R + 0.45, -h + 0.18), (BORE_R + 0.55, -h + 0.05), (WHEEL_R - lip, -h)]
    arc = [(WHEEL_R - lip + lip * math.sin(a), -h + lip - lip * math.cos(a)) for a in (i / 8 * math.pi / 2 for i in range(1, 9))]
    half = front + arc
    pts = half + [(r, -y) for r, y in half[::-1]]
    segs = 64
    bm = bmesh.new()
    rings = [[bm.verts.new((r * math.cos(a), y, r * math.sin(a))) for r, y in pts] for a in (i / segs * 2 * math.pi for i in range(segs))]
    m = len(pts)
    for i in range(segs):
        A, B = rings[i], rings[(i + 1) % segs]
        for j in range(m - 1):
            bm.faces.new((A[j], B[j], B[j + 1], A[j + 1]))
        bm.faces.new((A[-1], B[-1], B[0], A[0]))  # the bore wall
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    uv = bm.loops.layers.uv.new('UVMap')
    face_r = WHEEL_R - 0.1
    for f in bm.faces:
        printed = f.normal.y < -0.5 and all(lp.vert.co.y < -h + 0.2 for lp in f.loops)
        f.material_index = 0 if printed else 1
        for lp in f.loops:
            co = lp.vert.co
            lp[uv].uv = (co.x / (2 * face_r) + 0.5, co.z / (2 * face_r) + 0.5) if printed else (0.5, 0.5)
    for f in bm.faces:  # the bore's wall, a shade darker
        if all(math.hypot(lp.vert.co.x, lp.vert.co.z) < BORE_R + 0.01 for lp in f.loops):
            f.material_index = 2
    ob = link('Wheel', bm, [mats['wheelface'], mats['urethane'], mats['bore']])
    return ob


# ---------------------------------------------------------------- shoe
# Toe along +X, the outside of a right shoe toward -Y (the camera).
SHOE_L = 26.0


def outline(t):
    """Half width of the foot at t (0 heel, 1 toe) and how far it's shifted to the outside. Both ends round off."""
    w = 3.5 + 1.2 * math.sin(math.pi * min(1, t * 1.25)) ** 0.8
    w *= 1 - 0.25 * smoothstep(0.8, 1.0, t)
    w *= math.sqrt(max(0.0, 1 - ((0.1 - min(t, 0.1)) / 0.1) ** 2))  # round heel
    w *= math.sqrt(max(0.0, 1 - ((max(t, 0.86) - 0.86) / 0.14) ** 2))  # round toe
    return max(w, 0.05), -0.3 * math.sin(math.pi * t)


def stitch_tex():
    """Black suede with white stitching, in the upper's UVs (u heel to toe, v round from the outside sole edge up and
    over to the inside one)."""
    W, H = 1024, 512
    im = Image.new('RGB', (W, H), (26, 26, 30))
    d = ImageDraw.Draw(im)
    # suede grain
    import random
    rnd = random.Random(4)
    for _ in range(9000):
        x, y = rnd.randrange(W), rnd.randrange(H)
        g = rnd.choice((20, 34, 40))
        d.point((x, y), fill=(g, g, g + 4))

    def dashes(pts, width=2, dash=8):
        walked = 0.0
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            L = math.hypot(x1 - x0, y1 - y0)
            u = 0.0
            while u < L:
                step = min(dash - walked % dash, L - u)
                if int(walked // dash) % 2 == 0:
                    a, b = u / L, (u + step) / L
                    d.line((x0 + (x1 - x0) * a, y0 + (y1 - y0) * a, x0 + (x1 - x0) * b, y0 + (y1 - y0) * b), fill=(236, 236, 236), width=width)
                u += step
                walked += step

    for side in (0, 1):
        def V(v):
            return v * H / 2 if side == 0 else H - v * H / 2
        def curve(*ctrl, n=24):  # a quadratic Bezier through (u, v) control points, in pixels
            (x0, y0), (x1, y1), (x2, y2) = ctrl
            return [(W * ((1 - k) ** 2 * x0 + 2 * (1 - k) * k * x1 + k * k * x2), V((1 - k) ** 2 * y0 + 2 * (1 - k) * k * y1 + k * k * y2))
                    for k in (i / n for i in range(n + 1))]

        def double(*ctrl, gap=0.022):
            dashes(curve(*ctrl))
            dashes(curve(*[(x + gap, y) for x, y in ctrl]))

        dashes([(x, V(0.035)) for x in (0, W)])  # just above the sole all round
        double((0.6, 0.03), (0.62, 0.75), (0.75, 1.0))  # the toe cap's seam, meeting over the top
        double((0.36, 0.76), (0.68, 0.74), (0.78, 1.0))  # the eyestay round the lacing
        double((0.0, 0.5), (0.12, 0.45), (0.15, 0.03))  # the heel counter
        dashes(curve((0.0, 0.88), (0.2, 0.88), (0.37, 0.86)))  # round the collar
        # our own side mark: a big lightning bolt of double stitching across the quarter (not anyone's stripe)
        bolt = [(0.21, 0.16), (0.4, 0.48), (0.37, 0.3), (0.58, 0.6)]
        for o in (0, 0.03):
            dashes([(W * x, V(y + o)) for x, y in bolt])
    return im


def patch_tex(text):
    im = Image.new('RGB', (256, 128), (22, 22, 26))
    d = ImageDraw.Draw(im)
    d.rectangle((6, 6, 249, 121), outline=(236, 236, 236), width=4)
    font = ImageFont.truetype(FONT, 46) if FONT else ImageFont.load_default()
    d.text((128, 52), text, font=font, fill=(236, 236, 236), anchor='mm')
    small = ImageFont.truetype(FONT, 18) if FONT else ImageFont.load_default()
    d.text((128, 98), 'SKATE  ·  MID', font=small, fill=(236, 236, 236), anchor='mm')
    return im


def shoe_height(t):
    """The upper's height over the sole at t: the mid-top collar at the back, the laces sloping down, a low round toe."""
    collar = 11.2 - 1.2 * smoothstep(0.0, 0.36, t)
    throat = 9.6 - 4.8 * smoothstep(0.36, 0.8, t)
    toe = 4.8 - 3.4 * smoothstep(0.8, 1.0, t) ** 1.5
    return collar if t < 0.36 else throat if t < 0.8 else toe


SOLE_H = 2.4
SHOE_M = 24  # verts round each arch of the upper


def upper_at(t, s, lift=0.0):
    """A point on the upper: t heel (0) to toe (1), s round the section from the outside sole edge (0) up the wall,
    over the rounded top and down the inside wall (1), even steps by length. lift pushes it out of the surface."""
    w, off = outline(t)
    w = w * 0.97 + lift
    h = shoe_height(t) + lift
    r = min(w * (0.75 if t < 0.36 else 0.95), h * 0.9)  # the top's rounding: squarer round the collar
    wall, arc, top = h - r, math.pi / 2 * r, 2 * (w - r)
    total = 2 * wall + 2 * arc + top
    d = s * total
    side = -1
    if d > total / 2:  # the inside half mirrors the outside one
        d, side = total - d, 1
    if d < wall:
        y, z = -w, d
    elif d < wall + arc:
        a = (d - wall) / r
        y, z = -w + r * (1 - math.cos(a)), wall + r * math.sin(a)
    else:
        y, z = -w + r + (d - wall - arc), h
    y *= 1 - 0.08 * (z / h) ** 2  # the walls lean in a little toward the top
    return Vector((t * SHOE_L, off + (y if side < 0 else -y), SOLE_H - 0.1 + z))


def upper_normal(t, s):
    p = upper_at(t, s)
    n = (upper_at(t, s, 0.01) - p)
    return n.normalized() if n.length > 1e-6 else Vector((0, 0, 1))


OPEN = (0.07, 0.35, 0.37, 0.63)  # the foot opening, as t0, t1, s0, s1 on the upper


def shoe(mats):
    root = bpy.data.objects.new('Shoe', None)
    bpy.context.scene.collection.objects.link(root)

    def sole_band(z0, z1, grow, mat, name, bevel=0.0):
        bm = bmesh.new()
        n = 48
        rings = []
        for z in (z0, z1):
            ring = []
            for i in range(n):
                a = i / n * 2 * math.pi
                t = 0.5 + 0.5 * math.cos(a)  # 0 at the heel, round the outside (-Y) to the toe and back
                w, off = outline(t)
                ring.append((t * SHOE_L + grow * math.cos(a), off - (w + grow) * math.sin(a), z))
            rings.append(ring)
        loft(bm, rings)
        ob = link(name, bm, [mat], parent=root)
        if bevel:
            modify(ob, 'BEVEL', width=bevel, segments=3, limit_method='ANGLE')
        return ob

    # the vulc sole: a tall white wall with a thin grey line round it
    sole_band(0.0, SOLE_H, 0.14, mats['rubber'], 'sole', 0.3)
    sole_band(1.55, 1.68, 0.17, mats['rubberdk'], 'soleline')

    # the upper: a loft of arches on the sole, UVs (t, s) into the stitching texture; the foot opening is lining
    N = 40
    ts = [0.5 - 0.5 * math.cos(math.pi * i / (N - 1)) for i in range(N)]  # closer together at the round ends
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new('UVMap')
    grid = [[bm.verts.new(upper_at(t, j / SHOE_M)) for j in range(SHOE_M + 1)] for t in ts]
    for i in range(N - 1):
        for j in range(SHOE_M):
            f = bm.faces.new((grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]))
            tc, sc = (ts[i] + ts[i + 1]) / 2, (j + 0.5) / SHOE_M
            f.material_index = 1 if OPEN[0] < tc < OPEN[1] and OPEN[2] < sc < OPEN[3] else 0
            for lp, (ii, jj) in zip(f.loops, ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))):
                lp[uvl].uv = (ts[ii], 1 - jj / SHOE_M)
    tip = bm.verts.new(upper_at(1.0, 0.0).lerp(upper_at(1.0, 0.5), 0.5))
    heel = bm.verts.new(upper_at(0.0, 0.0).lerp(upper_at(0.0, 0.5), 0.5))
    for j in range(SHOE_M):
        for f in (bm.faces.new((grid[-1][j], tip, grid[-1][j + 1])), bm.faces.new((grid[0][j + 1], heel, grid[0][j]))):
            for lp in f.loops:
                lp[uvl].uv = (0.99 if f.verts[1] is tip else 0.01, 0.5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    upper = link('upper', bm, [mats['suede'], mats['lining']], parent=root)
    modify(upper, 'SUBSURF', levels=1, render_levels=1)

    # the padded collar: a fat roll round the edge of the opening
    t0, t1, s0, s1 = OPEN
    loop = []
    n = 44
    for k in range(n):  # a rounded rectangle in (t, s)
        a = k / n * 2 * math.pi
        c, sn = math.cos(a), math.sin(a)
        t = (t0 + t1) / 2 + (t1 - t0) / 2 * math.copysign(abs(c) ** 0.5, c)
        sv = (s0 + s1) / 2 + (s1 - s0) / 2 * math.copysign(abs(sn) ** 0.5, sn)
        loop.append((t, sv))
    bm = bmesh.new()
    rings = []
    for t, sv in loop:
        p = upper_at(t, sv)
        nrm = upper_normal(t, sv)
        nxt = upper_at(*loop[(loop.index((t, sv)) + 1) % n])
        tan = (nxt - p).normalized()
        side = nrm.cross(tan).normalized()
        rings.append([p + nrm * (0.25 + 0.5 * math.sin(b)) + side * 0.55 * math.cos(b) for b in (k / 10 * 2 * math.pi for k in range(10))])
    vs = [[bm.verts.new(q) for q in r] for r in rings]
    for i in range(n):
        A, B = vs[i], vs[(i + 1) % n]
        for k in range(10):
            bm.faces.new((A[k], A[(k + 1) % 10], B[(k + 1) % 10], B[k]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    link('collar', bm, [mats['suedehi']], parent=root)

    # the tongue: a padded flap standing up out of the front of the opening, lying down the throat
    bm = bmesh.new()
    rings = []
    for k in range(9):
        u = k / 8
        t = t1 - 0.04 + 0.26 * u
        p = upper_at(t, 0.5)
        up = 1.3 * (1 - u) ** 1.5 + 0.3
        rings.append([p + Vector((0, 1.75 * math.cos(b), up + 0.4 * math.sin(b))) for b in (i / 14 * 2 * math.pi for i in range(14))])
    loft(bm, rings)
    link('tongue', bm, [mats['canvas']], parent=root)

    # laces: fat white laces criss-crossing between two rows of eyelets, and a bow at the top
    rows = 6
    eyes = [(t1 + 0.02 + 0.36 * k / (rows - 1)) for k in range(rows)]
    lo, hi = 0.41, 0.59
    bm = bmesh.new()
    for k in range(rows - 1):
        for sa, sb in ((lo, hi), (hi, lo)):
            pa = upper_at(eyes[k], sa, 0.35)
            pb = upper_at(eyes[k + 1], sb, 0.35)
            mid = (pa + pb) / 2 + upper_normal((eyes[k] + eyes[k + 1]) / 2, 0.5) * 0.35
            rod(bm, pa, mid, 0.34, 8)
            rod(bm, mid, pb, 0.34, 8)
    pa, pb = upper_at(eyes[0], lo, 0.35), upper_at(eyes[0], hi, 0.35)
    rod(bm, pa, pb, 0.34, 8)
    knot = (pa + pb) / 2 + Vector((0, 0, 0.35))
    for s in (1, -1):  # the bow's loops and the loose ends
        a = knot + Vector((-1.3, s * 2.0, 1.0))
        rod(bm, knot, a, 0.3, 8)
        rod(bm, a, knot + Vector((0.5, s * 1.1, 0.5)), 0.3, 8)
        rod(bm, knot, knot + Vector((1.8, s * 2.6, -2.6)), 0.26, 8)
    bmesh.ops.create_icosphere(bm, subdivisions=1, radius=0.45, matrix=Matrix.Translation(knot))
    link('laces', bm, [mats['lace']], parent=root)
    bm = bmesh.new()  # metal eyelets in the eyestay
    for t in eyes:
        for sv in (lo - 0.035, hi + 0.035):
            p, nrm = upper_at(t, sv, 0.05), upper_normal(t, sv)
            rod(bm, p, p + nrm * 0.12, 0.33, 12)
    link('eyelets', bm, [mats['eyelet']], smooth=False, parent=root)

    # our own mark: a woven patch on the outside of the heel
    def patch(name, t, sv, w, h, mat, lift=0.06):
        p, nrm = upper_at(t, sv, lift), upper_normal(t, sv)
        along = (upper_at(t + 0.01, sv) - upper_at(t - 0.01, sv)).normalized()
        up = nrm.cross(along).normalized()
        if up.z < 0:
            up = -up
        bm = bmesh.new()
        uv = bm.loops.layers.uv.new('UVMap')
        corners = ((-1, -1), (1, -1), (1, 1), (-1, 1))
        vs = [bm.verts.new(p + along * (cx * w / 2) + up * (cy * h / 2)) for cx, cy in corners]
        f = bm.faces.new(vs)
        for lp, (cx, cy) in zip(f.loops, corners):
            lp[uv].uv = ((cx + 1) / 2, (cy + 1) / 2)
        if f.normal.dot(nrm) < 0:  # face outward, and flip the picture back so it reads
            f.normal_flip()
            for lp in f.loops:
                lp[uv].uv = (1 - lp[uv].uv[0], lp[uv].uv[1])
        return link(name, bm, [mat], parent=root)

    patch('sidepatch', 0.2, 0.3, 4.2, 2.0, mats['patch'])
    return root


def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    mats = {
        'chrome': material('chrome', 0xE8EBF0, 0.18, 1.0),
        'steel': material('steel', 0x4A4744, 0.5, 0.6),
        'steelhi': material('steelhi', 0x9A968E, 0.4, 0.8),
        'nut': material('nut', 0xD4D8DE, 0.25, 1.0),
        'bushing': material('bushing', 0xB3182C, 0.6),
        'dark': material('dark', 0x16161A, 0.9),
        'urethane': material('urethane', 0xF1E6CF, 0.55),
        'bore': material('bore', 0xCFC2A6, 0.7),
        'wheelface': textured('wheelface', wheel_face(), 0.55),
        'rubber': material('rubber', 0xF4F2EE, 0.8),
        'rubberdk': material('rubberdk', 0xC9C6C0, 0.8),
        'suede': textured('suede', stitch_tex(), 0.95),
        'suedehi': material('suedehi', 0x232327, 0.95),
        'canvas': material('canvas', 0x1E1E22, 0.9),
        'lining': material('lining', 0x0E0E10, 0.95),
        'lace': material('lace', 0xF7F7F7, 0.7),
        'eyelet': material('eyelet', 0xC9CDD3, 0.3, 1.0),
        'patch': textured('patch', patch_tex('GNAR'), 0.8),
    }
    t = truck(mats)
    w = wheel(mats)
    s = shoe(mats)
    # side by side in the .blend; the card renderer frames each on its own
    w.location.x = 16
    s.location.x = 26
    return [t, w, s]


def export():
    os.makedirs(os.path.dirname(GLB), exist_ok=True)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=GLB, export_format='GLB', use_selection=True, export_yup=True, export_apply=True)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)


if __name__ == '__main__':
    build()
    tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in bpy.data.objects if o.type == 'MESH')
    print(f'gear: {tris} tris')
    export()
    print('wrote', GLB)
