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

- **Merged:** `cozy-room` (PR 5, the isometric room) and `character-select` (PR 6: Muki's character pack, roster in `js/characters.js`, the picker, unlocks, `?dev` on localhost).
  - Unlocks: Leo from the start; Night Owl = a push between midnight and 4am; Ghost Kid = 7 logged days in a row (commit or run); Rain Runner = 3 runs in one Mon–Sun week
  - The profile saves `characterId`, `unlocked` (never taken away) and `log` (every logged day + best streak)
- **Also merged:** `slower-run` (PR 7, calmer run cycle and scroll) and `room-screen` (PR 8):
  - the room left the main page; a pixel **"My room"** button with a door icon sits in the header (next to Change player)
  - the room has its own screen at **`#room`**: as big as fits (whole-number scaling), "← Back", "Pick character" lives here now
  - the browser back button works, `#room` links can be bookmarked, Escape goes back, focus moves to the heading and back to the button
  - peeks work too: `?user=<name>#room` shows their room read-only ("Their room", no Pick character)
- **Also merged:** `room-camera` (PR 9):
  - the room is always at least 2× (3× when the room area is 969px or wider), in whole device pixels so it stays crisp at 125%/150% zoom
  - a **camera**: if the room doesn't fit (phones), the view centers on your character and stops at the room's edges
  - the room screen fills the whole visible screen (slim header, no page scrolling) on a dusk backdrop: warm brown in light mode, plum night in dark mode
- **Also merged:** `card-lists` (PR 10):
  - long lists in the cards (GitHub "This day", "Most active in", the runs list) show 4 items, then a pixel "Show all N ▾" / "Show less ▴" button (`aria-expanded`)
  - picking another day folds them back up; "Most active in" can now show every repo, not just the top 4
  - the three cards line up at the top with equal heights on wide screens (phones keep the tabs)
- **Also merged:** `github-cache` (PR 11):
  - every GitHub answer is saved in the browser (`pdl:gh:<url>`) and reused for 15 minutes; trimmed to the fields we use, cleared after a week
  - when the hourly limit is hit, older saved data is used and the GitHub card says "Showing saved data from 20 min ago"
  - with nothing saved, messages give the reset time from `X-RateLimit-Reset` ("Try again after 3:42 PM")
- **`github-proxy`** is pushed, waiting for its pull request (**and the worker must be pasted into Cloudflare**, see worker/README.md):
  - the worker has `GET /github/...` for exactly the 3 GitHub calls the site makes, adds `GITHUB_TOKEN` (5,000 requests an hour, shared), caches answers 10 minutes at the edge (`X-Proxy-Cache: HIT/MISS`)
  - js/github.js asks the worker first and falls back to api.github.com; the browser cache from PR 11 still wraps both
  - open question: the Cache API may do nothing on `workers.dev`; check with the curl in worker/README.md (a custom domain would fix it)

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
