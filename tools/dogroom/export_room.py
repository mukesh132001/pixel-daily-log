"""Export the dog room for the game, in the same format as sprites/room/ (see that folder's README).

Run from this folder:   python export_room.py        (needs Pillow: pip install pillow)

It writes sprites/petroom/:
  room_shell.png          floor + walls, 256x256
  <item>.png              one PNG per item, cropped to its pixels
  petroom_manifest.json   x, y, layer, depthY, blockedTiles, interact tiles, and where pets can go
  preview_full.png        the room with a few sample pets and Leo
  preview_spots.png       blocked tiles, pet spots and the door tile

The dog and the sleeping puppy from dog_room_512.png are not exported: the game puts real pets in the room.
"""
import json
import os
from PIL import Image, ImageChops, ImageDraw
from scene import *   # the drawing functions, P(), hexc(), Scene, N

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.normpath(os.path.join(HERE, "..", ".."))
OUT = os.path.join(REPO, "sprites", "petroom")

# ----- what's in the room -----
# draw: the function in scene.py that paints it. foot: its footprint on the floor [x0, x1, y0, y1] in world units
# (used to work out depthY). blocked: the tiles Leo can't enter (10 world units a tile).
ITEMS = [
    dict(id="window", draw=window, layer="wall"),
    dict(id="picture", draw=frame_pic, layer="wall"),
    dict(id="shelf", draw=shelf, layer="wall"),
    dict(id="leash_hooks", draw=leash_hooks, layer="wall"),
    dict(id="pet_door", draw=dog_door, layer="wall", interact=dict(action="next_room", to="room", tile=[8, 1])),
    dict(id="bone_clock", draw=bone_clock, layer="wall"),
    dict(id="string_lights", draw=lambda s: string_lights(s, 0), layer="wall"),
    dict(id="rug", draw=rug, layer="floor"),
    dict(id="sunlight", draw=sunlight, layer="floor"),
    dict(id="toys", draw=toys, layer="floor"),
    dict(id="kennel", draw=kennel, layer="object", foot=[6, 34, 8, 36], blocked=dict(x=0, y=0, w=3, d=4)),
    dict(id="bowls", draw=bowls, layer="object", foot=[50, 80, 6, 18], blocked=dict(x=5, y=0, w=3, d=2)),
    dict(id="dog_bed", draw=lambda s: bed(s, 0, puppy=False), layer="object", foot=[6, 34, 58, 88], blocked=dict(x=0, y=6, w=3, d=3)),
    dict(id="cat_bed", draw=cat_bed, layer="object", foot=[7, 21, 41.5, 55.5], blocked=dict(x=0, y=4, w=2, d=2)),
    dict(id="basket", draw=basket, layer="object", foot=[81.5, 94.5, 37.5, 50.5], blocked=dict(x=8, y=4, w=2, d=1)),
    dict(id="hydrant", draw=hydrant, layer="object", foot=[81, 87, 87, 93], blocked=dict(x=8, y=9, w=1, d=1)),
    dict(id="plant", draw=plant, layer="object", foot=[4, 12, 90, 98], blocked=dict(x=0, y=9, w=1, d=1)),
]

# Where pets can be. x, y: where their feet go (world units); z: how far up (on a cushion); on: the item they
# sit on or in front of (they're drawn right after it); pose: what they do there; kind: dog, cat or any.
SPOTS = [
    dict(id="rug_mid", kind="any", pose="sit", x=62, y=64),
    dict(id="rug_left", kind="any", pose="sit", x=50, y=78),
    dict(id="rug_right", kind="any", pose="sit", x=74, y=50),
    dict(id="bowl", kind="any", pose="eat", x=57, y=26),
    dict(id="dog_bed", kind="dog", pose="sleep", x=20, y=73, z=5, on="dog_bed"),
    dict(id="kennel", kind="dog", pose="sleep", x=22, y=35.5, on="kennel"),
    dict(id="cat_bed", kind="cat", pose="sleep", x=14, y=48.5, z=5, on="cat_bed"),
]

