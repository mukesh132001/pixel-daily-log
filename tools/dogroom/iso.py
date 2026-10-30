from PIL import Image, ImageDraw
import math
N=256
OX,OY=128,112
def P(x,y,z=0): return (OX+(x-y), OY+(x+y)/2-z)
def R(pts): return [(round(a),round(b)) for a,b in pts]
def hexc(h): h=h.lstrip('#'); return tuple(int(h[i:i+2],16) for i in (0,2,4))
def sh(c,f): return tuple(max(0,min(255,round(v*f))) for v in c[:3])
def mix(a,b,t): return tuple(round(a[i]*(1-t)+b[i]*t) for i in range(3))
class Scene:
    def __init__(s): 
        s.im=Image.new('RGBA',(N,N),(0,0,0,0)); s.d=ImageDraw.Draw(s.im)
    def poly(s,pts,fill,outline=None):
        s.d.polygon(R(pts),fill=fill,outline=outline)
    def box(s,x0,y0,z0,x1,y1,z1,c,ol=True,top=None):
        c=hexc(c) if isinstance(c,str) else c
        o=sh(c,0.55) if ol else None
        s.poly([P(x1,y0,z0),P(x1,y1,z0),P(x1,y1,z1),P(x1,y0,z1)],sh(c,0.78),o)   # +x face (right)
        s.poly([P(x0,y1,z0),P(x1,y1,z0),P(x1,y1,z1),P(x0,y1,z1)],sh(c,0.9),o)    # +y face (left)
        s.poly([P(x0,y0,z1),P(x1,y0,z1),P(x1,y1,z1),P(x0,y1,z1)],top or c,o)      # top
    def ell(s,cx,cy,z,r,fill,outline=None):
        X,Y=P(cx,cy,z); s.d.ellipse([round(X-r),round(Y-r/2),round(X+r),round(Y+r/2)],fill=fill,outline=outline)
    def cyl(s,cx,cy,z,r,h,side,top,ol):
        X,Y=P(cx,cy,z); 
        s.d.ellipse([round(X-r),round(Y-r/2),round(X+r),round(Y+r/2)],fill=side,outline=ol)
        s.d.rectangle([round(X-r),round(Y-h),round(X+r),round(Y)],fill=side)
        s.d.line([round(X-r),round(Y-h),round(X-r),round(Y)],fill=ol); s.d.line([round(X+r),round(Y-h),round(X+r),round(Y)],fill=ol)
        s.d.ellipse([round(X-r),round(Y-h-r/2),round(X+r),round(Y-h+r/2)],fill=top,outline=ol)
    def px(s,x,y,c):
        if 0<=x<N and 0<=y<N: s.im.putpixel((int(x),int(y)),c+(255,) if len(c)==3 else c)
    def stamp(s,art,pal,ox,oy,flip=False):
        for j,row in enumerate(art):
            if flip: row=row[::-1]
            for i,ch in enumerate(row):
                if ch in pal: s.px(ox+i,oy+j,pal[ch])
    def blend(s,pts,col,a):
        ov=Image.new('RGBA',(N,N),(0,0,0,0)); ImageDraw.Draw(ov).polygon(R(pts),fill=col+(a,))
        s.im.alpha_composite(ov)

def prism(scene,poly,z0,z1,c,ol=True,top=None):
    c=hexc(c) if isinstance(c,str) else c
    o=sh(c,0.55) if ol else None
    n=len(poly)
    # side faces whose outward normal faces viewer
    cx=sum(p[0] for p in poly)/n; cy=sum(p[1] for p in poly)/n
    faces=[]
    for i in range(n):
        a=poly[i]; b=poly[(i+1)%n]
        ex,ey=b[0]-a[0],b[1]-a[1]; nx,ny=ey,-ex
        mx,my=(a[0]+b[0])/2-cx,(a[1]+b[1])/2-cy
        if nx*mx+ny*my<0: nx,ny=-nx,-ny
        L=(nx*nx+ny*ny)**.5 or 1; nx,ny=nx/L,ny/L
        if nx+ny>0.01:
            f=0.78+0.12*(ny-nx+1)/2*1.0
            faces.append((a[0]+a[1]+b[0]+b[1],[P(a[0],a[1],z0),P(b[0],b[1],z0),P(b[0],b[1],z1),P(a[0],a[1],z1)],sh(c,f)))
    for _,q,col in sorted(faces): scene.poly(q,col,o)
    scene.poly([P(x,y,z1) for x,y in poly],top or c,o)
def rrect(x0,y0,x1,y1,r):
    return [(x0+r,y0),(x1-r,y0),(x1,y0+r),(x1,y1-r),(x1-r,y1),(x0+r,y1),(x0,y1-r),(x0,y0+r)]
