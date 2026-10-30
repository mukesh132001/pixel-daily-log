from room import *
from sprites import *
import random, math
def wallL(y,z): return P(0,y,z)
def wallR(x,z): return P(x,0,z)
def window(s):
    f=wallL; y0,y1,z0,z1=30,62,26,60
    fr=hexc('#fbf6ea'); frS=hexc('#d8cdb4')
    s.poly([f(y0-2,z0-3),f(y1+2,z0-3),f(y1+2,z1+2),f(y0-2,z1+2)],frS)
    s.poly([f(y0,z0),f(y1,z0),f(y1,z1),f(y0,z1)],hexc('#bfe3ef'))
    # sky gradient + clouds + distant tree
    for z in range(z0,z1):
        t=(z-z0)/(z1-z0); c=mix(hexc('#cfeef2'),hexc('#8fcbe6'),t)
        s.d.line(R([f(y0,z),f(y1,z)]),fill=c)
    for cy,cz,w in [(38,52,7),(52,46,5)]:
        for k in range(w): s.d.line(R([f(cy+k,cz),f(cy+k,cz+1)]),fill=(255,255,255))
    s.poly([f(y0,z0),f(y0+12,z0),f(y0+9,z0+10),f(y0+3,z0+10)],hexc('#7fb069'))
    s.poly([f(y1-14,z0),f(y1,z0),f(y1,z0+7),f(y1-10,z0+9)],hexc('#93c47d'))
    # mullions
    s.d.line(R([f((y0+y1)/2,z0),f((y0+y1)/2,z1)]),fill=fr)
    s.d.line(R([f((y0+y1)/2+.6,z0),f((y0+y1)/2+.6,z1)]),fill=fr)
    s.d.line(R([f(y0,(z0+z1)/2),f(y1,(z0+z1)/2)]),fill=fr)
    s.poly([f(y0-2,z0-3),f(y1+2,z0-3),f(y1+2,z0),f(y0-2,z0)],fr)
    # sill (protrudes)
    s.box(0,y0-4,z0-5,5,y1+4,z0-2,'#fbf6ea')
    # striped valance
    for i,y in enumerate(range(y0-3,y1+3,2)):
        c=hexc('#e8a87c') if i%2 else hexc('#fbf6ea')
        s.poly([f(y,z1+6),f(y+2,z1+6),f(y+2,z1-1+(i%2)),f(y,z1-1+(i%2))],c)
    s.d.line(R([f(y0-4,z1+6),f(y1+4,z1+6)]),fill=hexc('#a0623d'))
    # little succulent pots on sill
    for y in (36,56):
        X,Y=P(2.5,y,z0-2); 
        s.d.rectangle([round(X)-2,round(Y)-4,round(X)+2,round(Y)],fill=hexc('#d9805f'),outline=hexc('#9c5238'))
        for dx,dy in [(-2,-6),(0,-8),(2,-6),(-1,-7),(1,-7),(0,-6),(-3,-5),(3,-5)]: s.px(round(X)+dx,round(Y)+dy,hexc('#6aa35a'))
        s.px(round(X),round(Y)-9,hexc('#f2a3a3'))
def frame_pic(s):
    f=wallR; x0,x1,z0,z1=40,54,36,52
    s.poly([f(x0,z0),f(x1,z0),f(x1,z1),f(x0,z1)],hexc('#a0623d'))
    s.poly([f(x0+1.5,z0+1.5),f(x1-1.5,z0+1.5),f(x1-1.5,z1-1.5),f(x0+1.5,z1-1.5)],hexc('#fdf3e1'))
    # tiny paw heart drawing
    X,Y=P((x0+x1)/2,0,(z0+z1)/2)
    art=[".RR.RR.","RRRRRRR","RRRRRRR",".RRRRR.","..RRR..","...R..."]
    s.stamp(art,{'R':hexc('#e8737a')},round(X)-3,round(Y)-3)
def shelf(s):
    s.box(58,0,44,78,7,46,'#b07a4f')
    for x in (61,75): 
        X,Y=P(x,1,43); s.d.line([round(X),round(Y),round(X),round(Y)+3],fill=hexc('#7a5236'))
    # treat jar
    X,Y=P(64,3.5,46)
    s.d.rectangle([round(X)-3,round(Y)-9,round(X)+3,round(Y)],fill=hexc('#d9eef0'),outline=hexc('#7fa3a8'))
    s.d.rectangle([round(X)-3,round(Y)-11,round(X)+3,round(Y)-9],fill=hexc('#e8737a'),outline=hexc('#a8464c'))
    for dx,dy in [(-1,-3),(1,-5),(0,-2),(2,-2),(-2,-6),(1,-7)]: s.px(round(X)+dx,round(Y)+dy,hexc('#c98a4a'))
    s.stamp(["W.W","WWW","W.W"],{'W':(255,255,255)},round(X)-1,round(Y)-6)
    # trophy
    X,Y=P(72,3.5,46)
    s.stamp([".YYYYY.","YYYYYYY",".YYYYY.","..YYY..","...Y...","..yyy..",".yyyyy."],{'Y':hexc('#f4c542'),'y':hexc('#c9922a')},round(X)-3,round(Y)-7)
