# CLAUDE.md: briefing for Pixel daily log (working name: Pixmod)

Read this first in every session. It explains the project, the plan, the rules, and how Muki likes to work.

## About Muki (the owner)

- Muki (GitHub: `mukesh132001`) is a student at NYU (data analytics and ML) and is **learning** web development, Git and the Terminal through this project.
- Explain what you're doing in plain, friendly language, one step at a time. Say what each command does before running it. Celebrate wins.
- When Muki needs to do something himself (GitHub website, Cloudflare dashboard, Strava settings), give numbered click-by-click steps.
- Machine: MacBook Air, Terminal uses **bash**. The repo lives at `~/Downloads/pixel-daily-log`.
- Muki is practicing the **branch and pull request** workflow. Default to: new branch per feature, small commits, push the branch, open a PR, merge on GitHub. Ask before committing directly to `main`.

## What the project is

A cozy pixel-art daily log. Your real day (GitHub activity, Strava runs, later music) becomes your pixel character's day. Staying active earns points that unlock new characters, pets and rewards.

Design principles (keep these in every decision):
1. **Real life drives the game.** Animations come from things the user actually did.
2. **Reward, never punish.** Pets never die or leave, streaks can be saved, rest days still count.
3. **Yours first, social later.** Make one person's world delightful before adding friends.

## Live places

- Website (GitHub Pages, publishes from `main`): https://mukesh132001.github.io/pixel-daily-log/
- Repo: https://github.com/mukesh132001/pixel-daily-log
- Strava worker (Cloudflare): https://pixel-daily-log-strava.mukeshethiraj0.workers.dev
- Strava API app: Client ID `289322`, athlete limit currently **10**.

## How it's built

No build step, no framework. Plain HTML, CSS and JavaScript ES modules. GitHub Pages serves the files as they are (`.nojekyll` is present on purpose).

```
index.html          page structure (title screen, HUD, scene, calendar, panels, phone tabs, room screen, picker)
css/style.css       cozy retro theme: CSS variables, light (warm paper) and dark (plum night)
js/main.js          app entry: loads a player, calendar, panels, controls
js/config.js        PUBLIC settings only: STRAVA_CLIENT_ID and WORKER_URL
js/github.js        GitHub REST API + community contributions API
js/strava.js        Strava OAuth flow, tokens (in localStorage), activities via the worker
js/scene.js         the 192x108 pixel canvas: sprites, phases (dawn/day/dusk/night), particles
js/room.js          the 323x256 isometric room (pack sprites + character + pennant), drawn at whole device pixels (2x, 3x on big screens) with a camera that follows the character when it doesn't fit. Its own screen at #room (routing in main.js)
js/characters.js    the character roster: id, display name, sprite paths, unlock rule (id is saved, name can change)
js/picker.js        character select: one big front-facing character, arrows, silhouettes for locked ones
sprites/characters/ Muki's own character pack (OK to commit): side sheets and front idles, 32x40 frames, feet on row 35
js/art.js           the school pennant, plus the OLD layered character (only gallery.html uses it now)
js/font.js          the A-Z pixel font
sprites/room/       ONLY the pack sprites we use (see CREDITS.md). The raw packs in assets/ are git-ignored, never commit them
js/runs.js          hand-logged runs and pace math
js/icons.js         8x8 pixel SVG icons (shoe, laptop, flame, star, tape)
js/dates.js         date helpers and the 4-week window
js/storage.js       safe localStorage wrapper
js/sound.js         Web Audio beeps (muted by default)
worker/strava-worker.js   Cloudflare Worker: holds the Strava secret, proxies token/activity calls
```

