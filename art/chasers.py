# Builds act 3's chasers and exports public/models/chasers.glb: Atlantis's tidal wave, Greece's gold chariot with its
# driver and two horses, and the museum's guards. They run the skater down from behind (src/sim/chaser.ts); the game
# draws them in src/render/chaser-view.ts.
#
#   blender -b -P art/chasers.py            (or run it from Blender's Text Editor; it rebuilds the scene)
#
# Units are tiles (Lou is about 2 tall), same axes as the other models: +X is the way the skater rolls (the chasers
# face +X, after them), -Y faces the game camera, Z is up. Objects, each with its origin where the game turns it:
#   Wave          the wave, spanning the street's depth; origin on the street at its foot
#   Chariot       the car, its pole and yoke, and the driver; origin on the ground under the axle
#   ChariotWheel  one spoked wheel, origin at its hub (the game places two and rolls them about the axle)
#   Horse         a horse without legs, origin on the ground under its middle
#   HorseLeg      one leg, origin at the hip (the game hangs four on each horse and swings them)
#   Guard         a museum guard without legs, origin on the ground under them
#   GuardLeg      one leg, origin at the hip
#   GuardArm      one arm hanging straight down, origin at the shoulder (the game hangs two on each guard and swings
#                 them, and the front guard raises the camera-side one to aim)
#   GuardPistol   the front guard's pistol in that hand, barrel down along the arm; origin at the shoulder too, so it
#                 turns with the arm
import math
import os
import sys

import bpy  # first: the bpy module provides bmesh and mathutils
import bmesh
from mathutils import Matrix

HERE = os.path.dirname(os.path.abspath(__file__)) if '__file__' in dir() else bpy.path.abspath('//')
sys.path.insert(0, HERE)
from cars import box, join, link, material, prism  # noqa: E402  (shared helpers)

ROOT = os.path.dirname(HERE)
GLB = os.path.join(ROOT, 'public', 'models', 'chasers.glb')
BLEND = os.path.join(HERE, 'chasers.blend')

WAVE_Y = (-2.2, 4.2)  # the street's depth: from in front of the camera-side kerb to the back wall
WHEEL_R = 0.5

# named apart from the other models' colours: the game shares materials by name (src/render/models.ts)
COLORS = {
    'waveDeep': 0x1A4F9A,
    'waveFace': 0x2A7FD0,
    'waveLight': 0x5AB8F0,
    'foam': 0xEAF8FF,
    'chariotGold': 0xD8A83A,
    'chariotRed': 0xC0302A,
    'chariotWood': 0x5A3A20,
    'horseCoat': 0x6A4428,
    'horseMane': 0x2A1A10,
    'hoof': 0x1A1210,
    'skinTan': 0xC8946A,
    'guardNavy': 0x1F2A48,
    'guardCap': 0x10162A,
    'guardBadge': 0xF0C040,
    'shoeBlack': 0x101014,
}


def blob(bm, scale, at, u=10, v=7):
    tmp = bmesh.new()
    bmesh.ops.create_uvsphere(tmp, u_segments=u, v_segments=v, radius=1)
    bmesh.ops.scale(tmp, vec=scale, verts=tmp.verts)
    bmesh.ops.translate(tmp, verts=tmp.verts, vec=at)
    me = bpy.data.meshes.new('tmp')
    tmp.to_mesh(me)
    tmp.free()
    bm.from_mesh(me)
    bpy.data.meshes.remove(me)


def tilted(bm, size, at, angle):
    """A box size (x, y, z) centred at `at`, leaned by `angle` about Y (positive tips its top toward +X)."""
    tmp = bmesh.new()
    sx, sy, sz = size
    box(tmp, -sx / 2, sx / 2, -sy / 2, sy / 2, -sz / 2, sz / 2)
    bmesh.ops.rotate(tmp, verts=tmp.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(angle, 3, 'Y'))
    bmesh.ops.translate(tmp, verts=tmp.verts, vec=at)
    me = bpy.data.meshes.new('tmp')
    tmp.to_mesh(me)
    tmp.free()
    bm.from_mesh(me)
    bpy.data.meshes.remove(me)


