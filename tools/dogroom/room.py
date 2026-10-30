from iso import *
WH=72; T=5
C=dict(
 rim=hexc('#fbf1d6'), rimS=hexc('#e7d7b0'),
 wallL=hexc('#9db58f'), wallR=hexc('#c3d3a6'),
 wain=hexc('#f2e6c9'), wainS=hexc('#d9c9a3'),
 floor=hexc('#d99c62'), plank=hexc('#c0834d'), floorHi=hexc('#e6ae74'),
 base=hexc('#8f5e3a'),
)
def shell(s):
    # floor slab with front thickness
    s.box(-T,-T,-6,100,100,0,C['rim'],ol=False,top=C['floor'])
    s.poly([P(-T,100,-6),P(100,100,-6),P(100,100,0),P(-T,100,0)],C['rimS'])
    s.poly([P(100,-T,-6),P(100,100,-6),P(100,100,0),P(100,-T,0)],sh(C['rimS'],0.9))
    # planks: lines along x every 8 units of y, with staggered seams
    for y in range(8,100,8):
        s.d.line(R([P(0,y),P(100,y)]),fill=C['plank'])
    import random; random.seed(4)
    for row in range(0,100,8):
        off=random.randint(0,30)
        for x in range(off,96,34):
            s.d.line(R([P(x,row+1),P(x,row+7)]),fill=C['plank'])
    # left wall (plane x=0, thickness to -T)
    s.poly([P(0,0,0),P(0,100,0),P(0,100,WH),P(0,0,WH)],C['wallL'])
    s.poly([P(0,0,0),P(100,0,0),P(100,0,WH),P(0,0,WH)],C['wallR'])
    # wainscot panels
    for (a,b,plane,c) in [(0,100,'L',C['wain']),(0,100,'R',sh(C['wain'],1.03))]:
        f=(lambda u,z:P(0,u,z)) if plane=='L' else (lambda u,z:P(u,0,z))
        s.poly([f(a,0),f(b,0),f(b,20),f(a,20)],c)
        s.d.line(R([f(a,20),f(b,20)]),fill=C['wainS']); s.d.line(R([f(a,21),f(b,21)]),fill=sh(C['wainS'],0.85))
        for u in range(10,100,12): s.d.line(R([f(u,2),f(u,18)]),fill=C['wainS'])
        s.d.line(R([f(a,1),f(b,1)]),fill=C['base'])
        s.d.line(R([f(a,0),f(b,0)]),fill=C['base'])
    # paw-dot wallpaper on right wall above wainscot
    paw=[(0,0),(-2,-2),(0,-3),(2,-2)]
    for i,x in enumerate(range(8,100,14)):
        for j,z in enumerate(range(30,WH-4,14)):
            xx=x+(7 if j%2 else 0)
            if xx>98: continue
            X,Y=P(xx,0,z); c=sh(C['wallR'],0.9)
            s.d.rectangle([round(X),round(Y),round(X)+1,round(Y)],fill=c)
            for dx,dy in paw[1:]: s.px(round(X+dx),round(Y+dy),c)
    # wall tops (rim) + outer edges
    s.poly([P(-T,-T,WH),P(0,-T+0,WH),P(0,100,WH),P(-T,100,WH)],C['rim'])
    s.poly([P(-T,-T,WH),P(100,-T,WH),P(100,0,WH),P(0,0,WH)],C['rim'])
    s.poly([P(-T,100,-6),P(0,100,-6),P(0,100,WH),P(-T,100,WH)],C['rimS'])
    s.poly([P(100,-T,-6),P(100,0,-6),P(100,0,WH),P(100,-T,WH)],sh(C['rimS'],0.85))
    s.d.line(R([P(0,0,0),P(0,0,WH)]),fill=sh(C['wallL'],0.8))
