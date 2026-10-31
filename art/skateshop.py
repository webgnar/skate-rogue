# Builds the skate shop's storefront and exports public/models/skateshop.glb: GNAR SUPPLY, the shop the run stops
# at. It stands at the back of the sidewalk behind the gate of the floor that leads to the shop (src/render/shop-front.ts).
# From zack's photo of a real corner shop: a dark wood front, a big hand-lettered sign over it, two display windows
# full of decks, a recessed glass door between angled windows, and a tiled step. Our own name and art, no logos.
#
#   blender -b -P art/skateshop.py            (or run it from Blender's Text Editor; it rebuilds the scene)
#   (headless: python art/skateshop.py with the pip bpy module)
#
# Units are tiles (Lou is about 2 tall), same axes as the props: +X along the street, -Y toward the game camera,
# Z up. One object, origin on the ground at the middle of its front face; the shop runs back into +Y. The game
# merges it into one vertex-coloured mesh (models.ts flatGeometry), so colours are cheap: one draw, plus its ink.
# The sign's lettering is painted on in the game (a canvas texture), so the sign board here is blank.
import math
import os
import random
import sys

import bpy  # first: the bpy module provides bmesh and mathutils
import bmesh
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__)) if '__file__' in dir() else bpy.path.abspath('//')
sys.path.insert(0, HERE)
from cars import box, join, link, material, prism  # noqa: E402  (shared helpers)

ROOT = os.path.dirname(HERE)
GLB = os.path.join(ROOT, 'public', 'models', 'skateshop.glb')
BLEND = os.path.join(HERE, 'skateshop.blend')

COLORS = {
    'shopWood': 0x3B2418,  # the dark stained frame, pilasters and bulkheads
    'shopWoodLite': 0x6A4429,  # raised panels and trim
    'shopInlay': 0xB08452,  # the diamonds on the bulkheads
    'shopSign': 0x121214,  # the sign board (lettering painted on in the game)
    'shopInside': 0x2C2833,  # the shop's dim inside, behind the displays
    'shopWall': 0xE8E0CC,  # the display windows' back walls, cream
    'shopShelf': 0xC89A62,  # display floors and the deck racks
    'shopTile': 0xA8463A,  # the red tiled step and entry floor
    'shopTileLite': 0xD9C9AE,  # its cream tiles
    'shopFrame': 0xC9CCD2,  # the door's aluminium frame
    'shopGlint': 0xCFE4F0,  # streaks on the glass
    'shopGlass': 0x3A4A5E,  # door glass and transoms, seen dark
    'shopBrick': 0x8C3A2C,  # the storey above
    'shopStone': 0xCDBFA6,  # sills, lintels and the cornice
    'shopRed': 0xD8392B,  # tees, deck graphics
    'shopBlack': 0x18181C,
    'deckYellow': 0xF2C230,
    'deckBlue': 0x2F7FE0,
    'deckGreen': 0x3CC06A,
    'deckPink': 0xFF6FB0,
    'deckWhite': 0xF0ECE0,
    'deckMaple': 0xDDAA6E,
    'deckOrange': 0xFF7A1A,
    'wheel': 0xEFE6C8,
    'truck': 0xB8BCC4,
}

W = 9.0  # the front's width
FLOOR = 4.0  # the shop floor's height, to the bottom of the sign band
BAND = 1.5  # the sign band
TOP = 9.2  # the top of the cornice
DOOR = 1.4  # the recessed entry's half width at the front
RECESS = 0.8  # how far back the door stands
DEEP = 0.95  # how deep the front goes: the city's buildings stand 1 tile behind its face (kit.ts)


class Parts:
    """One bmesh per material, joined at the end into the shop's one object."""

    def __init__(self, mats):
        self.mats = mats
        self.bms = {}

    def __getitem__(self, name):
        if name not in self.bms:
            self.bms[name] = bmesh.new()
        return self.bms[name]

    def done(self):
        return join([link(n, bm, self.mats[n]) for n, bm in self.bms.items()], 'SkateShop')


def quad_xz(bm, pts, y):
    """A flat plate in the xz plane facing the camera (-Y), from (x, z) points."""
    vs = [bm.verts.new((x, y, z)) for x, z in pts]
    f = bm.faces.new(vs)
    f.normal_update()
    if f.normal.y > 0:
        f.normal_flip()


