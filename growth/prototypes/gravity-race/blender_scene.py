import bpy, math, os, json
from mathutils import Vector
from math import sin, cos, pi, sqrt
from bisect import bisect_left
OUT=os.environ.get("OUT","blender-preview")
os.makedirs(OUT,exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
sc=bpy.context.scene
sc.render.engine='BLENDER_WORKBENCH'
sc.render.resolution_x=540;sc.render.resolution_y=960;sc.render.resolution_percentage=100
sc.render.fps=15;sc.frame_start=1;sc.frame_end=120
sc.render.image_settings.file_format='PNG'
s=sc.display.shading
s.light='STUDIO';s.studiolight_rotate_z=0.45;s.color_type='MATERIAL'
s.show_shadows=True;s.show_cavity=True;s.cavity_type='BOTH'
s.curvature_ridge_factor=1.2;s.curvature_valley_factor=1.1
s.show_specular_highlight=True;s.show_object_outline=False
s.background_type='WORLD';sc.world.color=(.035,.06,.095)
sc.display.render_aa='16'
def mat(n,c):
 m=bpy.data.materials.new(n);m.diffuse_color=(*c,1);return m
M=[mat('coral',(.85,.15,.12)),mat('amber',(.96,.52,.035)),mat('aqua',(.035,.63,.78))]
dark=mat('navy',(.045,.10,.15));rail=mat('cream',(.86,.91,.90));metal=mat('aluminum',(.42,.52,.60));floor=mat('slate',(.13,.19,.24));white=mat('white',(.97,.97,.93));black=mat('black',(.025,.035,.045))
def attach(o,m):o.data.materials.append(m);return o
def box(n,p,d,m,b=.05):
 bpy.ops.mesh.primitive_cube_add(size=1,location=p);o=bpy.context.object;o.name=n;o.dimensions=d;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);attach(o,m)
 if b:
  mod=o.modifiers.new('Machined rounded edges','BEVEL');mod.width=b;mod.segments=3
  mod=o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
 return o
def tube(n,points,r,m):
 c=bpy.data.curves.new(n,'CURVE');c.dimensions='3D';c.bevel_depth=r;c.bevel_resolution=3
 sp=c.splines.new('POLY');sp.points.add(len(points)-1)
 for pt,p in zip(sp.points,points):pt.co=(*p,1)
 o=bpy.data.objects.new(n,c);bpy.context.collection.objects.link(o);attach(o,m);return o
def sphere(n,p,r,m):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=40,ring_count=24,radius=r,location=p);o=bpy.context.object;o.name=n;attach(o,m)
 for f in o.data.polygons:f.use_smooth=True
 return o
# Identical length in horizontal displacement and height difference, different paths.
# Frictionless point mass approximation along each guide; gravitational acceleration.
xs=[-2.1,0,2.1];rad=.32;D=4.8;L=10
def z(u,i):
 if i==0:return 5.6-D*u
 if i==1:return 5.6-D*(1-(1-u)**2.2)
 return 5.6-D*(.12*u+.88*u**2.2)
def pos(u,i):return (xs[i],-5+L*u,z(u,i))
paths=[];times=[];balls=[]
for i,x in enumerate(xs):
 pts=[pos(j/1000,i) for j in range(1001)]
 t=[0.]
 for j in range(1,len(pts)):
  ds=(Vector(pts[j])-Vector(pts[j-1])).length
  v0=sqrt(max(0,2*9.81*(5.6-pts[j-1][2])));v1=sqrt(max(0,2*9.81*(5.6-pts[j][2])))
  t.append(t[-1]+2*ds/max(v0+v1,1e-9))
 paths.append(pts);times.append(t)
 # visible smooth 3D track body: ribbon curved cross section with solid thickness
 verts=[];faces=[];N=100;K=12
 for j in range(N+1):
  _,y,zz=pos(j/N,i)
  for k in range(K+1):
   q=-.58+1.16*k/K
   verts.append((x+q,y,zz-rad-.025+0.22*(q/.58)**2))
 for j in range(N):
  for k in range(K):
   a=j*(K+1)+k;faces.append((a,a+1,a+K+2,a+K+1))
 me=bpy.data.meshes.new('curved track mesh');me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new('Track '+str(i),me);bpy.context.collection.objects.link(o);attach(o,M[i])
 solid=o.modifiers.new('Solid track','SOLIDIFY');solid.thickness=.15
 bev=o.modifiers.new('Rounded edge','BEVEL');bev.width=.035;bev.segments=3
 for f in me.polygons:f.use_smooth=True
 for off in [-.59,.59]:tube('Guide rail',[(x+off,p[1],p[2]-rad+.22) for p in pts[::10]],.055,rail)
 for u in [.02,.22,.43,.64,.85,.98]:
  _,y,zz=pos(u,i);h=zz-rad-.22
  for off in [-.37,.37]:box('Support',(x+off,y,h/2),(.15,.19,h),metal,.025)
  box('Support crossbar',(x,y,h-.1),(1.10,.20,.15),dark,.035)
  box('Footplate',(x,y,.07),(1.16,.52,.12),dark,.045)
 ball=sphere('Racer '+str(i),pts[0],rad,M[i]);balls.append(ball)
 # bright stripe around each sphere, parented for rolling animation
 ring=tube('Ball racing stripe',[(rad*1.008*cos(j*2*pi/96),0,rad*1.008*sin(j*2*pi/96)) for j in range(97)],.028,white);ring.parent=ball;ring.location=(0,0,0)
