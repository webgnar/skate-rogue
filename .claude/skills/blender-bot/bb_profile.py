"""Bend a blocked-out creature onto a side outline traced from zack's reference
(zack, 2026-11-06: "your ability to trace is disappointing"). Nudging box sizes
toward a trace never made the model follow the line, so this moves the mesh
onto it.

The outline is a black-on-white PNG of the reference side on (art/reference/
<name>-outline.png). Column by column, from the rump to the nose, it gives the
line of the back and the line of the belly (the first gap under the back; where
a leg or the tail fills the column to the ground, the belly is filled in from
the columns either side). Every vert of the body, chest, neck and head then
keeps its place between the model's own back and belly at its y, but between
the outline's. The legs stretch or shrink between the ground and the new belly,
the ears ride the new top of the head and the tail root rides the rump. Only z
moves (and x a little, so a cross-section stays round), so the mirror holds.

How it holds together:
- the outline's ground is the feet line (ground_row; a drawing's tail can dip below it), and
  a fleck of white in the fur is not taken for the belly (min_gap);
- the creature is first stretched along y so rump to nose over feet to back is the drawing's;
- the start cube's long faces are cut up (refine) and big ngons split, so they can bend;
- each section is widened with its new depth (round_x, max_x) and bulged (bulge), so a box
  side bent onto a line does not stay a flat wall;
- wherever the skin then folds through itself, the move is backed off there (and on the
  mirror side) a step at a time until nothing crosses (back_off).

Call conform() after the blockout's runs, ears and legs, before the knives and
the clay. It moves the logged joints (C.J) and rings (C.R) as well, so the rig
and the paint follow. Score the fit by overlaying a side silhouette on the
drawing at the same ground line and height (the rat: body overlap 0.66 by hand,
0.85 with this)."""
import math
import numpy as np
from PIL import Image
from mathutils import Vector


def outline(path, nose='right', rump_frac=0.3, top_rows=0.75, ground_row=None, leg_margin=0.06):
    """read the traced outline: returns (u, top, bottom) with u 0 at the rump and 1
    at the nose, and top / bottom as heights over the ground, 1 at the highest point"""
    m = np.array(Image.open(path).convert('L')) < 128
    if nose == 'left': m = m[:, ::-1]
    H, W = m.shape
    rows = np.arange(H)
    has = m.any(0)
    top = np.where(has, np.argmax(m, 0), H)
    gap = np.full(W, -1.0)
    min_gap = max(2, int(0.03 * H))          # a speck of white in the fur is not the belly
    for x in range(W):
        if not has[x]: continue
        c = m[top[x]:, x]
        g = len(c)
        holes = np.where(~c)[0]
        for i in holes:
            if not c[i:i + min_gap].any(): g = i; break
        gap[x] = top[x] + g
    # the nose: the furthest column of the upper body; the rump: where the back has risen out of the tail
    upper = m[: int(H * top_rows)]
    xs = np.where(upper.any(0))[0]
    x1 = xs.max()
    # the ground is the line the feet stand on; a drawing's tail can dip below it, so pass it when it does
    ground = ground_row if ground_row is not None else np.percentile(np.where(m)[0], 99.5)
    peak = top[has].min()
    # a column whose first gap only opens at the ground is a leg (or the tail) filling it: take the belly
    # there from the columns either side
    ok = has & (gap < ground - leg_margin * (ground - peak))
    gap = np.where(ok, gap, np.nan)
    idx = np.arange(W)
    gap = np.interp(idx, idx[ok], gap[ok])
    # the rump: the first column where the back stands clear of the tail (a tail curling up behind
    # can be deep, but it never rises far off the ground)
    risen = np.where(has & (ground - top > rump_frac * (ground - peak)))[0]
    x0 = risen.min()
    u = np.linspace(0, 1, 101)
    cx = x0 + u * (x1 - x0)
    t = np.interp(cx, np.arange(W), top.astype(float))
    b = np.interp(cx, np.arange(W), gap)
    # smooth both lines (fur, whiskers)
    k = np.ones(5) / 5
    t = np.convolve(np.pad(t, 2, mode='edge'), k, 'valid')
    b = np.convolve(np.pad(b, 2, mode='edge'), k, 'valid')
    b = np.maximum(b, t + 1)
    h = lambda r: (ground - r) / (ground - peak)
    return u, h(t), h(b), (x1 - x0) / (ground - peak)


