# Copied from webgnar/underground-LA tools/blender/game_ready.py (2026-11-01), unchanged below this note: its Meshy
# reduce-and-bake pass, run by art/meshy_skater.py. Keep it in step with that repo rather than editing it here.
"""Makes a Meshy model game-ready (run inside Blender, see tools/make_game_models.py).

  blender -b -P tools/blender/game_ready.py -- <config.json>

The config (written by make_game_models.py) says, for one model: the source
.glb, where the .glb goes, its real size, which way it faces, how much to
reduce it, and (the Glock) how to split it into parts.

What it does:
  - joins the mesh, turns it so its front faces Godot's -Z, scales it to its
    real size (meters), and puts its origin at the bottom center (props) or
    the center (the Glock)
  - welds the mesh's texture seams shut (Meshy splits it at every seam), so
    it's one closed surface with no cracks
  - keeps Meshy's triangles when the model is within its budget
    (target_tris); a denser one is reduced, unwrapped fresh, and the
    full-detail model's color, metal/roughness and normals are baked onto it
  - drops Meshy's textures from the .glb: they ship as JPGs next to it, and a
    Godot material (.tres) uses them, so Godot doesn't unpack big PNGs
  - the Glock: cuts the slide, frame and magazine floorplate from the shell
    (the cuts closed off: a hollow slide, an open magazine well) and builds
    the parts a shell doesn't have (barrel, recoil spring, locking block,
    trigger housing, pins, magazine body), sized to a real Glock 26
"""
import bpy
import bmesh
import json
import math
import sys
from mathutils import Vector, Matrix

cfg = json.load(open(sys.argv[sys.argv.index('--') + 1]))


# --- HELPERS ---

def material(name, color, metallic=0.0, roughness=0.5):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*color, 1.0)
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = roughness
    return mat


def new_object(name, bm, mat):
    mesh = bpy.data.meshes.new(name)
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.materials.append(mat)
    return obj


def box(name, lo, hi, mat):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector(((lo[i] + hi[i]) / 2 + v.co[i] * (hi[i] - lo[i]) for i in range(3)))
    return new_object(name, bm, mat)


def cylinder(name, a, b, radius, mat, segments=20):
    """A cylinder from point a to point b."""
    a, b = Vector(a), Vector(b)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=segments, radius1=radius, radius2=radius, depth=(b - a).length)
    rot = (b - a).to_track_quat('Z', 'Y').to_matrix().to_4x4()
    bmesh.ops.transform(bm, matrix=Matrix.Translation((a + b) / 2) @ rot, verts=bm.verts)
    return new_object(name, bm, mat)


def join(objs, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    objs[0].name = name
    objs[0].data.name = name
    return objs[0]


def tris(obj):
    return sum(len(p.vertices) - 2 for p in obj.data.polygons)


def smooth(obj, degrees=35.0):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(degrees))


# --- LOAD ---

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=cfg['source'])
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
shell = join(meshes, cfg['name']) if len(meshes) > 1 else meshes[0]
for o in list(bpy.data.objects):
    if o is not shell:
        bpy.data.objects.remove(o)
shell.parent = None
shell.name = shell.data.name = cfg['name']
bpy.context.view_layer.objects.active = shell
shell.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
# Tilt (degrees about X): a rug Meshy made standing up lies down, a gun
# standing on its grip lies on its side
if cfg.get('tilt'):
    shell.data.transform(Matrix.Rotation(math.radians(cfg['tilt']), 4, 'X'))
source_tris = tris(shell)

# Join the seams: Meshy splits the mesh wherever the texture (UV) map is cut,
# so it's thousands of loose patches that only line up. Welded, it's one
# closed surface (the UVs stay as they were), and nothing done to it later
# can open cracks along those seams. The .glb export splits them again where
# it has to, at exactly the same positions.
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.remove_doubles(threshold=1e-5)
bpy.ops.object.mode_set(mode='OBJECT')

# --- REDUCE AND BAKE (only models over their triangle budget) ---
# Most of Meshy's models come dense (up to millions of triangles). Those are
# rebuilt the game way: a reduced copy of the welded (closed) mesh, unwrapped
# fresh, and the full-detail model's color, metal/roughness and surface
# normals baked onto it. The detail lives on in the textures; with new UVs
# there are no stretched seams, and with the mesh closed, no cracks.

