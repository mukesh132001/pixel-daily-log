# Halloween event decor (original, owned by Pixmod)

Put this folder at `sprites/events/halloween/`.

- Active from Oct 25 to Nov 1 (inclusive, user's local time), see `halloween_manifest.json` -> `active`.
- Same coordinate space, layers, depth sorting and blockedTiles rules as `sprites/room/room_manifest.json`.
- Event items show at every room level.
- `replaces`: while active, hide that base item (the spooky lights replace the normal string lights;
  if the room is below the string lights' level, just show the spooky lights anyway).
- `hw_pumpkin_patch` blocks tile (3,0).
- Ghost plush sits on the bed, candy bucket on the rug (walk-through).
- `banner`: shown once a year, the first time you open your room while the event is active
  (added for the site; another event's manifest can have its own).

Items: hw_cobweb_back, hw_cobweb_front, hw_bat_garland, hw_spooky_lights, hw_sill_pumpkin,
hw_pumpkin_patch, hw_ghost_plush, hw_candy_bucket
