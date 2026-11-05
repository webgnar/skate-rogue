"""Tunnel Beetle: first attempt at a new enemy in zack's style.
Low poly tubes, flat shaded, one 256px Closest-filtered painted texture, armature with walk/attack/death."""
import bpy, bmesh, math, sys, os, random
import numpy as np
from mathutils import Vector, Matrix
OUT=sys.argv[sys.argv.index('--')+1]
random.seed(7); np.random.seed(7)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc=bpy.context.scene

bm=bmesh.new()
L_part=bm.verts.layers.int.new("part"); L_t=bm.verts.layers.float.new("t"); L_a=bm.verts.layers.float.new("ang")
PARTS={}
def pid(name):
    if name not in PARTS: PARTS[name]=len(PARTS)
    return PARTS[name]
def tube(name, pts, radii, sides=6, squash=(1,1), cap_tip=True, twist=0.0, up=Vector((0,0,1))):
    p=pid(name); rings=[]
    n=len(pts)
    for i,(c,r) in enumerate(zip(pts,radii)):
        c=Vector(c)
        d=(Vector(pts[min(i+1,n-1)])-Vector(pts[max(i-1,0)])).normalized()
        x=d.cross(up)
        if x.length<1e-4: x=d.cross(Vector((1,0,0)))
        x.normalize(); y=x.cross(d).normalized()
        ring=[]
        if r<=1e-4:
            v=bm.verts.new(c); v[L_part]=p; v[L_t]=i/(n-1); v[L_a]=0; ring=[v]
        else:
            for k in range(sides):
                a=2*math.pi*k/sides+twist
                v=bm.verts.new(c+x*math.cos(a)*r*squash[0]+y*math.sin(a)*r*squash[1])
                v[L_part]=p; v[L_t]=i/(n-1); v[L_a]=k/sides; ring.append(v)
        rings.append(ring)
    for i in range(n-1):
        A,B=rings[i],rings[i+1]
        if len(B)==1:
            for k in range(len(A)): bm.faces.new((A[k],A[(k+1)%len(A)],B[0]))
        elif len(A)==1:
            for k in range(len(B)): bm.faces.new((A[0],B[(k+1)%len(B)],B[k]))
        else:
            for k in range(len(A)): bm.faces.new((A[k],A[(k+1)%len(A)],B[(k+1)%len(B)],B[k]))
    if len(rings[0])>2: bm.faces.new(list(reversed(rings[0])))
    if len(rings[-1])>2: bm.faces.new(rings[-1])

# body runs along -Y (head at -Y, matching zack's creatures facing -Y)
tube("abdomen",[(0,0.25,0.55),(0,0.7,0.62),(0,1.2,0.6),(0,1.6,0.48),(0,1.85,0.3)],[0.42,0.62,0.6,0.42,0.12],sides=8,squash=(1.15,0.8))
tube("thorax",[(0,0.3,0.55),(0,0.0,0.58),(0,-0.35,0.52)],[0.38,0.4,0.3],sides=8,squash=(1.1,0.85))
tube("head",[(0,-0.3,0.52),(0,-0.55,0.55),(0,-0.85,0.45),(0,-0.98,0.36)],[0.3,0.38,0.32,0.16],sides=8,squash=(1.2,0.85))
# horn
tube("horn",[(0,-0.7,0.78),(0,-0.85,0.98),(0,-1.05,1.12)],[0.09,0.06,0.0],sides=5)
# mandibles: hook forward and in
for s in (-1,1):
    tube(f"mand_{'L' if s<0 else 'R'}",[(0.2*s,-0.9,0.38),(0.38*s,-1.15,0.34),(0.32*s,-1.42,0.32),(0.1*s,-1.58,0.3)],[0.09,0.08,0.05,0.0],sides=5)
# six legs: hip at thorax, knee up and out, foot down
for i,(y,spread) in enumerate([(-0.25,-0.5),(0.05,0.0),(0.35,0.55)]):
    for s in (-1,1):
        side='L' if s<0 else 'R'
        hip=Vector((0.32*s,y,0.5)); knee=Vector((0.95*s,y+spread*0.5,0.85)); foot=Vector((1.35*s,y+spread,0.0))
        tube(f"leg{i}{side}",[hip,(hip+knee)/2,knee,(knee+foot)/2+Vector((0.05*s,0,0)),foot],[0.1,0.09,0.08,0.06,0.0],sides=5)

