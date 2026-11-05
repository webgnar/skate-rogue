"""The Blender bot's shared machinery: build a creature the way zack builds
(STYLE_GUIDE.md), so a new model is a short spec, not a copy of another script.

    from bb_lib import Creature, Painter, Rig

Creature  block out from ONE primitive by extrusion (mirror-true skeleton),
          knife shapes in and extrude them, then the clay pass (the only
          uneven step), then primitive accents. Checks the mirror.
Painter   one 256px Closest texture painted on the model: hard dabs and
          strokes, and bone marks laid over the skeleton from the side, front,
          back and above, so the paint is balanced in all three views.
Rig       bones from the creature's joint log, skinning by nearest bone (with
          per-part overrides such as a lower jaw), actions keyed on every frame.

Conventions: the model faces -Y, Z is up, X is its left/right (side -1 / +1).
Run with the bpy from PyPI: /opt/bpyenv/bin/python build_x.py -- <out dir> ...
"""
import bpy, bmesh, math, os, random
import numpy as np
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree


def _u(items):
    """unique, in first-seen order. Never a set of mesh elements: a set's order
    follows memory addresses, which change from run to run, and bmesh ops cut
    in the order they are handed geometry, so one seed built two different
    Skimmers (3 bad faces, then 0; 2026-11-04)"""
    return list(dict.fromkeys(items))


def hexc(h):
    return np.array([int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)], np.float32)


