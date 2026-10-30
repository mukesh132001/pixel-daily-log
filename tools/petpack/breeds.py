from gen import *
BASE={'K':'#3b2620','E':'#2a1a14','W':'#ffffff','N':'#2a1a14','T':'#e8737a','Y':'#f4c542','Q':'#e98a95',
      'w':'#c9c2b8','H':'#ff5d73','G':'#c47a3a','L':'#e0e6ea','U':'#5fb3e8','I':'#f2a3a3'}
def shade(h,f):
    r,g,b=hx(h); return '#%02x%02x%02x'%tuple(max(0,min(255,round(v*f))) for v in (r,g,b))
def P_(base,muz,collar,outline='#3b2620',ear=None,X=None,Z=None,paw=None,**kw):
    p=dict(BASE); p.update({'B':base,'s':shade(base,0.82),'M':muz,'P':paw or muz,'C':collar,'c':shade(collar,0.75),
        'K':outline,'F':ear or shade(base,0.75),'X':X or shade(base,0.7),'Z':Z or shade(base,0.6)}); p.update(kw); return p
PETS=[
# ---- dogs ----
dict(id='shiba',name='Shiba',kind='dog',rarity='common',ears='pointy',tail='curly',pal=P_('#e3954a','#fbeedb','#d9534f')),
dict(id='corgi',name='Corgi',kind='dog',rarity='common',ears='big',tail='stub',marks=m_mask_husky,pal=P_('#e89a52','#fdf3e4','#3f8fd9')),
dict(id='golden',name='Golden Retriever',kind='dog',rarity='common',ears='floppy',tail='plume',pal=P_('#e7b562','#f6dca4','#4caf7d',ear='#c98f3e')),
dict(id='blacklab',name='Black Lab',kind='dog',rarity='common',ears='floppy',tail='straight',pal=P_('#3d3a40','#56525a','#f28c38',outline='#16141a',ear='#2a272d',N='#111111',E='#f6e7b0',W='#2a1a14')),
dict(id='beagle',name='Beagle',kind='dog',rarity='rare',ears='floppy',tail='straight',marks=m_beagle,pal=P_('#c9853f','#fbf3e6','#e04f6a',ear='#8a5428',X='#3b3036')),
dict(id='dalmatian',name='Dalmatian',kind='dog',rarity='rare',ears='floppy',tail='straight',marks=m_spots,pal=P_('#f7f5f2','#ffffff','#e04f3f',outline='#2b2b33',ear='#2f2f36',X='#2f2f36',s='#e6e3de')),
dict(id='pug',name='Pug',kind='dog',rarity='rare',ears='folded',tail='curly',marks=m_points,pal=P_('#e3c49a','#e3c49a','#9b6fd6',F='#3a2c28',X='#3a2c28',Z='#3a2c28',paw='#e3c49a')),
dict(id='husky',name='Husky',kind='dog',rarity='epic',ears='pointy',tail='plume',blue=True,marks=m_mask_husky,pal=P_('#7d8794','#f4f6f8','#2f9e8f',outline='#262b33',I='#e7b3b8')),
dict(id='poodle',name='Poodle',kind='dog',rarity='epic',ears='floppy',tail='straight',marks=m_poodle,pal=P_('#e7a978','#f8d9bb','#e86fa3',ear='#cf8e5c',X='#f3c49a')),
dict(id='samoyed',name='Samoyed',kind='dog',rarity='epic',ears='fluff',tail='plume',pal=P_('#fbfaf6','#ffffff','#5a8de0',outline='#4a4450',s='#e3e0d8',I='#f2c4c4')),
dict(id='pixelpup',name='Pixel Pup',kind='dog',rarity='legendary',ears='big',tail='straight',marks=m_pixel,pal=P_('#5fe0c8','#d9fff6','#ff5dc8',outline='#173a46',X='#3bbfa8',Z='#9ffff0',E='#173a46',I='#ff9de2',T='#ff5dc8')),
# ---- cats ----
dict(id='orange',name='Orange Tabby',kind='cat',rarity='common',tail='up',marks=m_tabby,pal=P_('#f0a04b','#fde9cf','#3f8fd9',X='#c8712a')),
dict(id='blackcat',name='Black Cat',kind='cat',rarity='common',tail='up',pal=P_('#34303a','#4a4552','#e04f3f',outline='#121016',E='#f4d35e',W='#2a1a14',I='#b87a8a',w='#8a8494')),
dict(id='whitecat',name='Snow',kind='cat',rarity='common',tail='up',pal=P_('#fbfaf7','#ffffff','#ff8fb1',outline='#4a4450',s='#e2dfd8',E='#5fb3e8')),
dict(id='greycat',name='Russian Blue',kind='cat',rarity='common',tail='up',pal=P_('#8c98a8','#a7b1bf','#f4c542',outline='#2c313a',E='#7ccf7a',W='#ffffff')),
dict(id='browntabby',name='Brown Tabby',kind='cat',rarity='rare',tail='up',marks=m_tabby,pal=P_('#a87c55','#efe0c8','#4caf7d',X='#6e4c30')),
dict(id='tuxedo',name='Tuxedo',kind='cat',rarity='rare',tail='up',marks=m_tux,pal=P_('#2f2c35','#fafafa','#e04f3f',outline='#121016',E='#7ccf7a',W='#ffffff',I='#c48a96',paw='#fafafa')),
dict(id='calico',name='Calico',kind='cat',rarity='rare',tail='up',marks=m_calico,pal=P_('#fbf6ee','#ffffff','#9b6fd6',X='#e8954a',Z='#3a3238',s='#e6dfd2',outline='#3b2620')),
dict(id='siamese',name='Siamese',kind='cat',rarity='epic',tail='up',blue=True,marks=m_points,pal=P_('#f3e6d0','#f3e6d0','#d9534f',X='#5a4136',Z='#5a4136',paw='#f3e6d0')),
dict(id='mainecoon',name='Maine Coon',kind='cat',rarity='epic',tail='fluffy',marks=m_tabby,pal=P_('#8a6a4c','#e9dcc6','#2f9e8f',X='#5a4430',E='#c9b04a',W='#ffffff')),
dict(id='ragdoll',name='Ragdoll',kind='cat',rarity='epic',tail='fluffy',blue=True,marks=m_ragdoll,pal=P_('#f7f1e8','#ffffff','#e86fa3',X='#8d97a8',Z='#8d97a8',paw='#ffffff',outline='#3a3a48')),
dict(id='cosmic',name='Cosmic Cat',kind='cat',rarity='legendary',tail='fluffy',marks=m_cosmic,pal=P_('#4b3b8f','#8f7fe0','#f4c542',outline='#1a1438',X='#fff3a6',Z='#ff9de2',E='#9ffff0',W='#ffffff',I='#ff9de2',w='#b7a8ff')),
]
FRAMES=['sitA','sitB','blink','happy','eatA','eatB','sleepA','sleepB']
def render(spec,frame,sc=1):
    g=sit_on_feet(shrink_grid(pose(spec,frame))); pal={k:hx(v) for k,v in spec['pal'].items()}
    im=Image.new('RGBA',(FW,FH),(0,0,0,0))
    for y in range(FH):
        for x in range(FW):
            c=g[y][x]
            if c!='.' and c in pal: im.putpixel((x,y),pal[c]+(255,))
    return im.resize((FW*sc,FH*sc),Image.NEAREST) if sc>1 else im
if __name__=='__main__':
    sc=4
    cols=len(FRAMES); rows=len(PETS)
    sheet=Image.new('RGBA',(FW*sc*cols,FH*sc*rows),(255,255,255,255))
    for r,p in enumerate(PETS):
        for c,f in enumerate(FRAMES):
            sheet.alpha_composite(render(p,f,sc),(c*FW*sc,r*FH*sc))
    sheet.save('preview_all.png'); print(sheet.size)
    # compact overview: first frame of each, grid 6x4
    ov=Image.new('RGBA',(FW*6*6,FH*6*4),(255,255,255,255))
    for i,p in enumerate(PETS): ov.alpha_composite(render(p,'sitA',6),((i%6)*FW*6,(i//6)*FH*6))
    ov.save('overview.png')
