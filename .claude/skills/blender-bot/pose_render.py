import bpy,sys,math,mathutils
a=sys.argv[sys.argv.index('--')+1:]
bpy.ops.wm.open_mainfile(filepath=a[0]); out=a[1]
ao=[o for o in bpy.data.objects if o.type=='ARMATURE'][0]
acts=a[2].split(',') if len(a)>2 else ['walk:1','walk:9','walk:17','attack:6','death:24']
for tr in list(ao.animation_data.nla_tracks): tr.mute=True
sc=bpy.context.scene
w=bpy.data.worlds.new("w"); sc.world=w; w.use_nodes=True; w.node_tree.nodes['Background'].inputs[0].default_value=(0.35,0.37,0.42,1)
ld=bpy.data.lights.new("sun",'SUN'); ld.energy=3.5; lo=bpy.data.objects.new("sun",ld); sc.collection.objects.link(lo); lo.rotation_euler=(math.radians(50),0,math.radians(30))
cd=bpy.data.cameras.new("c"); cd.type='ORTHO'; cd.ortho_scale=5.2; cam=bpy.data.objects.new("c",cd); sc.collection.objects.link(cam); sc.camera=cam
ctr=mathutils.Vector((0,0.1,0.4)); cam.location=ctr+mathutils.Vector((-0.8,-0.8,0.6)).normalized()*12
cam.rotation_euler=(ctr-cam.location).to_track_quat('-Z','Y').to_euler()
sc.render.engine='CYCLES'; sc.cycles.samples=24; sc.render.resolution_x=sc.render.resolution_y=256; sc.view_settings.view_transform='Standard'
for act,fr in [(s.split(':')[0],int(s.split(':')[1])) for s in acts]:
    ao.animation_data.action=bpy.data.actions[act]; sc.frame_set(fr)
    sc.render.filepath=f"{out}_{act}{fr}.png"; bpy.ops.render.render(write_still=True)
