# Builds the street's storefronts and exports public/models/storefronts.glb: a pizza place, a tattoo shop and a
# liquor store, the same kind of prop as GNAR SUPPLY (art/skateshop.py) and in the same units. From zack's photos of
# real New York fronts (2026-11-02): our own names and art, no real shop's name or logo.
#
#   PizzaShop   (7 wide)  teal wood front, a red enamel bulkhead, a stand-up counter window with pies on it and the
#                         oven glowing behind, the door to the left, a red door to the flats upstairs, three
#                         gooseneck lamps over a white sign box
#   TattooShop  (7 wide)  black and oxblood front with gold trim, two arched windows (flash sheets on the wall, a
#                         chair and a ring light, an OPEN sign), black and white striped awnings, an A-frame
#                         "walk-ins" board on the sidewalk
#   LiquorStore (8 wide)  slate front with shutters, two windows lit yellow with shelves of bottles, a glass door, a
#                         scalloped maroon awning, rolled-up security gates, a black neon box sign and a fire escape
#
#   blender -b -P art/storefronts.py           (or run it from Blender's Text Editor; it rebuilds the scene)
#   (headless: python art/storefronts.py with the pip bpy module)
#
# Each is two objects: the shop floor (<Name>) and the storey over it (<Name>Up), so the title's street can stand the
# shop floors under its own building. Axes as the skate shop: +X along the street, -Y toward the game camera, Z up; each object's origin on the ground at
# the middle of its front face, running back into +Y no deeper than DEEP (the city's buildings stand a tile behind).
# The game merges each into one vertex-coloured mesh, and paints the signs' lettering on canvases
# (src/render/storefronts.ts STOREFRONTS: the sign boards here are blank, at the rectangles given there).
import math
import os
import random
import sys

import bpy  # first: the bpy module provides bmesh and mathutils
import bmesh
from mathutils import Matrix

HERE = os.path.dirname(os.path.abspath(__file__)) if '__file__' in dir() else bpy.path.abspath('//')
sys.path.insert(0, HERE)
from cars import box, join, link, material, prism  # noqa: E402  (shared helpers)

ROOT = os.path.dirname(HERE)
GLB = os.path.join(ROOT, 'public', 'models', 'storefronts.glb')
BLEND = os.path.join(HERE, 'storefronts.blend')

DEEP = 0.95

# every colour gets its own material name, prefixed so they don't clash with other models' (models.ts shares
# materials by name)
COLORS = {
    # shared
    'sfGlass': 0x34465A,  # dark glass: transoms, doors, upstairs windows
    'sfGlint': 0xCFE4F0,
    'sfStone': 0xCDBFA6,  # sills, lintels, cornices
    'sfInside': 0x2A2630,
    'sfMetal': 0xA9AEB8,
    'sfBlack': 0x17161A,
    'sfWhite': 0xF2EEE4,
    'sfBulb': 0xFFF0C0,
    # the pizza place
    'pzTeal': 0x1E8A7C,
    'pzTealDark': 0x13605A,
    'pzRed': 0xC9302A,
    'pzRedDark': 0x8E1F1C,
    'pzCream': 0xF1E6CC,
    'pzTile': 0xE8E2D2,
    'pzBrick': 0x9A4A36,
    'pzOven': 0x6E3A2A,
    'pzFire': 0xFF8A1E,
    'pzCrust': 0xD9963F,
    'pzCheese': 0xF6CF5A,
    'pzPepperoni': 0xB3241E,
    'pzBasil': 0x3F8A3A,
    'pzMenu': 0x24302C,
    # the tattoo shop
    'ttBlack': 0x1B1719,
    'ttOxblood': 0x6E1A1E,
    'ttGold': 0xD6A445,
    'ttWall': 0x7A2A26,  # the shop's red walls inside
    'ttFlash': 0xEDE3C8,  # flash sheets
    'ttInk1': 0x2F7FE0,
    'ttInk2': 0x3CA05A,
    'ttInk3': 0xD8392B,
    'ttChair': 0x2B2B30,
    'ttLeather': 0xA12A2A,
    'ttRing': 0xF4F4FF,
    'ttBrick': 0x47343A,
    'ttChalk': 0x262B28,
    'ttWood': 0x6A4429,
    # the liquor store
    'lqSlate': 0x30333B,
    'lqSlateLite': 0x4C505A,
    'lqShutter': 0x24302B,
    'lqLit': 0xF4C24E,  # the windows' lit back walls
    'lqShelf': 0xF7E4B0,
    'lqAwning': 0x7A1F2B,
    'lqAwningDark': 0x58141E,
    'lqGate': 0x8E939C,
    'lqBrick': 0x7E3B30,
    'lqIron': 0x1E1D22,
    'btAmber': 0xB5651D,
    'btGreen': 0x2E7A44,
    'btClear': 0xDCEBEE,
    'btWine': 0x6B1A2A,
    'btBlue': 0x2B4FA0,
    'btGold': 0xE0B040,
    'lqPoster': 0xF6F0E2,
    'lqPosterRed': 0xD8392B,
}


class Parts:
    """One bmesh per material, joined at the end into one object."""

    def __init__(self, mats, name):
        self.mats = mats
        self.name = name
        self.bms = {}

    def __getitem__(self, name):
        if name not in self.bms:
            self.bms[name] = bmesh.new()
        return self.bms[name]

    def done(self):
        return join([link(f'{self.name}_{n}', bm, self.mats[n]) for n, bm in self.bms.items()], self.name)