me=bpy.data.meshes.new("tunnel_beetle"); bm.to_mesh(me)
# carry attributes to mesh for painting/weights
part=[v[L_part] for v in bm.verts]; tt=[v[L_t] for v in bm.verts]; aa=[v[L_a] for v in bm.verts]
bm.free()
ob=bpy.data.objects.new("tunnel_beetle",me); sc.collection.objects.link(ob)
for p in me.polygons: p.use_smooth=False
bpy.context.view_layer.objects.active=ob; ob.select_set(True)
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.normals_make_consistent(inside=False)
bpy.ops.uv.smart_project(angle_limit=math.radians(60),island_margin=0.02)
bpy.ops.object.mode_set(mode='OBJECT')
tris=sum(len(p.vertices)-2 for p in me.polygons)
print("TRIS",tris,"VERTS",len(me.vertices),"PARTS",PARTS)

# ---------- paint texture ----------
S=256
img=np.zeros((S,S,3),np.float32); mask=np.zeros((S,S),bool)
def hexc(h): return np.array([int(h[i:i+2],16)/255 for i in (1,3,5)],np.float32)
C=dict(teal=hexc("#1d5c63"),dteal=hexc("#0f2e36"),lime=hexc("#a6e22e"),yel=hexc("#f2d02b"),org=hexc("#e8641e"),
       mar=hexc("#6e1a22"),bone=hexc("#efe6c2"),dark=hexc("#1a1414"),red=hexc("#d22b2b"),pink=hexc("#f08aa0"),purp=hexc("#8a3fd1"))
inv={v:k for k,v in PARTS.items()}
def vnoise(x,y,f):
    return (np.sin(x*f*1.7+np.cos(y*f*1.3)*2.1)+np.sin(y*f*2.3+x*f*0.7))*0.25
def shade(name,t,a,P):
    # t along part, a around, P 3d pos ; returns rgb
    x,y,z=P
    n=vnoise(x*7,y*7+z*5,3)
    if name=="abdomen":
        band=(np.sin(t*math.pi*7+np.sin(a*math.pi*8)*0.9))  # zigzag bands
        c=np.where(band[...,None]>0.55,C['lime'],np.where(band[...,None]>0.25,C['yel'],C['teal']))
        spot=((np.sin(a*math.pi*6)*np.sin(t*math.pi*9))>0.75)&(z>0.5)
        c=np.where(spot[...,None],C['org'],c)
        belly=z<0.35
        c=np.where(belly[...,None],C['dteal'],c)
    elif name=="thorax":
        c=np.where(((np.sin(a*math.pi*8)>0.3)&(z>0.45))[...,None],C['lime'],C['teal'])
        c=np.where((np.abs(np.sin(t*math.pi*3))<0.18)[...,None],C['dark'],c)
    elif name=="head":
        c=np.tile(C['org'],t.shape+(1,))
        c=np.where((np.sin((x+z)*28)>0.6)[...,None],C['red'],c)
        # big cartoon eyes on the upper front sides
        for s in (-1,1):
            d=np.sqrt(((x-0.22*s)/1.0)**2+((y+0.72)/1.0)**2+((z-0.62)/1.0)**2)
            c=np.where((d<0.16)[...,None],C['dark'],c)
            c=np.where((d<0.13)[...,None],C['bone'],c)
            pd=np.sqrt((x-0.25*s)**2+(y+0.8)**2+(z-0.62)**2)
            c=np.where((pd<0.06)[...,None],C['dark'],c)
        # teeth row at the front bottom
        mouth=(y<-0.86)&(z<0.42)
        c=np.where(mouth[...,None],np.where((np.sin(x*60)>0)[...,None],C['bone'],C['mar']),c)
    elif name=="horn":
        c=np.where((t>0.55)[...,None],C['yel'],C['mar'])
    elif name.startswith("mand"):
        c=np.where((t>0.6)[...,None],C['dark'],C['bone'])
        c=np.where((np.abs(np.sin(t*math.pi*5))<0.15)[...,None],C['mar'],c)
    else:  # legs: maroon with yellow stripes, dark tips
        c=np.where((np.sin(t*math.pi*9)>0.35)[...,None],C['yel'],C['mar'])
        c=np.where((t>0.85)[...,None],C['dark'],c)
    # brushy value jitter and streaks
    c=c*(1+n[...,None]*0.35)
    return np.clip(c,0,1)