def leash_hooks(s):
    for i,x in enumerate((84,92)):
        X,Y=P(x,0,54); s.d.rectangle([round(X)-1,round(Y)-1,round(X),round(Y)],fill=hexc('#7a5236'))
        col=hexc('#3f7f8c') if i==0 else hexc('#e8737a')
        pts=[(round(X)+dx,round(Y)+dy) for dx,dy in [(0,1),(-1,3),(-2,6),(-2,9),(-1,12),(0,13),(1,12),(2,9),(1,5),(0,1)]]
        s.d.line(pts,fill=col,width=1)
        s.px(round(X),round(Y)+14,hexc('#c9c9c9'))
    # collar on hook 2
def dog_door(s):
    f=wallR; x0,x1=84,96
    s.poly([f(x0,0),f(x1,0),f(x1,15),f(x0,15)],hexc('#a0623d'))
    s.poly([f(x0+1.5,0),f(x1-1.5,0),f(x1-1.5,13),f(x0+1.5,13)],hexc('#6e4a3a'))
    s.poly([f(x0+2,1),f(x1-2,1),f(x1-2,12),f(x0+2,12)],hexc('#8a5e46'))
    X,Y=P((x0+x1)/2,0,8); s.stamp([".W.W.","W.W.W",".WWW.","WWWWW",".WWW."],{'W':hexc('#f2e6c9')},round(X)-2,round(Y)-3)
def bone_clock(s):
    X,Y=P(0,84,48)
    art=[
    ".KK.......KK.",
    "KWWK.....KWWK",
    "KWWWKKKKKWWWK",
    ".KWWWWWWWWWK.",
    ".KWWWWKWWWWK.",
    ".KWWWWKKKWWK.",
    ".KWWWWWWWWWK.",
    "KWWWKKKKKWWWK",
    "KWWK.....KWWK",
    ".KK.......KK.",]
    s.stamp(art,{'K':hexc('#8f5e3a'),'W':hexc('#fbf3e1')},round(X)-6,round(Y)-5)
def string_lights(s,t=0):
    pts=[]
    for x in range(2,99):
        z=64-3*abs(math.sin((x-2)/12*math.pi))
        pts.append(P(x,0,z))
    s.d.line(R(pts),fill=hexc('#5c6b4c'))
    cols=[hexc('#ffd166'),hexc('#ff8fa3'),hexc('#8fd3ff'),hexc('#b8f28f')]
    for k,x in enumerate(range(8,99,12)):
        z=64-3*abs(math.sin((x-2)/12*math.pi))-1.5
        X,Y=P(x,0,z); c=cols[(k+t)%4]; on=((k+t)%3)!=0
        s.d.rectangle([round(X),round(Y),round(X)+1,round(Y)+1],fill=c if on else sh(c,0.6))
        if on: 
            for dx,dy in [(-1,0),(2,0),(0,-1),(1,2)]: 
                s.px(round(X)+dx,round(Y)+dy,mix(c,hexc('#c3d3a6'),0.5))