def deck_outline(w, h, n=4):
    """A deck seen flat: a long rounded rectangle, (x, z) about its middle, nose up."""
    r = w / 2
    pts = []
    for i in range(n + 1):  # the nose
        a = math.pi * i / n
        pts.append((r * math.cos(a), h / 2 - r + r * math.sin(a)))
    for i in range(n + 1):  # the tail
        a = math.pi + math.pi * i / n
        pts.append((r * math.cos(a), -h / 2 + r + r * math.sin(a)))
    return pts


def deck(p, color, graphic, x, y, z, w=0.3, h=1.05, tilt=0.0, art=0):
    """A deck stood or hung on its tail, its graphic toward the street: a thin slab in the xz plane, with a graphic
    in a second colour on the face (a stripe, a band or a dot)."""
    rot = Matrix.Rotation(tilt, 2)

    def place(pts):
        return [tuple(rot @ Vector(pt)) for pt in pts]

    bm = p[color]
    out = [(x + a, z + b) for a, b in place(deck_outline(w, h))]
    prism(bm, out, y, y + 0.05)
    g = p[graphic]
    if art == 0:  # a band across the middle
        shape = [(-w / 2 + 0.02, -0.12), (w / 2 - 0.02, -0.12), (w / 2 - 0.02, 0.12), (-w / 2 + 0.02, 0.12)]
    elif art == 1:  # a stripe up the length
        shape = [(-0.05, -h / 2 + 0.14), (0.05, -h / 2 + 0.14), (0.05, h / 2 - 0.14), (-0.05, h / 2 - 0.14)]
    elif art == 2:  # a dot
        shape = [(0.11 * math.cos(a), 0.11 * math.sin(a) + 0.12) for a in [i * math.pi / 4 for i in range(8)]]
    else:  # a bolt
        shape = [(-0.08, 0.3), (0.06, 0.3), (0.0, 0.05), (0.09, 0.05), (-0.06, -0.3), (-0.01, -0.02), (-0.1, -0.02)]
    quad_xz(g, [(x + a, z + b) for a, b in place(shape)], y - 0.006)


def tee(p, color, x, y, z):
    """A T-shirt hung flat on the wall, shoulders at z."""
    pts = [(-0.18, -0.55), (0.18, -0.55), (0.18, -0.12), (0.3, -0.18), (0.36, -0.02), (0.14, 0.0), (0.06, -0.04),
           (-0.06, -0.04), (-0.14, 0.0), (-0.36, -0.02), (-0.3, -0.18), (-0.18, -0.12)]
    prism(p[color], [(x + a, z + b) for a, b in pts], y, y + 0.03)


def wheels(p, x, y, z, n=3):
    """A short stack of wheels lying on the display floor."""
    for i in range(n):
        vs = bmesh.ops.create_cone(p['wheel'], cap_ends=True, segments=10, radius1=0.12, radius2=0.12, depth=0.1)['verts']
        bmesh.ops.translate(p['wheel'], verts=vs, vec=(x, y, z + 0.05 + i * 0.105))


def complete(p, x, y, z, deck_color, graphic):
    """A complete stood on its tail: deck, trucks and wheels."""
    deck(p, deck_color, graphic, x, y, z + 0.55, h=1.05, art=3)
    for tz in (z + 0.3, z + 0.8):
        box(p['truck'], x - 0.17, x + 0.17, y + 0.05, y + 0.12, tz - 0.03, tz + 0.03)
        for sx in (-0.2, 0.2):
            vs = bmesh.ops.create_cone(p['wheel'], cap_ends=True, segments=8, radius1=0.06, radius2=0.06, depth=0.07)['verts']
            bmesh.ops.rotate(p['wheel'], verts=vs, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, 'Y'))
            bmesh.ops.translate(p['wheel'], verts=vs, vec=(x + sx, y + 0.12, tz))


def bulkhead(p, x0, x1):
    """The wood panel under a display window: a raised panel with a diamond inlay in each bay."""
    box(p['shopWood'], x0, x1, -0.12, 0.3, 0, 0.95)
    box(p['shopWood'], x0 - 0.02, x1 + 0.02, -0.2, 0.3, 0.88, 0.98)  # the sill
    bays = 2
    bw = (x1 - x0) / bays
    for i in range(bays):
        a, b = x0 + i * bw + 0.12, x0 + (i + 1) * bw - 0.12
        box(p['shopWoodLite'], a, b, -0.16, -0.12, 0.14, 0.78)
        box(p['shopWood'], a + 0.07, b - 0.07, -0.18, -0.16, 0.21, 0.71)
        cx, cz = (a + b) / 2, 0.46
        quad_xz(p['shopInlay'], [(cx, cz + 0.17), (cx + 0.17, cz), (cx, cz - 0.17), (cx - 0.17, cz)], -0.185)


