# PROGRESS.md: where Pixel daily log stands

Last updated: Wednesday, Oct 21, 2026. Update this file whenever a pull request is merged or a decision is made.

## ✅ Live right now

- **Website:** https://mukesh132001.github.io/pixel-daily-log/ (GitHub Pages, publishes from `main`)
- **Strava worker:** https://pixel-daily-log-strava.mukeshethiraj0.workers.dev (Cloudflare). Strava Client ID `289322`, up to 10 athletes can connect.
- **Features:** live GitHub activity and commit messages, Strava runs and pace, hand-logged runs, cozy title screen, time-of-day skies, streak flame, PR celebration, glowing calendar, phone tabs, ghost tab icon.
- **Merged pull requests:**
  1. Ghost favicon (tab icon)
  2. CLAUDE.md project briefing
  3. PR 1, `profile-foundation`: your data now belongs to a **profile** saved in the browser, GitHub is optional, and share links (`?user=someone`) open as a read-only **peek**

## 📍 Where we stopped

- **PR 2a + 2d** is committed and pushed on the branch **`character-art`**, but **not merged yet**. It adds:
  - a layered art system (`js/art.js`): 3 starters (Runner, Coder, Student), 5 skin tones, 3 hair styles × 4 colors, 6 shirt colors
  - the A–Z pixel font (`js/font.js`)
  - your own school pennant (initials + two colors, no logos)
  - `gallery.html`, a **dev-only** test page (not linked from the game)
- Claude Code was opening the pull request with `gh pr create`. If `gh` isn't installed, open it on the GitHub website from the `character-art` banner.

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
- **Name:** "Pixmod" is a working name. Check GitHub, domains and trademarks before renaming.

## ⏭️ Next up (in order)

1. **Merge PR 2a + 2d** (`character-art`): Merge → Confirm merge → purple "Merged" → Delete branch. Then `git checkout main` and `git pull`.
2. **Tell Claude Code** the character-select vision (big front-facing character) and that the gallery stays dev-only.
3. **Pick an art pack** on itch.io (search "cozy isometric pixel room", "isometric pixel interior"). It needs front-facing characters and an isometric room. Check the license.
4. **Isometric room prototype:** one room, one lighting, your character standing in it. Decide if the look is right.
5. **The four lighting moods** matched to the time of day.
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