class Creature:
    """One mesh grown from one primitive. Vert layers it keeps for later:
    part   (int) an override bone for skinning, e.g. 1 = lower jaw
    acc    (int) which accent primitive a vert belongs to (paint fills it whole)
    region (int) which limb of the skeleton a vert grew along (bone paint)"""

    def __init__(self, seed=5, jit=0.5):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        self.sc = bpy.context.scene
        self.rng = random.Random(seed)
        self.jit = jit
        self.bm = bmesh.new()
        L = self.bm.verts.layers.int
        self.PART, self.ACCL, self.REG, self.LIMB = L.new("part"), L.new("acc"), L.new("region"), L.new("limb")
        self.RING = L.new("ring")                       # which ring of its limb a vert was made in (1 = the root)
        self.limbs = {}      # run name -> limb id, so one limb can be changed alone
        self.scars = []      # (point, direction, length) of every battle scar, for the paint
        self.seats = []      # (base point, direction, base radius, key, part) of every accent, for connect()
        self.regions = {'body': 0}
        self.acc_codes = {}
        self.J = {}          # joint logs: name -> [ring centres], the skeleton's path
        self.R = {}          # ring logs: name -> [[vert coords of each ring]]
        self.ACC = {}        # accent positions: key -> [Vector]

    # ---------- helpers ----------
    def hand(self, s=0.06):
        r = self.rng
        return Vector((r.gauss(0, s), r.gauss(0, s), r.gauss(0, s))) * self.jit

    def region_id(self, name):
        return self.regions.setdefault(name, len(self.regions))

    def acc_id(self, key):
        return self.acc_codes.setdefault(key, len(self.acc_codes) + 1)

    def face_where(self, normal, pick=lambda f: 0.0):
        n = Vector(normal).normalized()
        return max(self.bm.faces, key=lambda f: f.normal.dot(n) * 10 + pick(f))

    def on(self, region, f, part=0):
        """is face f in this region, and on this part (0: not the jaw)? A brow
        strip cut across the head must not catch the jaw's top inside the mouth,
        or the pull lifts it up through the skull (slop, 2026-11-04)"""
        rid = self.regions[region]
        return any(v[self.REG] == rid for v in f.verts) and \
            (part is None or all(v[self.PART] == part for v in f.verts))

    # ---------- 1. block out ----------
    def start_cube(self, size, at, round_long=1.15, round_plan=0, plan_segments=2):
        """the one primitive: a default cube scaled to (x, y, z) at `at`. round_long
        bevels the four edges running nose to tail so every tube extruded from the
        front and back faces has eight sides (0 keeps it square). round_plan
        bevels the four upright corners too, in plan_segments steps, so a flat
        creature's disc reads round from above instead of a box with wings
        bolted on (the Manta, 2026-11-04). Use it for anything wider or longer
        than it is tall that the camera sees from overhead"""
        bm = self.bm
        bmesh.ops.create_cube(bm, size=1.0)
        for v in bm.verts:
            v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2])) + Vector(at)
        if round_plan:
            up = [e for e in bm.edges if abs((e.verts[0].co - e.verts[1].co).normalized().z) > 0.9]
            bmesh.ops.bevel(bm, geom=up, offset=round_plan, offset_type='OFFSET',
                            segments=plan_segments, profile=0.5, affect='EDGES')
        if round_long:
            long_edges = [e for e in bm.edges if abs((e.verts[0].co - e.verts[1].co).normalized().y) > 0.9]
            bmesh.ops.bevel(bm, geom=long_edges, offset=round_long, offset_type='OFFSET',
                            segments=1, profile=0.5, affect='EDGES')
        self.origin = Vector(at)

    def run(self, face, steps, name=None, region=None, part=None, keep=None):
        """extrude `face` out step by step. step: (direction, distance, scale, squash_z).
        The new cap is turned to the direction, moved, scaled. No jitter: this is
        the skeleton and it stays mirror-true. keep=(z, sign, rings): the first
        `rings` rings stay on their side of the plane z (sign +1 above, -1 below),
        so two halves of one knifed face (skull and jaw) can flare without
        growing into each other. Logs ring centres in J[name] and ring
        verts in R[name]; tags every new vert with the region (and part)."""
        bm = self.bm
        if name: self.J.setdefault(name, []); self.R.setdefault(name, [])
        rid = self.region_id(region) if region else None
        lid = self.limbs.setdefault(name, len(self.limbs) + 1) if name else None
        ring_no = [0]
        def extrude(face, d, dist, s, sz, sxyz, k, log, slide=None):
            before = set(bm.verts) if part else None
            r = bmesh.ops.extrude_face_region(bm, geom=[face])
            nf = [e for e in r['geom'] if isinstance(e, bmesh.types.BMFace)][0]
            bmesh.ops.delete(bm, geom=[face], context='FACES_ONLY')   # the old cap would stay inside
            c = nf.calc_center_median(); n = nf.normal.copy()
            rot = n.rotation_difference(d).to_matrix()
            newc = c + d * dist + (slide if slide is not None else Vector())
            for v in nf.verts:
                off = rot @ (v.co - c)
                off *= s; off.z *= sz
                if sxyz is not None: off = Vector((off.x * sxyz.x, off.y * sxyz.y, off.z * sxyz.z))
                v.co = newc + off
            # hinge: a sharp turn swings the inside of the new ring back behind
            # the old cap, and the walls fold through each other (slop). Every
            # vert of the new ring stays ahead of the old cap's plane; the ring
            # slides forward along the old normal until it does.
            ahead = min((v.co - c).dot(n) for v in nf.verts)
            need = max(0.25 * dist, 0.15)
            if ahead < need:
                push = n * (need - ahead)
                for v in nf.verts: v.co += push
                newc = newc + push
                print("  HINGE", name, "ring pushed", round(need - ahead, 2))
            if keep and k < keep[2]:
                kz = keep[0] + keep[1] * 0.12          # a hair apart, never touching
                for v in nf.verts:
                    if (v.co.z - kz) * keep[1] < 0: v.co.z = kz
            if name and log:
                self.J[name].append(newc.copy())
                self.R[name].append([v.co.copy() for v in nf.verts])
            if rid is not None:
                for v in nf.verts: v[self.REG] = rid
            if lid is not None:
                ring_no[0] += 1
                for v in nf.verts: v[self.LIMB] = lid; v[self.RING] = ring_no[0]
            if part:
                for v in set(bm.verts) - before: v[self.PART] = part
            return nf
        for k, st in enumerate(steps):
            d, dist, s, sz = st[:4]
            sxyz = Vector(st[4]) if len(st) > 4 and st[4] is not None else None   # optional extra world-axis scale (x, y, z)
            slide = Vector(st[5]) if len(st) > 5 else None  # optional world offset for the ring, keeping its facing:
                                                             # a hip ring widened and moved out, still facing down
            d = Vector(d).normalized()
            bm.normal_update()
            n = face.normal.copy()
            if n.angle(d) > math.radians(70):
                # a knee: a turn this sharp gets a ring of its own at the bend,
                # half way round, so neither turn folds the walls (not logged:
                # the joint logs and bones keep the steps as written)
                c = face.calc_center_median()
                rad = sum((v.co - c).length for v in face.verts) / len(face.verts)
                face = extrude(face, (n + d).normalized(), max(rad * 0.5, 0.3), 1.0, 1.0, None, k, False)
            face = extrude(face, d, dist, s, sz, sxyz, k, True, slide)
        return face

    def gut(self, depth, hip, half=2.3, front=5.5, back=4.5, below=0.5, fade=3.0, swell=0.18):
        """a boss is fat (zack, 2026-11-04: "bosses are fat... the belly should be
        fatter"): sag the underside into a gut by moving verts, the way zack
        scales verts. The drop is `depth`, level for |y| < `half` under the
        hip block (so legs pulled from there start level and never fold), and
        fades out `front` units up the chest and `back` units into the tail
        root. Only verts below hip.z + `below` move, fully from `fade` under
        it, so the back line stays. x only swells, so the mirror holds. Call it
        after the chest and tail runs, before the legs."""
        for v in self.bm.verts:
            y = v.co.y
            off = max(0.0, -y - half) / front if y < 0 else max(0.0, y - half) / back
            w = max(0.0, 1.0 - off * off) ** 2
            t = min(1.0, max(0.0, (hip.z + below - v.co.z) / fade))
            if w * t > 0:
                v.co.z -= depth * w * t
                v.co.x *= 1.0 + swell * w * t
        self.bm.normal_update()

    def leg_patches(self, hip, y_half=2.0, x_cut=0.15, below=2.5):
        """legs that merge into the body (zack: "the legs should merge we
        shouldnt have segmented body parts"): the underside of the hip block
        and the bevel above it, knifed into a left and a right patch and each
        made one face. Returns {-1: face, 1: face}. Start each leg's run with
        a haunch step along the patch's OWN normal (no turn, so nothing folds),
        widened and slid out: (tuple(face.normal), 0.6, 1, 1, (1.3, 1.05, 1),
        (side * 0.4, 0, 0)). The thigh's outer wall then carries straight on up
        the flank, and the thigh turns down from there by under 30 degrees."""
        bm = self.bm
        bm.normal_update()
        under = [f for f in bm.faces if f.normal.z < -0.3 and f.calc_center_median().z < hip.z - below
                 and abs(f.calc_center_median().y) < y_half + 0.6]
        pats = self.knife_pair(under, [((0, y_half, 0), (0, 1, 0)), ((0, -y_half, 0), (0, -1, 0))], x_cut)
        for side in (-1, 1):
            fs = pats[side]
            pats[side] = fs[0] if len(fs) == 1 else bmesh.ops.dissolve_faces(bm, faces=fs)['region'][0]
        bm.normal_update()
        return pats

    def side_patch(self, side, region='body', min_dot=0.5):
        """the whole flank of a region as one face, to grow a wing or a fin
        out of: every face of it facing side (-1 left, +1 right) by more than
        min_dot, dissolved together. A wing grown from one face of a rounded
        disc came out narrow at the root and read bolted on (the Manta)"""
        bm = self.bm
        bm.normal_update()
        fs = [f for f in bm.faces if self.on(region, f) and f.normal.x * side > min_dot]
        if len(fs) == 1: return fs[0]
        out = bmesh.ops.dissolve_faces(bm, faces=fs)['region']
        bm.normal_update()
        return max(out, key=lambda f: f.calc_area())

    def split_face(self, face, plane_co, plane_no=(0, 0, 1)):
        """knife straight across one face; returns (below, above) along plane_no"""
        bm = self.bm
        bm.normal_update()
        fn, fc = face.normal.copy(), face.calc_center_median()
        size = max((v.co - fc).length for v in face.verts) * 2
        r = bmesh.ops.bisect_plane(bm, geom=[face] + list(face.edges) + list(face.verts),
                                   plane_co=plane_co, plane_no=plane_no)
        bm.normal_update()
        cand = _u([e for e in r['geom'] if isinstance(e, bmesh.types.BMFace)] + ([face] if face.is_valid else []))
        halves = [f for f in cand if f.normal.dot(fn) > 0.99
                  and abs((f.calc_center_median() - fc).dot(fn)) < 0.05
                  and (f.calc_center_median() - fc).length < size]
        halves.sort(key=lambda f: f.calc_center_median().dot(Vector(plane_no)))
        assert len(halves) == 2, len(halves)
        return halves[0], halves[1]

    def end_point(self, face, at):
        """close a tube's end to a point (a tail tip)"""
        bmesh.ops.pointmerge(self.bm, verts=list(face.verts), merge_co=Vector(at))

    # ---------- 2. knife shapes in, extrude them ----------
    def knife(self, faces, planes):
        """cut the faces by each plane (co, normal); returns the faces inside all of them"""
        bm = self.bm
        geom = _u(faces)
        for co, no in planes:
            g = geom + _u(e for f in geom for e in f.edges) + _u(v for f in geom for v in f.verts)
            r = bmesh.ops.bisect_plane(bm, geom=g, plane_co=co, plane_no=no)
            geom = _u([e for e in r['geom'] if isinstance(e, bmesh.types.BMFace)] + [f for f in geom if f.is_valid])
        return [f for f in geom if f.is_valid and all((f.calc_center_median() - Vector(co)).dot(Vector(no)) < 0 for co, no in planes)]

    def knife_pair(self, faces, planes, x_cut):
        """the mirror-safe knife for a feature on both sides (brows, cheek plates):
        cut the shared region by `planes`, then at x = -x_cut and +x_cut in one go,
        and return {-1: left faces, 1: right faces}. Knifing each side separately
        cuts shared edges in a different order and breaks the mirror."""
        bm = self.bm
        strip = self.knife(faces, planes)
        for side in (-1, 1):
            g = strip + _u(e for f in strip for e in f.edges) + _u(v for f in strip for v in f.verts)
            r = bmesh.ops.bisect_plane(bm, geom=g, plane_co=(side * x_cut, 0, 0), plane_no=(1, 0, 0))
            strip = _u([e for e in r['geom'] if isinstance(e, bmesh.types.BMFace)] + [f for f in strip if f.is_valid])
        return {side: [f for f in strip if f.is_valid and f.calc_center_median().x * side > x_cut] for side in (-1, 1)}

    def _tags_of(self, faces):
        """the limb, region, part and ring the faces' verts carry (the most
        common of each), for verts an op makes out of them"""
        def common(L, skip0=True):
            vals = [v[L] for f in faces for v in f.verts if not (skip0 and v[L] == 0)]
            return max(set(vals), key=vals.count) if vals else 0
        return {self.LIMB: common(self.LIMB), self.REG: common(self.REG),
                self.PART: common(self.PART), self.RING: common(self.RING)}

    def _retag(self, verts, tags, limb=None, region=None, part=None):
        """give new verts that an op left untagged (limb or region 0) the
        tags of the faces they came from, and set whatever is named outright,
        so the skin puts them on the bone that part moves with. Untagged verts
        went to the nearest BODY bone and tore away from the limb they sat on
        when it moved (the Flakmaw's maw rim and throat, 2026-11-04)"""
        named = {}
        if limb is not None: named[self.LIMB] = self.limbs[limb] if isinstance(limb, str) else limb
        if region is not None: named[self.REG] = self.region_id(region)
        if part is not None: named[self.PART] = part
        for v in verts:
            for L in (self.LIMB, self.REG):
                if v[L] == 0: v[L] = tags[L]
            for L, val in named.items(): v[L] = val

    def pull(self, faces, along, dist, shrink=1.0, limb=None, region=None, part=None):
        """extrude a knifed region out along a direction, shrinking its outline.
        The new verts carry the tags of the faces they came from (limb, region,
        part, ring); name limb/region/part to give them others"""
        bm = self.bm
        tags = self._tags_of(faces)
        r = bmesh.ops.extrude_face_region(bm, geom=faces)
        nv = [e for e in r['geom'] if isinstance(e, bmesh.types.BMVert)]
        bmesh.ops.delete(bm, geom=faces, context='FACES')
        self._retag(nv, tags, limb, region, part)
        c = sum((v.co for v in nv), Vector()) / len(nv)
        for v in nv:
            v.co = c + (v.co - c) * shrink + Vector(along) * dist
        return nv

    def inset(self, faces, thickness, depth=0.0, limb=None, region=None, part=None):
        """inset a region (a rim round a mouth, a socket): returns the inner
        faces. The new verts are tagged like pull's"""
        bm = self.bm
        tags = self._tags_of(faces)
        before = set(bm.verts)
        bmesh.ops.inset_region(bm, faces=faces, thickness=thickness, depth=depth)
        self._retag([v for v in bm.verts if v not in before], tags, limb, region, part)
        bm.normal_update()
        return [f for f in faces if f.is_valid]

    # ---------- the check, then the clay ----------
    def proportions(self, ref, head='head', jaw='jaw', tol=0.15):
        """hold the block-out to the reference drawing. `ref` holds ratios
        measured off zack's reference, each against the whole length nose to
        tail: head_len, head_depth (skull top to chin), body_depth (at the
        hips, gut included), height (top of the back to the soles). Prints
        each against the model and returns the ones off by more than `tol`
        (a fraction), so the build can stop before the paint. The Rex
        one-shot came out with half the head the reference has because
        nothing measured it (2026-11-04)."""
        vs = [v.co for v in self.bm.verts]
        L = max(v.y for v in vs) - min(v.y for v in vs)
        got = {}
        if head in self.R:
            hv = [p for r in self.R[head] for p in r] + [p for r in self.R.get(jaw, []) for p in r]
            got['head_len'] = (max(p.y for p in hv) - min(p.y for p in hv)) / L
            got['head_depth'] = (max(p.z for p in hv) - min(p.z for p in hv)) / L
        from mathutils.bvhtree import BVHTree
        t = BVHTree.FromBMesh(self.bm)
        o = self.origin
        top = t.ray_cast(Vector((0, o.y, 200)), Vector((0, 0, -1)))[0]
        bot = t.ray_cast(Vector((0, o.y, -200)), Vector((0, 0, 1)))[0]
        if top is not None and bot is not None: got['body_depth'] = (top.z - bot.z) / L
        got['height'] = (max(v.z for v in vs) - min(v.z for v in vs)) / L
        off = {}
        for k, want in ref.items():
            if k not in got: continue
            err = got[k] / want - 1
            print(f"  PROPORTION {k}: model {got[k]:.3f} reference {want:.3f} ({err:+.0%})")
            if abs(err) > tol: off[k] = err
        return off

    def mirror_error(self):
        bm = self.bm
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        kd = KDTree(len(bm.verts))
        for i, v in enumerate(bm.verts): kd.insert(v.co, i)
        kd.balance()
        err = max(kd.find(Vector((-v.co.x, v.co.y, v.co.z)))[2] for v in bm.verts)
        print("MIRROR max error before clay", round(err, 4))
        x = self.crossings()
        if x: print("  SKIN CROSSES ITSELF before the clay:", len(x), "verts, e.g.",
                    sorted({tuple(round(c, 1) for c in v.co) for v in x})[:6])
        if err > 1e-3:
            for v in bm.verts:
                d = kd.find(Vector((-v.co.x, v.co.y, v.co.z)))[2]
                if d > 0.05: print("  ASYM", tuple(round(c, 2) for c in v.co), "region", v[self.REG])
        return err

    def clay(self, jitter=0.05, lumps=7, box=((-3, 3), (-8, 14), (6, 15)), lump_r=(1.5, 3.0), lump_amt=(-0.22, 0.28)):
        """the ONLY uneven step: a light vertex jitter and a few soft lumps pushed
        in or out along the surface. Call after mirror_error()."""
        bm, rng = self.bm, self.rng
        bm.normal_update()
        before = {v: v.co.copy() for v in bm.verts}
        for v in bm.verts:
            v.co += self.hand(jitter)
        L = [(Vector([rng.uniform(*b) for b in box]), rng.uniform(*lump_r), rng.uniform(*lump_amt)) for _ in range(lumps)]
        for v in bm.verts:
            for c, r, amt in L:
                d = (v.co - c).length
                if d < r:
                    v.co += v.normal * amt * (1 - d / r) ** 2
        # the clay must not fold a thin part (a chin, a toe) through itself:
        # wherever it made the skin cross itself, those verts go back
        back = 0
        for _ in range(6):
            bad = self.crossings()
            if not bad: break
            for v in bad: v.co = before[v].copy(); back += 1
        if back: print("  CLAY put back", back, "verts that folded the skin")
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        self._bvh = BVHTree.FromBMesh(bm)

    def crossings(self):
        """verts of body faces that pass through other, non-neighbouring body
        faces: the skin crossing itself (the slop check's 'intersect')"""
        bm = self.bm
        bm.faces.ensure_lookup_table()
        tree = BVHTree.FromBMesh(bm)
        out = set()
        for i, j in tree.overlap(tree):
            if i >= j: continue
            fi, fj = bm.faces[i], bm.faces[j]
            if set(fi.verts) & set(fj.verts): continue
            if any(v[self.ACCL] for v in fi.verts) or any(v[self.ACCL] for v in fj.verts): continue
            out |= set(fi.verts) | set(fj.verts)
        return out

    # ---------- the personality pass: after the clay, before the accents ----------
    # zack (2026-11-04): "bring out more attention to the forms by adding a
    # personality to the creature.. maybe one arms slightly longer than the
    # other... maybe it has a battle scar somewhere odd on its body". The
    # skeleton was mirror-true at the check; this pass breaks it ON PURPOSE,
    # once or twice, and the joint logs move with it so the bones follow.
    def lengthen(self, name, factor):
        """stretch one limb from its root by factor (1.12 = 12 percent longer)"""
        pts = self.J[name]
        root = pts[0]
        lid = self.limbs[name]
        def chain_point(p):
            best, bd = pts[0], 1e9
            for a, b in zip(pts, pts[1:]):
                ab = b - a; t = max(0, min(1, (p - a).dot(ab) / max(ab.length_squared, 1e-9)))
                q = a + ab * t; d = (p - q).length
                if d < bd: best, bd = q, d
            return best
        for v in self.bm.verts:
            if v[self.LIMB] == lid:
                v.co += (chain_point(v.co) - root) * (factor - 1)
        self.J[name] = [root + (p - root) * factor for p in pts]
        self.R[name] = [[root + (q - root) * factor for q in ring] for ring in self.R[name]]
        self._bvh = BVHTree.FromBMesh(self.bm)

    def scar(self, origin, toward, direction, length, width=0.3, depth=0.35, reach=2.5):
        """a battle scar: a thin slash knifed into the surface where a ray from
        `origin` along `toward` lands, running along `direction`, and pushed in"""
        bm = self.bm
        hit = self._bvh.ray_cast(Vector(origin), Vector(toward).normalized())
        if hit[0] is None:
            print("SCAR missed", origin); return
        p, n = hit[0], hit[1]
        d = (Vector(direction) - n * Vector(direction).dot(n)).normalized()
        side = n.cross(d).normalized()
        bm.faces.ensure_lookup_table()
        near = [f for f in bm.faces if f.normal.dot(n) > 0.3 and min((v.co - p).length for v in f.verts) < max(reach, length)]
        if hit[2] is not None: near.append(bm.faces[hit[2]])
        near = _u(near)
        planes = [(p + side * width, side), (p - side * width, -side),
                  (p + d * length / 2, d), (p - d * length / 2, -d)]
        cut = self.knife(near, planes)
        print("SCAR", tuple(round(c, 1) for c in p), "faces", len(cut))
        if cut:
            self.pull(cut, -n, depth, shrink=0.8)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        self._bvh = BVHTree.FromBMesh(bm)
        self.scars.append((p.copy(), d.copy(), length))

    # ---------- 3. primitive accents ----------
    def skin(self, o, d):
        """where a ray from o along d meets the body (after the clay)"""
        return self._bvh.ray_cast(Vector(o), Vector(d).normalized())[0]

    def _tag(self, made, key, part):
        code = self.acc_id(key)
        for v in made['verts']:
            v[self.ACCL] = code
            if part: v[self.PART] = part

    def cone(self, at, direction, r, h, key, sides=4, part=0):
        bm = self.bm
        d = Vector(direction).normalized()
        m = Matrix.Translation(Vector(at) + d * h / 2) @ Vector((0, 0, 1)).rotation_difference(d).to_matrix().to_4x4()
        self._tag(bmesh.ops.create_cone(bm, cap_ends=True, segments=sides, radius1=r, radius2=0.0, depth=h, matrix=m), key, part)
        self.ACC.setdefault(key, []).append(Vector(at))
        self.seats.append((Vector(at), d, r, key, part))

    def ball(self, at, r, key, part=0):
        self._tag(bmesh.ops.create_icosphere(self.bm, subdivisions=1, radius=r, matrix=Matrix.Translation(Vector(at))), key, part)
        self.ACC.setdefault(key, []).append(Vector(at))
        self.seats.append((Vector(at), None, r, key, part))

    def box(self, matrix, key, part=0, at=None):
        self._tag(bmesh.ops.create_cube(self.bm, size=1.0, matrix=matrix), key, part)
        self.ACC.setdefault(key, []).append(Vector(at) if at is not None else matrix.translation.copy())

    # ---------- the final pass: everything visually connected ----------
    def connect(self, tol=0.08, sink=0.12):
        """zack (2026-11-04): "the final pass should be making sure everything is
        visually connected. look for seperate meshes for accents that should be
        seated within the body ... instead of moving them into the body, extrude
        out from the body to meet them". For every accent whose base floats off
        the body, knife a patch on the body under it and extrude that patch out
        to the accent's base. The accent never moves."""
        bm = self.bm
        bm.normal_update()
        body = [f for f in bm.faces if all(v[self.ACCL] == 0 for v in f.verts)]
        made = 0
        for at, d, r, key, part in self.seats:
            bm.verts.index_update()
            # a jaw tooth seats on the jaw, never on the skull across the open mouth
            mine = [f for f in body if max(v[self.PART] for v in f.verts) == part]
            bvh = BVHTree.FromPolygons([v.co.copy() for v in bm.verts], [[v.index for v in f.verts] for f in mine])
            base = at
            hit = bvh.find_nearest(base)
            if hit[0] is None: continue
            q, n = hit[0], hit[1]
            gap = (base - q).dot(n)
            if d is None: gap -= r * 0.6                # a ball is seated when it is sunk to about half
            if gap <= tol: continue                     # already inside or touching the body
            if gap > max(4 * r, 1.2):                   # a pillar that long is a misplaced accent, not a seat
                print("  MISPLACED", key, "gap", round(gap, 2), "- move it onto the skin (C.skin)"); continue
            print("  floating", key, "gap", round(gap, 2))
            target = base - (d * sink if d is not None else (base - q).normalized() * r * 0.5)
            t1 = n.cross(Vector((0, 0, 1)) if abs(n.z) < 0.9 else Vector((1, 0, 0))).normalized()
            t2 = n.cross(t1).normalized()
            w = max(r * 0.9, 0.2)
            near = [f for f in mine if f.is_valid and f.normal.dot(n) > 0.2 and min((v.co - q).length for v in f.verts) < max(3 * w, 2.0)]
            if hit[2] is not None and hit[2] < len(mine) and mine[hit[2]].is_valid: near.append(mine[hit[2]])
            patch = self.knife(_u(near), [(q + t1 * w, t1), (q - t1 * w, -t1), (q + t2 * w, t2), (q - t2 * w, -t2)])
            if not patch: continue
            reg = max(v[self.REG] for f in patch for v in f.verts)
            if len(patch) > 1:
                region = bmesh.ops.dissolve_faces(bm, faces=patch)['region']
                live = [f for f in region if f.is_valid] or [f for f in patch if f.is_valid]
                if not live: continue
                cap = min(live, key=lambda f: (f.calc_center_median() - q).length)
            else:
                cap = patch[0]
            before = self._crossings(q, 3 * max(w, gap))
            ring0 = list(cap.verts)
            r_ = bmesh.ops.extrude_face_region(bm, geom=[cap])
            nf = [e for e in r_['geom'] if isinstance(e, bmesh.types.BMFace)][0]
            home = [(v, v.co.copy()) for v in nf.verts]
            bmesh.ops.delete(bm, geom=[cap], context='FACES_ONLY')
            c = nf.calc_center_median()
            for v in nf.verts:                          # the cap goes to the accent's base, at its size
                v.co = target + (v.co - c) * (r * 0.85 / max(w, 1e-6))
                v[self.REG] = reg
                if part: v[self.PART] = part
            bm.normal_update()
            if self._crossings(q, 3 * max(w, gap)) > before:
                # the socket runs through the body's own skin (two claws on a
                # narrow foot tip: the Skimmer, 2026-11-04). Take it back out
                # and leave the accent where it is; slop_check shows it if it
                # floats
                for v, co in home: v.co = co            # back onto the ring it came from,
                bmesh.ops.remove_doubles(bm, verts=_u([v for v, _ in home] + ring0), dist=1e-5)   # and merged into it
                bm.normal_update()
                print("  SOCKET dropped", key, "(it crossed the body)")
                body = [f for f in bm.faces if f.is_valid and all(v[self.ACCL] == 0 for v in f.verts)]
                continue
            body = [f for f in bm.faces if f.is_valid and all(v[self.ACCL] == 0 for v in f.verts)]
            made += 1
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        print("CONNECT sockets extruded", made, "of", len(self.seats), "accents")
        return made

    def _crossings(self, at, reach):
        """body faces within reach of a point that pass through other body
        faces (not neighbours): the check a new socket must not raise"""
        bm = self.bm
        bm.verts.index_update()
        body = [f for f in bm.faces if f.is_valid and all(v[self.ACCL] == 0 for v in f.verts)
                and (f.calc_center_median() - at).length < reach]
        if len(body) < 2: return 0
        t = BVHTree.FromPolygons([v.co.copy() for v in bm.verts], [[v.index for v in f.verts] for f in body])
        return sum(1 for i, j in t.overlap(t) if i < j and not (set(body[i].verts) & set(body[j].verts)))

    # ---------- out ----------
    def to_object(self, name="Cube"):
        """the mesh keeps its primitive's name, as zack's do; flat shaded, smart UV"""
        bm = self.bm
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        me = bpy.data.meshes.new(name)
        bm.to_mesh(me); bm.free()
        ob = bpy.data.objects.new(name, me)
        self.sc.collection.objects.link(ob)
        for p in me.polygons: p.use_smooth = False
        bpy.context.view_layer.objects.active = ob
        ob.select_set(True)
        bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
        # PAINTING.md (zack approved, 2026-11-04): 80 degrees, islands at one
        # scale, packed tight, so the texture is used 50 percent, not 34
        bpy.ops.uv.smart_project(angle_limit=math.radians(80), island_margin=0.01)
        bpy.ops.uv.average_islands_scale()
        bpy.ops.uv.pack_islands(rotate=True, rotate_method='ANY', scale=True, margin_method='FRACTION',
                                margin=0.004, shape_method='CONCAVE')
        bpy.ops.object.mode_set(mode='OBJECT')
        print("TRIS", sum(len(p.vertices) - 2 for p in me.polygons), "VERTS", len(me.vertices))
        self.ob, self.me = ob, me
        return ob, me