def loft(bm, profile, y0, y1, steps, wobble):
    """Sweep a closed side profile (x, z) across Y from y0 to y1, its x pushed by wobble(y, z) at each step, so the
    face of the wave rolls in and out along the street."""
    rings = []
    for k in range(steps + 1):
        y = y0 + (y1 - y0) * k / steps
        rings.append([bm.verts.new((x + wobble(y, z), y, z)) for x, z in profile])
    n = len(profile)
    faces = [bm.faces.new(rings[0][::-1]), bm.faces.new(rings[-1])]
    for a, b in zip(rings, rings[1:]):
        faces += [bm.faces.new((a[i], a[(i + 1) % n], b[(i + 1) % n], b[i])) for i in range(n)]
    bmesh.ops.recalc_face_normals(bm, faces=faces)


def wave(m):
    """A wall of water curling over toward +X: a dark back, a lighter face scooping up into a lip that throws out
    over the street, foam on the lip and along the foot."""
    parts = []
    roll = lambda y, z: 0.28 * math.sin(y * 1.1) * min(1, z / 2.5) + 0.1 * math.sin(y * 2.7 + 1)  # noqa: E731
    back = [(-3.4, 0), (0.2, 0), (-0.2, 1.4), (-0.25, 2.6), (0.1, 3.4), (-0.6, 3.9), (-1.8, 3.6), (-3.0, 2.8), (-3.4, 1.6)]
    bm = bmesh.new()
    loft(bm, back, *WAVE_Y, 10, roll)
    parts.append(link('waveDeep', bm, m['waveDeep']))
    # the face: the concave scoop and the lip, a skin in front of the back
    face = [(1.3, 0), (0.6, 0.35), (0.15, 1.2), (0.1, 2.3), (0.45, 3.15), (1.0, 3.55), (1.6, 3.5), (1.75, 3.15),
            (1.5, 3.3), (1.0, 3.3), (0.55, 2.9), (0.3, 2.2), (0.35, 1.2), (0.8, 0.45), (1.6, 0.06)]
    bm = bmesh.new()
    loft(bm, face, *WAVE_Y, 10, roll)
    parts.append(link('waveFace', bm, m['waveFace']))
    bm = bmesh.new()  # the light catching the inside of the curl
    inner = [(0.2, 1.4), (0.18, 2.3), (0.45, 3.0), (0.38, 3.05), (0.1, 2.3), (0.12, 1.4)]
    loft(bm, inner, WAVE_Y[0] + 0.01, WAVE_Y[1] - 0.01, 10, lambda y, z: roll(y, z) - 0.06)
    parts.append(link('waveLight', bm, m['waveLight']))
    bm = bmesh.new()  # foam: clumps along the lip, spray off its tip, and the wash at the foot
    n = 14
    for i in range(n):
        y = WAVE_Y[0] + 0.2 + (WAVE_Y[1] - WAVE_Y[0] - 0.4) * i / (n - 1)
        r = 0.2 + 0.08 * ((i * 7) % 3)
        blob(bm, (r * 1.3, r * 1.1, r), (1.25 + roll(y, 3.5), y, 3.6 + 0.08 * (i % 2)), 8, 5)
        blob(bm, (r * 0.7, r * 0.7, r * 0.6), (1.85 + roll(y, 3.2), y + 0.15, 3.05 - 0.12 * (i % 3)), 6, 4)
        blob(bm, (r * 1.8, r * 1.2, r * 0.6), (1.45 + roll(y, 0), y, 0.1), 8, 4)
    parts.append(link('foam', bm, m['foam']))
    ob = join(parts, 'Wave')
    return ob


