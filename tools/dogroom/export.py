from scene import *
from sprites import *
BG=hexc('#7fa7b5')
frames=[render(t) for t in range(8)]
frames[0].resize((512,512),Image.NEAREST).save('dog_room_512.png')
frames[0].resize((1024,1024),Image.NEAREST).save('dog_room_1024.png')
gif=[]
for f in frames:
    b=Image.new('RGBA',(N,N),BG+(255,)); b.alpha_composite(f); gif.append(b.convert('RGB').resize((512,512),Image.NEAREST))
gif[0].save('dog_room_animated.gif',save_all=True,append_images=gif[1:],duration=180,loop=0)
# sprite sheets
def sheet(arts,pal,w,h,sc,name):
    im=Image.new('RGBA',(w*len(arts),h),(0,0,0,0))
    for k,a in enumerate(arts):
        for j,r in enumerate(a):
            for i,ch in enumerate(r):
                if ch in pal: im.putpixel((k*w+i,j+(h-len(a))),pal[ch]+(255,))
    im.resize((im.width*sc,im.height*sc),Image.NEAREST).save(name)
sheet([sitting_dog(0),sitting_dog(1),sitting_dog(0),sitting_dog(1),sitting_dog(0,True),sitting_dog(1,True)],DPAL,24,26,4,'shiba_sitting_sheet.png')
sheet([sleeping_puppy(0),sleeping_puppy(1)],PUPPAL,22,12,4,'puppy_sleeping_sheet.png')
print('done')
