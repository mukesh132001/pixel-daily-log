# Pixmod room art (original, owned by Pixmod)

Drop this folder into the repo as `sprites/room/`.

## Files
- `room_shell.png`: floor + walls, 256x256, always drawn first
- one PNG per furniture item (window, door, poster, string_lights, rug, closet, desk, chair, bookshelf, lamp, bed, plant)
- `room_manifest.json`: where each item goes and how it behaves
- `preview_full.png`, `preview_levels.png`: what it should look like

## Scale
Native art is 256x256. Draw it at an integer scale (2x or 3x) with `image-rendering: pixelated`.
Sprite Street characters (32x40, feet on row 35) are drawn at the SAME scale, so they match.

## Placing items
Each item has `x, y` (top-left in native room pixels). Draw the sprite there.

## Draw order
1. `room_shell.png`
2. items with `layer: "wall"`
3. items with `layer: "floor"` (rug: always under the character)
4. items with `layer: "object"` AND the character, sorted by `depthY` (smaller first).
   The character's depthY is the screen Y of its feet.

## World <-> screen
screen_x = 128 + (x - y), screen_y = 112 + (x + y) / 2 - z   (native pixels)
World x,y run 0..100 across the floor; 10 units = 1 tile, so the floor is a 10x10 tile grid.
x runs along the right wall (toward the door), y runs along the left wall (toward the bed).

## Collision
`blockedTiles {x, y, w, d}` = tiles the character can't enter. Walls block the edges of the 10x10 grid.

## Interactions
`interact.tile` = the tile the character stands on to use the item.
- closet -> open character picker
- desk -> opens the monitor panel with the latest GitHub work (js/monitor.js). In a peek (someone else's room) the desk is always offered
- bed -> "Sleep": the character lies in bed under the blanket, the lights dim (the lamp keeps a glow), any key, click or tap stands it up. The lying pose and blanket line are SLEEP_POSE and SLEEP_BLANKET in js/room.js, tuned to bed.png; if you redraw the bed, retune them
- door -> next room, `locked: true` until unlocked

## Levels
`unlockLevel` = room level when the item appears. Current plan:
L1 bed, closet, desk, chair, window, door - L2 rug, lamp - L3 bookshelf, plant - L4 poster - L5 string lights
