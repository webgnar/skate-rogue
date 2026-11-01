# Gives the Meshy skaters (art/meshy/<name>.blend, the NEW models behind the DEV TOOLS switch) their own proportions
# back, and slims them.
#
#   blender -b -P art/meshy_refit.py -- webster keanu ...   (no names: all five)
#
# art/meshy_skater.py fitted each Meshy model onto the old rig: shoulders at the rig's, every limb stretched or
# squashed to the rig's bone lengths. The Meshy bodies have longer legs and shorter torsos than the rig, so the legs
# came out squashed and the torsos stretched (zack, 2026-11-01: "too chunky", "websters torso is too big", "since we
# had to shrink thier legs.. it looks all off"; the feet and the board are the focus). This undoes that on the fitted
# mesh, since the Meshy originals are gone: the hips and knees go back up to the model's own heights (MESHY's joint
# guesses, at the same scale as the fit), the torso shortens to match, the shoulders, arms, head and feet stay put.
# Then the torso, arms and legs are slimmed about their bones (SLIM). The rig's bones move with the mesh; the game
# reads each model's leg lengths and joint heights off its skeleton (skater-rig.ts bind), so Lou's clips still land the
# feet on the board.
#
# Run it once per model, on the model as meshy_skater.py left it (meshy_skater.py runs it): running it twice lifts the
# hips twice. It saves the .blend and exports public/models/meshy/<name>.glb. After painting or editing a new model,
# export it with --export, which changes nothing:
#
#   blender -b -P art/meshy_refit.py -- --export webster   (no names: all five)
import os
import sys

import bpy  # first: the bpy module provides mathutils
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lou_gnar as lg  # noqa: E402
import meshy_skater as ms  # noqa: E402
import skaters  # noqa: E402

HERE = os.path.join(lg.HERE, 'meshy')
OUT = os.path.join(lg.ROOT, 'public', 'models', 'meshy')

# how much of its width each part keeps: (across, front to back). The head, hands and feet keep theirs.
SLIM = {
    'torso': (0.8, 0.88),
    'arm': (0.8, 0.8),
    'leg': (0.84, 0.88),
}
# per skater, over SLIM (Webster's chest and shoulders were the biggest)
SLIM_SKATER = {
    'webster': {'torso': (0.74, 0.84), 'arm': (0.76, 0.78)},
}

ANKLE_Z = lg.ANKLE_Z  # meshy_skater put every ankle here; the feet stay


def part(bone):
    """Which part a bone moves: torso, leg, arm or None (kept as is)."""
    n = bone.name
    if n in ('Hips', 'Spine', 'Spine1'):
        return 'torso'
    if n.endswith(('UpLeg', 'Leg')):
        return 'leg'
    if n.endswith(('Arm', 'ForeArm')):
        return 'arm'
    if n.startswith('Spring'):  # hair and strings go where the bone they hang from goes
        b = bone
        while b.parent and b.parent.name.startswith('Spring'):
            b = b.parent
        return part(b.parent) if b.parent else None
    return None


def zmap(hip, knee):
    """Heights from the old rig's legs and torso to the model's: piecewise straight through the ankle, knee, hip and
    shoulder, nothing changes above the shoulders or below the ankle."""
    pts = [(ANKLE_Z, ANKLE_Z), (lg.KNEE_Z, knee), (lg.HIP_Z, hip), (lg.SHOULDER_Z, lg.SHOULDER_Z)]

    def f(z):
        if z <= pts[0][0] or z >= pts[-1][0]:
            return z
        for (a, fa), (b, fb) in zip(pts, pts[1:]):
            if z <= b:
                return fa + (fb - fa) * (z - a) / (b - a)
        return z

    return f


def mover(kind, slim, f):
    """Where a point of this part goes: slimmed about the part's bone line (straight down in the bind pose), then
    lifted by the height map."""
    if kind is None:
        return lambda p: p.copy()
    sx, sy = slim[kind]

    def go(p):
        if kind == 'torso':
            ax = 0.0
        elif kind == 'arm':
            ax = lg.ARM_X if p.x >= 0 else -lg.ARM_X
        else:
            ax = lg.HIP_X if p.x >= 0 else -lg.HIP_X
        z = p.z if kind == 'arm' else f(p.z)
        return Vector((ax + (p.x - ax) * sx, p.y * sy, z))

    return go


def export(name):
    """The open .blend to public/models/meshy (Lou with his clips, as art/lou_gnar.py does; the game plays the old
    lou-gnar.glb's)."""
    if name == 'lou-gnar':
        lg.GLB, lg.BLEND = os.path.join(OUT, 'lou-gnar.glb'), os.path.join(HERE, 'lou-gnar.blend')
        lg.export()
        return lg.GLB
    skaters.OUT = OUT
    return skaters.export(name)


def refit(name):
    spec = ms.MESHY[name]
    s = lg.SHOULDER_Z / spec['shoulder'][1]  # the fit's scale (meshy_skater build)
    hip, knee = spec['hip'][1] * s, spec['knee'][1] * s
    f = zmap(hip, knee)
    slim = {**SLIM, **SLIM_SKATER.get(name, {})}
    bpy.ops.wm.open_mainfile(filepath=os.path.join(HERE, f'{name}.blend'))
    rig = bpy.data.objects[spec.get('rig', f'{name}Rig')]
    ob = next(o for o in bpy.data.objects if o.type == 'MESH' and o.parent == rig and o.name == spec.get('object', o.name)
              and any(m.type == 'ARMATURE' for m in o.modifiers))
    kinds = {b.name: part(b) for b in rig.data.bones}
    moves = {k: mover(k, slim, f) for k in ('torso', 'leg', 'arm', None)}

    # the mesh: each vertex moved as its bones' parts move it, by weight (all in the bind pose, the rig at rest)
    names = {g.index: g.name for g in ob.vertex_groups}
    for v in ob.data.vertices:
        ws = [(kinds.get(names[g.group]), g.weight) for g in v.groups if g.weight > 0 and names.get(g.group) in kinds]
        total = sum(w for _, w in ws)
        if not total:
            continue
        p = Vector()
        for kind, w in ws:
            p += moves[kind](v.co) * (w / total)
        v.co = p

    # the bones: heads and tails moved the same way (each by its own part, so a joint stays on its bone line)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode='EDIT')
    # every new end worked out from the old ones first: moving a tail moves a connected child's head with it
    ends = {}
    for eb in rig.data.edit_bones:
        kind = kinds[eb.name]
        if kind in ('torso', 'leg'):  # bone lines stay on their axis: only the heights change
            ends[eb.name] = [Vector((p.x, p.y, f(p.z))) for p in (eb.head, eb.tail)]
        else:
            ends[eb.name] = [moves[kind](eb.head), moves[kind](eb.tail)]
    for eb in rig.data.edit_bones:
        eb.head, eb.tail = ends[eb.name]
    bpy.ops.object.mode_set(mode='OBJECT')
    print(f'{name}: hips {lg.HIP_Z:.3f} -> {hip:.3f}, knees {lg.KNEE_Z:.3f} -> {knee:.3f}, slim {slim}')

    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, f'{name}.blend'), compress=True)
    return export(name)


if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    for n in [a for a in args if not a.startswith('--')] or ms.MESHY:
        if '--export' in args:
            bpy.ops.wm.open_mainfile(filepath=os.path.join(HERE, f'{n}.blend'))
            print(export(n))
        else:
            print(refit(n))
