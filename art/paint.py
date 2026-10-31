# Texture painting (zack, 2026-10-31: "can i texture paint these models?"). A model is unwrapped onto one texture,
# art/tex/<name>.png, that its GLB carries. The first build bakes today's flat colours into it; after that the PNG
# is the source: paint it in Blender (open art/<name>.blend, Texture Paint workspace, Image > Save) or any paint app,
# and the next export puts it on. The unwrap comes from the mesh, so a mesh edited in Blender keeps its UVs (new faces
# need unwrapping there); a mesh rebuilt from its script gets a fresh layout, and the paint has to be baked across
# from the old .blend. Faces the game shades itself keep their own materials (KEEP).
import math
import os

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
TEX = os.path.join(HERE, 'tex')
TEX_SIZE = 1024
KEEP = ('Wear', 'visor', 'VisorGlint')  # gear-wear decals (wear.ts), the visor and its glint (skater-rig.ts)


def paintable(ob):
    return [i for i, slot in enumerate(ob.material_slots) if slot.material and not slot.material.name.startswith(KEEP)]


def unwrap(ob):
    """One UV layout over every paintable face, islands split at sharp edges, packed into the square. Textures
    already on the model (Lou's flag) keep reading their own layout until the bake."""
    paint = set(paintable(ob))
    me = ob.data
    old = (me.uv_layers.active or me.uv_layers[0]).name if len(me.uv_layers) else None
    for i in paint:
        nt = ob.material_slots[i].material.node_tree
        for node in [n for n in nt.nodes if n.type == 'TEX_IMAGE' and old and not n.inputs['Vector'].links]:
            uv = nt.nodes.new('ShaderNodeUVMap')
            uv.uv_map = old
            nt.links.new(uv.outputs['UV'], node.inputs['Vector'])
    layer = me.uv_layers.new(name='paint')
    me.uv_layers.active = layer
    layer.active_render = True
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    for p in me.polygons:
        p.select = p.material_index in paint
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_mode(type='FACE')
    bpy.ops.uv.smart_project(angle_limit=math.radians(55), island_margin=0.004, scale_to_bounds=True)
    bpy.ops.object.mode_set(mode='OBJECT')


def bake_colours(ob, image):
    """Today's material colours, baked into `image` through the paint layout."""
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 1
    scene.render.bake.use_pass_direct = False
    scene.render.bake.use_pass_indirect = False
    scene.render.bake.use_pass_color = True
    scene.render.bake.margin = 6
    for i in paintable(ob):
        nt = ob.material_slots[i].material.node_tree
        node = nt.nodes.new('ShaderNodeTexImage')
        node.image = image
        nt.nodes.active = node
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'COLOR'}, use_clear=True)


def paint_material(name, image):
    m = bpy.data.materials.new(f'{name}Paint')
    nt = m.node_tree
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = image
    bsdf = nt.nodes['Principled BSDF']
    bsdf.inputs['Roughness'].default_value = 0.9
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    nt.nodes.active = tex  # what Texture Paint paints on
    return m


def painted(name):
    return f'{name}Paint' in bpy.data.materials


def texture(name, ob):
    """Unwraps the model and puts it on its painted texture, baking one from its colours if there's none yet."""
    unwrap(ob)
    path = os.path.join(TEX, f'{name}.png')
    if os.path.exists(path):
        image = bpy.data.images.load(path)
    else:
        os.makedirs(TEX, exist_ok=True)
        image = bpy.data.images.new(f'{name}Paint', TEX_SIZE, TEX_SIZE)
        bake_colours(ob, image)
        image.filepath_raw = path
        image.file_format = 'PNG'
        image.save()
    image.name = f'{name}Paint'
    image.filepath = f'//tex/{name}.png'  # relative to the .blend, so painting in Blender saves over it
    mat = paint_material(name, image)
    paint = set(paintable(ob))
    ob.data.materials.append(mat)
    slot = len(ob.data.materials) - 1
    for p in ob.data.polygons:
        if p.material_index in paint:
            p.material_index = slot
    me = ob.data
    for layer in [l.name for l in me.uv_layers if l.name != 'paint']:
        me.uv_layers.remove(me.uv_layers[layer])
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.material_slot_remove_unused()


def check(ob):
    """Warns about what a hand edit in Blender can break: a vertex skinned to no bone stays behind at the feet in the
    game, and faces off the paint layout show as one smeared colour."""
    weighted = {g.index for g in ob.vertex_groups}
    loose = sum(1 for v in ob.data.vertices if not any(g.group in weighted and g.weight > 0 for g in v.groups))
    if loose:
        print(f'WARNING {ob.name}: {loose} vertices skinned to no bone (Weight Paint them, or Ctrl+P > With Automatic Weights)')
    if 'paint' not in ob.data.uv_layers:
        print(f'WARNING {ob.name}: no "paint" UV layout')