def drop_specks(obj, min_faces):
    """Deletes the loose bits under min_faces faces. Meshy's dense models
    carry thousands of floating specks; remeshed, each is a little blob that
    would take the reduced model's triangles from the real surface."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    seen = set()
    drop = []
    for f in bm.faces:
        if f in seen:
            continue
        piece, stack = [], [f]
        seen.add(f)
        while stack:
            g = stack.pop()
            piece.append(g)
            for e in g.edges:
                for h in e.link_faces:
                    if h not in seen:
                        seen.add(h)
                        stack.append(h)
        if len(piece) < min_faces:
            drop += piece
    bmesh.ops.delete(bm, geom=drop, context='FACES')
    bm.to_mesh(obj.data)
    bm.free()


def bake_to_low(high, target, sizes, out_dir):
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    sc.cycles.device = 'CPU'
    sc.cycles.samples = 2
    sc.render.bake.margin = 8
    low = high.copy()
    low.data = high.data.copy()
    high.name = high.data.name = cfg['name'] + '_high'
    low.name = low.data.name = cfg['name']
    bpy.context.scene.collection.objects.link(low)
    bpy.ops.object.select_all(action='DESELECT')
    low.select_set(True)
    bpy.context.view_layer.objects.active = low
    if not cfg.get('remesh'):
        mod = low.modifiers.new('Decimate', 'DECIMATE')
        mod.ratio = min(1.0, target / max(tris(high), 1))
        mod.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=mod.name)
    if cfg.get('remesh') or tris(low) > target * 1.5:
        # A tangled mesh (pegboard holes, faces sharing edges three ways) won't
        # reduce, and one made of many small loose pieces reduces to scraps:
        # rebuild its surface as a clean closed shell first (voxels about
        # 1/350 of its size), then reduce. The holes and fine detail still
        # come through, baked from the full-detail model.
        low.data = high.data.copy()
        remesh = low.modifiers.new('Remesh', 'REMESH')
        remesh.mode = 'VOXEL'
        remesh.voxel_size = max(high.dimensions) / 350
        bpy.ops.object.modifier_apply(modifier=remesh.name)
        drop_specks(low, 300)
        mod = low.modifiers.new('Decimate', 'DECIMATE')
        mod.ratio = min(1.0, target / max(tris(low), 1))
        mod.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=mod.name)
    while low.data.uv_layers:
        low.data.uv_layers.remove(low.data.uv_layers[0])
    low.data.uv_layers.new(name='UVMap')
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.003, correct_aspect=True)
    bpy.ops.object.mode_set(mode='OBJECT')
    bpy.ops.mesh.customdata_custom_splitnormals_clear()
    smooth(low, 40)

    # The low model's bake targets
    bake_mat = bpy.data.materials.new('bake')
    bake_mat.use_nodes = True
    low.data.materials.clear()
    low.data.materials.append(bake_mat)
    target_node = bake_mat.node_tree.nodes.new('ShaderNodeTexImage')
    bake_mat.node_tree.nodes.active = target_node

    # The high model's maps, found through its material
    hm = high.data.materials[0]
    nt = hm.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    out = next(n for n in nt.nodes if n.type == 'OUTPUT_MATERIAL')
    def source(socket_name):
        link = next((l for l in nt.links if l.to_socket == bsdf.inputs[socket_name]), None)
        node = link.from_node if link else None
        while node is not None and node.type != 'TEX_IMAGE':
            ins = [l for l in nt.links if l.to_node == node]
            node = ins[0].from_node if ins else None
        return node
    base_img, mr_img = source('Base Color'), source('Roughness')
    emit = nt.nodes.new('ShaderNodeEmission')

    extent = max(high.dimensions)
    def bake(kind, size, noncolor, name, from_node=None):
        img = bpy.data.images.new(name, size, size, alpha=False)
        if noncolor:
            img.colorspace_settings.name = 'Non-Color'
        target_node.image = img
        if from_node is not None:
            nt.links.new(from_node.outputs['Color'], emit.inputs['Color'])
            nt.links.new(emit.outputs['Emission'], out.inputs['Surface'])
        else:
            nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
        bpy.ops.object.select_all(action='DESELECT')
        high.select_set(True)
        low.select_set(True)
        bpy.context.view_layer.objects.active = low
        # Rays start 2% of the model's size out from the reduced surface and
        # look up to 8% (or the model's own 'ray') for the original: fine
        # parts drift further when reduced, and a missed ray bakes black
        bpy.ops.object.bake(type=kind, use_selected_to_active=True, cage_extrusion=extent * 0.02,
                            max_ray_distance=extent * cfg.get('ray', 0.08), margin=8, use_clear=True)
        img.filepath_raw = f'{out_dir}/{name}.png'
        img.file_format = 'PNG'
        img.save()

    albedo_size, normal_size, mr_size = sizes
    if base_img:
        bake('EMIT', albedo_size, False, 'albedo', base_img)
    if mr_img:
        bake('EMIT', mr_size, True, 'metal_rough', mr_img)
    bake('NORMAL', normal_size, True, 'normal')
    bpy.data.objects.remove(high)
    return low


if cfg.get('keep_uvs') and source_tris > cfg['target_tris'] * 1.15:
    # Reduced as it is, keeping Meshy's own UVs and textures (no bake): for
    # a model built of thin sheets and many loose pieces, whose reduced copy
    # unwraps into thousands of scraps (a blurry bake) and whose remesh
    # opens holes in the thin walls. A tangled mesh can stall a pass, so up
    # to three.
    drop_specks(shell, 50)
    for _ in range(3):
        if tris(shell) <= cfg['target_tris'] * 1.1:
            break
        mod = shell.modifiers.new('Decimate', 'DECIMATE')
        mod.ratio = cfg['target_tris'] / tris(shell)
        mod.use_collapse_triangulate = True
        bpy.context.view_layer.objects.active = shell
        bpy.ops.object.modifier_apply(modifier=mod.name)
elif cfg.get('target_tris') and source_tris > cfg['target_tris'] * 1.15:
    shell = bake_to_low(shell, cfg['target_tris'], cfg['bake_sizes'], cfg['bake_dir'])

# The shell's material is the one the .tres replaces
shell_mat = material(cfg['name'], (0.8, 0.8, 0.8))
shell.data.materials.clear()
shell.data.materials.append(shell_mat)

parts = [shell]

# --- THE GLOCK: PARTS ---
# Worked in the source's own units (1.906 long, muzzle at -X, Z up); the whole
# gun is scaled to 165 mm afterwards. Real Glock 26 sizes, in these units:
# 1 mm = 0.01155.

if cfg.get('glock_parts'):
    steel = material('gun_steel', (0.07, 0.07, 0.075), 0.85, 0.35)
    barrel_steel = material('gun_barrel', (0.16, 0.16, 0.17), 0.9, 0.3)
    polymer = material('gun_polymer', (0.045, 0.045, 0.05), 0.0, 0.7)
    brass = material('brass', (0.78, 0.56, 0.25), 1.0, 0.3)
    spring = material('spring_steel', (0.35, 0.35, 0.37), 1.0, 0.4)

    SLIDE_CUT = 0.33         # the slide/frame seam
    FLOORPLATE_CUT = -0.54   # the magazine floorplate, under the grip

    def split(obj, height, name_above):
        """Cuts obj at a height; what's above becomes a new object."""
        bpy.ops.object.select_all(action='DESELECT')
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.mode_set(mode='EDIT')
        bm = bmesh.from_edit_mesh(obj.data)
        bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(0, 0, height), plane_no=(0, 0, 1))
        for f in bm.faces:
            f.select = f.calc_center_median().z > height
        bmesh.update_edit_mesh(obj.data)
        bpy.ops.mesh.separate(type='SELECTED')
        bpy.ops.object.mode_set(mode='OBJECT')
        above = [o for o in bpy.context.selected_objects if o is not obj][0]
        above.name = name_above
        above.data.name = name_above
        return above

    def bridge_gaps(bm, rim):
        """The cut's outline can have a break or two (where the cut passes
        right through a vertex): join each loose end to the nearest other one,
        so the outline is closed and can be filled."""
        ends = [v for v in {v for e in rim for v in e.verts}
                if sum(1 for e in v.link_edges if e in rim) == 1]
        added = []
        while len(ends) > 1:
            a = ends.pop()
            b = min(ends, key=lambda v: (v.co - a.co).length)
            ends.remove(b)
            added.append(bm.edges.new((a, b)))
        return added

    def close_cut(obj, height, direction, depth, inset, mat, slant=0.0):
        """Closes the open cut at `height`: a recess `depth` deep (inward,
        toward `direction`), its walls shrunk by `inset` and leaning `slant`
        in x per unit of depth (to follow the grip), and a floor. depth 0: a
        flat cap. Only the new faces' normals are set (pointing out of the
        solid), so the shell's own shading is left alone."""
        if mat.name not in obj.data.materials:
            obj.data.materials.append(mat)
        index = list(obj.data.materials).index(mat)
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        rim = [e for e in bm.edges if e.is_boundary and all(abs(v.co.z - height) < 1e-3 for v in e.verts)]
        rim += bridge_gaps(bm, rim)
        rim_center = sum((v.co for e in rim for v in e.verts), Vector()) / max(2 * len(rim), 1)
        walls = []
        if depth > 0:
            ret = bmesh.ops.extrude_edge_only(bm, edges=rim)
            new_verts = [g for g in ret['geom'] if isinstance(g, bmesh.types.BMVert)]
            for v in new_verts:
                v.co.x = rim_center.x + (v.co.x - rim_center.x) * inset + slant * depth
                v.co.y = rim_center.y + (v.co.y - rim_center.y) * inset
                v.co.z += direction * depth
            walls = [g for g in ret['geom'] if isinstance(g, bmesh.types.BMFace)]
            rim = [g for g in ret['geom'] if isinstance(g, bmesh.types.BMEdge) and g.is_boundary]
        filled = bmesh.ops.holes_fill(bm, edges=rim, sides=0)
        caps = bmesh.ops.triangulate(bm, faces=filled['faces'])['faces']
        floor_normal = Vector((0, 0, -direction if depth > 0 else direction))
        axis = Vector((rim_center.x, rim_center.y, 0))
        for f in caps:
            f.material_index = index
            if f.normal.dot(floor_normal) < 0:
                f.normal_flip()
        for f in walls:
            f.material_index = index
            c = f.calc_center_median()
            inward = Vector((axis.x - c.x, axis.y - c.y, 0))
            if f.normal.dot(inward) < 0:
                f.normal_flip()
        bm.to_mesh(obj.data)
        bm.free()

    frame = shell
    frame.name = frame.data.name = 'Frame'
    slide = split(frame, SLIDE_CUT, 'Slide')
    # Below the floorplate cut is the magazine's floorplate; the frame keeps the rest
    floor_above = split(frame, FLOORPLATE_CUT, 'FrameUpper')
    floorplate = frame
    floorplate.name = floorplate.data.name = 'Floorplate'
    frame = floor_above
    frame.name = frame.data.name = 'Frame'

    close_cut(slide, SLIDE_CUT, +1, 0.12, 0.72, polymer)      # the slide's hollow underside
    close_cut(frame, SLIDE_CUT, -1, 0.05, 0.86, polymer)      # the frame's rails, recessed
    close_cut(frame, FLOORPLATE_CUT, +1, 0.3, 0.72, polymer, slant=-0.33)  # the magazine well, up the grip
    close_cut(floorplate, FLOORPLATE_CUT, +1, 0.0, 1.0, polymer)

    BORE_Z = 0.446
    # Barrel: the tube to the chamber, the hood under the ejection port, the lug
    barrel = join([
        cylinder('Barrel', (-0.935, 0, BORE_Z), (-0.27, 0, BORE_Z), 0.078, barrel_steel, 24),
        box('Hood', (-0.27, -0.1, 0.366), (0.08, 0.1, 0.555), barrel_steel),
        box('Lug', (-0.15, -0.06, 0.30), (0.05, 0.06, 0.366), barrel_steel),
        cylinder('Bore', (-0.937, 0, BORE_Z), (-0.9, 0, BORE_Z), 0.042, polymer, 16),
    ], 'Barrel')

    # Recoil spring assembly: guide rod, coil, flange
    ROD_Z = 0.285
    coil = bpy.data.curves.new('Coil', 'CURVE')
    coil.dimensions = '3D'
    coil.bevel_depth = 0.008
    coil.bevel_resolution = 0
    coil.resolution_u = 1
    spline = coil.splines.new('POLY')
    turns, start, end, radius = 11, -0.9, -0.25, 0.045
    steps = turns * 8
    spline.points.add(steps)
    for i in range(steps + 1):
        t = i / steps
        a = t * turns * 2 * math.pi
        spline.points[i].co = (start + (end - start) * t, radius * math.cos(a), ROD_Z + radius * math.sin(a), 1)
    coil_obj = bpy.data.objects.new('Coil', coil)
    bpy.context.scene.collection.objects.link(coil_obj)
    bpy.ops.object.select_all(action='DESELECT')
    coil_obj.select_set(True)
    bpy.context.view_layer.objects.active = coil_obj
    bpy.ops.object.convert(target='MESH')
    coil_obj = bpy.context.view_layer.objects.active
    coil_obj.data.materials.append(spring)
    recoil = join([
        cylinder('GuideRod', (-0.93, 0, ROD_Z), (-0.2, 0, ROD_Z), 0.02, steel, 12),
        coil_obj,
        cylinder('Flange', (-0.25, 0, ROD_Z), (-0.2, 0, ROD_Z), 0.055, steel, 16),
    ], 'RecoilSpring')

    locking_block = box('LockingBlock', (-0.22, -0.09, 0.25), (-0.02, 0.09, 0.325), steel)
    trigger_housing = join([
        box('TriggerHousing', (0.62, -0.07, 0.14), (0.84, 0.07, 0.32), steel),
        box('Ejector', (0.64, 0.015, 0.32), (0.72, 0.045, 0.345), steel),
    ], 'TriggerHousing')
    pins = join([
        cylinder('Pin1', (-0.03, -0.14, 0.285), (-0.03, 0.14, 0.285), 0.017, steel, 12),
        cylinder('Pin2', (-0.06, -0.14, 0.19), (-0.06, 0.14, 0.19), 0.017, steel, 12),
        cylinder('Pin3', (0.7, -0.14, 0.24), (0.7, 0.14, 0.24), 0.017, steel, 12),
    ], 'FramePins')

    # The magazine: its body up the grip from the floorplate, a round on top
    bm = bmesh.new()
    bot_x, top_x, top_z, half_d, half_w = 0.64, 0.36, 0.30, 0.12, 0.10
    corners = []
    for (cx, z) in ((bot_x, FLOORPLATE_CUT + 0.005), (top_x, top_z)):
        for (dx, dy) in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            corners.append(bm.verts.new((cx + dx * half_d, dy * half_w, z)))
    for idx in ((0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)):
        bm.faces.new([corners[i] for i in idx])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    body = new_object('MagBody', bm, polymer)
    magazine = join([
        floorplate, body,
        cylinder('Round', (top_x - 0.1, 0, top_z + 0.045), (top_x + 0.1, 0, top_z + 0.045), 0.045, brass, 16),
    ], 'Magazine')

    # The small holes Meshy's own shell had (a few dozen edges): patched
    for piece in (frame, slide, magazine):
        bm = bmesh.new()
        bm.from_mesh(piece.data)
        bmesh.ops.holes_fill(bm, edges=[e for e in bm.edges if e.is_boundary], sides=16)
        bm.to_mesh(piece.data)
        bm.free()

    parts = [frame, slide, barrel, recoil, locking_block, trigger_housing, pins, magazine]
    for p in parts:
        smooth(p, 30 if p in (frame, slide, magazine) else 40)