def display(p, x0, x1, side, rng):
    """A display window from x0 to x1: its frame, a cream back wall, a rack of decks hung on it, tees, decks stood
    along the floor and a few glints across the glass."""
    back = DEEP
    # the window's box: floor, back wall, ceiling, ends
    box(p['shopShelf'], x0, x1, 0.0, back, 0.95, 1.0)
    quad_xz(p['shopWall'], [(x0, 1.0), (x1, 1.0), (x1, 3.35), (x0, 3.35)], back)
    box(p['shopInside'], x0, x1, 0.05, back, 3.35, 3.45)
    # the frame: posts at the ends, a transom bar and a mullion
    box(p['shopWood'], x0 - 0.14, x0 + 0.04, -0.14, 0.2, 0.95, FLOOR)
    box(p['shopWood'], x1 - 0.04, x1 + 0.14, -0.14, 0.2, 0.95, FLOOR)
    box(p['shopWood'], x0, x1, -0.14, 0.2, 3.35, 3.5)
    mid = (x0 + x1) / 2
    box(p['shopWood'], mid - 0.04, mid + 0.04, -0.06, 0.04, 3.5, FLOOR)  # the transom's mullion
    for a, b in ((x0, mid - 0.04), (mid + 0.04, x1)):  # transom lights
        quad_xz(p['shopGlass'], [(a, 3.5), (b, 3.5), (b, FLOOR - 0.05), (a, FLOOR - 0.05)], 0.0)
    # the deck rack on the back wall: a rail and the decks hung nose up
    box(p['shopShelf'], x0 + 0.15, x1 - 0.15, back - 0.12, back - 0.02, 2.95, 3.02)
    colors = ['deckYellow', 'deckBlue', 'shopRed', 'deckGreen', 'deckPink', 'deckWhite', 'deckMaple', 'deckOrange', 'shopBlack']
    graphics = {'deckYellow': 'shopBlack', 'deckBlue': 'deckWhite', 'shopRed': 'deckWhite', 'deckGreen': 'deckYellow',
                'deckPink': 'shopBlack', 'deckWhite': 'shopRed', 'deckMaple': 'shopRed', 'deckOrange': 'shopBlack',
                'shopBlack': 'deckPink'}
    n = 6
    span = (x1 - x0 - 0.5) / (n - 1)
    rng.shuffle(colors)
    for i in range(n):
        c = colors[i % len(colors)]
        deck(p, c, graphics[c], x0 + 0.25 + i * span, back - 0.16, 2.42, h=1.0, art=i % 4)
    # tees up top on the outer side, and decks stood along the floor, leaning a little
    tx = x0 + 0.5 if side < 0 else x1 - 0.5
    tee(p, 'shopRed' if side < 0 else 'shopBlack', tx, back - 0.2, 3.28)
    rng.shuffle(colors)
    m = 4
    for i in range(m):
        c = colors[i]
        x = x0 + 0.45 + i * (x1 - x0 - 0.9) / (m - 1)
        deck(p, c, graphics[c], x, 0.3 + (i % 2) * 0.18, 1.53, h=1.05, tilt=(rng.random() - 0.5) * 0.25, art=(i + side) % 4)
    if side < 0:
        wheels(p, x1 - 0.35, 0.2, 1.0)
    else:
        complete(p, x0 + 0.4, 0.16, 1.0, 'deckGreen', 'deckWhite')
    # glints on the glass: two slanted streaks
    for k, (u, wd, z0, z1) in enumerate(((0.62, 0.07, 2.2, 3.15), (0.7, 0.035, 2.45, 3.15))):
        gx = x0 + (x1 - x0) * u
        lean = (z1 - z0) * 0.35
        quad_xz(p['shopGlint'], [(gx, z0), (gx + wd, z0), (gx + wd + lean, z1), (gx + lean, z1)], -0.03 - 0.002 * k)