box('Arena plinth',(0,0,-.28),(8.3,12.5,.55),floor,.19)
box('Starting platform',(0,-5.35,5.11),(6.2,1.0,.32),dark,.08)
for i,x in enumerate(xs):
 box('Start gate',(x,-4.97,6.00),(1.27,.09,.11),white,.025)
 # individual goal arch, checker finish line, and catch basin
 box('Finish deck',(x,5.48,.28),(1.45,1.05,.22),dark,.06)
 for j in range(6):
  for k in range(2):
   box('Checker',(x-.55+j*.22,5.07+k*.18,.411),(.22,.18,.025),white if (j+k)%2==0 else black,.001)
 for off in [-.65,.65]:box('Goal pylon',(x+off,5.1,.82),(.10,.12,1.0),M[i],.03)
 box('Goal bar',(x,5.1,1.35),(1.38,.13,.12),white,.025)
 # tiny numbered placards; English numerals are geometry.
 cu=bpy.data.curves.new('Lane number','FONT');cu.body=str(i+1);cu.align_x='CENTER';cu.size=.43;cu.extrude=.012
 ob=bpy.data.objects.new('Lane number',cu);bpy.context.collection.objects.link(ob);ob.location=(x,5.20,1.37);ob.rotation_euler=(pi/2,0,pi);attach(ob,white)
# studio background and a rail-race camera
box('Studio ground',(0,0,-.65),(200,200,.18),dark,0)
bpy.ops.object.camera_add();cam=bpy.context.object;sc.camera=cam;cam.data.type='ORTHO'
def camera(p,target,scale):
 cam.location=p;cam.rotation_euler=(Vector(target)-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=scale
def interp(a,b,f):return tuple((1-f)*x+f*y for x,y in zip(a,b))
def keycam(f,p,target,scale):
 camera(p,target,scale);cam.keyframe_insert('location',frame=f);cam.keyframe_insert('rotation_euler',frame=f);cam.data.keyframe_insert('ortho_scale',frame=f)
keycam(1,(10,13,16),(0,0,2.6),14.2)
keycam(22,(8,15,15),(0,0,2.6),14.0)
keycam(47,(6.6,9,10.6),(0,1.3,2.0),10.8)
keycam(76,(7.5,12,12),(0,1.9,1.8),12.0)
keycam(120,(8,14,15),(0,0,2.6),14.2)
maxT=max(t[-1] for t in times)
# 1.4 seconds anticipation; slow motion 1.7x for legibility
factor=1.7;start=1.4
for f in range(1,121):
 sec=(f-1)/15;tt=max(0,(sec-start)/factor)
 for i,o in enumerate(balls):
  arr=times[i];pts=paths[i];j=min(len(arr)-1,bisect_left(arr,tt))
  if j==0:p=pts[0]
  elif tt>=arr[-1]:
   q=min(1,(tt-arr[-1])/.35);p=(xs[i],5+.36*q,.8)
  else:
   q=(tt-arr[j-1])/(arr[j]-arr[j-1]);p=interp(pts[j-1],pts[j],q)
  o.location=p;o.rotation_euler=(tt*4.5,0,0);o.keyframe_insert('location',frame=f);o.keyframe_insert('rotation_euler',frame=f)
for i,t in enumerate(times):print('lane',i+1,'seconds',t[-1],flush=True)
with open(os.path.join(OUT,'simulation.json'),'w') as f:json.dump({'ideal_model':'frictionless point-mass along guide, same height, no friction or air resistance','times_seconds':[t[-1] for t in times],'start_video_seconds':start,'time_stretch':factor,'winner':1+min(range(3),key=lambda i:times[i][-1]),'fps':15,'frames':120},f,indent=2)
sc.frame_set(1);bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(os.path.join(OUT,'race.blend')))
sc.render.filepath=os.path.abspath(os.path.join(OUT,'frame-'))
bpy.ops.render.render(animation=True)
