from breeds import *
import json, os, base64, io
COST={'common':50,'rare':150,'epic':300,'legendary':600}
os.makedirs('out/PetPack/sheets_1x',exist_ok=True); os.makedirs('out/PetPack/sheets_4x',exist_ok=True); os.makedirs('out/PetPack/gifs',exist_ok=True)
meta=[]
atlas=Image.new('RGBA',(FW*len(FRAMES),FH*len(PETS)),(0,0,0,0))
for r,p in enumerate(PETS):
    sh=Image.new('RGBA',(FW*len(FRAMES),FH),(0,0,0,0))
    for c,f in enumerate(FRAMES): sh.alpha_composite(render(p,f),(c*FW,0))
    sh.save(f"out/PetPack/sheets_1x/{p['id']}.png")
    sh.resize((sh.width*4,sh.height*4),Image.NEAREST).save(f"out/PetPack/sheets_4x/{p['id']}.png")
    atlas.alpha_composite(sh,(0,r*FH))
    seq=['sitA','sitB']*3+['blink','sitA','sitB','sitA','sitB','happy','happy']
    ims=[render(p,f,6) for f in seq]
    ims[0].save(f"out/PetPack/gifs/{p['id']}.gif",save_all=True,append_images=ims[1:],duration=220,loop=0,disposal=2)
    meta.append(dict(id=p['id'],name=p['name'],kind=p['kind'],rarity=p['rarity'],cost=COST[p['rarity']],row=r))
atlas.save('out/PetPack/pets_atlas.png')
json.dump(dict(frameWidth=FW,frameHeight=FH,feetX=FEET[0],feetY=FEET[1],frames=FRAMES,
  rarityCost=COST,pets=meta),open('out/PetPack/pets.json','w'),indent=2)
buf=io.BytesIO(); atlas.save(buf,'PNG'); open('atlas_b64.txt','w').write(base64.b64encode(buf.getvalue()).decode())
print(atlas.size, len(meta))