def conform(C, path, nose='right', body=('body', 'chest', 'neck', 'head'), legs=('leg',), ride_top=('ear',),
            tail=('tail',), round_x=0.5, ground=None, band=0.7, strength=1.0, ground_row=None, smooth=5, match_length=True, relax=0, relax_all=False, relax_reach=1, per_ring=True, refine=1.0, back_off=16, max_x=1.4, bulge=0.0, belly_min=0.0):
    bm = C.bm
    import bmesh
    if refine:
        # the start cube's long faces (rump to shoulders in one) can't bend to a line: cut them up
        # along y first (the cube's verts are region and limb 0, so the cuts are too)
        long_ = [e for e in bm.edges if all(v[C.REG] == 0 and v[C.LIMB] == 0 for v in e.verts)
                 and e.calc_length() > refine]
        if long_:
            n = max(1, int(max(e.calc_length() for e in long_) / refine))
            bmesh.ops.subdivide_edges(bm, edges=long_, cuts=n, use_grid_fill=True)
            bm.verts.ensure_lookup_table(); bm.faces.ensure_lookup_table()
    inv = {v: k for k, v in C.regions.items()}
    reg = lambda v: inv.get(v[C.REG], 'body') if v[C.REG] else 'body'
    B = [v for v in bm.verts if reg(v) in body]
    ys = np.array([v.co.y for v in B]); zs = np.array([v.co.z for v in B])
    y_nose, y_rump = ys.min(), ys.max()
    g = ground if ground is not None else min(v.co.z for v in bm.verts if reg(v) in legs)
    ztop = zs.max()
    u_o, top_o, bot_o, aspect = outline(path, nose, ground_row=ground_row)
    hgt = ztop - g
    if match_length:
        # stretch the whole creature along y so rump to nose over ground to back is the drawing's
        sy = aspect * hgt / (y_rump - y_nose)
        yc = 0.5 * (y_rump + y_nose)
        for v in bm.verts: v.co.y = yc + (v.co.y - yc) * sy
        for k in C.J: C.J[k] = [Vector((p.x, yc + (p.y - yc) * sy, p.z)) for p in C.J[k]]
        for k in C.R: C.R[k] = [[Vector((p.x, yc + (p.y - yc) * sy, p.z)) for p in ring] for ring in C.R[k]]
        ys = yc + (ys - yc) * sy
        y_nose, y_rump = ys.min(), ys.max()

    def target(y):
        u = (y_rump - y) / (y_rump - y_nose)
        u = min(1.0, max(0.0, u))
        # (the belly kept belly_min off the ground: a drawing's far legs and fur can read as belly
        # right down to the paws, and a belly on the ground leaves the legs nothing to swing in)
        return g + np.interp(u, u_o, top_o) * hgt, g + max(belly_min, np.interp(u, u_o, bot_o)) * hgt

    # the model's own back and belly, as smooth curves along y (a vert's neighbours alone jump about
    # from ring to ring, and a map that jumps folds faces through each other)
    yg = np.linspace(y_nose, y_rump, 64)
    ot_g = np.empty(64); ob_g = np.empty(64)
    for i, y in enumerate(yg):
        near = np.abs(ys - y) < band
        if near.sum() < 3: near = np.argsort(np.abs(ys - y))[:6]
        ot_g[i], ob_g[i] = zs[near].max(), zs[near].min()
    k = np.ones(smooth) / smooth; pad = smooth // 2
    ot_g = np.convolve(np.pad(ot_g, pad, mode='edge'), k, 'valid')
    ob_g = np.convolve(np.pad(ob_g, pad, mode='edge'), k, 'valid')

    def own(y):
        return float(np.interp(y, yg, ot_g)), float(np.interp(y, yg, ob_g))

    def body_z(p, y=None):
        y = p.y if y is None else y
        ot, ob = own(y)
        tt, tb = target(y)
        f = (p.z - ob) / max(1e-3, ot - ob)
        nz = tb + f * (tt - tb)
        sx = ((tt - tb) / max(1e-3, ot - ob)) ** round_x
        sx = min(max_x, max(0.7, sx))
        # and round the section out: a box side bent onto a line is still a flat wall
        sx *= 1 + bulge * math.sin(math.pi * min(1.0, max(0.0, f)))
        return p.z + (nz - p.z) * strength, 1 + (sx - 1) * strength

    def leg_z(p, root_y):
        # above the old belly the leg is inside the body and moves with it; below, it stretches
        # between the ground and the new belly
        ot, ob = own(root_y)
        tt, tb = target(root_y)
        nb = ob + (tb - ob) * strength
        if p.z >= ob:
            z, sx = body_z(p)
            return z, sx
        return g + (p.z - g) * (nb - g) / max(1e-3, ob - g), 1.0

    def top_shift(y):
        ot, ob = own(y); tt, tb = target(y)
        return (tt - ot) * strength

    # the moves, worked out on the rest positions before anything moves
    ring_y = {}
    for v in B:
        if v[C.RING]: ring_y.setdefault((v[C.LIMB], v[C.RING]), []).append(v.co.y)
    # (a ring spread far along y, or one whose verts don't sit between that y's back and belly,
    # keeps the per-vert map)
    ring_y = {k: sum(ys_) / len(ys_) for k, ys_ in ring_y.items() if max(ys_) - min(ys_) < 1.2 * band}
    moves = {}
    for v in bm.verts:
        r = reg(v)
        if r in body:
            # a ring moves as one, by the outline at its middle: rings are tilted, and mapping each
            # vert by its own y shears a ring through its neighbour where the outline turns fast
            yc = ring_y.get((v[C.LIMB], v[C.RING])) if per_ring and v[C.RING] else None
            if yc is not None:
                ot_, ob_ = own(yc)
                if not (ob_ - 0.3 <= v.co.z <= ot_ + 0.3): yc = None
            z, sx = body_z(v.co, yc); moves[v] = Vector((v.co.x * sx, v.co.y, z))
        elif r in ride_top:
            moves[v] = v.co + Vector((0, 0, top_shift(v.co.y)))
    limbs = {}
    for v in bm.verts:
        if reg(v) in legs: limbs.setdefault(v[C.LIMB], []).append(v)
    roots = {}
    for lid, vs in limbs.items():
        # the leg's root joint, so both sides of a pair map alike (and as the joints do)
        nm = next((n for n, i in C.limbs.items() if i == lid), None)
        roots[lid] = C.J[nm][0].y if nm in C.J and C.J[nm] else max(vs, key=lambda v: v.co.z).co.y
        for v in vs:
            z, sx = leg_z(v.co, roots[lid]); moves[v] = Vector((v.co.x * sx, v.co.y, z))
    rump_end = max(B, key=lambda v: v.co.y).co.y
    rump_shift = top_shift(rump_end) * 0 + (body_z(Vector((0, rump_end, own(rump_end)[1])))[0] - own(rump_end)[1])
    tz = [v.co.z for v in bm.verts if reg(v) in tail]
    tail_lift = (g - min(tz)) if tz else 0.0          # the part lying down rests on the feet's ground
    for v in bm.verts:
        if reg(v) in tail:
            # the tail root rides the rump, the part lying on the ground stays on it
            f = min(1.0, max(0.0, (v.co.z - g) / max(1e-3, own(rump_end)[1] - g)))
            moves[v] = v.co + Vector((0, 0, rump_shift * f + tail_lift * (1 - f)))
    # the joints, moved the same way
    newJ = {}
    for name, pts in C.J.items():
        out = []
        for p in pts:
            r = 'leg' if name.startswith(('front', 'hind')) else 'ear' if name.startswith('ear') else 'tail' if name == 'tail' else 'body'
            if r == 'body':
                z, _ = body_z(p); out.append(Vector((p.x, p.y, z)))
            elif r == 'ear':
                out.append(p + Vector((0, 0, top_shift(p.y))))
            elif r == 'leg':
                z, sx = leg_z(p, pts[0].y); out.append(Vector((p.x * sx, p.y, z)))
            else:
                f = min(1.0, max(0.0, (p.z - g) / max(1e-3, own(rump_end)[1] - g)))
                out.append(p + Vector((0, 0, rump_shift * f + tail_lift * (1 - f))))
        newJ[name] = out
    for k in C.R:
        if k in ('chest', 'neck', 'head', 'rump', 'body'):
            C.R[k] = [[Vector((p.x * body_z(p)[1], p.y, body_z(p)[0])) for p in ring] for ring in C.R[k]]
    # relax the moves over the mesh: neighbours that move very differently shear faces through each other
    d = {v: co - v.co for v, co in moves.items()}
    # only round the leg roots (where a leg's own stretch meets the body's), unless relax_all
    soft = set(d) if relax_all else {v for v in d if reg(v) in legs}
    if not relax_all:
        for _ in range(relax_reach):
            soft |= {e.other_vert(v) for v in list(soft) for e in v.link_edges if e.other_vert(v) in d}
    for _ in range(int(relax)):
        nd = dict(d)
        for v in soft:
            dv = d[v]
            nb = [d[e.other_vert(v)] for e in v.link_edges if e.other_vert(v) in d]
            if nb: nd[v] = dv * 0.5 + sum(nb, Vector()) * (0.5 / len(nb))
            else: nd[v] = dv
        d = nd
    # a big ngon (where a run left the start cube) bends out of plane and folds through its
    # neighbours: split it into a fan of quads and triangles
    big = [f for f in bm.faces if len(f.verts) > 4 and all(reg(v) in body for v in f.verts)]
    if big: bmesh.ops.triangulate(bm, faces=big, quad_method='BEAUTY', ngon_method='BEAUTY')
    base = {v: v.co.copy() for v in d}
    for v, dv in d.items(): v.co = v.co + dv
    # where the skin still folds through itself, back the move off there (and around it) a step at
    # a time until nothing crosses; everywhere else keeps the full fit
    k = {v: 1.0 for v in d}
    from mathutils.kdtree import KDTree
    vl = list(d); kd = KDTree(len(vl))
    for i, v in enumerate(vl): kd.insert(base[v], i)
    kd.balance()
    twin = {v: vl[kd.find(Vector((-base[v].x, base[v].y, base[v].z)))[1]] for v in vl}   # keep the mirror
    for it in range(back_off):
        x = C.crossings()
        if not x: break
        zone = set(x)
        for _ in range(2): zone |= {e.other_vert(v) for v in list(zone) for e in v.link_edges}
        zone |= {twin[v] for v in zone if v in twin}
        for v in zone:
            if v in k:
                k[v] *= 0.75; v.co = base[v] + d[v] * k[v]
    backed = sum(1 for v in k if k[v] < 1)
    for k, v in newJ.items(): C.J[k] = v
    bm.normal_update()
    return {'ground': g, 'top': ztop, 'nose': y_nose, 'rump': y_rump, 'aspect': aspect, 'backed_off': backed}