def chariot(m):
    """A two-wheeled racing chariot in gold with a red band, its pole running forward to the yoke, and the driver
    braced in it, cloak flying, whip up."""
    parts = []
    bm = bmesh.new()  # the car: a low back, rising to a curved breastwork at the front
    prism(bm, [(-0.55, 0.55), (0.45, 0.55), (0.6, 1.35), (0.45, 1.5), (0.3, 1.1), (-0.55, 0.85)], -0.5, 0.5)
    parts.append(link('chariotGold', bm, m['chariotGold']))
    bm = bmesh.new()
    prism(bm, [(-0.56, 0.68), (0.5, 0.68), (0.53, 0.8), (-0.56, 0.8)], -0.52, 0.52)  # red band
    tilted(bm, (0.5, 0.42, 1.0), (-0.25, 0, 1.45), 0.25)  # the driver's cloak, leaning into the gallop
    tilted(bm, (0.5, 0.1, 0.8), (-0.75, 0.05, 1.6), 1.1)  # its tail streaming back
    box(bm, -0.1, 0.0, -0.03, 0.03, 2.45, 2.75)  # the helmet's crest
    box(bm, -0.25, 0.1, -0.03, 0.03, 2.62, 2.75)
    parts.append(link('chariotRed', bm, m['chariotRed']))
    bm = bmesh.new()  # the axle, the pole and the yoke
    box(bm, -0.06, 0.06, -0.62, 0.62, WHEEL_R - 0.05, WHEEL_R + 0.05)
    tilted(bm, (1.9, 0.08, 0.08), (1.35, 0, 0.85), -0.12)
    box(bm, 2.2, 2.32, -0.5, 0.5, 1.02, 1.12)
    parts.append(link('chariotWood', bm, m['chariotWood']))
    bm = bmesh.new()  # the driver's head and arms
    blob(bm, (0.15, 0.15, 0.17), (0.0, 0, 2.2), 8, 6)
    tilted(bm, (0.1, 0.1, 0.55), (0.25, -0.24, 1.6), -0.9)  # rein arm, forward
    tilted(bm, (0.1, 0.1, 0.55), (-0.2, 0.24, 2.15), -0.5)  # whip arm, up and back
    parts.append(link('skinTan', bm, m['skinTan']))
    bm = bmesh.new()  # the helmet, and the whip
    blob(bm, (0.17, 0.17, 0.12), (-0.02, 0, 2.32), 8, 5)
    tilted(bm, (0.03, 0.03, 1.2), (-0.15, 0.24, 2.9), -0.5)
    parts.append(link('chariotGold2', bm, m['chariotGold']))
    return join(parts, 'Chariot')


def chariot_wheel(m):
    """A six-spoked wheel in gold, about its hub; the axle runs along Y."""
    bm = bmesh.new()
    n = 16
    for i in range(n):  # the rim: segments of a ring
        a0, a1 = 2 * math.pi * i / n, 2 * math.pi * (i + 1) / n
        r0, r1 = WHEEL_R - 0.07, WHEEL_R
        pts = [(r0 * math.cos(a0), r0 * math.sin(a0)), (r1 * math.cos(a0), r1 * math.sin(a0)),
               (r1 * math.cos(a1), r1 * math.sin(a1)), (r0 * math.cos(a1), r0 * math.sin(a1))]
        prism(bm, pts, -0.05, 0.05)
    for i in range(6):
        a = math.pi * i / 6
        tmp = bmesh.new()
        box(tmp, -WHEEL_R + 0.04, WHEEL_R - 0.04, -0.025, 0.025, -0.03, 0.03)
        bmesh.ops.rotate(tmp, verts=tmp.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(a, 3, 'Y'))
        me = bpy.data.meshes.new('tmp')
        tmp.to_mesh(me)
        tmp.free()
        bm.from_mesh(me)
        bpy.data.meshes.remove(me)
    vs = bmesh.ops.create_cone(bm, cap_ends=True, segments=10, radius1=0.09, radius2=0.09, depth=0.16)['verts']
    bmesh.ops.rotate(bm, verts=vs, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, 'X'))
    return link('ChariotWheel', bm, m['chariotGold'])


def horse(m):
    """A horse at the gallop, legs off (HorseLeg): a barrel of a body, the neck stretched forward, the head, a mane,
    the tail out behind."""
    parts = []
    bm = bmesh.new()
    blob(bm, (0.72, 0.22, 0.3), (0, 0, 1.2), 12, 8)  # body
    tilted(bm, (0.28, 0.2, 0.75), (0.72, 0, 1.6), 0.75)  # neck
    tilted(bm, (0.2, 0.18, 0.55), (1.15, 0, 1.85), 2.0)  # head, nose down
    blob(bm, (0.2, 0.2, 0.22), (-0.55, 0, 1.25), 8, 6)  # haunch
    blob(bm, (0.2, 0.2, 0.22), (0.5, 0, 1.2), 8, 6)  # chest
    for s in (-1, 1):  # ears
        box(bm, 0.86, 0.93, s * 0.06 - 0.025, s * 0.06 + 0.025, 2.0, 2.14)
    parts.append(link('horseCoat', bm, m['horseCoat']))
    bm = bmesh.new()
    tilted(bm, (0.09, 0.08, 0.8), (0.62, 0, 1.7), 0.75)  # mane
    tilted(bm, (0.09, 0.07, 0.6), (-0.95, 0, 1.15), 1.0)  # tail, streaming
    parts.append(link('horseMane', bm, m['horseMane']))
    bm = bmesh.new()  # a red plume on the bridle, to match the car
    box(bm, 0.82, 0.92, -0.03, 0.03, 2.12, 2.3)
    parts.append(link('chariotRed', bm, m['chariotRed']))
    return join(parts, 'Horse')


