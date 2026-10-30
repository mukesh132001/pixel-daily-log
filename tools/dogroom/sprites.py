from iso import hexc
DPAL={'K':hexc('#4a2c20'),'O':hexc('#e3954a'),'o':hexc('#c0743a'),'C':hexc('#fbeedb'),'c':hexc('#e3cfae'),
      'P':hexc('#f2a3a3'),'N':hexc('#2a1a14'),'E':hexc('#2a1a14'),'W':(255,255,255),'R':hexc('#d9534f'),'r':hexc('#a83a37'),
      'Y':hexc('#f4c542'),'T':hexc('#e8737a')}
HALF_HEAD=[
".KK......",
"KOOK.....",
"KOPOK....",
"KOPPOKKKK",
"KOOOOOOOO",
"KOOOOOOOO",
"KOOCOOOOO",
"KOOEEOOOO",
"KOOEWOOOC",
"KOCCCCCCC",
".KCCCCCCN",
".KCCCCKCC",
"..KKCCCKT",
"...KKKKKK",
]
HALF_BODY=[
"...KRRRRR",
"..KORRrrY",
"..KOOCCCC",
".KOOOCCCC",
".KOOOOCCC",
".KOOOOCCC",
".KOOOOKCC",
".KoOOOKCC",
"KooOOKCCK",
"KoCCCKCCK",
".KKKKKKKK",
]
def mirror(rows): return [r+r[::-1] for r in rows]
HEAD=mirror(HALF_HEAD)
# fix asymmetric details after mirroring: tongue only center
HEAD[12]=HEAD[12][:8]+"TT"+HEAD[12][10:]
def blink(head):
    h=list(head); h[7]=h[7].replace('E','O'); h[8]=h[8].replace('E','K').replace('W','K'); return h
BODY=mirror(HALF_BODY)
BODY[1]=BODY[1][:8]+"YY"+BODY[1][10:]
TAILS=[
["..KKK.",".KOOOK","KOCCOK","KOK.KK","KOK...",".KOK.."],
[".KKK..","KOOOK.","KOCCOK",".KKOOK","...KOK","..KOK."],
]
def sitting_dog(frame=0,blinking=False):
    """returns (rows, width) 22 wide; tail wags between 2 positions; head bob"""
    W=24; Hh=len(HEAD)+len(BODY)
    g=[['.']*W for _ in range(Hh+1)]
    def put(art,ox,oy):
        for j,r in enumerate(art):
            for i,ch in enumerate(r):
                if ch!='.' and 0<=oy+j<len(g) and 0<=ox+i<W: g[oy+j][ox+i]=ch
    tail=TAILS[frame%2]
    put(tail,17,len(HEAD)+(1 if frame%2 else 2))
    put(BODY,1,len(HEAD)-1+1)
    head=blink(HEAD) if blinking else HEAD
    put(head,0,(1 if frame in(1,2) else 0))
    return [''.join(r) for r in g]
SLEEP=[
"..KK....KK...........",
".KOPK..KPOK..KKKKK...",
".KOOOKKKOOK.KOOOOOKK.",
"KOOOOOOOOOKKOOOOOOOOK",
"KOOOOOOOOOOKOOOOKKKOK",
"KOKKOOOKKOOKOOOKOCCKK",
"KCCCCCCCCCCKOOOKOOCOK",
"KCCCCNNCCCCKOOOOKKKOK",
".KCCCCCCCCKOOOOOOOOOK",
"..KCCCCCKOOOOOOOOOOK.",
"..KCCCCCKoooooooooK..",
"...KKKKKKKKKKKKKKK...",
]
def sleeping_puppy(frame=0):
    rows=[r for r in SLEEP]
    if frame%2:  # breathe: body rises 1px
        body_cols=range(11,21)
        g=[list(r) for r in rows]
        new=[list(r) for r in rows]
        for j in range(len(g)-1):
            for i in body_cols:
                if i<len(g[j+1]) and i<len(new[j]): new[j][i]=g[j+1][i] if j+1<len(g)-1 else g[j][i]
        rows=[''.join(r) for r in new]
    return rows

PUPPAL=dict(DPAL); PUPPAL.update({'O':hexc('#4b4552'),'o':hexc('#332e3a'),'K':hexc('#1f1a24'),'P':hexc('#c98a8a')})