def entry(p):
    """The recessed entry: angled side windows from the displays back to a glass door, the tiled floor and step."""
    d = 0.75  # the door's half width
    # the angled side windows: low wood under, glass with the inside showing, a thin frame
    for s in (-1, 1):
        a = (s * DOOR, 0.0)
        b = (s * d, RECESS)
        bm = p['shopWood']
        vs = [bm.verts.new((a[0], a[1], 0)), bm.verts.new((b[0], b[1], 0)), bm.verts.new((b[0], b[1], 0.95)), bm.verts.new((a[0], a[1], 0.95))]
        bm.faces.new(vs if s < 0 else vs[::-1])
        bm = p['shopInside']
        vs = [bm.verts.new((a[0], a[1], 0.95)), bm.verts.new((b[0], b[1], 0.95)), bm.verts.new((b[0], b[1], 3.5)), bm.verts.new((a[0], a[1], 3.5))]
        bm.faces.new(vs if s < 0 else vs[::-1])
        bm = p['shopGlint']
        t0, t1 = 0.35, 0.42
        pa = (a[0] + (b[0] - a[0]) * t0, a[1] + (b[1] - a[1]) * t0 - 0.02)
        pb = (a[0] + (b[0] - a[0]) * t1, a[1] + (b[1] - a[1]) * t1 - 0.02)
        vs = [bm.verts.new((pa[0], pa[1], 1.2)), bm.verts.new((pb[0], pb[1], 1.2)), bm.verts.new((pb[0], pb[1], 2.9)), bm.verts.new((pa[0], pa[1], 2.9))]
        bm.faces.new(vs if s < 0 else vs[::-1])
    # the recess's ceiling, and the transom over the door
    box(p['shopWood'], -DOOR, DOOR, 0.0, RECESS + 0.1, 3.5, 3.6)
    quad_xz(p['shopGlass'], [(-d, 3.0), (d, 3.0), (d, 3.5), (-d, 3.5)], RECESS + 0.02)
    # the door: an aluminium frame round dark glass, a push bar, and a little hours card
    y = RECESS
    for x0, x1, z0, z1 in ((-d, -d + 0.12, 0.12, 3.0), (d - 0.12, d, 0.12, 3.0), (-d, d, 0.12, 0.42), (-d, d, 2.86, 3.0)):
        box(p['shopFrame'], x0, x1, y - 0.04, y + 0.04, z0, z1)
    box(p['shopFrame'], -d, d, y - 0.04, y + 0.04, 2.92, 3.04)
    quad_xz(p['shopGlass'], [(-d + 0.12, 0.42), (d - 0.12, 0.42), (d - 0.12, 2.86), (-d + 0.12, 2.86)], y)
    box(p['shopFrame'], -d + 0.2, d - 0.2, y - 0.12, y - 0.06, 1.42, 1.5)  # the push bar
    quad_xz(p['deckWhite'], [(-0.22, 1.85), (0.22, 1.85), (0.22, 2.3), (-0.22, 2.3)], y - 0.01)  # hours card
    quad_xz(p['shopRed'], [(-0.17, 2.18), (0.17, 2.18), (0.17, 2.25), (-0.17, 2.25)], y - 0.012)
    # a skater sticker slapped on the glass, and a deck seen inside past the door
    quad_xz(p['deckYellow'], [(0.22, 0.8), (0.42, 0.8), (0.42, 1.0), (0.22, 1.0)], y - 0.01)
    quad_xz(p['shopGlint'], [(-0.45, 1.9), (-0.39, 1.9), (-0.15, 2.7), (-0.21, 2.7)], y - 0.012)
    # the tiled floor in the recess and the step out front: red tiles with cream ones in a checker
    t = 0.32
    box(p['shopTile'], -DOOR, DOOR, -0.42, RECESS, 0.0, 0.12)
    box(p['shopTile'], -DOOR - 0.15, DOOR + 0.15, -0.62, -0.42, 0.0, 0.06)  # the step's nosing
    ix = 0
    x = -DOOR
    while x < DOOR - 0.01:
        iy = 0
        yy = -0.42
        while yy < RECESS - 0.01:
            if (ix + iy) % 2 == 0:
                # only the tiles inside the recess's trapezoid (and on the step)
                half = DOOR + (d - DOOR) * max(0.0, yy + t / 2) / RECESS
                if abs(x + t / 2) + t / 2 <= half + 0.01:
                    quad = [(x + 0.02, yy + 0.02), (x + t - 0.02, yy + 0.02), (x + t - 0.02, yy + t - 0.02), (x + 0.02, yy + t - 0.02)]
                    bm = p['shopTileLite']
                    vs = [bm.verts.new((a, b, 0.121)) for a, b in quad]
                    bm.faces.new(vs)
            yy += t
            iy += 1
        x += t
        ix += 1