PET_FRAME = (21, 21)    # sprites/pets: sitA, sitB, blink, happy, eatA, eatB, sleepA, sleepB
PET_FEET = (10, 19)     # the middle of the feet and the bottom row, in a pet frame
LEO = dict(w=32, h=40, feet=35)
SPAWN_TILE = [8, 2]     # where Leo arrives, one tile in front of the pet door

# ----- helpers -----
def render_item(fn):
    s = Scene()
    fn(s)
    return s.im

def overlap(a, b):
    """Do two full-canvas images share a pixel on screen?"""
    return ImageChops.multiply(a.getchannel("A"), b.getchannel("A")).getbbox() is not None

def free(x, y, blocks):
    """The same rule as createFloor() in js/roomfloor.js: where Leo's feet can be."""
    if not (4 <= x <= 97 and 4 <= y <= 97):
        return False
    return not any(b["x"] * 10 - 3 < x < (b["x"] + b["w"]) * 10 + 3 and b["y"] * 10 - 3 < y < (b["y"] + b["d"]) * 10 + 3 for b in blocks)

def frange(a, b, step):
    while a <= b:
        yield a
        a += step

# ----- render every item on its own -----
shell_im = render_item(shell)
for it in ITEMS:
    it["full"] = render_item(it["draw"])
    x0, y0, x1, y1 = it["full"].getbbox()
    it.update(x=x0, y=y0, w=x1 - x0, h=y1 - y0, img=it["full"].crop((x0, y0, x1, y1)))

# ----- depthY -----
# Objects and the character are drawn in depthY order (smaller first). One number per piece can't be perfect,
# so: (1) pick, for each piece, the value where Leo is drawn the right way round at the most floor spots
# where the two overlap on screen, then (2) make sure pieces that overlap each other keep their true order
# (a plant in front of the bed stays in front of the bed).
objects = [it for it in ITEMS if it["layer"] == "object"]
blocks = [it["blocked"] for it in objects]
points = [(x, y) for x in frange(4, 97, 2.5) for y in frange(4, 97, 2.5) if free(x, y, blocks)]

def leo_cases(it):
    x0, x1, y0, y1 = it["foot"]
    alpha = it["full"].getchannel("A")
    cases = []
    for (x, y) in points:
        behind = x <= x0 or y <= y0   # Leo is farther away than the piece
        front = x >= x1 or y >= y1    # Leo is nearer than the piece
        if behind == front:
            continue
        sx, sy = P(x, y)
        box = (round(sx) - 16, round(sy) - LEO["feet"], round(sx) + 16, round(sy) + 5)
        if alpha.crop(box).getbbox() is None:
            continue                  # they don't overlap on screen, so the order doesn't matter
        cases.append((sy, front))
    return cases

for it in objects:
    x0, x1, y0, y1 = it["foot"]
    lo, hi = 112 + (x0 + y0) / 2, 112 + (x1 + y1) / 2
    it["cases"], it["lo"], it["hi"] = leo_cases(it), lo, hi
    candidates = [lo - 6 + 0.5 * i for i in range(int((hi - lo + 12) / 0.5) + 1)]
    it["depthY"] = min(candidates, key=lambda d: (sum(1 for sy, leo_after in it["cases"] if (sy >= d) != leo_after), abs(d - (hi - 1.5))))

def misses(it, d):
    return sum(1 for sy, leo_after in it["cases"] if (sy >= d) != leo_after)

# order between pieces: A must be drawn after B when A is nearer along an axis and they overlap on screen
pairs = []
for a in objects:
    for b in objects:
        if a is b or not overlap(a["full"], b["full"]):
            continue
        if a["foot"][0] >= b["foot"][1] - 0.01 or a["foot"][2] >= b["foot"][3] - 0.01:
            pairs.append((b, a))      # (drawn first, drawn after)
for _ in range(30):
    clean = True
    for first, after in pairs:
        if first["depthY"] < after["depthY"]:
            continue
        clean = False
        raise_after, lower_first = after["depthY"], first["depthY"]
        cost_up = misses(after, first["depthY"] + 0.5) - misses(after, after["depthY"])
        cost_down = misses(first, after["depthY"] - 0.5) - misses(first, first["depthY"])
        if cost_up <= cost_down:
            after["depthY"] = first["depthY"] + 0.5
        else:
            first["depthY"] = after["depthY"] - 0.5
    if clean:
        break