class Painter:
    """The 100 percent pass on a 256px texture, painted onto the surface. Every
    texel knows its 3D point, normal, accent and region, so marks can be laid
    by anatomy rather than by UV."""

    def __init__(self, creature, base, size=1024):     # 1024 for a boss, 512 for a smaller enemy (PAINTING.md)
        cr = self.cr = creature
        me = cr.me
        S = self.S = size
        self.rng = cr.rng
        self.pos = np.zeros((S, S, 3), np.float32); self.nrm = np.zeros((S, S, 3), np.float32)
        self.mask = np.zeros((S, S), bool)
        self.acc = np.zeros((S, S), np.int32); self.reg = np.zeros((S, S), np.int32)
        V = np.array([v.co for v in me.vertices], np.float32); uvl = me.uv_layers.active.data
        A = me.attributes["acc"].data; Rg = me.attributes["region"].data
        for poly in me.polygons:
            li = list(poly.loop_indices); vi = list(poly.vertices); n = np.array(poly.normal)
            a_code = max(A[i].value for i in vi); r_code = max(Rg[i].value for i in vi)
            for k in range(1, len(li) - 1):
                tri = [0, k, k + 1]
                uv = np.array([uvl[li[j]].uv for j in tri]) * S
                mn = np.floor(uv.min(0)).astype(int) - 1; mx = np.ceil(uv.max(0)).astype(int) + 1
                xs, ys = np.meshgrid(np.arange(mn[0], mx[0] + 1) + 0.5, np.arange(mn[1], mx[1] + 1) + 0.5)
                (x0, y0), (x1, y1), (x2, y2) = uv
                den = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2)
                if abs(den) < 1e-9: continue
                w0 = ((y1 - y2) * (xs - x2) + (x2 - x1) * (ys - y2)) / den
                w1 = ((y2 - y0) * (xs - x2) + (x0 - x2) * (ys - y2)) / den
                w2 = 1 - w0 - w1
                ins = (w0 >= -0.03) & (w1 >= -0.03) & (w2 >= -0.03)
                ids = [vi[j] for j in tri]
                P = w0[..., None] * V[ids[0]] + w1[..., None] * V[ids[1]] + w2[..., None] * V[ids[2]]
                px = (xs - 0.5).astype(int); py = (ys - 0.5).astype(int)
                ok = ins & (px >= 0) & (px < S) & (py >= 0) & (py < S)
                self.pos[py[ok], px[ok]] = P[ok]; self.nrm[py[ok], px[ok]] = n; self.mask[py[ok], px[ok]] = True
                self.acc[py[ok], px[ok]] = a_code; self.reg[py[ok], px[ok]] = r_code
        self.img = np.zeros((S, S, 3), np.float32); self.img[:] = hexc(base) if isinstance(base, str) else base
        self.bvh = BVHTree.FromPolygons([v.co.copy() for v in me.vertices], [list(p.vertices) for p in me.polygons])
        self.PX, self.PY, self.PZ = self.pos[..., 0], self.pos[..., 1], self.pos[..., 2]
        self.NX, self.NY, self.NZ = self.nrm[..., 0], self.nrm[..., 1], self.nrm[..., 2]
        self.V = V

    def col(self, c):
        return hexc(c) if isinstance(c, str) else c

    def region(self, *names):
        """texels on these limbs of the skeleton (names given to Creature.run)"""
        m = np.zeros_like(self.mask)
        for n in names:
            if n in self.cr.regions: m |= self.reg == self.cr.regions[n]
        return m

    # ---------- rays ----------
    def from_above(self, x, y): return self.bvh.ray_cast(Vector((x, y, 80)), Vector((0, 0, -1)))[0]
    def from_below(self, x, y): return self.bvh.ray_cast(Vector((x, y, -20)), Vector((0, 0, 1)))[0]
    def from_side(self, side, y, z): return self.bvh.ray_cast(Vector((side * 60, y, z)), Vector((-side, 0, 0)))[0]
    def top_z(self, y, default=0.0): p = self.from_above(0, y); return p.z if p is not None else default
    def bot_z(self, y, default=0.0): p = self.from_below(0, y); return p.z if p is not None else default

    # ---------- brush ----------
    def dab(self, p, r, col, facing=None):
        q = self.bvh.find_nearest(Vector(p))[0]
        q = q if q is not None else Vector(p)
        d = np.linalg.norm(self.pos - np.array(q, np.float32), axis=2)
        m = self.mask & (d < r)
        if facing is not None:
            m &= (self.nrm @ np.array(facing, np.float32)) > 0.15
        self.img[m] = self.col(col)

    def stroke(self, points, r, col, facing=None, wobble=0.12):
        pts = [Vector(p) for p in points if p is not None]
        for a, b in zip(pts, pts[1:]):
            n = max(1, int((b - a).length / (r * 0.6)))
            for i in range(n + 1):
                self.dab(a.lerp(b, i / n) + self.cr.hand(wobble), r * self.rng.uniform(0.85, 1.1), col, facing)

    def broad(self, y0, y1, col, from_='above', r=1.6, step=0.5):
        """broad hard dabs dragged down the top (a darker back) or the underside (a pale belly)"""
        for y in np.arange(y0, y1, step):
            x = self.rng.gauss(0, 0.3)
            p = self.from_above(x, y) if from_ == 'above' else self.from_below(x, y)
            if p is not None:
                self.dab(p, r, col, facing=(0, 0, 1) if from_ == 'above' else (0, 0, -1))

    # ---------- bone marks, seen from a direction ----------
    def _wob(self, pts, s=0.07):
        g = self.rng.gauss
        return [(a + g(0, s), b + g(0, s)) for a, b in pts]

    @staticmethod
    def _line_mask(A, B, pts, w):
        d = np.full(A.shape, 1e9, np.float32)
        for (ay, az), (by, bz) in zip(pts, pts[1:]):
            vy, vz = by - ay, bz - az; L = vy * vy + vz * vz + 1e-9
            t = np.clip(((A - ay) * vy + (B - az) * vz) / L, 0, 1)
            d = np.minimum(d, np.hypot(A - (ay + vy * t), B - (az + vz * t)))
        return d < w

    def side_line(self, pts_yz, w, col, where, side):
        """a bone seen from the side: polyline in (y, z) on the faces turned to `side`"""
        m = self.mask & where & self._line_mask(self.PY, self.PZ, self._wob(pts_yz), w) & (self.NX * side > 0.15) & (self.PX * side > 0)
        self.img[m] = self.col(col)

    def side_oval(self, cy, cz, ry, rz, col, where, side, tilt=0.0):
        """a window or plate seen from the side (skull openings, a hip plate)"""
        c, s_ = math.cos(tilt), math.sin(tilt)
        g = self.rng.gauss
        dy, dz = self.PY - cy - g(0, 0.05), self.PZ - cz - g(0, 0.05)
        u, v = dy * c + dz * s_, -dy * s_ + dz * c
        m = self.mask & where & ((u / ry) ** 2 + (v / rz) ** 2 < 1) & (self.NX * side > 0.1) & (self.PX * side > 0)
        self.img[m] = self.col(col)

    def view_line(self, pts3, w, col, where, view):
        """a bone seen from the front (faces turned to -Y) or the back (+Y): polyline in (x, z)"""
        face = (self.NY < -0.15) if view == 'front' else (self.NY > 0.15)
        m = self.mask & where & self._line_mask(self.PX, self.PZ, self._wob([(p.x, p.z) for p in pts3]), w) & face
        self.img[m] = self.col(col)

    def top_line(self, pts_xy, w, col, where):
        """a bone seen from above: polyline in (x, y) on the upward faces"""
        m = self.mask & where & self._line_mask(self.PX, self.PY, self._wob(pts_xy, 0.04), w) & (self.NZ > 0.3)
        self.img[m] = self.col(col)

    def spine_bars(self, path, col, where, every=1.3, width=1.1, taper_from=None, taper=0.04):
        """a bar across the back at every vertebra along a path of joints, so the
        spine reads from the front and back as well as the side"""
        for a, b in zip(path, path[1:]):
            n = max(1, int((b - a).length / every))
            for i in range(n):
                q = a.lerp(b, (i + 0.5) / n)
                w = width if taper_from is None or q.y < taper_from else max(0.35, width - (q.y - taper_from) * taper)
                self.top_line([(q.x - w, q.y), (q.x + w, q.y)], 0.2, col, where)

    def paint_scars(self, core, edge):
        """each battle scar: a dark gash with pale scar tissue stitched across it"""
        for p, d, length in self.cr.scars:
            a, b = p - d * length / 2, p + d * length / 2
            self.stroke([a, b], 0.16, core, wobble=0.02)
            n = max(2, int(length / 0.45))
            side = d.cross(Vector((0, 0, 1)))
            side = side.normalized() if side.length > 1e-3 else Vector((1, 0, 0))
            for i in range(1, n):
                q = a.lerp(b, i / n)
                self.stroke([q - side * 0.35, q + side * 0.35], 0.08, edge, wobble=0.02)

    # ---------- finish ----------
    def accents(self, colours):
        """each accent primitive takes its colour whole: {key: colour}"""
        for key, c in colours.items():
            code = self.cr.acc_codes.get(key)
            if code: self.img[self.acc == code] = self.col(c)

    def save(self, out_dir, name):
        from scipy import ndimage
        from PIL import Image
        img, mask = self.img, self.mask.copy()
        for _ in range(4):                     # bleed past the island edges so Closest never samples the gap
            grown = ndimage.binary_dilation(mask)
            nb = ndimage.maximum_filter(img * mask[..., None], size=(3, 3, 1))
            img[grown & ~mask] = nb[grown & ~mask]; mask = grown
        png = os.path.join(out_dir, name + ".png")
        Image.fromarray((np.flipud(np.clip(img, 0, 1)) * 255).astype(np.uint8)).save(png)
        mat = bpy.data.materials.new("Material.001"); mat.use_nodes = True
        nt = mat.node_tree; bsdf = nt.nodes['Principled BSDF']
        # matte: a glossy hand-painted model mirrors the grey sky as grey patches
        bsdf.inputs['Roughness'].default_value = 1.0
        if 'Specular IOR Level' in bsdf.inputs: bsdf.inputs['Specular IOR Level'].default_value = 0.0
        tex = nt.nodes.new('ShaderNodeTexImage'); tex.image = bpy.data.images.load(png); tex.image.filepath = "//" + name + ".png"
        tex.interpolation = 'Closest'
        nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color']); self.cr.me.materials.append(mat)
        return png


