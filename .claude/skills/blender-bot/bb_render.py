# usage: python bb_render.py -- file.blend out_prefix [hide,obj,names]
import bpy, sys, os, math, mathutils
a=sys.argv[sys.argv.index('--')+1:]
f,out=a[0],a[1]; hide=a[2].split(',') if len(a)>2 and a[2] else []
bpy.ops.wm.open_mainfile(filepath=f)
SEARCH=["/home/claude/godot-sandbox/blender files/textures","/home/claude/godot-sandbox/godot-sandbox/resources/models/characters/boss","/home/claude/godot-sandbox/blender files"]
for im in bpy.data.images:
    if im.size[0]==0 and im.filepath:
        base=os.path.basename(im.filepath)
        for d in SEARCH:
            for cand in (base, "spiderboss_"+base):
                p=os.path.join(d,cand)
                if os.path.exists(p): im.filepath=p; im.reload(); break
sc=bpy.context.scene
for o in list(sc.objects):
    if o.name in hide or o.name.startswith('_bc') or o.name=='Earthian_tank' or o.type in ('LIGHT','CAMERA'):
        o.hide_render=True
meshes=[o for o in sc.objects if o.type=='MESH' and not o.hide_render]
dg=bpy.context.evaluated_depsgraph_get()
pts=[]
for o in meshes:
    e=o.evaluated_get(dg)
    for c in e.bound_box: pts.append(o.matrix_world@mathutils.Vector(c))
mn=mathutils.Vector([min(p[i] for p in pts) for i in range(3)]); mx=mathutils.Vector([max(p[i] for p in pts) for i in range(3)])
ctr=(mn+mx)/2; rad=(mx-mn).length/2
print("BOUNDS",tuple(round(v,2) for v in (mx-mn)))
w=bpy.data.worlds.new("w"); sc.world=w; w.use_nodes=True
w.node_tree.nodes['Background'].inputs[0].default_value=(0.35,0.37,0.42,1); w.node_tree.nodes['Background'].inputs[1].default_value=0.9
ld=bpy.data.lights.new("sun",'SUN'); ld.energy=3.5; lo=bpy.data.objects.new("sun",ld); sc.collection.objects.link(lo); lo.rotation_euler=(math.radians(50),0,math.radians(30))
cd=bpy.data.cameras.new("cam"); cd.type='ORTHO'; cd.ortho_scale=rad*2.1
cam=bpy.data.objects.new("cam",cd); sc.collection.objects.link(cam); sc.camera=cam
sc.render.engine='CYCLES'; sc.cycles.samples=24; sc.cycles.device='CPU'; sc.cycles.use_denoising=False
sc.render.resolution_x=sc.render.resolution_y=512; sc.render.film_transparent=False
sc.view_settings.view_transform='Standard'
views={"front":(0,-1,0.35),"three_q":(-0.8,-0.8,0.6),"side":(-1,0,0.25),"top":(0,-0.05,1)}
for name,d in views.items():
    v=mathutils.Vector(d).normalized()
    cam.location=ctr+v*rad*4
    cam.rotation_euler=(ctr-cam.location).to_track_quat('-Z','Y').to_euler()
    cd.clip_end=rad*10
    sc.render.filepath=f"{out}_{name}.png"; bpy.ops.render.render(write_still=True)
