# Today props

What you did today shows up in your room (js/room.js reads `today_manifest.json`, js/roomtoday.js has the rules):

| Prop | When | Where |
|---|---|---|
| Monitor glow + scrolling green lines | 1+ GitHub contribution (or a push) today; brighter on contribution levels 1 to 4 | the screen on `desk.png` (`screen` in the manifest) |
| Running shoes | a run today | floor, at the foot of the bed |
| Water bottle | a run today | on the desk |
| Medal | a run of 3.1+ mi (5 km) today | left wall |
| Candle with the streak number | a 3+ day streak | on the bookshelf, or on the closet before the bookshelf unlocks |
| zzz bubble | nothing logged today, after 9pm | over the character |
| Sparkle | coded and ran today | near the character, now and then |

Nothing logged yet today: the room is a bit dimmer and the idle animation is slower.
With reduced motion, the props stay but nothing scrolls, flickers, sparkles or bobs.

## Swapping in your own art

Every prop is drawn by a placeholder in js/roomtoday.js until it has a PNG. To swap one:

1. Put the PNG in this folder (same pixel scale as the room art).
2. In `today_manifest.json`, set that prop's `"sprite": "shoes.png"` and adjust `x`, `y` (top-left, room pixels) if the size changed.

The zzz bubble works the same way (`zzz.sprite`, with `dx`/`dy` from the character's feet).