class Rig:
    """bones named after the game's pivots, skinned by nearest bone, actions keyed every frame"""

    def __init__(self, creature):
        self.cr = creature
        sc = creature.sc
        self.arm = bpy.data.armatures.new("Armature"); self.ao = bpy.data.objects.new("Armature", self.arm)
        sc.collection.objects.link(self.ao)
        bpy.context.view_layer.objects.active = self.ao
        bpy.ops.object.mode_set(mode='EDIT')
        self.segs = {}; self.limb_of = {}

    def bone(self, name, head, tail, parent=None, limb=None, hinge=False):
        """limb: the run name (C.run(..., name=)) this bone drives; only that
        limb's verts are skinned to it, and that limb's verts to nothing else.
        hinge=True: the limb swings on a hinge rather than growing out of the
        body (a wing, a fin, a flap), so its root ring stays wholly on the
        parent bone. Shared half and half, as a grown limb's is, every
        wingbeat dragged the thorax's flank up and down and creased it (the
        Harrier, 2026-11-04). Put the hinged bone's head a little out past the
        root ring, so the beat turns about the stalk, not about the body."""
        b = self.arm.edit_bones.new(name); b.head = Vector(head); b.tail = Vector(tail)
        if parent: b.parent = self.arm.edit_bones[parent]
        self.limb_of[name] = limb
        if hinge and limb is not None:
            if not hasattr(self, 'hinged'): self.hinged = {}
            self.hinged.setdefault(limb, parent)          # the first bone of the limb names the body bone
        return name

    def chain(self, base, points, parent, limb=None):
        """a bone between each pair of points: base, base.001, ..."""
        prev = parent
        for i in range(len(points) - 1):
            name = base if i == 0 else f"{base}.{i:03d}"
            self.bone(name, points[i], points[i + 1], prev, limb); prev = name
        return prev

    def skin(self, part_bones=None, skip=()):
        """bind the mesh: a vert whose `part` is in part_bones goes to that bone,
        every other vert to its nearest bone (never to those in skip or part_bones)"""
        self.segs = {b.name: (b.head.copy(), b.tail.copy()) for b in self.arm.edit_bones}
        self.parent = {b.name: (b.parent.name if b.parent else None) for b in self.arm.edit_bones}
        bpy.ops.object.mode_set(mode='OBJECT')
        part_bones = part_bones or {}
        me, ob = self.cr.me, self.cr.ob
        part = me.attributes["part"].data
        free = [n for n in self.segs if n not in skip and n not in part_bones.values()]
        # a limb's verts go to that limb's bones only, the body's to body bones
        # only: nearest-bone alone gave hip verts to a leg, and the body tore
        # when the leg swung (slop in the walk, 2026-11-04)
        lid = {lid: nm for nm, lid in self.cr.limbs.items()}
        limb = me.attributes["limb"].data; acc = me.attributes["acc"].data; ringd = me.attributes["ring"].data
        from mathutils.kdtree import KDTree
        skin_v = [v for v in me.vertices if not acc[v.index].value]
        kd = KDTree(len(skin_v))
        for v in skin_v: kd.insert(v.co, v.index)
        kd.balance()
        def limb_name(v):
            i = v.index
            if acc[i].value: i = kd.find(v.co)[1]      # an accent rides the skin it sits on
            return lid.get(limb[i].value)
        pools = {}
        def pool(ln):
            if ln not in pools:
                own = [n for n in free if self.limb_of.get(n) == ln and ln is not None]
                pools[ln] = own or [n for n in free if self.limb_of.get(n) is None]
            return pools[ln]
        def seg_dist(p, a, b):
            ab = b - a; t = max(0, min(1, (p - a).dot(ab) / max(ab.length_squared, 1e-9)))
            return (p - (a + ab * t)).length
        # a ring that sits on a joint (as near the next bone as its own) is
        # shared between the two, by distance: 50/50 right on the joint. A ring
        # given wholly to one bone creases there when the joint bends
        linked = lambda a, b: self.parent.get(a) == b or self.parent.get(b) == a
        groups = {}
        for v in me.vertices:
            pb = part_bones.get(part[v.index].value)
            if pb:
                groups.setdefault(pb, []).append((v.index, 1.0)); continue
            cand = sorted(pool(limb_name(v)), key=lambda n: seg_dist(v.co, *self.segs[n]))
            n1 = cand[0]; d1 = seg_dist(v.co, *self.segs[n1])
            n2 = next((n for n in cand[1:] if linked(n, n1)), None)
            par = self.parent.get(n1)
            hinged = getattr(self, 'hinged', {})
            if ringd[v.index].value == 1 and not acc[v.index].value and self.limb_of.get(n1) in hinged \
                    and hinged[self.limb_of[n1]] in free:
                groups.setdefault(hinged[self.limb_of[n1]], []).append((v.index, 1.0)); continue   # a hinge: root on the body
            if par in free and self.limb_of.get(n1) and ringd[v.index].value == 1 and not acc[v.index].value:
                # a limb's root ring is shared half and half with the body bone
                # it grows out of, so the body bends with it instead of tearing
                groups.setdefault(n1, []).append((v.index, 0.5))
                groups.setdefault(par, []).append((v.index, 0.5)); continue
            d2 = seg_dist(v.co, *self.segs[n2]) if n2 else None
            if n2:                                       # only a ring right at the joint is shared
                h1, t1_ = self.segs[n1]; h2, t2_ = self.segs[n2]
                jp = min(((a, b) for a in (h1, t1_) for b in (h2, t2_)), key=lambda ab: (ab[0] - ab[1]).length)[0]
                ax = (t1_ - h1).normalized() if (t1_ - h1).length > 1e-6 else Vector((0, 1, 0))
                if abs((v.co - jp).dot(ax)) > max(0.6, 0.12 * (t1_ - h1).length): n2 = None
            if n2 and d2 < d1 * 1.25 + 0.05 and not acc[v.index].value:
                w1 = (d2 + 1e-6) / (d1 + d2 + 2e-6)
                groups.setdefault(n1, []).append((v.index, w1))
                groups.setdefault(n2, []).append((v.index, 1 - w1))
            else:
                groups.setdefault(n1, []).append((v.index, 1.0))
        # the skin next to a part (the throat under the jaw) is shared with the
        # part's bone, so opening the jaw stretches it instead of creasing it
        pv = {v.index: part_bones[part[v.index].value] for v in me.vertices if part[v.index].value in part_bones}
        edge_pb = {}
        for e in me.edges:
            a, b = e.vertices
            if (a in pv) != (b in pv):
                o, q = (b, a) if a in pv else (a, b)
                if not acc[o].value: edge_pb[o] = pv[q]
        if edge_pb:
            for n in list(groups):
                groups[n] = [(i, w * 0.5) if i in edge_pb else (i, w) for i, w in groups[n]]
            for i, n in edge_pb.items(): groups.setdefault(n, []).append((i, 0.5))
        for n, vs in groups.items():
            g = ob.vertex_groups.new(name=n)
            for i, w in vs: g.add([i], w, 'ADD')
        ob.parent = self.ao
        md = ob.modifiers.new("Armature", 'ARMATURE'); md.object = self.ao
        self.ao.animation_data_create()
        for pb in self.ao.pose.bones: pb.rotation_mode = 'XYZ'

    def act(self, name, length, pose):
        """pose(bone_name, phase 0..1) -> (rotation degrees xyz, location); keyed on every frame.
        +X tips a forward-pointing bone's far end DOWN: +X opens a jaw, -X shuts it
        (a negative jaw angle once slammed the Tyrant's jaw up through its skull)"""
        ao = self.ao
        if not hasattr(self, 'poses'): self.poses = {}
        self.poses[name] = (length, pose)
        a = bpy.data.actions.new(name); ao.animation_data.action = a
        for f in range(0, length + 1):
            ph = f / length
            for pb in ao.pose.bones:
                r, loc = pose(pb.name, ph)
                pb.rotation_euler = [math.radians(x) for x in r]; pb.location = loc
                pb.keyframe_insert("rotation_euler", frame=f); pb.keyframe_insert("location", frame=f)
        a.use_fake_user = True
        tr = ao.animation_data.nla_tracks.new(); tr.name = name; tr.strips.new(name, 0, a)

    def save(self, out_dir, name):
        self.ao.animation_data.action = None
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out_dir, name + ".blend"))
        print("SAVED")

    # ---------- joints that hold when the animation plays ----------
    def fix_joints(self, rounds=5, grows=(1.0, 1.06, 1.12, 1.2)):
        """zack (2026-11-04): "loop cutting body parts and scaling bigger just
        enough to make sure there are none of these slop sections of holes in
        the geometry... WHEN ANIMATIONS PLAY". Plays every action and finds the
        faces that cross the skin or turn inside out in a pose. At each joint
        those faces sit on it tries a loop cut of the seam (the ring of edges
        running from one bone's verts to the next bone's), the new ring weighted
        half to each bone and scaled up a step at a time, and keeps the smallest
        swell that leaves fewer bad faces in every frame and none at rest. A cut
        that does not help is undone. Returns the bad faces left."""
        ob, ao, me = self.cr.ob, self.ao, self.cr.me
        def score():                                    # bad AREA, so a cut that splits a bad
            res = posed_slop(ob, ao)                    # face in three is not counted as worse
            area = sum(me.polygons[i].area for v in res.values() for i in v[2])
            return round(area + 10 * rest_crossings(me) + 10 * len(rest_pokes(me)), 3), res
        best, res = score()
        print("JOINTS start", best, {k: (v[0], len(v[1])) for k, v in res.items()})
        tried = set()
        for r in range(rounds):
            if not best: break
            tried = set()                               # a joint may take a second cut next round
            bad = set().union(*(v[2] for v in res.values()))
            joints = [j for j in self._joints_near(bad) if j not in tried]
            if not joints: break
            for j in joints:
                tried.add(j)
                keep = me.copy()
                pick = None
                for cuts, g in [(c, g) for c in (1, 3) for g in grows]:
                    if not self._cut_seams(j, g, cuts): break
                    sc_, res_ = score()
                    if sc_ < best: best, res, pick = sc_, res_, (cuts, g); break   # the least that helps
                    _restore(me, keep)
                if pick is None: _restore(me, keep)
                else: print("  loop cut", "/".join(sorted(j)), "cuts, swell", pick, "->", best)
                bpy.data.meshes.remove(keep)
                if not best: break
        print("JOINTS left", best, {k: (v[0], len(v[1])) for k, v in res.items()})
        return best

    def soften(self, factor=0.9, floor=0.8, rounds=14):
        """the last resort after fix_joints (SKILL: "a pose drives a limb through
        the body: soften that pose"): for each action that still has bad faces,
        scale down the swing of the bones at the joints those faces sit on, one
        joint at a time, by `factor` a round, never under `floor` of the
        original, keeping a step only when the slop shrinks. Prints what it
        softened; the walk still walks, a bite still bites, a little less far."""
        ob, ao, me = self.cr.ob, self.ao, self.cr.me
        scale = {}                                       # (action, bone) -> factor so far
        def rekey(act):
            length, pose = self.poses[act]
            def scaled(n, ph, pose=pose, act=act):
                r, loc = pose(n, ph); k = scale.get((act, n), 1.0)
                return tuple(x * k for x in r), loc
            old = bpy.data.actions.get(act)
            for tr in list(ao.animation_data.nla_tracks):
                if tr.name == act: ao.animation_data.nla_tracks.remove(tr)
            if old: bpy.data.actions.remove(old)
            keep = self.poses[act]
            self.act(act, length, scaled)
            self.poses[act] = keep
        def score():
            res = posed_slop(ob, ao)
            return round(sum(me.polygons[i].area for v in res.values() for i in v[2]), 3), res
        best, res = score()
        for _ in range(rounds):
            if not best: break
            moved = False
            for act, (wf, fb, anyb) in list(res.items()):
                if not anyb: continue
                for j in self._joints_near(anyb):
                    for bone in sorted(j):
                        k0 = scale.get((act, bone), 1.0)
                        k = k0 * factor
                        while k >= floor and not moved:       # a step that does not help may still
                            scale[(act, bone)] = k; rekey(act)  # lead to one further down that does
                            sc_, res_ = score()
                            if sc_ < best:
                                best, res, moved = sc_, res_, True
                                print(f"  SOFTEN {act} {bone} x{k:.2f} -> {best}")
                            k *= factor
                        if moved: break
                        scale[(act, bone)] = k0; rekey(act)
                    if moved: break
                if moved: break
            if not moved: break
        for tr in ao.animation_data.nla_tracks: tr.mute = False
        print("SOFTEN left", best, {k: (v[0], len(v[1])) for k, v in res.items()})
        return best

    def _joints_near(self, bad_faces):
        """bone pairs whose seam runs through or beside the bad faces, most first"""
        ob, me = self.cr.ob, self.cr.me
        gname = {g.index: g.name for g in ob.vertex_groups}
        vb = [gname[max(v.groups, key=lambda g: g.weight).group] if v.groups else None for v in me.vertices]
        near = set()
        for i in bad_faces:
            for v in me.polygons[i].vertices: near.add(v)
        for e in me.edges:
            a, b = e.vertices
            if a in near or b in near: near |= {a, b}
        count = {}
        for e in me.edges:
            a, b = e.vertices
            if (a in near or b in near) and vb[a] and vb[b] and vb[a] != vb[b]:
                k = frozenset((vb[a], vb[b])); count[k] = count.get(k, 0) + 1
        return sorted(count, key=lambda k: -count[k])

    def _cut_seams(self, joint, grow, cuts=1):
        """loop cut either side of a joint and swell it: the ring the two bones
        share (weighted to both) gets a new ring cut into the band on each side,
        its weights interpolated along the band, and the shared ring is scaled
        up by `grow` round its centre, so a bend does not pinch it thin. Where
        two bones meet with no shared ring (a jaw), the band between them is cut
        and weighted by where each new ring sits along it."""
        ob, me = self.cr.ob, self.cr.me
        gid = {g.name: g.index for g in ob.vertex_groups}
        A, B = (gid[n] for n in sorted(joint))
        bm = bmesh.new(); bm.from_mesh(me)
        mark = bm.verts.layers.int.new("_joint")       # (a new layer drops every BMVert handle: first)
        dl = bm.verts.layers.deform.verify(); acc = bm.verts.layers.int.get("acc")
        isacc = lambda v: bool(acc and v[acc])
        shared = [v for v in bm.verts if not isacc(v) and A in v[dl] and B in v[dl]
                  and min(v[dl][A], v[dl][B]) > 0.2]
        def bone_of(v):
            w = v[dl]
            return max(w.items(), key=lambda kv: kv[1])[0] if w else None
        if shared:
            ring = set(shared)
            band = [e for e in bm.edges if (e.verts[0] in ring) != (e.verts[1] in ring)
                    and not isacc(e.verts[0]) and not isacc(e.verts[1])
                    and all(set(u[dl].keys()) <= {A, B} for u in e.verts)]
            if not band: bm.free(); return 0
            segs = [(dict(e.verts[0][dl].items()), dict(e.verts[1][dl].items()), e.verts[0].co.copy(), e.verts[1].co.copy()) for e in band]
            for v in shared: v[mark] = 1
            res = bmesh.ops.subdivide_edges(bm, edges=band, cuts=cuts, use_grid_fill=False)
            for v in [x for x in res['geom_inner'] if isinstance(x, bmesh.types.BMVert)]:
                best = None
                for w0, w1, c0, c1 in segs:
                    ab = c1 - c0; t = (v.co - c0).dot(ab) / max(ab.length_squared, 1e-12)
                    d = (v.co - (c0 + ab * t)).length
                    if best is None or d < best[0]: best = (d, min(1, max(0, t)), w0, w1)
                _, t, w0, w1 = best
                v[dl].clear()
                for g in set(w0) | set(w1):
                    w = w0.get(g, 0) * (1 - t) + w1.get(g, 0) * t
                    if w > 1e-3: v[dl][g] = w
            shared = [v for v in bm.verts if v[mark]]
            c = sum((v.co for v in shared), Vector()) / len(shared)
            for v in shared: v.co = c + (v.co - c) * grow
            bm.verts.layers.int.remove(mark); bm.to_mesh(me); me.update(); bm.free()
            return len(band)
        seams = [e for e in bm.edges
                 if not isacc(e.verts[0]) and not isacc(e.verts[1])
                 and len(e.verts[0][dl]) == 1 and len(e.verts[1][dl]) == 1
                 and {bone_of(e.verts[0]), bone_of(e.verts[1])} == {A, B}]
        if not seams: bm.free(); return 0
        segs = []
        for e in seams:
            a, b = (e.verts[0], e.verts[1]) if bone_of(e.verts[0]) == A else (e.verts[1], e.verts[0])
            segs.append((a.co.copy(), b.co.copy()))
        res = bmesh.ops.subdivide_edges(bm, edges=seams, cuts=cuts, use_grid_fill=False)
        ring = [v for v in res['geom_inner'] if isinstance(v, bmesh.types.BMVert)]
        mids = []
        for v in ring:
            best = None
            for pa, pb in segs:
                ab = pb - pa; t = (v.co - pa).dot(ab) / max(ab.length_squared, 1e-12)
                d = (v.co - (pa + ab * t)).length
                if best is None or d < best[0]: best = (d, min(1, max(0, t)))
            t = best[1]
            v[dl].clear(); v[dl][A] = 1 - t; v[dl][B] = t
            mids.append((v, 1 - abs(2 * t - 1)))        # 1 in the middle of the band, 0 at its ends
        c = sum((v.co for v in ring), Vector()) / len(ring)
        for v, m in mids: v.co = c + (v.co - c) * (1 + (grow - 1) * m)
        bm.verts.layers.int.remove(mark); bm.to_mesh(me); me.update(); bm.free()
        return len(ring)