uvl=me.uv_layers.active.data
V=np.array([v.co for v in me.vertices]); T=np.array(tt); A=np.array(aa)
for poly in me.polygons:
    li=list(poly.loop_indices); vi=list(poly.vertices)
    name=inv[part[vi[0]]]
    for k in range(1,len(li)-1):
        tri=[0,k,k+1]
        uv=np.array([uvl[li[j]].uv for j in tri])*S
        mn=np.floor(uv.min(0)).astype(int)-1; mx=np.ceil(uv.max(0)).astype(int)+1
        xs,ys=np.meshgrid(np.arange(mn[0],mx[0]+1)+0.5,np.arange(mn[1],mx[1]+1)+0.5)
        (x0,y0),(x1,y1),(x2,y2)=uv
        den=(y1-y2)*(x0-x2)+(x2-x1)*(y0-y2)
        if abs(den)<1e-9: continue
        w0=((y1-y2)*(xs-x2)+(x2-x1)*(ys-y2))/den; w1=((y2-y0)*(xs-x2)+(x0-x2)*(ys-y2))/den; w2=1-w0-w1
        inside=(w0>=-0.02)&(w1>=-0.02)&(w2>=-0.02)
        if not inside.any(): continue
        ids=[vi[j] for j in tri]
        P=[w0*V[ids[0],d]+w1*V[ids[1],d]+w2*V[ids[2],d] for d in range(3)]
        t=w0*T[ids[0]]+w1*T[ids[1]]+w2*T[ids[2]]
        a=w0*A[ids[0]]+w1*A[ids[1]]+w2*A[ids[2]]
        col=shade(name,t,a,P)
        px=(xs[inside]-0.5).astype(int); py=(ys[inside]-0.5).astype(int)
        ok=(px>=0)&(px<S)&(py>=0)&(py<S)
        img[py[ok],px[ok]]=col[inside][ok]; mask[py[ok],px[ok]]=True
# dark outline around islands, then bleed
from scipy import ndimage
er=ndimage.binary_erosion(mask,iterations=1)
img[mask&~er]*=0.72
for _ in range(4):
    grown=ndimage.binary_dilation(mask)
    nb=ndimage.maximum_filter(img*mask[...,None],size=(3,3,1))
    img[grown&~mask]=nb[grown&~mask]; mask=grown
out_png=os.path.join(OUT,"tunnel_beetle.png")
from PIL import Image
Image.fromarray((np.flipud(img)*255).astype(np.uint8)).save(out_png)

mat=bpy.data.materials.new("tunnel_beetle"); mat.use_nodes=True
nt=mat.node_tree; bsdf=nt.nodes['Principled BSDF']; bsdf.inputs['Roughness'].default_value=0.5
tex=nt.nodes.new('ShaderNodeTexImage'); tex.image=bpy.data.images.load(out_png); tex.image.filepath="//tunnel_beetle.png"; tex.interpolation='Closest'
nt.links.new(tex.outputs['Color'],bsdf.inputs['Base Color']); me.materials.append(mat)

# ---------- armature, rigid weights per part ----------
arm=bpy.data.armatures.new("tunnel_beetle_armature"); ao=bpy.data.objects.new("tunnel_beetle_armature",arm); sc.collection.objects.link(ao)
bpy.context.view_layer.objects.active=ao; bpy.ops.object.mode_set(mode='EDIT')
def bone(n,h,t,parent=None):
    b=arm.edit_bones.new(n); b.head=Vector(h); b.tail=Vector(t)
    if parent: b.parent=arm.edit_bones[parent]
    return b
