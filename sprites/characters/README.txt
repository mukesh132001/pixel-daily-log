Sprite Street - pixel character pack (21 characters)

sheets/<name>.png      Side view, 4 columns x 4 rows, 32x40 px per frame, transparent, facing right.
                       Rows top to bottom: idle, walk, run, jump. Flip horizontally to face left.
sheets/<name>@4x.png   Same sheet pre-scaled 4x.
front/<name>_front.png Front-facing idle, 4 frames in one row, 32x40 each.
                       Available for: leo, night_owl, rain_runner, ghost_kid.
gifs/                  Animated previews of every row.

Jump frames: 0 crouch/land, 1 rise, 2 peak, 3 fall - move the sprite vertically in your game.
Suggested frame times: idle 260ms, walk 150ms, run 95ms, jump ~170ms.
Feet touch the ground on pixel row 35 of every frame (front and side), so views line up.
Scale with nearest-neighbor filtering to keep pixels crisp.

Characters: leo, maya, dre, kira, ben, hana, grant, park, marco, fennick, cosmo, dunmore,
bolt, kage, walt, zoe, vance, pip, night_owl, rain_runner, ghost_kid