def plate(bm, pts, y):
    """A flat plate in the xz plane facing the camera (-Y), from (x, z) points."""
    vs = [bm.verts.new((x, y, z)) for x, z in pts]
    f = bm.faces.new(vs)
    f.normal_update()
    if f.normal.y > 0:
        f.normal_flip()


def rect(bm, x0, x1, z0, z1, y):
    plate(bm, [(x0, z0), (x1, z0), (x1, z1), (x0, z1)], y)


def disc(bm, cx, cz, r, y, n=10):
    plate(bm, [(cx + r * math.cos(a), cz + r * math.sin(a)) for a in [i * 2 * math.pi / n for i in range(n)]], y)


def cylinder_z(bm, x, y, z, r, h, segs=10):
    """An upright cylinder standing at (x, y, z)."""
    vs = bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=r, radius2=r, depth=h)['verts']
    bmesh.ops.translate(bm, verts=vs, vec=(x, y, z + h / 2))


def cylinder_x(bm, x0, x1, y, z, r, segs=8):
    """A cylinder lying along the street from x0 to x1 (a rolled-up gate, a pipe)."""
    vs = bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=r, radius2=r, depth=x1 - x0)['verts']
    bmesh.ops.rotate(bm, verts=vs, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, 'Y'))
    bmesh.ops.translate(bm, verts=vs, vec=((x0 + x1) / 2, y, z))


