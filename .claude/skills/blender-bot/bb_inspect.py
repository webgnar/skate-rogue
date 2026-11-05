import bpy, sys, json
f=sys.argv[sys.argv.index('--')+1]
bpy.ops.wm.open_mainfile(filepath=f)
print("=====",f.split('/')[-1], "units scale", bpy.context.scene.unit_settings.scale_length)
for o in bpy.data.objects:
    line=f"  {o.type:9} {o.name!r} dims={tuple(round(d,2) for d in o.dimensions)} loc={tuple(round(v,2) for v in o.location)} parent={o.parent.name if o.parent else None}"
    if o.type=='MESH':
        m=o.data; tris=sum(len(p.vertices)-2 for p in m.polygons)
        ngon={}
        for p in m.polygons: ngon[len(p.vertices)]=ngon.get(len(p.vertices),0)+1
        smooth=sum(p.use_smooth for p in m.polygons)
        line+=f"\n      verts={len(m.vertices)} faces={len(m.polygons)} tris={tris} sides={ngon} smooth={smooth}/{len(m.polygons)} uv={[u.name for u in m.uv_layers]} vcol={[a.name for a in m.color_attributes]} mods={[(md.type,md.name) for md in o.modifiers]} mats={[s.material.name if s.material else None for s in o.material_slots]} vgroups={len(o.vertex_groups)}"
    if o.type=='ARMATURE':
        line+=f"\n      bones={len(o.data.bones)}: {[b.name for b in o.data.bones][:40]}"
    print(line)
for m in bpy.data.materials:
    if not m.use_nodes: print("  MAT",m.name,"nonodes",tuple(m.diffuse_color)); continue
    info=[]
    for n in m.node_tree.nodes:
        if n.type=='TEX_IMAGE' and n.image: info.append(f"TEX {n.image.name} {tuple(n.image.size)} interp={n.interpolation}")
        elif n.type=='BSDF_PRINCIPLED':
            bc=n.inputs['Base Color']; info.append(f"BSDF rough={n.inputs['Roughness'].default_value:.2f} metal={n.inputs['Metallic'].default_value:.2f} base={'linked' if bc.is_linked else tuple(round(c,2) for c in bc.default_value)} emis_linked={n.inputs['Emission Color'].is_linked} emis_str={n.inputs['Emission Strength'].default_value}")
        elif n.type not in ('OUTPUT_MATERIAL',): info.append(n.type)
    print("  MAT",m.name,info)
for a in bpy.data.actions:
    print("  ACTION",a.name,"frames",tuple(a.frame_range))
for i in bpy.data.images: print("  IMG",i.name,tuple(i.size),i.filepath)