def front(p, rng):
    """The whole shopfront."""
    h = W / 2
    # pilasters at the ends, full height of the shop floor and the sign band, with a cap and a plinth
    for s in (-1, 1):
        x0, x1 = (-h - 0.1, -h + 0.42) if s < 0 else (h - 0.42, h + 0.1)
        box(p['shopWood'], x0, x1, -0.3, 0.3, 0, FLOOR + BAND)
        box(p['shopWoodLite'], x0 + 0.08, x1 - 0.08, -0.34, -0.3, 1.1, FLOOR - 0.2)
        box(p['shopWood'], x0 - 0.06, x1 + 0.06, -0.36, 0.3, 0, 0.3)
        box(p['shopWood'], x0 - 0.08, x1 + 0.08, -0.4, 0.3, FLOOR + BAND - 0.12, FLOOR + BAND + 0.05)
    # the displays and their bulkheads either side of the entry
    for s in (-1, 1):
        x0, x1 = (-h + 0.42, -DOOR) if s < 0 else (DOOR, h - 0.42)
        bulkhead(p, x0, x1)
        display(p, x0 + 0.14, x1 - 0.14, s, rng)
    # posts either side of the entry, from the floor to the band
    for s in (-1, 1):
        box(p['shopWood'], s * DOOR - 0.14, s * DOOR + 0.14, -0.16, 0.2, 0, FLOOR)
    entry(p)
    # the sign band: the wood fascia, a moulding along its top and bottom, and the sign board on it
    box(p['shopWood'], -h + 0.42, h - 0.42, -0.2, 0.3, FLOOR, FLOOR + BAND)
    box(p['shopWoodLite'], -h + 0.42, h - 0.42, -0.28, 0.3, FLOOR - 0.04, FLOOR + 0.08)
    box(p['shopWoodLite'], -h + 0.42, h - 0.42, -0.3, 0.3, FLOOR + BAND - 0.1, FLOOR + BAND)
    box(p['shopSign'], -h + 0.7, h - 0.7, -0.26, -0.2, FLOOR + 0.18, FLOOR + BAND - 0.18)
    # the storey above: brick, three windows with stone sills and lintels, and a cornice
    box(p['shopBrick'], -h, h, 0.05, 0.4, FLOOR + BAND, TOP - 0.5)
    for i in range(3):
        cx = (i - 1) * 2.8
        quad_xz(p['shopStone'], [(cx - 0.65, 6.25), (cx + 0.65, 6.25), (cx + 0.65, 8.15), (cx - 0.65, 8.15)], 0.04)
        quad_xz(p['shopGlass'], [(cx - 0.52, 6.35), (cx + 0.52, 6.35), (cx + 0.52, 8.05), (cx - 0.52, 8.05)], 0.035)
        box(p['shopStone'], cx - 0.04, cx + 0.04, 0.0, 0.04, 6.35, 8.05)  # the sash bar
        box(p['shopStone'], cx - 0.52, cx + 0.52, 0.0, 0.04, 7.18, 7.25)
        box(p['shopStone'], cx - 0.8, cx + 0.8, -0.1, 0.1, 6.05, 6.22)  # sill
        box(p['shopStone'], cx - 0.78, cx + 0.78, -0.06, 0.1, 8.15, 8.42)  # lintel
    box(p['shopStone'], -h - 0.15, h + 0.15, -0.3, 0.4, TOP - 0.5, TOP - 0.25)
    box(p['shopBrick'], -h - 0.05, h + 0.05, -0.15, 0.4, TOP - 0.25, TOP - 0.12)
    box(p['shopStone'], -h - 0.25, h + 0.25, -0.38, 0.4, TOP - 0.12, TOP)
    # behind the front: the shop's dim inside and its sides, so nothing shows through from an angle
    box(p['shopInside'], -DOOR, DOOR, RECESS + 0.06, DEEP, 0, 3.6)
    box(p['shopBrick'], -h, h, 0.4, DEEP, FLOOR + BAND, TOP - 0.5)


def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    m = {k: material(k, v) for k, v in COLORS.items()}
    p = Parts(m)
    front(p, random.Random(7))
    return [p.done()]


def export():
    os.makedirs(os.path.dirname(GLB), exist_ok=True)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=GLB, export_format='GLB', use_selection=True, export_yup=True, export_apply=True)
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)


if __name__ == '__main__':
    for ob in build():
        for poly in ob.data.polygons:
            poly.use_smooth = False
        tris = sum(len(poly.vertices) - 2 for poly in ob.data.polygons)
        print(f'{ob.name}: {tris} tris, {len(ob.data.materials)} materials')
    export()
    print('wrote', GLB)