def _restore(me, src):
    bm = bmesh.new(); bm.from_mesh(src); bm.to_mesh(me); me.update(); bm.free()


def rest_pokes(me):
    """accent edges that cross the body skin in and out again further apart
    than a graze at the seat: a tooth through a jaw, a claw through a toe"""
    acc = me.attributes.get("acc")
    if acc is None: return set()
    accd = [d.value for d in acc.data]
    polys = [list(p.vertices) for p in me.polygons]
    body = [p for p in polys if not any(accd[v] for v in p)]
    tree = BVHTree.FromPolygons([v.co for v in me.vertices], body)
    out = set()
    for e in me.edges:
        a, b = e.vertices
        if not (accd[a] and accd[b]): continue
        a0, a1 = me.vertices[a].co, me.vertices[b].co
        d = a1 - a0; L = d.length
        if L < 1e-6: continue
        d = d / L; o = a0.copy(); ts = []; t = 0.0
        while len(ts) < 5 and t < L:
            h = tree.ray_cast(o, d, L - t)
            if h[0] is None: break
            t += (h[0] - o).length; ts.append(t); t += 1e-3; o = h[0] + d * 1e-3
        if any(y - x > 0.2 for x, y in zip(ts, ts[1:])): out.add(e.index)
    return out


def rest_crossings(me):
    """body faces that pass through each other in the rest pose"""
    acc = me.attributes.get("acc")
    accd = [d.value for d in acc.data] if acc else [0] * len(me.vertices)
    polys = [list(p.vertices) for p in me.polygons]
    body = [i for i, p in enumerate(polys) if not any(accd[v] for v in p)]
    tree = BVHTree.FromPolygons([v.co for v in me.vertices], [polys[i] for i in body])
    n = 0
    for i, j in tree.overlap(tree):
        a, b = body[i], body[j]
        if a < b and not (set(polys[a]) & set(polys[b])): n += 1
    return n


