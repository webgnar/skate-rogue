import bpy, sys, bmesh, math
from collections import Counter
f=sys.argv[sys.argv.index('--')+1]
bpy.ops.wm.open_mainfile(filepath=f)
print("=====",f.split('/')[-1])
for o in bpy.data.objects:
    if o.type!='MESH' or o.name.startswith('_bc') or o.name=='Earthian_tank': continue
    bm=bmesh.new(); bm.from_mesh(o.data); bm.verts.ensure_lookup_table()
    # connected components
    seen=set(); comps=[]
    for v in bm.verts:
        if v.index in seen: continue
        st=[v]; n=0
        while st:
            u=st.pop()
            if u.index in seen: continue
            seen.add(u.index); n+=1
            for e in u.link_edges: st.append(e.other_vert(u))
        comps.append(n)
    # symmetry across X
    co=[tuple(round(c,3) for c in v.co) for v in bm.verts]; s=set(co)
    sym=sum((-x,y,z) in s for x,y,z in co)/len(co)
    # edge length spread, face area spread
    el=sorted(e.calc_length() for e in bm.edges); fa=sorted(fc.calc_area() for fc in bm.faces)
    nonmanifold=sum(not e.is_manifold for e in bm.edges)
    # vertices per "loop": valence stats
    val=Counter(len(v.link_edges) for v in bm.verts)
    # sharp angles between neighbours (how faceted)
    ang=[math.degrees(e.calc_face_angle(0)) for e in bm.edges if len(e.link_faces)==2]
    print(f" {o.name}: comps={sorted(comps,reverse=True)[:12]} ({len(comps)} pieces) mirrorX={sym:.0%} nonmanifold_edges={nonmanifold} valence={dict(sorted(val.items()))}")
    print(f"   edge len min/med/max={el[0]:.3f}/{el[len(el)//2]:.3f}/{el[-1]:.3f}  face area ratio max/med={fa[-1]/max(fa[len(fa)//2],1e-9):.0f}  dihedral med={sorted(ang)[len(ang)//2]:.0f} deg, >45deg={sum(a>45 for a in ang)/len(ang):.0%}")
    print("   mods:",[m.type for m in o.modifiers], "shape keys:", bool(o.data.shape_keys))
print(" addons in file / workspaces:",[w.name for w in bpy.data.workspaces][:12])
print(" brushes:",[b.name for b in bpy.data.brushes][:20])
print(" texts:",[t.name for t in bpy.data.texts])
for a in bpy.data.actions:
    ks=sum(len(fc.keyframe_points) for layer in getattr(a,'layers',[]) for st in layer.strips for cb in st.channelbags for fc in cb.fcurves) if hasattr(a,'layers') else 0
    print("  action",a.name,"keys",ks)