Test locally (modules need a server, double-clicking index.html won't work):
```bash
cd ~/Downloads/pixel-daily-log
python3 -m http.server 8000   # open http://localhost:8000, Ctrl + C to stop
```
Open http://localhost:8000/?dev to unlock every character for that visit (localhost only, never saved).

## Rules you must follow

- **Never put secrets in the repo.** The Strava Client Secret lives only in Cloudflare (Worker > Settings > Variables and Secrets). `js/config.js` holds public values only.
- **Worker changes don't deploy with git.** After editing `worker/strava-worker.js`, tell Muki to paste the whole file into the Cloudflare editor and click Deploy (`cat worker/strava-worker.js | pbcopy` copies it).
- The worker only accepts requests from `https://mukesh132001.github.io` and `http://localhost:8000` (see `ALLOWED_ORIGINS`).
- Strava tokens and runs stay in the browser that connected them, and only show on the linked player's world. Keep it that way.
- Respect API limits: anonymous GitHub API is ~60 requests/hour (js/github.js caches every answer for 15 minutes and falls back to saved data when limited); the public events feed covers ~90 days and no longer includes commit lists (fetch commit messages individually, capped per day).
- Don't copy existing games' characters, logos or artwork. Draw original pixel art. For schools, draw our own pennant with the name/initials and chosen colors, never an official logo. Don't use trademarked names like "FIFA" for features (call it a pixel football game).
- Accessibility: keep sound off by default, respect `prefers-reduced-motion`, keep keyboard support (arrow keys change days, space acts on the scene), keep both themes readable.
- After a change goes live, remind Muki to watch the **Actions** tab for the green check and hard refresh (Cmd + Shift + R).

## Pixel art conventions

- Canvas is 192x108, scaled up with `image-rendering: pixelated`.
- Sprites are text grids: each letter is a color, `.` is empty (see `SPRITES` and `COLORS` in `js/scene.js`).
- Use the shared cozy palette (CSS variables in `css/style.css`, `PHASES` in `js/scene.js`). New art should match its colors and pixel scale.
- The ghost mascot (sweatband, sly glowing eyes, floating sneakers) is the app's icon and appears on the title screen and rest days.
- Plan for an art **system**: one shared body with swappable layers (shirt, hair, hat, backpack) so many characters come from few drawings.

## The plan (in order)

Each step should be one or more small pull requests.

1. **Create your character** (saved in the browser for now, "Option A"): name, school + colors (for the pennant), one line about you, pick 1 of 3 starter characters + shirt color + hair, pick a starter pet + name it, optional power-ups (connect GitHub, connect Strava), then Press Start. Removes the need for a GitHub username. Include **export/import profile** so data can move to real accounts later.
2. **The room and the day-movie**: indoor coding room (desk, laptop, coffee, school pennant, window showing time of day). Coding intensity scales with contributions. Combo days (code + run) play a movie: code, stand up, open the door, run outside, more sweat on longer runs. Idle: character wanders thinking "ykims..." (= "you know I'm saying") in a bubble. Pet appears in every scene.
3. **Points, collection and badges**: earn points, unlock characters and pets, badge shelf with locked silhouettes.
4. **About me changes the world**: start with picking interests (props appear in the room); later free text read by AI.
5. **Talk to your character**: scripted replies first; later real AI through the worker with per-user daily limits and a monthly budget cap.
6. **Friends hangout** (the big boss): real accounts ("Option B": sign in with Strava or GitHub, profile stored server-side, e.g. Cloudflare D1/KV), visit a friend's room, pixel football mini-game in real time. Check Strava's rules on showing data to others; make sharing opt-in.

### Points (first draft, keep it healthy)

| Activity | Points |
|---|---|
| Run | 5 per mile (cap per day) |
| Walk | 2 per mile |
| GitHub contribution | 1 each, max 10/day |
| Each streak day | +5 |
| 7-day streak | +25 |
| New best pace (PR) | +20 |
| Welcome bonus | points for the last 4 weeks |

Add a "streak saver" (one free rest day a week). Browser points can be edited; that's fine until friends can compare, then score on the server.

### Characters

Starters: The Runner, The Coder (hoodie, headphones), The Student (backpack, cap).
Points: Night Owl 150, Cyclist 300, Pixel Bot 500, Cat 750.
Specials (achievements only): The Ghost (7-day streak), Golden Runner (3 PRs), Midnight Coder (5 commits after midnight), The Legend (30-day streak).

### Pets

Starters: Pixel Pup, Kitten. Points: Bunny 200, Duck 400, Turtle 600 (naps on run days).
Specials: Ghost Cat (14-day streak), Tiny Dragon (50 total miles, puffs fire on PR days).
Pet mood follows the streak (hearts when active, sleepy by the window after quiet days). Never sick, never leaves.

Build starters first; add more characters and pets over time.

## Later ideas (backlog)

Music via Last.fm (headphones on music days, top track on the cassette), shareable day-card images, pace trend chart + PRs for 1 mile and 5K, weekly goals as a health bar, real weather and seasons in the room window, daily note + mood, month/year calendar, weekly recap, README GIF demo, GitHub Actions checks, custom domain. Strava review checklist before going past 10 athletes: official "Connect with Strava" button image, "Powered by Strava" logo, webhooks (worker has `/webhook`; add `WEBHOOK_VERIFY_TOKEN`), short privacy page, screenshots.

## Naming

"Pixmod" is a working name. Before renaming anything, check GitHub, domains, app stores and do a quick trademark search.