# --- ORIENT, SCALE, ORIGIN ---

for p in parts:
    p.select_set(False)
lo = Vector((1e9,) * 3)
hi = -lo
for p in parts:
    for v in p.data.vertices:
        w = p.matrix_world @ v.co
        lo = Vector(map(min, lo, w))
        hi = Vector(map(max, hi, w))
size = hi - lo
if 'size_x' in cfg:        # a gun: its length along the barrel (Meshy's X)
    scale = cfg['size_x'] / size.x
elif 'height' in cfg:
    scale = cfg['height'] / size.z
else:
    scale = cfg['length'] / max(size.x, size.y)
center = (lo + hi) / 2
pivot = Vector((center.x, center.y, lo.z)) if cfg.get('origin', 'bottom') == 'bottom' else center
xform = Matrix.Rotation(math.radians(cfg.get('turn', 0.0)), 4, 'Z') @ Matrix.Scale(scale, 4) @ Matrix.Translation(-pivot)
for p in parts:
    p.data.transform(xform @ p.matrix_world)
    p.matrix_world = Matrix.Identity(4)
    # Each part's own origin at its middle, placed where it sits assembled
    if len(parts) > 1:
        bpy.ops.object.select_all(action='DESELECT')
        p.select_set(True)
        bpy.context.view_layer.objects.active = p
        bpy.ops.object.origin_set(type='ORIGIN_GEOMETRY', center='BOUNDS')

# --- EXPORT ---

bpy.ops.object.select_all(action='DESELECT')
bpy.ops.export_scene.gltf(
    filepath=cfg['out'], export_format='GLB', export_image_format='NONE',
    export_materials='EXPORT', export_yup=True, export_apply=True,
    export_tangents=False, export_normals=True, export_texcoords=True)

report = {'source_tris': source_tris, 'parts': {p.name: tris(p) for p in parts},
          'size_m': [round(x * scale, 4) for x in size]}
json.dump(report, open(cfg['out'] + '.report.json', 'w'), indent=1)
print('GAME_READY', json.dumps(report))