def upstairs(p, w, z0, top, brick, windows, rng, ac=None):
    """The storey above the shop: brick, a row of windows with stone sills and lintels (some lit by a lamp inside,
    one with an air conditioner hanging out), a cornice, and the brick running back so nothing shows through."""
    h = w / 2
    box(p[brick], -h, h, 0.05, DEEP, z0, top - 0.5)
    span = w / windows
    for i in range(windows):
        cx = -h + span * (i + 0.5)
        ww = min(0.62, span * 0.3)
        wz0, wz1 = z0 + 0.75, top - 1.1
        rect(p['sfStone'], cx - ww - 0.12, cx + ww + 0.12, wz0, wz1, 0.04)
        rect(p['sfGlass'], cx - ww, cx + ww, wz0 + 0.1, wz1 - 0.1, 0.035)
        box(p['sfStone'], cx - 0.04, cx + 0.04, 0.0, 0.04, wz0 + 0.1, wz1 - 0.1)  # the sash bar
        box(p['sfStone'], cx - ww, cx + ww, 0.0, 0.04, (wz0 + wz1) / 2 - 0.04, (wz0 + wz1) / 2 + 0.03)
        box(p['sfStone'], cx - ww - 0.28, cx + ww + 0.28, -0.1, 0.1, wz0 - 0.18, wz0)  # sill
        box(p['sfStone'], cx - ww - 0.26, cx + ww + 0.26, -0.06, 0.1, wz1, wz1 + 0.26)  # lintel
        if ac == i:
            box(p['sfMetal'], cx - 0.42, cx + 0.42, -0.42, 0.04, wz0 + 0.02, wz0 + 0.52)
            for k in range(5):  # its grille
                box(p['sfBlack'], cx - 0.34 + k * 0.15, cx - 0.3 + k * 0.15, -0.44, -0.42, wz0 + 0.1, wz0 + 0.44)
    box(p['sfStone'], -h - 0.12, h + 0.12, -0.28, 0.4, top - 0.5, top - 0.26)
    box(p[brick], -h - 0.04, h + 0.04, -0.14, 0.4, top - 0.26, top - 0.12)
    box(p['sfStone'], -h - 0.22, h + 0.22, -0.36, 0.4, top - 0.12, top)
    # brackets under the cornice
    for i in range(int(w // 1.2) + 1):
        x = -h + 0.2 + i * (w - 0.4) / int(w // 1.2)
        box(p['sfStone'], x - 0.08, x + 0.08, -0.26, 0.0, top - 0.85, top - 0.5)


def glints(p, x0, x1, z0, z1, y):
    """Two slanted streaks of light across a pane of glass."""
    for k, (u, wd) in enumerate(((0.6, 0.07), (0.69, 0.035))):
        gx = x0 + (x1 - x0) * u
        a, b = z0 + (z1 - z0) * 0.45, z1 - 0.1
        lean = (b - a) * 0.3
        plate(p['sfGlint'], [(gx, a), (gx + wd, a), (gx + wd + lean, b), (gx + lean, b)], y - 0.002 * k)


def door(p, frame, x0, x1, y, z1, glass_from=1.2, kick=None, handle='sfMetal'):
    """A shop door at the back of its frame: the frame, the glass from glass_from up, a kick panel, a handle."""
    t = 0.12
    box(p[frame], x0, x0 + t, y - 0.05, y + 0.05, 0, z1)
    box(p[frame], x1 - t, x1, y - 0.05, y + 0.05, 0, z1)
    box(p[frame], x0, x1, y - 0.05, y + 0.05, z1 - t, z1)
    box(p[kick or frame], x0 + t, x1 - t, y - 0.03, y + 0.05, 0, glass_from)
    rect(p['sfGlass'], x0 + t, x1 - t, glass_from, z1 - t, y)
    box(p[handle], x1 - 0.32, x1 - 0.24, y - 0.14, y - 0.05, glass_from - 0.1, glass_from + 0.5)
    plate(p['sfGlint'], [(x0 + 0.3, glass_from + 0.6), (x0 + 0.36, glass_from + 0.6), (x0 + 0.56, z1 - 0.3), (x0 + 0.5, z1 - 0.3)], y - 0.006)


# --- the pizza place -------------------------------------------------------------------------------------------------

def pie(p, x, y, z, r=0.36, rng=None):
    """A pizza on a raised tray: tray, crust, cheese, a few pepperoni and basil leaves, seen from the street."""
    cylinder_z(p['sfMetal'], x, y, z, 0.05, 0.22, segs=6)  # the stand
    cylinder_z(p['sfMetal'], x, y, z + 0.22, r + 0.04, 0.02, segs=14)
    cylinder_z(p['pzCrust'], x, y, z + 0.24, r, 0.05, segs=14)
    cylinder_z(p['pzCheese'], x, y, z + 0.29, r - 0.05, 0.012, segs=14)
    for k in range(6):
        a = k * 2 * math.pi / 6 + (rng.random() if rng else 0)
        d = (r - 0.12) * (0.4 + 0.6 * (k % 2))
        cylinder_z(p['pzPepperoni'], x + d * math.cos(a), y + d * math.sin(a), z + 0.3, 0.055, 0.012, segs=7)
    cylinder_z(p['pzBasil'], x + 0.05, y - 0.05, z + 0.305, 0.04, 0.01, segs=5)


def pizza(p, u, rng):
    W, FLOOR, BAND, TOP = 7.0, 3.9, 1.5, 8.4
    h = W / 2
    # pilasters at the ends, teal with a red panel, from the ground to the top of the sign band
    for s in (-1, 1):
        x0, x1 = (-h - 0.08, -h + 0.38) if s < 0 else (h - 0.38, h + 0.08)
        box(p['pzTeal'], x0, x1, -0.28, 0.3, 0, FLOOR + BAND)
        box(p['pzTealDark'], x0 + 0.07, x1 - 0.07, -0.31, -0.28, 0.35, FLOOR - 0.25)
        box(p['pzTealDark'], x0 - 0.05, x1 + 0.05, -0.34, 0.3, 0, 0.3)
    # the door on the left: a teal frame, glass over a kick panel, a transom over it
    d0, d1 = -h + 0.38, -h + 1.75
    box(p['pzTeal'], d1, d1 + 0.18, -0.16, 0.2, 0, FLOOR)
    box(p['pzTeal'], d0, d1, -0.16, 0.3, 3.05, 3.25)  # the head over the door
    rect(p['sfGlass'], d0, d1, 3.25, FLOOR - 0.05, 0.05)
    box(p['pzTile'], d0, d1, 0.0, 0.3, 0.0, 0.02)
    door(p, 'pzTeal', d0 + 0.05, d1 - 0.05, 0.25, 3.05, glass_from=1.05, kick='pzTealDark')
    rect(p['sfWhite'], d0 + 0.35, d1 - 0.35, 1.9, 2.3, 0.19)  # the hours card
    rect(p['pzRed'], d0 + 0.42, d1 - 0.42, 2.18, 2.24, 0.188)
    # the counter window: red enamel bulkhead with a cream panel, a stand-up counter out front, the glass over it
    w0, w1 = d1 + 0.18, h - 1.42
    box(p['pzRed'], w0, w1, -0.12, 0.3, 0, 1.12)
    box(p['pzRedDark'], w0 + 0.15, w1 - 0.15, -0.15, -0.12, 0.15, 0.97)
    box(p['pzCream'], w0 + 0.3, w1 - 0.3, -0.17, -0.15, 0.32, 0.8)
    for k in range(3):  # a red check across the cream, a nod to the tablecloths inside
        x = w0 + 0.55 + k * (w1 - w0 - 1.1) / 2
        box(p['pzRed'], x - 0.12, x + 0.12, -0.18, -0.17, 0.45, 0.67)
    box(p['pzTealDark'], w0 - 0.05, w1 + 0.05, -0.42, 0.3, 1.12, 1.22)  # the counter
    # inside: tiled walls, the counter top with pies on it, the oven's mouth glowing, a menu board over it
    box(p['pzCream'], w0, w1, 0.3, DEEP, 1.12, 1.3)
    rect(p['pzTile'], w0, w1, 1.3, 3.3, DEEP)
    for k in range(3):
        pie(p, w0 + 0.55 + k * 0.9, 0.55, 1.3, rng=rng)
    ox = w1 - 0.75
    box(p['pzOven'], ox - 0.6, ox + 0.6, DEEP - 0.25, DEEP - 0.01, 1.3, 2.75)
    arch = [(ox - 0.34, 1.6)] + [(ox + 0.34 * math.cos(math.pi - a), 2.05 + 0.3 * math.sin(math.pi - a)) for a in [i * math.pi / 8 for i in range(9)]] + [(ox + 0.34, 1.6)]
    plate(p['pzFire'], arch, DEEP - 0.27)
    rect(p['pzMenu'], w0 + 0.2, w0 + 1.6, 2.5, 3.2, DEEP - 0.02)
    for k in range(4):
        rect(p['sfWhite'], w0 + 0.32, w0 + 0.32 + (0.9 if k % 2 == 0 else 0.7), 3.04 - k * 0.15, 3.08 - k * 0.15, DEEP - 0.03)
    # the window's frame: posts, a transom bar, the glass and its glints, and a teal mullion
    box(p['pzTeal'], w0, w0 + 0.1, -0.14, 0.2, 1.22, FLOOR)
    box(p['pzTeal'], w1 - 0.1, w1, -0.14, 0.2, 1.22, FLOOR)
    box(p['pzTeal'], w0, w1, -0.14, 0.2, 3.3, 3.45)
    mid = (w0 + w1) / 2
    box(p['pzTeal'], mid - 0.05, mid + 0.05, -0.08, 0.04, 1.22, 3.3)
    rect(p['sfGlass'], w0, w1, 3.45, FLOOR - 0.05, 0.0)
    glints(p, w0, w1, 1.4, 3.25, -0.03)
    # a slice sticker on the glass: a little wedge, crust up
    plate(p['pzCheese'], [(mid + 0.5, 2.55), (mid + 1.0, 2.55), (mid + 0.75, 2.05)], -0.03)
    box(p['pzCrust'], mid + 0.48, mid + 1.02, -0.032, -0.03, 2.55, 2.62)
    # the door to the flats upstairs, on the right: red, panelled, a fanlight over it
    f0, f1 = h - 1.42, h - 0.38
    box(p['pzTeal'], f0, f0 + 0.14, -0.16, 0.2, 0, FLOOR)
    box(p['pzRed'], f0 + 0.14, f1, -0.05, 0.3, 0, 3.0)
    for z0, z1 in ((0.3, 1.3), (1.55, 2.7)):
        box(p['pzRedDark'], f0 + 0.32, f1 - 0.18, -0.08, -0.05, z0, z1)
    box(p['sfMetal'], f0 + 0.24, f0 + 0.32, -0.12, -0.05, 1.4, 1.5)
    box(p['pzTeal'], f0 + 0.14, f1, -0.1, 0.3, 3.0, 3.12)
    fan = [(f0 + 0.2, 3.12)] + [((f0 + f1) / 2 + 0.38 * math.cos(math.pi - a), 3.12 + 0.55 * math.sin(math.pi - a)) for a in [i * math.pi / 8 for i in range(9)]]
    plate(p['sfGlass'], fan[1:], 0.0)
    rect(p['pzTeal'], f0 + 0.14, f1, 3.12, FLOOR, 0.02)
    # the sign band: teal fascia, mouldings, and the white sign box (lettering painted in the game) with a red rim
    box(p['pzTeal'], -h + 0.38, h - 0.38, -0.2, 0.3, FLOOR, FLOOR + BAND)
    box(p['pzTealDark'], -h + 0.38, h - 0.38, -0.3, 0.3, FLOOR - 0.04, FLOOR + 0.1)
    box(p['pzTealDark'], -h + 0.38, h - 0.38, -0.32, 0.3, FLOOR + BAND - 0.1, FLOOR + BAND)
    box(p['pzRed'], -h + 0.5, h - 0.5, -0.36, -0.2, FLOOR + 0.16, FLOOR + BAND - 0.14)
    box(p['sfWhite'], -h + 0.6, h - 0.6, -0.4, -0.36, FLOOR + 0.24, FLOOR + BAND - 0.22)  # the sign's face: y = -0.4
    # three gooseneck lamps over the sign
    for x in (-2.2, 0.0, 2.2):
        top = FLOOR + BAND + 0.25
        box(p['pzTealDark'], x - 0.04, x + 0.04, -0.34, -0.26, FLOOR + BAND - 0.05, top)
        box(p['pzTealDark'], x - 0.04, x + 0.04, -0.85, -0.26, top - 0.08, top)
        shade = [(x - 0.2, top - 0.3), (x + 0.2, top - 0.3), (x + 0.1, top - 0.05), (x - 0.1, top - 0.05)]
        prism(p['pzTealDark'], shade, -1.0, -0.72)
        box(p['sfBulb'], x - 0.12, x + 0.12, -0.95, -0.77, top - 0.33, top - 0.3)
    upstairs(u, W, FLOOR + BAND, TOP, 'pzBrick', 2, rng, ac=0)
    box(p['sfInside'], d0, d1, DEEP - 0.04, DEEP, 0, FLOOR)  # behind the door's glass: dim


# --- the tattoo shop -------------------------------------------------------------------------------------------------

def arch_window(p, x0, x1, z0, z1, frame):
    """A window with a round-headed top: the frame posts, the spandrels over the arch, a sill."""
    w = x1 - x0
    r = w / 2
    cx = (x0 + x1) / 2
    spring = z1 - r
    box(p[frame], x0 - 0.12, x0, -0.14, 0.2, z0, z1)
    box(p[frame], x1, x1 + 0.12, -0.14, 0.2, z0, z1)
    n = 8
    for s in (-1, 1):  # the spandrel over each half of the arch: from the post up round the arch to its crown
        arc = [(cx + s * r * math.cos(math.pi / 2 * i / n), spring + r * math.sin(math.pi / 2 * i / n)) for i in range(n + 1)]
        prism(p[frame], [(cx + s * r, z1 + 0.05)] + arc + [(cx, z1 + 0.05)], -0.1, 0.12)
    # the arch's moulding: a run of short boxes round it
    for i in range(n * 2):
        a0, a1 = math.pi * i / (n * 2), math.pi * (i + 1) / (n * 2)
        pts = [(cx + (r + 0.0) * math.cos(a0), spring + r * math.sin(a0)), (cx + (r + 0.0) * math.cos(a1), spring + r * math.sin(a1)),
               (cx + (r + 0.1) * math.cos(a1), spring + (r + 0.1) * math.sin(a1)), (cx + (r + 0.1) * math.cos(a0), spring + (r + 0.1) * math.sin(a0))]
        prism(p['ttGold'], pts, -0.14, -0.1)
    box(p[frame], x0 - 0.2, x1 + 0.2, -0.26, 0.2, z0 - 0.1, z0)  # sill


def flash_wall(p, x0, x1, z0, z1, y, rng):
    """Flash sheets pinned up in a grid on the back wall: cream sheets with a coloured design on each."""
    cols, rows = 4, 3
    sw = (x1 - x0) / cols
    sh = (z1 - z0) / rows
    inks = ['ttInk1', 'ttInk2', 'ttInk3', 'ttGold', 'sfBlack']
    for i in range(cols):
        for j in range(rows):
            a, b = x0 + i * sw + 0.05, x0 + (i + 1) * sw - 0.05
            c, d = z0 + j * sh + 0.05, z0 + (j + 1) * sh - 0.05
            rect(p['ttFlash'], a, b, c, d, y)
            ink = inks[rng.randrange(len(inks))]
            k = rng.randrange(3)
            mx, mz = (a + b) / 2, (c + d) / 2
            if k == 0:
                disc(p[ink], mx, mz, min(b - a, d - c) * 0.28, y - 0.004, n=8)
            elif k == 1:  # a heart
                plate(p[ink], [(mx, mz - 0.12), (mx + 0.12, mz + 0.02), (mx + 0.07, mz + 0.1), (mx, mz + 0.05), (mx - 0.07, mz + 0.1), (mx - 0.12, mz + 0.02)], y - 0.004)
            else:  # a dagger
                plate(p[ink], [(mx - 0.02, mz - 0.14), (mx + 0.02, mz - 0.14), (mx + 0.02, mz + 0.1), (mx, mz + 0.15), (mx - 0.02, mz + 0.1)], y - 0.004)
                rect(p['ttGold'], mx - 0.08, mx + 0.08, mz - 0.06, mz - 0.03, y - 0.005)


def awning_striped(p, x0, x1, z, depth=0.5, drop=0.8):
    """A canvas awning sloping out over a window, in black and white stripes, with a straight valance."""
    n = max(4, int((x1 - x0) / 0.28))
    sw = (x1 - x0) / n
    for i in range(n):
        a, b = x0 + i * sw, x0 + (i + 1) * sw
        mat = p['sfBlack'] if i % 2 == 0 else p['sfWhite']
        vs = [mat.verts.new(v) for v in ((a, 0.0, z), (b, 0.0, z), (b, -depth, z - drop), (a, -depth, z - drop))]
        mat.faces.new(vs)
        vs = [mat.verts.new(v) for v in ((a, 0.0, z), (a, -depth, z - drop), (b, -depth, z - drop), (b, 0.0, z))]  # its underside
        mat.faces.new(vs)
        box(mat, a, b, -depth - 0.02, -depth, z - drop - 0.3, z - drop)  # the valance
    for x in (x0, x1):  # its side cheeks
        bm = p['sfBlack']
        for flip in (False, True):
            vs = [bm.verts.new(v) for v in ((x, 0.0, z), (x, -depth, z - drop), (x, -depth, z - drop - 0.3), (x, 0.0, z - 0.25))]
            bm.faces.new(vs[::-1] if flip else vs)


def tattoo(p, u, rng):
    W, FLOOR, BAND, TOP = 7.0, 4.0, 1.5, 8.9
    h = W / 2
    # pilasters: black, a gold-ringed oxblood panel, and a gold rosette near the top of each
    for s in (-1, 1):
        x0, x1 = (-h - 0.08, -h + 0.42) if s < 0 else (h - 0.42, h + 0.08)
        box(p['ttBlack'], x0, x1, -0.3, 0.3, 0, FLOOR + BAND)
        box(p['ttGold'], x0 + 0.07, x1 - 0.07, -0.33, -0.3, 0.45, FLOOR - 0.35)
        box(p['ttOxblood'], x0 + 0.11, x1 - 0.11, -0.35, -0.33, 0.49, FLOOR - 0.39)
        box(p['ttBlack'], x0 - 0.06, x1 + 0.06, -0.36, 0.3, 0, 0.3)
        disc(p['ttGold'], (x0 + x1) / 2, FLOOR + BAND / 2, 0.16, -0.32, n=8)
    # the two arched windows either side of the door
    for s in (-1, 1):
        x0, x1 = (-h + 0.6, -0.95) if s < 0 else (0.95, h - 0.6)
        # the bulkhead: black with an oxblood panel and a gold line
        box(p['ttBlack'], x0 - 0.18, x1 + 0.18, -0.12, 0.3, 0, 0.95)
        box(p['ttOxblood'], x0 + 0.05, x1 - 0.05, -0.15, -0.12, 0.15, 0.78)
        box(p['ttGold'], x0 + 0.05, x1 - 0.05, -0.16, -0.15, 0.44, 0.48)
        # inside: red walls, the flash wall, the floor
        box(p['ttBlack'], x0, x1, 0.0, DEEP, 0.85, 0.95)
        rect(p['ttWall'], x0, x1, 0.95, FLOOR, DEEP)
        flash_wall(p, x0 + 0.1, x1 - 0.1, 2.0, 3.35, DEEP - 0.02, rng)
        arch_window(p, x0, x1, 0.95, 3.75, 'ttBlack')
        rect(p['sfGlass'], x0, x1, 3.75, FLOOR, 0.0)
        glints(p, x0, x1, 1.2, 3.2, -0.03)
        if s < 0:
            # a tattoo chair and a ring light on its stand
            cx = (x0 + x1) / 2 + 0.1
            box(p['ttChair'], cx - 0.08, cx + 0.08, 0.5, 0.62, 0.95, 1.35)
            box(p['ttLeather'], cx - 0.5, cx + 0.3, 0.42, 0.72, 1.35, 1.5)
            prism(p['ttLeather'], [(cx + 0.25, 1.45), (cx + 0.4, 1.45), (cx + 0.7, 2.05), (cx + 0.55, 2.1)], 0.42, 0.72)
            rx, rz, rr = x0 + 0.42, 2.45, 0.3
            box(p['sfBlack'], rx - 0.02, rx + 0.02, 0.6, 0.64, 0.95, rz - rr)
            for i in range(12):
                a0, a1 = i * 2 * math.pi / 12, (i + 1) * 2 * math.pi / 12
                pts = [(rx + rr * math.cos(a0), rz + rr * math.sin(a0)), (rx + rr * math.cos(a1), rz + rr * math.sin(a1)),
                       (rx + (rr - 0.07) * math.cos(a1), rz + (rr - 0.07) * math.sin(a1)), (rx + (rr - 0.07) * math.cos(a0), rz + (rr - 0.07) * math.sin(a0))]
                prism(p['ttRing'], pts, 0.58, 0.62)
        else:
            # the OPEN sign hangs in this window (the game lights it), and a shelf of ink bottles
            box(p['sfBlack'], x0 + 0.25, x1 - 0.25, 0.3, 0.34, 2.35, 2.95)  # the sign's board: face at y = 0.3
            box(p['ttBlack'], x0 + 0.1, x1 - 0.1, DEEP - 0.3, DEEP - 0.02, 1.55, 1.6)
            inks = ['ttInk1', 'ttInk2', 'ttInk3', 'sfBlack', 'ttGold', 'ttInk1', 'ttInk3']
            for k, ink in enumerate(inks):
                x = x0 + 0.25 + k * (x1 - x0 - 0.5) / (len(inks) - 1)
                box(p[ink], x - 0.06, x + 0.06, DEEP - 0.2, DEEP - 0.08, 1.6, 1.82)
                box(p['sfBlack'], x - 0.03, x + 0.03, DEEP - 0.17, DEEP - 0.11, 1.82, 1.9)
        awning_striped(p, x0 - 0.15, x1 + 0.15, FLOOR + 0.3)
    # the door: black, a gold push plate, glass with the shop's swallow on it, a transom
    box(p['ttBlack'], -0.95, -0.8, -0.16, 0.3, 0, FLOOR)
    box(p['ttBlack'], 0.8, 0.95, -0.16, 0.3, 0, FLOOR)
    box(p['ttBlack'], -0.8, 0.8, -0.16, 0.3, 3.15, 3.3)
    rect(p['sfGlass'], -0.8, 0.8, 3.3, FLOOR - 0.05, 0.1)
    door(p, 'ttBlack', -0.8, 0.8, 0.3, 3.15, glass_from=1.15, kick='ttOxblood', handle='ttGold')
    sw = [(-0.3, 2.25), (-0.05, 2.15), (0.0, 2.05), (0.08, 2.15), (0.3, 2.3), (0.12, 2.12), (0.25, 1.95), (0.02, 1.98), (-0.12, 1.85), (-0.06, 2.05)]
    plate(p['ttGold'], sw, 0.29)
    box(p['ttBlack'], -0.8, 0.8, 0.0, 0.3, 0, 0.04)
    box(p['sfInside'], -0.8, 0.8, DEEP - 0.04, DEEP, 0, 3.3)
    # the sign band: black fascia with gold mouldings, an oxblood sign board (the game letters it in gold)
    box(p['ttBlack'], -h + 0.42, h - 0.42, -0.22, 0.3, FLOOR, FLOOR + BAND)
    box(p['ttGold'], -h + 0.42, h - 0.42, -0.3, 0.3, FLOOR - 0.04, FLOOR + 0.06)
    box(p['ttGold'], -h + 0.42, h - 0.42, -0.32, 0.3, FLOOR + BAND - 0.08, FLOOR + BAND)
    box(p['ttOxblood'], -h + 0.62, h - 0.62, -0.3, -0.22, FLOOR + 0.18, FLOOR + BAND - 0.16)  # the sign's face: y = -0.3
    # gooseneck spots over the sign, as on the red front in the photo
    for x in (-1.9, 1.9):
        top = FLOOR + BAND + 0.2
        box(p['ttBlack'], x - 0.03, x + 0.03, -0.34, -0.26, FLOOR + BAND - 0.05, top)
        box(p['ttBlack'], x - 0.03, x + 0.03, -0.7, -0.26, top - 0.06, top)
        box(p['ttBlack'], x - 0.1, x + 0.1, -0.82, -0.62, top - 0.24, top - 0.04)
    # the A-frame board on the sidewalk: a wood frame round a chalkboard (lettered by the game), leaning back
    ax, ay, lean = -h + 1.1, -0.35, 0.13
    for side in (-1, 1):  # the two leaves, feet apart, meeting at the top
        bm = p['ttWood']
        for flip in (False, True):
            vs = [bm.verts.new(v) for v in ((ax - 0.36, ay + side * lean, 0.0), (ax + 0.36, ay + side * lean, 0.0), (ax + 0.36, ay, 1.15), (ax - 0.36, ay, 1.15))]
            bm.faces.new(vs[::-1] if flip else vs)
    t = 0.07 / 1.15  # the chalkboard inset on the street side, a hair in front of the frame
    bm = p['ttChalk']
    lo, hi = 0.08, 1.07
    vs = [bm.verts.new(v) for v in ((ax - 0.29, ay - lean * (1 - lo / 1.15) - 0.012, lo), (ax + 0.29, ay - lean * (1 - lo / 1.15) - 0.012, lo), (ax + 0.29, ay - lean * (1 - hi / 1.15) - 0.012, hi), (ax - 0.29, ay - lean * (1 - hi / 1.15) - 0.012, hi))]
    bm.faces.new(vs)
    upstairs(u, W, FLOOR + BAND, TOP, 'ttBrick', 3, rng)


# --- the liquor store ------------------------------------------------------------------------------------------------

BOTTLES = ['btAmber', 'btGreen', 'btClear', 'btWine', 'btBlue', 'btGold', 'btAmber', 'btGreen', 'btClear']


def bottles(p, x0, x1, z, y, rng):
    """A shelf of bottles, each a body and a neck, some taller, some fat."""
    box(p['lqShelf'], x0, x1, y - 0.12, y + 0.18, z - 0.04, z)
    x = x0 + 0.08
    while x < x1 - 0.1:
        c = BOTTLES[rng.randrange(len(BOTTLES))]
        bw = 0.07 + rng.random() * 0.04
        bh = 0.22 + rng.random() * 0.12
        box(p[c], x - bw, x + bw, y - 0.05, y + 0.08, z, z + bh)
        box(p[c], x - 0.025, x + 0.025, y - 0.03, y + 0.06, z + bh, z + bh + 0.1 + rng.random() * 0.05)
        x += bw * 2 + 0.06 + rng.random() * 0.04


def scallops(p, x0, x1, z, y, mat):
    """The awning's valance: a band with a scalloped bottom edge."""
    n = max(4, int((x1 - x0) / 0.45))
    sw = (x1 - x0) / n
    pts = [(x1, z), (x0, z)]
    for i in range(n):
        a = x0 + i * sw
        for k in range(5):
            t = k / 4
            pts.append((a + sw * t, z - 0.42 - 0.1 * math.sin(math.pi * t)))
    prism(p[mat], pts, y - 0.03, y)


def liquor(p, u, rng):
    W, FLOOR, TOP = 8.0, 3.7, 9.0
    SIGN0, SIGN1 = 4.45, 5.85  # the box sign's height
    h = W / 2
    # pilasters
    for s in (-1, 1):
        x0, x1 = (-h - 0.08, -h + 0.4) if s < 0 else (h - 0.4, h + 0.08)
        box(p['lqSlate'], x0, x1, -0.28, 0.3, 0, 6.2)
        box(p['lqSlateLite'], x0 + 0.08, x1 - 0.08, -0.3, -0.28, 0.4, FLOOR - 0.2)
    # the two windows, lit yellow, with shutters folded back either side and bottles on shelves
    for s in (-1, 1):
        x0, x1 = (-h + 0.95, -0.95) if s < 0 else (0.95, h - 0.95)
        box(p['lqSlate'], x0 - 0.1, x1 + 0.1, -0.1, 0.3, 0, 0.8)
        box(p['lqSlateLite'], x0 + 0.08, x1 - 0.08, -0.13, -0.1, 0.12, 0.66)
        box(p['lqShelf'], x0, x1, 0.0, DEEP, 0.75, 0.8)
        rect(p['lqLit'], x0, x1, 0.8, FLOOR, DEEP)
        for k, z in enumerate((0.8, 1.55, 2.25, 2.95)):
            bottles(p, x0 + 0.05, x1 - 0.05, z + (0.02 if k else 0), 0.4 + 0.12 * (k % 2), rng)
        # a poster taped in the corner of the glass
        px = x0 + 0.25 if s < 0 else x1 - 0.85
        rect(p['lqPoster'], px, px + 0.6, 2.6, 3.3, -0.01)
        rect(p['lqPosterRed'], px + 0.06, px + 0.54, 3.0, 3.22, -0.012)
        rect(p['lqPosterRed'], px + 0.1, px + 0.5, 2.72, 2.8, -0.012)
        # the frame
        for x in (x0, x1):
            box(p['lqSlate'], x - 0.08, x + 0.08, -0.12, 0.2, 0.8, FLOOR)
        box(p['lqSlate'], x0, x1, -0.12, 0.2, 3.25, 3.35)
        rect(p['sfGlass'], x0, x1, 3.35, FLOOR, 0.0)
        glints(p, x0, x1, 1.0, 3.2, -0.03)
        # the shutters, folded back flat against the front either side
        for e, sx in ((x0 - 0.1, -1), (x1 + 0.1, 1)):
            a, b = sorted((e, e + sx * 0.42))
            box(p['lqShutter'], a, b, -0.2, -0.12, 0.85, FLOOR - 0.1)
            for zz in (1.3, 2.1, 2.9):
                box(p['lqSlateLite'], a + 0.06, b - 0.06, -0.22, -0.2, zz, zz + 0.45)
        # the security gate rolled up in its box over the window
        box(p['lqGate'], x0 - 0.1, x1 + 0.1, -0.3, 0.0, FLOOR - 0.05, FLOOR + 0.25)
    # the door: aluminium, glass all the way down to a kick plate, a sale card, bottles seen inside
    box(p['lqSlate'], -0.95, -0.8, -0.16, 0.3, 0, FLOOR)
    box(p['lqSlate'], 0.8, 0.95, -0.16, 0.3, 0, FLOOR)
    box(p['lqSlate'], -0.8, 0.8, -0.16, 0.3, 3.15, FLOOR)
    rect(p['lqLit'], -0.8, 0.8, 0.0, 3.15, DEEP)
    bottles(p, -0.75, 0.75, 1.5, DEEP - 0.2, rng)
    bottles(p, -0.75, 0.75, 2.2, DEEP - 0.2, rng)
    door(p, 'sfMetal', -0.78, 0.78, 0.3, 3.15, glass_from=0.35)
    rect(p['lqPoster'], -0.5, -0.05, 1.9, 2.5, 0.24)
    rect(p['lqPosterRed'], -0.45, -0.1, 2.25, 2.42, 0.238)
    box(p['lqGate'], -0.85, 0.85, -0.3, 0.0, FLOOR - 0.05, FLOOR + 0.25)
    # the awning: maroon, sloping out over the whole front, its scalloped valance (lettered by the game)
    a0, a1, az, depth, drop = -h + 0.45, h - 0.45, FLOOR + 0.85, 0.7, 0.6
    bm = p['lqAwning']
    for flip in (False, True):
        vs = [bm.verts.new(v) for v in ((a0, 0.0, az), (a1, 0.0, az), (a1, -depth, az - drop), (a0, -depth, az - drop))]
        bm.faces.new(vs[::-1] if flip else vs)
    for x in (a0, a1):
        for flip in (False, True):
            vs = [bm.verts.new(v) for v in ((x, 0.0, az), (x, -depth, az - drop), (x, -depth, az - drop - 0.42), (x, 0.0, az - 0.3))]
            bm.faces.new(vs[::-1] if flip else vs)
    scallops(p, a0, a1, az - drop, -depth, 'lqAwning')  # the valance's face: y = -depth - 0.03
    for i in range(1, 8):  # seams down the canvas
        x = a0 + i * (a1 - a0) / 8
        vs = [p['lqAwningDark'].verts.new(v) for v in ((x - 0.02, -0.01, az + 0.005), (x + 0.02, -0.01, az + 0.005), (x + 0.02, -depth + 0.01, az - drop + 0.012), (x - 0.02, -depth + 0.01, az - drop + 0.012))]
        p['lqAwningDark'].faces.new(vs)
    # the fascia over it, and the black box sign standing off it on brackets (the game puts its neon on)
    box(p['lqSlate'], -h + 0.4, h - 0.4, -0.15, 0.3, FLOOR, 6.2)
    box(p['sfBlack'], -h + 0.25, h - 0.25, -0.5, -0.3, SIGN0, SIGN1)  # the sign's face: y = -0.5
    box(p['lqSlateLite'], -h + 0.25, h - 0.25, -0.52, -0.3, SIGN1, SIGN1 + 0.08)
    box(p['lqSlateLite'], -h + 0.25, h - 0.25, -0.52, -0.3, SIGN0 - 0.08, SIGN0)
    for x in (-h + 0.8, h - 0.8):
        box(p['lqIron'], x - 0.04, x + 0.04, -0.3, 0.0, SIGN1 - 0.3, SIGN1 - 0.2)
    upstairs(u, W, 6.2, TOP, 'lqBrick', 3, rng, ac=2)
    # the fire escape over the left two windows: a grated landing on brackets, a railing, a ladder to the next one
    fx0, fx1, fz = -h + 0.3, 0.6, 6.2 + 0.6
    box(u['lqIron'], fx0, fx1, -1.0, 0.0, fz - 0.06, fz)
    for x in (fx0 + 0.1, fx1 - 0.1):
        prism(u['lqIron'], [(x - 0.03, fz - 0.06), (x + 0.03, fz - 0.06), (x + 0.03, fz - 0.6), (x - 0.03, fz - 0.6)], -0.06, 0.0)
        box(u['lqIron'], x - 0.03, x + 0.03, -1.0, -0.94, fz, fz + 1.0)
    box(u['lqIron'], fx0, fx1, -1.0, -0.94, fz + 0.94, fz + 1.0)  # the top rail
    box(u['lqIron'], fx0, fx1, -1.0, -0.96, fz + 0.45, fz + 0.48)
    x = fx0 + 0.25
    while x < fx1 - 0.15:  # the balusters
        box(u['lqIron'], x - 0.015, x + 0.015, -0.99, -0.96, fz, fz + 0.94)
        x += 0.22
    box(u['lqIron'], fx0, fx0 + 0.04, -1.0, 0.0, fz + 0.94, fz + 1.0)
    box(u['lqIron'], fx1 - 0.04, fx1, -1.0, 0.0, fz + 0.94, fz + 1.0)
    # the drop ladder hanging from it, hooked up
    lx = fx1 - 0.55
    for x in (lx - 0.2, lx + 0.2):
        box(u['lqIron'], x - 0.025, x + 0.025, -0.9, -0.85, fz - 1.4, fz)
    for i in range(5):
        z = fz - 1.3 + i * 0.27
        box(u['lqIron'], lx - 0.2, lx + 0.2, -0.89, -0.86, z, z + 0.03)


def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    m = {k: material(k, v) for k, v in COLORS.items()}
    out = []
    for name, make, seed in (('PizzaShop', pizza, 3), ('TattooShop', tattoo, 5), ('LiquorStore', liquor, 11)):
        p = Parts(m, name)
        u = Parts(m, name + 'Up')  # the storey above, its own object: the title's street puts the shops under its own building
        make(p, u, random.Random(seed))
        out += [p.done(), u.done()]
    # side by side in the .blend for looking at; the game places each by its own origin
    for i, ob in enumerate(out):
        ob.location.x = (i // 2 - 1) * 10
    return out


def export():
    os.makedirs(os.path.dirname(GLB), exist_ok=True)
    for ob in bpy.data.objects:
        ob.location.x = 0
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=GLB, export_format='GLB', use_selection=True, export_yup=True, export_apply=True)
    for i, name in enumerate(('PizzaShop', 'TattooShop', 'LiquorStore')):
        for part in (name, name + 'Up'):
            bpy.data.objects[part].location.x = (i - 1) * 10
    bpy.ops.wm.save_as_mainfile(filepath=BLEND)


if __name__ == '__main__':
    for ob in build():
        for poly in ob.data.polygons:
            poly.use_smooth = False
        tris = sum(len(poly.vertices) - 2 for poly in ob.data.polygons)
        print(f'{ob.name}: {tris} tris, {len(ob.data.materials)} materials')
    export()
    print('wrote', GLB)