def horse_leg(m):
    bm = bmesh.new()
    box(bm, -0.07, 0.07, -0.06, 0.06, -0.5, 0.05)  # upper
    box(bm, -0.05, 0.05, -0.045, 0.045, -0.85, -0.5)  # cannon
    parts = [link('horseCoat', bm, m['horseCoat'])]
    bm = bmesh.new()
    box(bm, -0.065, 0.075, -0.055, 0.055, -0.95, -0.85)
    parts.append(link('hoof', bm, m['hoof']))
    return join(parts, 'HorseLeg')


def guard(m):
    """A museum guard in a navy uniform and peaked cap, gold badge, legs and arms off (GuardLeg, GuardArm)."""
    parts = []
    bm = bmesh.new()
    box(bm, -0.17, 0.17, -0.25, 0.25, 0.75, 1.55)  # jacket
    parts.append(link('guardNavy', bm, m['guardNavy']))
    bm = bmesh.new()
    blob(bm, (0.16, 0.15, 0.18), (0.02, 0, 1.78), 10, 7)  # head
    box(bm, 0.16, 0.22, -0.03, 0.03, 1.72, 1.8)  # nose
    box(bm, -0.05, 0.05, -0.06, 0.06, 1.55, 1.63)  # neck
    parts.append(link('skinTan', bm, m['skinTan']))
    bm = bmesh.new()
    box(bm, -0.18, 0.18, -0.17, 0.17, 1.9, 2.02)  # cap crown
    box(bm, -0.2, 0.2, -0.19, 0.19, 2.02, 2.07)
    box(bm, 0.12, 0.3, -0.13, 0.13, 1.88, 1.91)  # peak
    box(bm, -0.18, 0.18, -0.26, 0.26, 0.75, 0.82)  # belt
    parts.append(link('guardCap', bm, m['guardCap']))
    bm = bmesh.new()
    box(bm, 0.17, 0.18, -0.2, -0.1, 1.35, 1.45)  # badge
    box(bm, 0.18, 0.21, -0.05, 0.05, 1.95, 2.0)  # cap badge
    parts.append(link('guardBadge', bm, m['guardBadge']))
    return join(parts, 'Guard')


def guard_leg(m):
    bm = bmesh.new()
    box(bm, -0.08, 0.08, -0.09, 0.09, -0.68, 0.0)
    parts = [link('guardNavy', bm, m['guardNavy'])]
    bm = bmesh.new()
    box(bm, -0.09, 0.16, -0.09, 0.09, -0.76, -0.66)
    parts.append(link('shoeBlack', bm, m['shoeBlack']))
    return join(parts, 'GuardLeg')


def guard_arm(m):
    bm = bmesh.new()
    box(bm, -0.06, 0.06, -0.06, 0.06, -0.6, 0.04)  # sleeve, from the shoulder down
    parts = [link('guardNavy', bm, m['guardNavy'])]
    bm = bmesh.new()
    blob(bm, (0.06, 0.06, 0.06), (0, 0, -0.65), 6, 4)  # hand
    parts.append(link('skinTan', bm, m['skinTan']))
    return join(parts, 'GuardArm')


def guard_pistol(m):
    """A black service pistol in the hand: the slide runs on down the arm past the fist, the grip in the palm."""
    bm = bmesh.new()
    box(bm, -0.032, 0.032, -0.028, 0.028, -0.92, -0.64)  # slide and barrel
    box(bm, -0.075, 0.0, -0.025, 0.025, -0.7, -0.62)  # grip, back from the slide
    parts = [link('shoeBlack', bm, m['shoeBlack'])]
    return join(parts, 'GuardPistol')


def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    m = {k: material(k, v) for k, v in COLORS.items()}
    obs = [wave(m), chariot(m), chariot_wheel(m), horse(m), horse_leg(m), guard(m), guard_leg(m), guard_arm(m), guard_pistol(m)]
    for i, ob in enumerate(obs):  # in a row in the file; the game reads each from its origin
        ob.location.x = i * 6
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