# a fold this much sharper in a pose than at rest is a crease. zack turned it
# down from 50 (2026-11-04: "turn down the slop detector to let the animations
# be more free"): a joint may fold hard; only a fold past a right angle beyond
# rest counts. Holes stay strict: skin through skin and inside-out faces are
# caught at any angle. SLOP_CREASE_DEG overrides it for a run.
CREASE_DEG = float(os.environ.get("SLOP_CREASE_DEG", 90))


def posed_slop(ob, ao, step=1):
    """play every action and find the slop the animation makes: body faces that
    pass through each other and faces that turn inside out against their bone.
    Returns {action: (worst frame, faces bad on that frame, faces bad on any frame)}"""
    sc = bpy.context.scene
    me = ob.data
    acc = me.attributes.get("acc")
    accd = [d.value for d in acc.data] if acc else [0] * len(me.vertices)
    polys = [list(p.vertices) for p in me.polygons]
    body = [i for i, p in enumerate(polys) if not any(accd[v] for v in p)]
    vsets = [set(p) for p in polys]
    gname = {g.index: g.name for g in ob.vertex_groups}
    vbone = [gname[max(v.groups, key=lambda g: g.weight).group] if v.groups else None for v in me.vertices]
    rest_n = [p.normal.copy() for p in me.polygons]
    rest = {b.name: b.matrix_local.copy() for b in ao.data.bones}
    # creases: two body faces across an edge that fold much sharper in a pose
    # than at rest (zack, 2026-11-04: "its rear abdomen ridge at the top needs
    # another vert" in the Hailcaster walk)
    ef = {}
    for i in body:
        p = polys[i]
        for k in range(len(p)):
            ef.setdefault(tuple(sorted((p[k], p[(k + 1) % len(p)]))), []).append(i)
    pairs = [fs for fs in ef.values() if len(fs) == 2]
    rest_fold = [rest_n[a].angle(rest_n[b], 0.0) for a, b in pairs]
    mute = [(tr, tr.mute) for tr in ao.animation_data.nla_tracks]
    for tr, _ in mute: tr.mute = True
    keep = ao.animation_data.action
    out = {}
    for act in [a for a in bpy.data.actions if a.use_fake_user]:
        ao.animation_data.action = act
        f0, f1 = (int(x) for x in act.frame_range)
        worst, wf, anyf = -1, f0, set()
        for f in range(f0, f1 + 1, step):
            sc.frame_set(f)
            dg = bpy.context.evaluated_depsgraph_get()
            em = ob.evaluated_get(dg).to_mesh()
            co = [v.co.copy() for v in em.vertices]
            pn = [p.normal.copy() for p in em.polygons]
            ob.evaluated_get(dg).to_mesh_clear()
            bad = set()
            tree = BVHTree.FromPolygons(co, [polys[i] for i in body])
            for i, j in tree.overlap(tree):
                a, b = body[i], body[j]
                if a < b and not (vsets[a] & vsets[b]): bad.add(a); bad.add(b)
            for i in body:                                # inside out against its own bone
                bn = vbone[polys[i][0]]
                if bn is None: continue
                pb = ao.pose.bones[bn]
                m = (pb.matrix @ rest[bn].inverted()).to_3x3()
                if (m @ rest_n[i]).dot(pn[i]) < 0: bad.add(i)
            for (a, b), r0 in zip(pairs, rest_fold):
                if pn[a].length > 0 and pn[b].length > 0 and pn[a].angle(pn[b], 0.0) - r0 > math.radians(CREASE_DEG):
                    bad.add(a); bad.add(b)
            anyf |= bad
            if len(bad) > worst: worst, wf, wbad = len(bad), f, set(bad)
        out[act.name] = (wf, wbad, anyf)
    ao.animation_data.action = keep
    for tr, m in mute: tr.mute = m
    sc.frame_set(0)
    return out


def ease(x):
    return x * x * (3 - 2 * x)