bone("root",(0,0,0),(0,0,0.3)); bone("thorax",(0,0.2,0.55),(0,-0.3,0.55),"root")
bone("abdomen",(0,0.25,0.58),(0,1.6,0.5),"thorax"); bone("head",(0,-0.3,0.52),(0,-0.9,0.45),"thorax")
for s in "LR":
    sg=-1 if s=="L" else 1
    bone(f"mand_{s}",(0.2*sg,-0.9,0.38),(0.32*sg,-1.42,0.32),"head")
for i,(y,spread) in enumerate([(-0.25,-0.5),(0.05,0.0),(0.35,0.55)]):
    for s in "LR":
        sg=-1 if s=="L" else 1
        hip=(0.32*sg,y,0.5); knee=(0.95*sg,y+spread*0.5,0.85); foot=(1.35*sg,y+spread,0.0)
        bone(f"leg{i}{s}_upper",hip,knee,"thorax"); bone(f"leg{i}{s}_lower",knee,foot,f"leg{i}{s}_upper")
bpy.ops.object.mode_set(mode='OBJECT')
groups={}
for vidx,p in enumerate(part):
    n=inv[p]
    if n=="horn": b="head"
    elif n.startswith("leg"): b=f"{n}_{'upper' if tt[vidx]<0.5 else 'lower'}"
    else: b=n
    groups.setdefault(b,[]).append(vidx)
for b,vs in groups.items(): ob.vertex_groups.new(name=b).add(vs,1.0,'REPLACE')
ob.parent=ao; md=ob.modifiers.new("Armature",'ARMATURE'); md.object=ao

# ---------- actions ----------
ao.animation_data_create()
def act(name,frames,keys):
    a=bpy.data.actions.new(name); ao.animation_data.action=a
    for pb in ao.pose.bones: pb.rotation_mode='XYZ'
    for f,pose in keys:
        for pb in ao.pose.bones:
            r=pose.get(pb.name,(0,0,0)); pb.rotation_euler=[math.radians(v) for v in r]
            pb.location=pose.get(pb.name+"@loc",(0,0,0))
            pb.keyframe_insert("rotation_euler",frame=f); pb.keyframe_insert("location",frame=f)
    a.use_fake_user=True
    tr=ao.animation_data.nla_tracks.new(); tr.name=name; tr.strips.new(name,int(keys[0][0]),a)
def walk_pose(ph):
    p={}
    for i in range(3):
        for s in "LR":
            grp=(i%2==0)==(s=="L")   # tripod gait
            ang=math.sin((ph+(0 if grp else 0.5))*2*math.pi)
            lift=max(0,math.cos((ph+(0 if grp else 0.5))*2*math.pi))
            p[f"leg{i}{s}_upper"]=(0,lift*-18*(1 if s=="L" else -1),ang*22)
    p["abdomen"]=(math.sin(ph*4*math.pi)*3,0,math.sin(ph*2*math.pi)*4)
    p["head"]=(0,0,math.sin(ph*2*math.pi)*-4)
    return p
act("walk",(1,32),[(1+f,walk_pose(f/32)) for f in range(0,33,4)])
act("attack",(0,20),[(0,{}),(6,{"head":(14,0,0),"mand_L":(0,0,-35),"mand_R":(0,0,35),"thorax":(-6,0,0)}),
                     (10,{"head":(-12,0,0),"mand_L":(0,0,15),"mand_R":(0,0,-15),"thorax@loc":(0,0.0,0)}),(20,{})])
dead={f"leg{i}{s}_upper":(0,(40 if s=="L" else -40),0) for i in range(3) for s in "LR"}
dead.update({f"leg{i}{s}_lower":(0,(60 if s=="L" else -60),0) for i in range(3) for s in "LR"})
dead["root"]=(0,180,0); dead["root@loc"]=(0,0,1.0)
act("death",(0,24),[(0,{}),(10,{"root":(0,100,0),"root@loc":(0,0,0.9)}),(24,dead)])
ao.animation_data.action=None
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,"tunnel_beetle.blend"))
print("SAVED")