# ----- compose: the same order the game uses -----
def compose(extras=(), skip=()):
    """The room the way sprites/room/README.md says to draw it. extras: (depthY, paint(im)) to sort in with the objects."""
    im = shell_im.copy()
    for layer in ("wall", "floor"):
        for it in ITEMS:
            if it["layer"] == layer and it["id"] not in skip:
                im.alpha_composite(it["img"], (it["x"], it["y"]))
    stack = [(it["depthY"], 0, it) for it in objects if it["id"] not in skip] + [(d, 1, paint) for d, paint in extras]
    for _, kind, thing in sorted(stack, key=lambda t: t[0]):
        if kind == 0:
            im.alpha_composite(thing["img"], (thing["x"], thing["y"]))
        else:
            thing(im)
    return im

def reference():
    """The original render without the dog and the puppy, painted in scene.py's own order."""
    s = Scene()
    shell(s); window(s); frame_pic(s); shelf(s); leash_hooks(s); dog_door(s); bone_clock(s); string_lights(s, 0)
    rug(s); sunlight(s); kennel(s); bowls(s); bed(s, 0, puppy=False); basket(s); toys(s); hydrant(s); plant(s)
    return s.im

# ----- pets and Leo, for the previews -----
def pet_frame(pet_id, index):
    sheet = Image.open(os.path.join(REPO, "sprites", "pets", "sheets", f"{pet_id}.png")).convert("RGBA")
    return sheet.crop((index * PET_FRAME[0], 0, (index + 1) * PET_FRAME[0], PET_FRAME[1]))

def pet_at(spot, pet_id, frame):
    sx, sy = P(spot["x"], spot["y"], spot.get("z", 0))
    art = pet_frame(pet_id, frame)
    return lambda im: im.alpha_composite(art, (round(sx) - PET_FEET[0], round(sy) - PET_FEET[1]))

def spot_depth(spot):
    if "on" in spot:
        return next(it["depthY"] for it in objects if it["id"] == spot["on"]) + 0.1
    return P(spot["x"], spot["y"])[1]

def leo_at(x, y):
    sx, sy = P(x, y)
    art = Image.open(os.path.join(REPO, "sprites", "characters", "front", "leo_front.png")).convert("RGBA").crop((0, 0, LEO["w"], LEO["h"]))
    return sy, lambda im: im.alpha_composite(art, (round(sx) - 16, round(sy) - LEO["feet"]))

# ----- write everything -----
os.makedirs(OUT, exist_ok=True)
shell_im.save(os.path.join(OUT, "room_shell.png"))
for it in ITEMS:
    it["img"].save(os.path.join(OUT, it["id"] + ".png"))

manifest_items = []
for it in ITEMS:
    out = dict(id=it["id"], sprite=it["id"] + ".png", layer=it["layer"], x=it["x"], y=it["y"], w=it["w"], h=it["h"], unlockLevel=1)
    if "blocked" in it:
        out["blockedTiles"] = it["blocked"]
    if it["layer"] == "object":
        out["depthY"] = it["depthY"]
    if "interact" in it:
        out["interact"] = it["interact"]
    manifest_items.append(out)

manifest = {
    "name": "Pet room",
    "nativeSize": [N, N],
    "tileSize": 10,
    "grid": [10, 10],
    "wallHeight": WH,
    "origin": {"note": "screen = (128 + (x - y), 112 + (x + y)/2 - z) in native pixels; x,y,z are world units, 10 units = 1 tile"},
    "spawnTile": SPAWN_TILE,
    "layers": "draw shell, then wall items, then floor items, then objects, pets and the character sorted by depthY (smaller first)",
    "pet": {"frame": list(PET_FRAME), "feet": list(PET_FEET),
            "frames": ["sitA", "sitB", "blink", "happy", "eatA", "eatB", "sleepA", "sleepB"],
            "note": "sprites/pets/sheets/<id>.png. A pet's feet go at screen (x, y - z) of its spot; on: draw it right after that item."},
    "petSpots": SPOTS,
    "items": manifest_items,
    "shell": "room_shell.png",
}
with open(os.path.join(OUT, "petroom_manifest.json"), "w", encoding="utf-8") as f:
    json.dump(manifest, f, indent=2)
    f.write("\n")

