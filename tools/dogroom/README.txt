Dog Room - original isometric pixel art

Room/
  dog_room_animated.gif  8-frame loop (tail wag, blink, sleeping puppy, twinkling lights)
  dog_room_1024.png      still, transparent background, 1024x1024
  dog_room_512.png       still, transparent background, 512x512

Sprites/
  shiba_sitting_sheet.png   6 frames, 96x104 each (wag x4, blink x2)
  puppy_sleeping_sheet.png  2 frames, 88x48 each (breathing)
  guy_run / guy_idle        running character (gif + sprite sheets)

Source/
  Python scripts that generate everything. Run: python3 export.py
  (needs Pillow: pip install pillow). Native art is 256x256, scaled
  with nearest-neighbor so pixels stay crisp.

Tip: use CSS image-rendering: pixelated when scaling on a web page.

Game export (added for Pixmod)
  python export_room.py     writes sprites/petroom/ in the same format as sprites/room/:
                            room_shell.png, one PNG per item, petroom_manifest.json and two previews.
                            The dog and the sleeping puppy are left out (the game uses real pets), and a cat bed
                            is added. It checks that the pieces put back together match the original render.
  scene.py                  bed(s, t, puppy=False) draws the bed without the puppy; cat_bed(s) is new.
  Needs Pillow: pip install pillow
