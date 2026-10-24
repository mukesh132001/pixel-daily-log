# PROGRESS.md: where Pixel daily log stands

Last updated: Saturday, Oct 24, 2026. Update this file whenever a pull request is merged or a decision is made.

## ✅ Live right now

- **Website:** https://mukesh132001.github.io/pixel-daily-log/ (GitHub Pages, publishes from `main`)
- **Strava worker:** https://pixel-daily-log-strava.mukeshethiraj0.workers.dev (Cloudflare). Strava Client ID `289322`, up to 10 athletes can connect.
- **Features:** live GitHub activity and commit messages, Strava runs and pace, hand-logged runs, cozy title screen, time-of-day skies, streak flame, PR celebration, glowing calendar, phone tabs, ghost tab icon.
- **Merged pull requests:**
  1. Ghost favicon (tab icon)
  2. CLAUDE.md project briefing
  3. PR 1, `profile-foundation`: your data now belongs to a **profile** saved in the browser, GitHub is optional, and share links (`?user=someone`) open as a read-only **peek**

## 📍 Where we stopped

- **PR 4 (`character-art`) is merged:** layered characters (`js/art.js`), the A–Z pixel font, your own school pennant, and the dev-only `gallery.html`.
- **Room prototype** is on the branch **`cozy-room`**, pushed, waiting for its pull request to be merged. It adds:
  - a **"Your room"** card under the day scene (shows after Press Start): the ToffeeCraft isometric room with a bed, desk + chair + laptop, rug, plant, bookcase, floor lamp and window
  - your character standing on the rug (5× scale) and your pennant hanging still on the left wall, leaning with the wall
  - crisp pixels, scaled by whole numbers only (3× desktop, 2× tablet, 1× phone)
  - `.gitignore` keeps the raw packs in `assets/` off GitHub; only the sprites we use live in `sprites/room/`
- **Look check:** the character's chunky 8×10 grid looks blockier than the detailed furniture. That's expected until the bigger ~16×24 character art arrives.

- **Character select** is on the branch **`character-select`**, pushed, waiting for its pull request:
  - Muki's own character pack in `sprites/characters/`; roster in `js/characters.js` (Leo, Night Owl, Ghost Kid, Rain Runner)
  - "Pick character" on the room card opens one big front-facing character, ◀ ▶ to switch, dark silhouettes + hints when locked
  - Unlocks: Leo from the start; Night Owl = a push between midnight and 4am; Ghost Kid = 7 logged days in a row (commit or run); Rain Runner = 3 runs in one Mon–Sun week
  - The profile saves `characterId`, `unlocked` (never taken away) and `log` (every logged day + best streak)
  - The room shows the front idle; the day scene uses the side sheets (run, walk, jump, nap on the bench)
  - `localhost:8000/?dev` unlocks everything for one visit

## 🧭 Decisions we made

- **Profiles:** saved in the browser for now (Option A). Real accounts (Option B) come with the friends features.
- **Share links:** stay as a read-only peek, with no runs or Strava shown.
- **Pennant:** our own design with your initials and colors. It **hangs still on your room wall**, no waving.
- **Art direction:** the page should look much higher quality.
  - Use a **pixel art pack** (check the license) with **front-facing characters** and **isometric rooms**, edited in Piskel or Aseprite as needed.
  - Bigger canvas, bigger characters (about 16×24), 4–8 frame animations, PNG sprite sheets with skin/hair/shirt options (palette swaps).
- **Room:** an **isometric cutaway room**, cozy and lived-in. Lighting changes with the time of day: bright day, soft evening, warm lamp at night, purple neon for late-night coding. Built as one background image plus a few animated layers; the character faces 2 directions (mirrored) and moves between a few spots (desk, bed, door, window).
- **Character select:** one **big front-facing character** looking at the player, with a small idle animation, arrows to switch starters, and live skin/hair/shirt options. Nothing else on that screen.
- **Focus:** make **one beautiful room** first, then add features.
- **Working with Claude Code:** Sonnet 5.5 for building, Opus for big planning, `/clear` between pull requests, manual mode while learning.
- **Characters are picked and unlocked, not built.** The layered "build your character" art (`js/art.js`) is off the main page; only `gallery.html` uses it.
- **Rain Runner:** Strava's activity list has no weather, so it unlocks with 3 runs in one week for now. Real rain would need a weather API by date and place.
- **Night Owl:** GitHub's public feed gives push times, not commit times, so a late-night push counts.
- **Name:** "Pixmod" is a working name. Check GitHub, domains and trademarks before renaming.

## ⏭️ Next up (in order)

1. **Merge the `cozy-room` PR**: Merge → Confirm merge → purple "Merged" → Delete branch. Then `git checkout main` and `git pull`.
2. **Decide if the room look is right** (furniture spots, colors, character size).
3. **Bigger character art** (~16×24, front-facing) so the character matches the furniture's detail.
4. **The four lighting moods** in the room, matched to the time of day.
6. **PR 3: character creator** using the new art.
7. **PR 4:** power-ups in the creator (connect GitHub and Strava) and an "Edit character" button.
8. **PR 5:** export and import your profile.

## 🗓️ Planned for later

**Step 2: the room comes alive**
- Code → stand up → open the door → run outside movie on days you coded and ran, with more sweat on longer runs
- The character wanders and thinks "ykims..." in a bubble
- Coding intensity scales with contributions; coffee steam; the window shows the real time of day

**Personalities and pets (old PRs 2b and 2c, to be redone with the new art)**
- Runner (sweatband tails, stretch, watch check), Coder (headphones with music notes, coffee sip, hood up at night), Student (reads a tiny book)
- Pixel Pup (runs ahead, chases commit blocks) and Kitten (sits on the keyboard, bats the mug, curls up on rest days); tap a pet for a heart

**Step 3: points, collection, badges**
- Points from runs, code, streaks and PRs; unlock characters (Night Owl, Cyclist, Pixel Bot, Cat) and pets (Bunny, Duck, Turtle); specials (Ghost, Golden Runner, Midnight Coder, The Legend, Ghost Cat, Tiny Dragon)
- Keep it healthy: daily cap on run points, a "streak saver" rest day

**Step 4:** "About me" changes your room.
**Step 5:** talk to your character (scripted first, then AI through the worker with limits and a budget).
**Step 6:** friends building, where each friend's room is one box in a grid; visit rooms; pixel football mini-game; real accounts.

**Other**
- Music via Last.fm (headphones on music days, top track on the cassette)
- Strava review to go past 10 athletes: official "Connect with Strava" button, "Powered by Strava" logo, webhooks (`/webhook` exists; add `WEBHOOK_VERIFY_TOKEN`), a short privacy page, screenshots
- Make sure Cloudflare has the latest `worker/strava-worker.js` pasted (the "connections are full" update)

**Small fixes noticed**
- Today can say "No contributions" while also showing a push (the contribution count updates later). Say "count not updated yet" instead.
- In peek mode, the Runs panel shows empty pace cards. Show "Runs are private" instead.

## 🔁 How to pick up again

```bash
cd ~/Downloads/pixel-daily-log
claude
```

Check it says **manual mode on** (Shift + Tab), then say:

> Read CLAUDE.md and PROGRESS.md, tell me where we stopped, and suggest the next step.