# ----- check: the exported pieces put back together look like the original -----
diff = ImageChops.difference(compose(skip={"cat_bed"}), reference())
print("exported pieces vs the original render (no dog, no puppy, no cat bed):",
      "identical" if diff.getbbox() is None else f"DIFFERENT at {diff.getbbox()}")

# ----- previews -----
BG = (43, 36, 49, 255)
def on_dark(im, scale=3):
    bg = Image.new("RGBA", im.size, BG)
    bg.alpha_composite(im)
    return bg.resize((im.width * scale, im.height * scale), Image.NEAREST)

spots = {s["id"]: s for s in SPOTS}
sample = [("rug_mid", "shiba", 0), ("bowl", "corgi", 4), ("dog_bed", "golden", 6), ("cat_bed", "calico", 6)]
extras = [(spot_depth(spots[sid]), pet_at(spots[sid], pid, fr)) for sid, pid, fr in sample]
leo_depth, leo_paint = leo_at(SPAWN_TILE[0] * 10 + 5, SPAWN_TILE[1] * 10 + 5)   # where Leo arrives
extras.append((leo_depth, leo_paint))
on_dark(compose(extras)).save(os.path.join(OUT, "preview_full.png"))

big = on_dark(compose())
over = Image.new("RGBA", big.size, (0, 0, 0, 0))
d = ImageDraw.Draw(over)
def S(x, y, z=0):
    sx, sy = P(x, y, z)
    return (sx * 3, sy * 3)
for i in range(0, 101, 10):   # the tile grid
    d.line([S(i, 0), S(i, 100)], fill=(255, 255, 255, 50))
    d.line([S(0, i), S(100, i)], fill=(255, 255, 255, 50))
for it in objects:            # blocked tiles
    b = it["blocked"]
    x0, x1, y0, y1 = b["x"] * 10, (b["x"] + b["w"]) * 10, b["y"] * 10, (b["y"] + b["d"]) * 10
    d.polygon([S(x0, y0), S(x1, y0), S(x1, y1), S(x0, y1)], fill=(230, 70, 70, 95), outline=(255, 120, 120, 200))
tx, ty = SPAWN_TILE            # where Leo arrives
d.polygon([S(tx * 10, ty * 10), S((tx + 1) * 10, ty * 10), S((tx + 1) * 10, (ty + 1) * 10), S(tx * 10, (ty + 1) * 10)], fill=(90, 220, 120, 130))
dx, dy = manifest_items[4]["interact"]["tile"]   # the pet door's tile
d.polygon([S(dx * 10, dy * 10), S((dx + 1) * 10, dy * 10), S((dx + 1) * 10, (dy + 1) * 10), S(dx * 10, (dy + 1) * 10)], fill=(255, 210, 80, 150))
colors = {"dog": (255, 150, 60, 255), "cat": (190, 130, 255, 255), "any": (255, 255, 255, 255)}
for sp in SPOTS:
    cx, cy = S(sp["x"], sp["y"], sp.get("z", 0))
    d.ellipse([cx - 6, cy - 6, cx + 6, cy + 6], fill=colors[sp["kind"]], outline=(40, 30, 40, 255), width=2)
    d.text((cx + 9, cy - 5), sp["id"] + " (" + sp["pose"] + ")", fill=(255, 255, 255, 255))
d.text((8, 8), "red = blocked tiles   yellow = pet door tile   green = Leo arrives   dots = pet spots (orange dog, purple cat, white any)", fill=(255, 255, 255, 255))
big.alpha_composite(over)
big.save(os.path.join(OUT, "preview_spots.png"))

print("depthY:", {it["id"]: it["depthY"] for it in objects})
print("wrote", OUT)
