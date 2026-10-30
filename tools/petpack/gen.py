from PIL import Image
import random
def hx(h): h=h.lstrip('#'); return tuple(int(h[i:i+2],16) for i in (0,2,4))

# Every pet is drawn natively on this small canvas, so each eye, nose and collar tag is a pixel placed by hand
# (a 1px detail doesn't survive shrinking a bigger drawing). Next to Leo (32x40) a pet stands about waist high.
# The width is odd on purpose: the nose, mouth and collar tag get one exact middle column.
FW,FH=21,21
FEET=(FW//2,FH-2)        # (10, 19): the middle of the feet and the one bottom row every frame ends on
HEAD_X,BODY_X,TAIL_X=4,5,16   # head is 13 wide (x 4..16), body 11 wide (x 5..15), tails start at x 16
def mir(rows):
    """Mirror a half (its last column is the middle) into a symmetric piece of odd width."""
    return [r+r[-2::-1] for r in rows]
# Letters: K outline, B fur, s fur shade, M muzzle/chest, P paws, C collar, c collar shade, Y collar tag, E eye, U blue eye,
# N nose, T tongue, Q cat nose, I inner ear, F floppy ear, X/Z markings, w whiskers, H heart, G food, L bowl.

# ---------- DOG PARTS ----------
D_EARS={
 'pointy':mir(["K......","KBK....","KBIKKKK"]),
 'big':mir(["K......","KBK....","KBIK...","KBIBKKK"]),
 'floppy':mir(["..KKKKK"]),
 'folded':mir(["KK.....","KFKKKKK"]),
 'fluff':mir(["..KK...",".KBBKKK"]),
}
D_FACE=mir([
"KBBBBBB",   # forehead
"KBBBBBB",
"KBBBEBB",   # eyes: one pixel each, 3 apart
"KBBBMMM",
"KBBMMMN",   # nose: one pixel, dead center
".KBMMMK",   # mouth: one pixel under the nose
"..KKKKK",   # chin
])
D_BODY=mir([
"KCCCCY",    # collar with its tag in the middle
"KBMMMM",
"KBBMMM",
"KBMMMK",    # front legs, one dark line between them
"KBPPPK",    # paws
".KKKKK",
])
D_TAILS={
 'curly':["..KK.",".KBBK",".KBK.","KBK..","KK..."],
 'curly2':["..KK.","..KBK",".KBBK","KBK..","KK..."],
 'straight':["...K.","..KBK",".KBK.","KBK..","KK..."],
 'straight2':["..KK.","..KBK","..KBK",".KBK.","KK..."],
 'stub':["","",".KK..","KBBK.",".KK.."],
 'plume':["..KKK",".KBBBK","KBBBK.","KBBK..","KK...."],
 'plume2':["KKK..","KBBK.",".KBBK","KBBK.","KK..."],
}
FLAP=[".KKK","KFFK","KFFK","KFFK","KFFK",".KKK"]   # a floppy ear hanging beside the head
# ---------- CAT PARTS ----------
C_EARS=mir(["K......","KIK....","KBIKKKK"])
C_FACE=mir([
"KBBBBBB",
"KBBBBBB",
"KBBBEBB",   # eyes
"KBBBBBQ",   # nose
".KBBMMK",   # mouth
"..KBBBB",
"...KKKK",
])
C_BODY=mir([
"KCCCCY",
"KBMMMM",
"KBBMMM",
"KBBMMM",
"KBPPPK",
".KKKKK",
])
C_TAILS={
 'up':["..KK.",".KBBK",".KBK.",".KBK.","KBK..","KBK..","KK..."],
 'up2':["KK...","KBBK.",".KBK.","..KBK","..KBK",".KBK.","KK..."],
 'fluffy':["..KKK",".KBBBK","KBBBBK","KBBBK.",".KBBK.",".KBK..","KK...."],
 'fluffy2':["KKK...","KBBK..","KBBBK.",".KBBBK","..KBBK",".KBK..","KK...."],
}
# ---------- SLEEP: curled up, ears and tail showing ----------
SLEEP=[
"..KK..KK.............",
".KBIKKBIK............",
"KBBBBBBBBKKKKKK......",
"KBBBBBBBBBBBBBBKK....",
"KBBBBBBBBBBBBBBBBK...",
"KBKKBBKKBBBBBBBBBBK..",
"KBBBBBBBBBBBBBBBBBK..",
"KBMMNMMKKKKKKKKKKKKK.",
".KMMMMMKsssssssssssMK",
"..KKKKKKKKKKKKKKKKKK.",
]   # eyes shut, ears up; the tail lies along the bottom and sticks out past the body with a pale tip
def sleep_floppy(rows):
    g=[list(r.ljust(21,'.')) for r in rows]
    for y in (0,1):
        for x in range(9): g[y][x]='.'
    g[1]=list(".KKKKKKK."+''.join(g[1][9:]))        # a rounded head instead of ear tips
    for y,x,c in [(2,1,'F'),(2,2,'F'),(3,0,'K'),(3,1,'F'),(3,2,'F'),(3,3,'F'),(4,1,'F'),(4,2,'F'),(4,3,'F'),(5,0,'K'),(5,2,'F'),(5,3,'K')]: g[y][x]=c
    return [''.join(r) for r in g]
# ---------- COMPOSE ----------
def grid(): return [['.']*FW for _ in range(FH)]
def put(g,art,ox,oy):
    for j,r in enumerate(art):
        for i,ch in enumerate(r):
            if ch!='.' and 0<=oy+j<FH and 0<=ox+i<FW: g[oy+j][ox+i]=ch
def pose(spec,frame):
    """frame: sitA sitB blink happy eatA eatB sleepA sleepB"""
    g=grid(); cat=spec['kind']=='cat'
    if frame.startswith('sleep'):
        rows=SLEEP if (cat or spec['ears']!='floppy') else sleep_floppy(SLEEP)
        rows=[r.ljust(21,'.') for r in rows]
        if frame=='sleepB':   # breathe: the body rises one pixel
            gg=[list(r) for r in rows]; new=[r[:] for r in gg]
            for y in range(len(gg)-2):
                for x in range(9,19): new[y][x]=gg[y+1][x]   # (not the tail: it stays on the floor)
            rows=[''.join(r) for r in new]
        rows=apply_marks(spec,'sleep',rows)
        put(g,rows,0,FH-len(rows)-1)
        return g
    ears=C_EARS if cat else D_EARS[spec['ears']]
    face=C_FACE if cat else D_FACE
    body=C_BODY if cat else D_BODY
    head=[list(r) for r in ears]+[list(r) for r in face]; ne=len(ears)
    E=ne+2                                   # the eye row
    eyes=[x for x in range(13) if head[E][x] in 'EU']
    if frame in('blink','eatA','eatB'):      # eyes shut: a two-pixel dash pointing at the nose
        for x in eyes: head[E][x]='K'; head[E][x+1 if x<6 else x-1]='K'
    if frame=='happy':                       # happy eyes: ^ ^
        for x in eyes:
            head[E][x]='B'; head[E-1][x]='K'; head[E][x-1]='K'; head[E][x+1]='K'
        head[ne+5][6]='T'                    # and the tongue out
    if frame.startswith('eat'): head[ne+5][6]='T'
    if spec.get('blue'):
        for y in range(len(head)):
            for x in range(13):
                if head[y][x]=='E': head[y][x]='U'
    head=[''.join(r) for r in head]
    head=apply_marks(spec,'head',head)
    body=apply_marks(spec,'body',body)
    tails=C_TAILS if cat else D_TAILS
    tk=spec['tail']+('2' if frame in('sitB','happy','eatB') and spec['tail']+'2' in tails else '')
    tail=apply_marks(spec,'tail',tails[tk])
    hh=len(head); by=FH-1-len(body)
    hy=by-hh
    bob={'sitB':1,'happy':-1,'eatA':2,'eatB':3}.get(frame,0)
    put(g,tail,TAIL_X,by+6-len(tail))
    put(g,body,BODY_X,by)
    put(g,head,HEAD_X,hy+bob)
    if not cat and spec['ears']=='floppy':
        put(g,FLAP,HEAD_X-3,hy+bob+ne+1); put(g,[r[::-1] for r in FLAP],HEAD_X+12,hy+bob+ne+1)
    if cat:  # whiskers: two pixels on each side, sloping down
        wy=hy+bob+ne+3
        for x,y in [(HEAD_X-1,wy),(HEAD_X-2,wy+1),(HEAD_X+13,wy),(HEAD_X+14,wy+1)]:
            if g[y][x]=='.': g[y][x]='w'
    if frame=='happy':
        put(g,[".H.H.","HHHHH",".HHH.","..H.."],TAIL_X,max(0,hy-1))
    if frame.startswith('eat'):
        put(g,["KKKKKKKKKKK","KGGGGGGGGGK","KLLLLLLLLLK",".KKKKKKKKK."],5,FH-5)
        if frame=='eatB':
            for x in (7,9,11,13): g[FH-5][x]='G'
    return g
# ---------- MARKINGS ----------
# Each one repaints some fur letters for a breed. g is one part (head, body, tail or sleep) as a list of rows; for the
# head, the last 7 rows are the face (the rows above are ears), so face row 0 is len(g)-7.
def apply_marks(spec,part,rows):
    f=spec.get('marks')
    if not f: return rows
    g=[list(r) for r in rows]
    f(g,part); return [''.join(r) for r in g]
def FY(g,part): return len(g)-7 if part=='head' else 0
def each(g):
    for y in range(len(g)):
        for x in range(len(g[y])): yield x,y,g[y][x]
def box(g,x0,y0,w,h,fro,to):
    for y in range(y0,y0+h):
        for x in range(x0,x0+w):
            if 0<=y<len(g) and 0<=x<len(g[y]) and g[y][x] in fro: g[y][x]=to

def m_spots(g,part):    # Dalmatian: three clear 2x2 spots (head, flank, side), spotted back when curled up
    f=FY(g,part)
    if part=='head': box(g,8,f,2,2,'BM','X')
    if part=='body': box(g,1,1,2,2,'BM','X'); box(g,8,2,2,2,'BM','X')
    if part=='sleep': box(g,12,3,2,2,'B','X'); box(g,15,5,2,2,'B','X'); box(g,4,2,2,2,'B','X')
def m_pug(g,part):
    m_points(g,part)
    if part=='head': g[len(g)-2][6]='T'          # the pug's tongue is always out
def m_golden(g,part):
    if part=='head': g[len(g)-2][6]='T'          # and the retriever grins
def m_corgi(g,part):     # white blaze down the face
    f=FY(g,part)
    if part=='head':
        for y in range(f,f+5): box(g,5,y,3,1,'B','M')
def m_husky(g,part):     # white mask with a dark cap
    f=FY(g,part)
    if part=='head':
        for y in range(f+2,f+7): box(g,2,y,9,1,'B','M')
        box(g,5,f,3,2,'B','M')
def m_beagle(g,part):    # dark saddle, white blaze and tail tip
    f=FY(g,part)
    if part=='body': box(g,0,1,11,3,'B','X')
    if part=='head': box(g,5,f+1,3,4,'B','M')
    if part=='tail': box(g,0,0,5,1,'B','M')
    if part=='sleep': box(g,11,0,7,5,'B','X')
def m_points(g,part):    # pug and siamese: a dark face mask, ears, paws and tail
    for x,y,c in each(g):
        if part=='head' and c in 'IM' and y>=0: g[y][x]='X' if c=='M' else 'Z'
        elif part=='tail' and c=='B': g[y][x]='X'
        elif part=='body' and c=='P': g[y][x]='X'
        elif part=='sleep' and c in 'MI': g[y][x]='X' if c=='M' else 'Z'
def m_poodle(g,part):
    f=FY(g,part)
    if part=='head': box(g,2,f,9,2,'B','X')
    if part=='tail': box(g,0,0,5,2,'B','X')
def m_tabby(g,part):
    f=FY(g,part)
    if part=='head':
        box(g,5,f,1,1,'B','X'); box(g,7,f,1,1,'B','X'); box(g,6,f+1,1,1,'B','X')   # the M on the forehead
        box(g,1,f+3,1,2,'B','X'); box(g,11,f+3,1,2,'B','X')                         # cheek stripes
    for x,y,c in each(g):
        if c!='B': continue
        if part=='body' and y%2==1 and (x<=1 or x>=9): g[y][x]='X'
        elif part=='tail' and y%2==0: g[y][x]='X'
        elif part=='sleep' and x>=11 and y%2==0: g[y][x]='X'
def m_calico(g,part):
    f=FY(g,part)
    for x,y,c in each(g):
        if c not in 'Bs': continue
        if part=='head':
            if x<=5 and y-f<=2: g[y][x]='X'
            elif x>=8 and y-f<=1: g[y][x]='Z'
        elif part=='body':
            if x<=2 and y>=2: g[y][x]='Z'
            elif x>=8 and y<=2: g[y][x]='X'
        elif part=='tail': g[y][x]='X' if y<3 else 'Z'
        elif part=='sleep':
            if x>=13 and y<=4: g[y][x]='X'
            elif 7<=x<=12 and y>=5: g[y][x]='Z'
def m_tux(g,part):
    if part=='body': box(g,0,0,11,7,'P','M')
def m_pixel(g,part):
    for x,y,c in each(g):
        if c=='B' and (x+y)%4==0: g[y][x]='X'
        elif c=='M' and (x*3+y)%5==0: g[y][x]='Z'
def m_cosmic(g,part):
    rnd=random.Random(len(part)*31)
    for x,y,c in each(g):
        if c in 'Bs' and rnd.random()<0.11: g[y][x]='X' if rnd.random()<0.6 else 'Z'
def m_ragdoll(g,part):
    f=FY(g,part)
    for x,y,c in each(g):
        if part=='head':
            if c=='I': g[y][x]='Z'
            elif c=='B' and y-f<=4 and (y-f<=1 or x<=3 or x>=9): g[y][x]='X'
        elif part=='tail' and c=='B': g[y][x]='X'
        elif part=='sleep' and c=='B' and y<=3 and x<=8: g[y][x]='X'