def kennel(s):
    x0,x1,y0,y1=6,32,8,32
    s.box(x0,y0,0,x1,y1,20,'#cf5f4f')
    # plank lines on +y face
    for z in range(4,20,4): s.d.line(R([P(x0,y1,z),P(x1,y1,z)]),fill=hexc('#a8473b'))
    for z in range(4,20,4): s.d.line(R([P(x1,y0,z),P(x1,y1,z)]),fill=hexc('#953f35'))
    # door arch on +y face
    dx0,dx1=13,25
    pts=[P(dx0,y1,0),P(dx1,y1,0),P(dx1,y1,10)]+[P((dx0+dx1)/2+6*math.cos(a),y1,10+5*math.sin(a)) for a in [i*math.pi/8 for i in range(1,8)]]+[P(dx0,y1,10)]
    s.poly(pts,hexc('#3b2622'),hexc('#7a3328'))
    # gable on +x face
    roofc=hexc('#3f7378')
    s.poly([P(x1,y0,20),P(x1,y1,20),P(x1,(y0+y1)/2,31)],sh(hexc('#cf5f4f'),0.78),sh(hexc('#cf5f4f'),0.5))
    # bone plaque
    X,Y=P(x1,y0+7,23)
    s.stamp(["W...W","WWWWW","W...W"],{'W':hexc('#fbf3e1')},round(X)-2,round(Y)-1)
    # front roof plane (slopes toward +y)
    s.poly([P(x0-2,(y0+y1)/2,31),P(x1+2,(y0+y1)/2,31),P(x1+2,y1+4,17),P(x0-2,y1+4,17)],roofc,sh(roofc,0.6))
    # shingles
    for k in range(1,4):
        t=k/4; yy=(y0+y1)/2+(y1+4-(y0+y1)/2)*t; zz=31-14*t
        s.d.line(R([P(x0-2,yy,zz),P(x1+2,yy,zz)]),fill=sh(roofc,0.8))
    # roof edge thickness on +x
    s.poly([P(x1+2,(y0+y1)/2,31),P(x1+2,y1+4,17),P(x1+2,y1+4,15),P(x1+2,(y0+y1)/2,29)],sh(roofc,0.65))
    s.poly([P(x1+2,(y0+y1)/2,31),P(x1+2,y0-4,17),P(x1+2,y0-4,15),P(x1+2,(y0+y1)/2,29)],sh(roofc,0.7))
    s.d.line(R([P(x0-2,(y0+y1)/2,31),P(x1+2,(y0+y1)/2,31)]),fill=sh(roofc,1.25))
    # name sign above door
    X,Y=P((dx0+dx1)/2,y1,15)
    s.d.rectangle([round(X)-6,round(Y)-2,round(X)+6,round(Y)+2],fill=hexc('#fbe7b5'),outline=hexc('#8f5e3a'))
    # tiny letters "MOCHI" as dots
    for i in range(5): s.d.line([round(X)-4+i*2,round(Y)-1,round(X)-4+i*2,round(Y)+1],fill=hexc('#8f5e3a'))
