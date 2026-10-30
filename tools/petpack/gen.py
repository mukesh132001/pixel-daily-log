from PIL import Image
import random
def hx(h): h=h.lstrip('#'); return tuple(int(h[i:i+2],16) for i in (0,2,4))
BW,BH=28,30   # the pets are drawn by hand on this canvas
# ...then shrunk for the game, so they stand roughly knee-to-waist next to Leo (he is 32x40).
SHRINK=0.7
FW,FH=round(BW*SHRINK),round(BH*SHRINK)   # the frame the game uses: 20x21
FEET=(FW//2,FH-2)                         # the middle of the feet, and the shared bottom row, in that frame
def mir(rows): return [r+r[::-1] for r in rows]
# ---------- DOG PARTS (region letters) ----------
D_EARS={
 'pointy':mir([".KK......","KBBK.....","KBIBK....","KBIIBKKKK"]),
 'big':mir(["KK.......","KBK......","KBIK.....","KBIIK....","KBIIBKKKK"]),
 'floppy':mir(["....KKKKK"]),
 'folded':mir([".KKK.....","KFFFKKKKK"]),
 'fluff':mir(["...KKK...","..KBBBKKK",".KBBBBBBB"]),
}
D_FACE=mir([
"KBBBBBBBB",
"KBBBBBBBB",
"KBBMBBBBB",
"KBBEEBBBB",
"KBBEWBBBM",
"KBMMMMMMM",
".KMMMMMMN",
".KMMMMKMM",
"..KKMMMKT",
"...KKKKKK",
])
D_BODY=mir([
"...KCCCCC",
"..KBCCccY",
"..KBBMMMM",
".KBBBMMMM",
".KBBBBMMM",
".KBBBBMMM",
".KBBBBKMM",
".KsBBBKMM",
"KssBBKMMK",
"KsPPPKPPK",
".KKKKKKKK",
])
D_TAILS={
 'curly':["..KKK.",".KBBBK","KBMMBK","KBK.KK","KBK...",".KBK.."],
 'curly2':[".KKK..","KBBBK.","KBMMBK",".KKBBK","...KBK","..KBK."],
 'straight':["....K.","...KBK","..KBK.",".KBK..","KBK...","KK...."],
 'straight2':["..KK..","..KBK.","..KBK.","..KBK.",".KBK..",".KK..."],
 'stub':["","","","..KK..",".KBBK.",".KKK.."],
 'plume':[".KKKK.","KBBMBK","KBBBMK",".KBBK.",".KBK..","..K..."],
 'plume2':["..KKKK",".KBBMK","KBBBBK","KBBK..",".KBK..","..K..."],
}
def floppy_ears(g,top):
    # hanging ears on both sides of head rows top+1..top+7
    for j in range(7):
        for i in range(3):
            y=top+1+j
            for x in (i, 17-i):
                if 0<=y<len(g): g[y][x]= 'K' if (i==0 or j==6 or (i==2 and j<1)) else 'F'
    return g
# ---------- CAT PARTS ----------
C_EARS=mir([".K.......","KIK......","KIIK.....","KBIBKKKKK"])
C_FACE=mir([
"KBBBBBBBB",
"KBBBBBBBB",
"KBBEEBBBB",
"KBBEWBBBB",
"KBBEEBBBB",
"KBBBBBMMM",
".KBBBMMMQ",
".KBBBMMKM",
"..KKBBMMM",
"...KKKKKK",
])
C_BODY=mir([
"....KCCCC",
"...KBCcCY",
"...KBBMMM",
"..KBBBMMM",
"..KBBBBMM",
"..KBBBBMM",
"..KBBBBKM",
"..KsBBBKM",
".KssBBKMM",
".KsPPPKPP",
"..KKKKKKK",
])
C_TAILS={
 'up':["...KK.","..KBBK","..KBK.","..KBK.",".KBK..",".KBK..","KBK...","KK...."],
 'up2':["KK....","KBBK..",".KBK..","..KBK.","..KBK.",".KBK..","KBK...","KK...."],
 'fluffy':["..KKK.",".KBBBK","KBBBBK","KBBBK.",".KBBK.",".KBK..","KBK...","KK...."],
 'fluffy2':[".KKK..","KBBBK.","KBBBBK",".KBBBK",".KBBK.",".KBK..","KBK...","KK...."],
}
# ---------- SLEEP ----------
SLEEP=[
"..KK....KK...........",
".KBIK..KIBK..KKKKK...",
".KBBBKKKBBK.KBBBBBKK.",
"KBBBBBBBBBKKBBBBBBBBK",
"KBBBBBBBBBBKBBBBKKKBK",
"KBKKBBBKKBBKBBBKBMMKK",
"KMMMMMMMMMMKBBBKBBMBK",
"KMMMMNNMMMMKBBBBKKKBK",
".KMMMMMMMMKBBBBBBBBBK",
"..KMMMMMKBBBBBBBBBBK.",
"..KMMMMMKsssssssssK..",
"...KKKKKKKKKKKKKKKK..",
]
def sleep_floppy(rows):
    g=[list(r) for r in rows]
    for y in (0,1,2):
        for x in range(12): 
            if g[y][x] in 'KBI': g[y][x]='.'
    # round head top
    g[2]=list(".KKKKKKKKKK"+''.join(g[2][11:]))
    # ear flop on left side
    for (x,y,c) in [(0,3,'K'),(1,3,'F'),(2,3,'F'),(0,4,'K'),(1,4,'F'),(2,4,'F'),(0,5,'K'),(1,5,'F'),(2,5,'K')]: g[y][x]=c
    return [''.join(r) for r in g]
# ---------- COMPOSE ----------
def grid(): return [['.']*BW for _ in range(BH)]
def put(g,art,ox,oy):
    for j,r in enumerate(art):
        for i,ch in enumerate(r):
            if ch!='.' and 0<=oy+j<BH and 0<=ox+i<BW: g[oy+j][ox+i]=ch
def pose(spec,frame):
    """frame: sitA sitB blink happy eatA eatB sleepA sleepB"""
    g=grid(); cat=spec['kind']=='cat'
    if frame.startswith('sleep'):
        rows=SLEEP if (cat or spec['ears'] not in('floppy',)) else sleep_floppy(SLEEP)
        rows=[r for r in rows]
        if frame=='sleepB':   # breathe: body area rises 1px
            gg=[list(r.ljust(21,'.')) for r in rows]; new=[r[:] for r in gg]
            for y in range(len(gg)-2):
                for x in range(12,21): new[y][x]=gg[y+1][x]
            rows=[''.join(r) for r in new]
        rows=apply_marks(spec,'sleep',rows)
        put(g,rows,3,BH-len(rows)-1)
        return g
    ears=C_EARS if cat else D_EARS[spec['ears']]
    face=C_FACE if cat else D_FACE
    body=C_BODY if cat else D_BODY
    head=[r for r in ears]+[r for r in face]
    head=[list(r) for r in head]; ne=len(ears)
    E=ne+(2 if cat else 3)
    if frame in('blink','eatA','eatB'):
        for y in range(E,E+3):
            for x in range(18):
                if head[y][x] in 'EW': head[y][x]='B'
        for x in (3,4,13,14): head[E+1][x]='K'
    if frame=='happy':
        for y in range(E,E+3):
            for x in range(18):
                if head[y][x] in 'EW': head[y][x]='B'
        for x,y in [(3,E+1),(4,E),(5,E+1),(12,E+1),(13,E),(14,E+1)]: head[y][x]='K'
    if spec.get('blue') : 
        for y in range(len(head)):
            for x in range(18):
                if head[y][x]=='E': head[y][x]='U'
    head=[''.join(r) for r in head]
    head=apply_marks(spec,'head',head)
    body=apply_marks(spec,'body',body)
    tails=C_TAILS if cat else D_TAILS
    tk=spec['tail']+('2' if frame in('sitB','happy','eatB') and spec['tail']+'2' in tails else '')
    tail=apply_marks(spec,'tail',tails[tk])
    hh=len(head); by=BH-1-len(body)
    hy=by-hh+1
    bob={'sitB':1,'happy':-1,'eatA':3,'eatB':4}.get(frame,0)
    put(g,tail,20,by+3-(len(tail)-6))
    put(g,body,5,by)
    put(g,head,5,hy+bob)
    if not cat and spec['ears']=='floppy':
        ear=["KKKK.","KFFFK","KFFFK","KFFFK","KFFFK","KFFFK",".KFFK","..KK."]
        put(g,ear,3,hy+bob+1); put(g,[r[::-1] for r in ear],20,hy+bob+1)
    if cat:  # whiskers
        wy=hy+bob+len(ears)+6
        for x,y in [(3,wy),(4,wy),(3,wy+2),(4,wy+1),(23,wy),(24,wy),(23,wy+1),(24,wy+2)]:
            if g[y][x]=='.': g[y][x]='w'
    if frame=='happy':
        put(g,[".H.H.","HHHHH",".HHH.","..H.."],20,max(0,hy-2))
    if frame.startswith('eat'):
        put(g,["KKKKKKKKKKKK","KGGGGGGGGGGK","KLLLLLLLLLLK",".KLLLLLLLLK.","..KKKKKKKK.."],8,BH-6)
        if frame=='eatB':
            for x in (10,13,16,18): g[BH-6][x]='G'
    return g
# ---------- MARKINGS ----------
def apply_marks(spec,part,rows):
    f=spec.get('marks')
    if not f: return rows
    g=[list(r) for r in rows]
    f(g,part); return [''.join(r) for r in g]
def m_spots(g,part):
    rnd=random.Random(len(part)*13+5)
    for y in range(len(g)):
        for x in range(len(g[y])-1):
            if g[y][x] in 'Bs' and g[y][x+1] in 'Bs' and rnd.random()<0.15:
                g[y][x]='X'; g[y][x+1]='X'
                if y+1<len(g) and g[y+1][x] in 'Bs': g[y+1][x]='X'

def m_tabby(g,part):
    for y in range(len(g)):
        for x in range(len(g[y])):
            if g[y][x] in 'B':
                if part=='head' and y in(4,5) and x in(7,8,9,10): g[y][x]='X'
                elif part=='head' and y==6 and x in(8,9): g[y][x]='X'
                elif part in('body','sleep') and (y%3==1) : g[y][x]='X'
                elif part=='tail' and y%2==0: g[y][x]='X'
                elif part=='head' and x in(1,2,15,16) and y in(8,10): g[y][x]='X'
def m_calico(g,part):
    for y in range(len(g)):
        for x in range(len(g[y])):
            if g[y][x] in 'Bs':
                if part=='head' and x<8 and y<9: g[y][x]='X'
                elif part=='head' and x>=11 and 3<y<8: g[y][x]='Z'
                elif part=='body' and x<6 and y>2: g[y][x]='Z'
                elif part=='body' and x>12 and y<6: g[y][x]='X'
                elif part=='tail': g[y][x]='X' if y<3 else 'Z'
                elif part=='sleep' and x>13 and y<6: g[y][x]='X'
                elif part=='sleep' and 11<x<16 and y>=6: g[y][x]='Z'
def m_points(g,part):  # siamese / pug style dark points
    for y in range(len(g)):
        for x in range(len(g[y])):
            c=g[y][x]
            if part=='head' and c in 'IM' and y>=1 and not (c=='I' and y<0): g[y][x]='X' if c=='M' else 'Z'
            if part=='tail' and c=='B' and y<5: g[y][x]='X'
            if part=='body' and c=='P': g[y][x]='X'
            if part=='sleep' and c in 'MI': g[y][x]='X' if c=='M' else 'Z'
def m_mask_husky(g,part):
    if part=='head':
        for y in range(len(g)):
            for x in range(len(g[y])):
                if g[y][x]=='B' and 6<=x<=11 and y>=4: g[y][x]='M'
                if g[y][x]=='B' and y in(7,8) and x in(2,3,14,15): g[y][x]='M'
def m_beagle(g,part):
    for y in range(len(g)):
        for x in range(len(g[y])):
            if part=='body' and g[y][x]=='B' and y<7: g[y][x]='X'
            if part=='head' and g[y][x]=='B' and 7<=x<=10 and y>=2: g[y][x]='M'
            if part=='tail' and g[y][x]=='B' and y<2: g[y][x]='M'
            if part=='sleep' and g[y][x]=='B' and x>13 and y<7: g[y][x]='X'
def m_tux(g,part):
    for y in range(len(g)):
        for x in range(len(g[y])):
            if part=='body' and g[y][x]=='P': g[y][x]='M'
def m_pixel(g,part):
    for y in range(len(g)):
        for x in range(len(g[y])):
            if g[y][x]=='B' and (x+y)%4==0: g[y][x]='X'
            if g[y][x]=='M' and (x*3+y)%5==0: g[y][x]='Z'
def m_cosmic(g,part):
    rnd=random.Random(len(part)*31)
    for y in range(len(g)):
        for x in range(len(g[y])):
            if g[y][x] in 'Bs' and rnd.random()<0.09: g[y][x]='X' if rnd.random()<0.6 else 'Z'
def m_poodle(g,part):
    if part=='head':
        for y in range(len(g)):
            for x in range(len(g[y])):
                if g[y][x]=='B' and y<4: g[y][x]='X'
    if part=='tail':
        for y in range(len(g)):
            for x in range(len(g[y])):
                if g[y][x]=='B' and y<3: g[y][x]='X'

def m_ragdoll(g,part):
    for y in range(len(g)):
        for x in range(len(g[y])):
            c=g[y][x]
            if part=='head' and c=='I': g[y][x]='Z'
            if part=='head' and c=='B' and (y<6 or x in(1,2,3,4,5,12,13,14,15,16)) and y<10: g[y][x]='X'
            if part=='tail' and c=='B': g[y][x]='X'
            if part=='sleep' and c=='B' and y<6 and x<11: g[y][x]='X'

# ---------- SHRINK ----------
# Pixel art can't be scaled by a plain resize (lines turn blurry or vanish). So every pixel of the smaller frame looks at
# the bigger pixels it covers and takes the color that covers most of it, with two nudges that keep the drawing alive:
# an outline wins even when it covers only about a third of the pixel, and small features (eyes, nose, tongue,
# collar, heart) count extra so they don't get swallowed by the fur around them.
OUTLINE='K'
FEATURES={'E':1.7,'U':1.7,'N':1.7,'W':1.3,'T':1.5,'Q':1.4,'H':1.5,'Y':1.4,'C':1.2,'c':1.2,'w':1.2,'G':1.1,'L':1.1}
KEEP={'K':0.36,'E':0.28,'U':0.28,'N':0.28}   # these win a pixel at this much coverage: the outline, eyes and nose
OUTLINE_AT=KEEP[OUTLINE]
OPAQUE_AT=0.42     # anything covering less than this of a pixel is left empty
def shrink_grid(g):
    sx,sy=BW/FW,BH/FH; area=sx*sy
    out=[['.']*FW for _ in range(FH)]
    for ty in range(FH):
        y0,y1=ty*sy,(ty+1)*sy
        for tx in range(FW):
            x0,x1=tx*sx,(tx+1)*sx
            w={}
            for yy in range(int(y0),min(BH,int(y1)+1)):
                oy=min(y1,yy+1)-max(y0,yy)
                if oy<=0: continue
                for xx in range(int(x0),min(BW,int(x1)+1)):
                    ox=min(x1,xx+1)-max(x0,xx)
                    if ox<=0: continue
                    c=g[yy][xx]; w[c]=w.get(c,0)+ox*oy
            solid=sum(v for c,v in w.items() if c!='.')/area
            if solid<OPAQUE_AT: continue
            kept={c:w.get(c,0)/area for c,need in KEEP.items() if w.get(c,0)/area>=need}
            if kept: out[ty][tx]=max(kept,key=kept.get); continue
            fill={c:v*FEATURES.get(c,1) for c,v in w.items() if c not in('.',OUTLINE)}
            out[ty][tx]=max(fill,key=fill.get) if fill else OUTLINE
    # an outline should stay one pixel thick: where four outline pixels make a block, drop one corner
    for y in range(FH-1):
        for x in range(FW-1):
            if all(out[y+j][x+i]==OUTLINE for j in (0,1) for i in (0,1)):
                out[y][x+1 if x+1<FW and out[y+1][x+1]==OUTLINE else x]='.'
    return out

def sit_on_feet(g):
    """Slide the finished frame up or down so its lowest pixel is on the shared feet row (the same for every pet and frame)."""
    rows=[y for y in range(FH) if any(c!='.' for c in g[y])]
    if not rows: return g
    d=FEET[1]-max(rows)
    if d==0: return g
    out=[['.']*FW for _ in range(FH)]
    for y in range(FH):
        if 0<=y-d<FH: out[y]=g[y-d][:]
    return out