def bed(s,t=0,puppy=True):
    x0,x1,y0,y1=6,34,58,88
    prism(s,rrect(x0,y0,x1,y1,6),0,10,'#e2b24a')
    prism(s,rrect(x0+4,y0+4,x1-4,y1-4,4),5,5.01,'#f3e4c4',top=hexc('#f3e4c4'))
    s.d.line(R([P(x0+6,y1,10),P(x1-6,y1,10)]),fill=hexc('#f6d27a'))
    s.d.line(R([P(x1,y0+6,10),P(x1,y1-6,10)]),fill=hexc('#f6d27a'))
    # quilt pattern on +y face
    for x in range(x0+9,x1-5,5): s.d.line(R([P(x,y1,2),P(x,y1,8)]),fill=hexc('#c99a3a'))
    # little blanket
    s.poly([P(x0+14,y0+6,5.5),P(x1-5,y0+6,5.5),P(x1-5,y0+16,5.5),P(x0+14,y0+16,5.5)],hexc('#8fb9c9'),hexc('#5d8a9c'))
    for k in range(3): s.d.line(R([P(x0+16+k*4,y0+6,5.5),P(x0+16+k*4,y0+16,5.5)]),fill=hexc('#fbf3e1'))
    if not puppy: return   # the game puts real pets on the bed
    X,Y=P((x0+x1)/2,(y0+y1)/2,5)
    rows=sleeping_puppy((t//2)%2)
    s.stamp(rows,PUPPAL,round(X)-10,round(Y)-9)
    # Zz
    zs=[["KKK",".K.","KKK"],["KK","KK"]]
    off=t%4
    s.stamp(["WWW",".W.","WWW"],{'W':(255,255,255)},round(X)+6+off,round(Y)-16-off)
    if off>1: s.stamp(["WW","WW"],{'W':(255,255,255)},round(X)+10+off,round(Y)-21-off)
def bowls(s):
    s.box(50,6,0,80,18,0.8,'#d97a6c')
    for x in range(52,80,5):
        X,Y=P(x,12,1); s.stamp(["W.W","WWW","W.W"],{'W':hexc('#f2b8ad')},round(X)-1,round(Y)-1)
    for cx,top,inner in [(58,'#e6e9ee','kib'),(72,'#e6e9ee','water')]:
        s.cyl(cx,12,1,7,4,hexc('#5aa3b8') if inner=='water' else hexc('#e8a33d'),hexc('#f4f6f8'),hexc('#6b7a85'))
        X,Y=P(cx,12,1)
        if inner=='water':
            s.d.ellipse([round(X)-5,round(Y)-6,round(X)+5,round(Y)-2],fill=hexc('#7fc8de'))
            s.d.line([round(X)-2,round(Y)-5,round(X)+1,round(Y)-5],fill=(255,255,255))
        else:
            s.d.ellipse([round(X)-5,round(Y)-6,round(X)+5,round(Y)-2],fill=hexc('#a5653a'))
            for dx,dy in [(-3,-4),(-1,-5),(1,-4),(3,-4),(0,-3),(2,-5),(-2,-3)]: s.px(round(X)+dx,round(Y)+dy,hexc('#d18a4f'))
def basket(s):
    cx,cy=88,44
    # balls behind rim
    X,Y=P(cx,cy,0)
    s.d.ellipse([round(X)-9,round(Y)-4,round(X)+9,round(Y)+4],fill=hexc('#a8783f'))
    s.d.rectangle([round(X)-9,round(Y)-10,round(X)+9,round(Y)],fill=hexc('#c8955a'))
    for k in range(-9,10,3):
        s.d.line([round(X)+k,round(Y)-10,round(X)+k,round(Y)+2],fill=hexc('#a8783f'))
    for yy in range(-8,1,3): s.d.line([round(X)-9,round(Y)+yy,round(X)+9,round(Y)+yy],fill=hexc('#d9a76a'))
    s.d.ellipse([round(X)-9,round(Y)-14,round(X)+9,round(Y)-6],fill=hexc('#6e4a2a'),outline=hexc('#8f5e3a'))
    for bx,by in [(-4,-13),(3,-14),(0,-16)]:
        s.d.ellipse([round(X)+bx-3,round(Y)+by-3,round(X)+bx+3,round(Y)+by+3],fill=hexc('#d4e157'),outline=hexc('#8a9a2a'))
        s.px(round(X)+bx-1,round(Y)+by-1,(255,255,255))
    # rope toy sticking out
    for k in range(6): s.px(round(X)+5+k//2,round(Y)-14-k,hexc('#e8737a') if k%2 else hexc('#fbf3e1'))
    s.d.line([round(X)-9,round(Y)-10,round(X)-9,round(Y)],fill=hexc('#7a5236'))
    s.d.line([round(X)+9,round(Y)-10,round(X)+9,round(Y)],fill=hexc('#7a5236'))
    s.d.arc([round(X)-9,round(Y)-4,round(X)+9,round(Y)+4],0,180,fill=hexc('#7a5236'))
def rug(s):
    cx,cy=62,64
    rings=[(36,'#c96d55'),(32,'#f2e6c9'),(27,'#7aa6b5'),(22,'#f2e6c9'),(17,'#e2b24a'),(11,'#f2e6c9'),(6,'#c96d55')]
    for r,c in rings:
        X,Y=P(cx,cy,0.2); s.d.ellipse([round(X-r),round(Y-r/2),round(X+r),round(Y+r/2)],fill=hexc(c))
    X,Y=P(cx,cy,0.2); s.d.ellipse([round(X-36),round(Y-18),round(X+36),round(Y+18)],outline=hexc('#9c4f3c'))
def sunlight(s):
    s.blend([P(1,30,0),P(1,62,0),P(36,76,0),P(36,44,0)],hexc('#fff3b0'),70)
    s.blend([P(1,46,0),P(1,47.5,0),P(36,61.5,0),P(36,60,0)],hexc('#d99c62'),40)
def plant(s):
    cx,cy=8,94
    s.cyl(cx,cy,0,6,10,hexc('#5f7fa0'),hexc('#4a3a30'),hexc('#3c5470'))
    X,Y=P(cx,cy,10)
    s.d.line([round(X)-6,round(Y)-4,round(X)+6,round(Y)-4],fill=hexc('#7e9cbd'))
    leaves=[(-7,-14,6,4),(6,-16,6,4),(-3,-22,5,4),(4,-26,5,3),(-8,-24,5,3),(0,-12,5,3),(8,-22,4,3)]
    for lx,ly,rw,rh in leaves:
        s.d.line([round(X),round(Y)-2,round(X)+lx,round(Y)+ly],fill=hexc('#3e6b3a'))
    for lx,ly,rw,rh in leaves:
        s.d.ellipse([round(X)+lx-rw,round(Y)+ly-rh,round(X)+lx+rw,round(Y)+ly+rh],fill=hexc('#4f8a46'),outline=hexc('#2f5a2c'))
        s.d.line([round(X)+lx-rw+2,round(Y)+ly,round(X)+lx+rw-2,round(Y)+ly],fill=hexc('#6fae5c'))
def toys(s):
    X,Y=P(46,94,0)  # tennis ball
    s.d.ellipse([round(X)-3,round(Y)-5,round(X)+3,round(Y)+1],fill=hexc('#d4e157'),outline=hexc('#8a9a2a'))
    s.px(round(X)-1,round(Y)-3,(255,255,255))
    X,Y=P(56,88,0)  # squeaky bone
    s.stamp([".WW.......WW.","WWWWWWWWWWWWW",".WW.......WW."],{'W':hexc('#fbf3e1')},round(X)-6,round(Y)-2)
    s.d.line([round(X)-4,round(Y)+1,round(X)+4,round(Y)+1],fill=hexc('#d9c9a3'))
    X,Y=P(88,74,0)  # rope toy
    for k in range(12):
        s.d.rectangle([round(X)-6+k,round(Y)-1+(k//4)%2,round(X)-6+k,round(Y)+(k//4)%2],fill=hexc('#e8737a') if (k//2)%2 else hexc('#7aa6b5'))
    s.d.ellipse([round(X)-8,round(Y)-2,round(X)-5,round(Y)+1],fill=hexc('#fbf3e1'),outline=hexc('#d9c9a3'))
    s.d.ellipse([round(X)+5,round(Y),round(X)+8,round(Y)+3],fill=hexc('#fbf3e1'),outline=hexc('#d9c9a3'))
def hydrant(s):
    X,Y=P(84,90,0)
    art=["..KKK..",".KrRRK.","KrRRRRK",".KKKKK.","KKrRRKK","KrrRRRK","KKrRRKK",".KrRRK.",".KrRRK.","KKKKKKK","KyyyyyK"]
    s.stamp(art,{'K':hexc('#7a2a26'),'R':hexc('#e2574c'),'r':hexc('#b8403a'),'y':hexc('#f4c542')},round(X)-3,round(Y)-10)
    s.px(round(X)+1,round(Y)-8,hexc('#f7a39a')); s.px(round(X)+1,round(Y)-4,hexc('#f7a39a'))
def dog(s,t=0):
    X,Y=P(62,64,0)
    art=sitting_dog(t%2, blinking=(t%8 in (6,7)))
    # shadow
    s.blend([(X-9,Y-1),(X+11,Y-1),(X+11,Y+2),(X-9,Y+2)],hexc('#7a4a30'),50)
    s.stamp(art,DPAL,round(X)-11,round(Y)-len(art)+1)
def cat_bed(s):
    """A round cushion bed in the sunbeam under the window, so the cats have a home too."""
    cx,cy=14,48.5
    s.cyl(cx,cy,0,10,5,hexc('#7aa6b5'),hexc('#a9cad6'),hexc('#4f7d8c'))
    X,Y=P(cx,cy,5)
    s.d.ellipse([round(X)-7,round(Y)-3,round(X)+7,round(Y)+3],fill=hexc('#f3e4c4'),outline=hexc('#d9c9a3'))
    s.d.ellipse([round(X)-3,round(Y)-1,round(X)+3,round(Y)+1],fill=hexc('#ead7b0'))
    X0,Y0=P(cx,cy,0)
    for dx in (-6,-2,2,6): s.px(round(X0)+dx,round(Y0)+3,hexc('#d6e8ee'))   # stitches on the rim
    # a yarn ball that rolled off the cushion
    X,Y=P(25,51,0)
    s.d.ellipse([round(X)-3,round(Y)-5,round(X)+3,round(Y)+1],fill=hexc('#e8737a'),outline=hexc('#a8464c'))
    s.d.line([round(X)-2,round(Y)-3,round(X)+2,round(Y)-3],fill=hexc('#f2a3a3'))
    s.d.line([round(X)-1,round(Y)-1,round(X)+2,round(Y)-4],fill=hexc('#f2a3a3'))
    s.d.line([round(X)+3,round(Y),round(X)+8,round(Y)+1],fill=hexc('#e8737a'))   # the loose end
def render(t=0):
    s=Scene(); shell(s)
    window(s); frame_pic(s); shelf(s); leash_hooks(s); dog_door(s); bone_clock(s); string_lights(s,t//2)
    rug(s); sunlight(s)
    kennel(s); bowls(s); bed(s,t); basket(s); toys(s); hydrant(s); dog(s,t); plant(s)
    return s.im
if __name__=='__main__':
    im=render(0)
    bg=Image.new('RGBA',(N,N),hexc('#7fa7b5')+(255,)); bg.alpha_composite(im)
    bg.resize((768,768),Image.NEAREST).save('t.png')
