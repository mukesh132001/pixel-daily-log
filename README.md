# Pixel daily log (Pixmod)

A cozy pixel-art daily log. Your real day (GitHub activity and Strava runs) becomes your pixel character's day, and staying active earns XP that grows your room, unlocks characters and lets you adopt pets. Pixmod is a working name.

Three ideas guide everything:

1. **Real life drives the game.** Animations come from things you actually did.
2. **Reward, never punish.** Pets never die or leave, rest days are fine, and nothing is ever taken away.
3. **Yours first, social later.** One person's world comes first; friends come after.

## Try it

Open https://mukesh132001.github.io/pixel-daily-log/ and type a GitHub username, or sign in to keep a profile. You can also link straight to someone's world (a read-only peek):

```
https://mukesh132001.github.io/pixel-daily-log/?user=USERNAME
```

## The pixel world

- **The day-movie:** the last four weeks sit on a glowing calendar. Pick a day and the scene plays it: code days put your character at a desk with commit blocks floating up, run days send them down the track (faster on longer runs), rest days mean a nap on the bench.
- **Time of day:** the sky follows when you actually ran or coded, with sunrise, sunset and moonlight.
- **Streak flame:** a flame and your streak count glow in the corner on streak days. A streak is days in a row with a commit or a run.
- **Personal best:** on your fastest-pace day the runner wears gold and a "PR!" badge pops up.
- **The ghost:** the mascot from the app icon jogs along on the title screen and drifts across the sky on rest days.

## Your room

Press **My room** for an isometric room (its own screen at `#room`) that you can walk around with the arrow keys or WASD, a touch pad on phones, or a click. It scales to the largest whole number that fits the screen and stays crisp. On small screens a camera follows your character.

- **XP and levels:** a code day earns 10 XP plus 2 per contribution (up to 30). Runs earn 15 plus 5 per mile and walks 2 per mile (up to 50 a day together). Each streak day adds 5 (up to 25). Rest days earn nothing and cost nothing. The room has 10 levels, and new furniture drops in at each one, with a "Level up!" banner.
- **Today in the room:** what you did today shows up: the monitor glows on a coding day, shoes and a water bottle after a run, a medal after a long one, a candle for a streak, a record player with floating notes on days you played music, and sleepy zzz at night.
- **Seasonal events:** decor like the Halloween set appears while its dates are on, with a one-time banner.
- **The closet:** stand in front of it to open the character picker and step out in a new look.

## Characters

Characters are picked and unlocked, not built. Leo is yours from the start. Night Owl comes from a push between midnight and 4am, Ghost Kid from a 7-day streak, and Rain Runner from 3 runs in one week (Monday to Sunday). Unlocks are never taken away.

## Pets

After a **7-day streak** (your best streak counts, so the door never locks again) the big door in your room leads to the pet room. There are 22 dogs and cats to adopt, from common to legendary. The first pet is free and common, and the rest cost XP from a balance. Your room's level still follows the XP you've earned, so adopting never takes furniture away. Up to 4 pets live in the room at once. They hop between spots, wag, blink, eat at the bowl and sleep on beds, and clicking one gives it a heart.

## Sign in (optional)

You can use the site as a guest and everything works. If you sign in with your email (a magic link, no password), your profile (name, school, character, unlocks, streak log, XP, pets, and your GitHub and Last.fm usernames) is saved to your account so you can open it on any device. Strava tokens and runs never leave the browser that connected them. [privacy.html](privacy.html) says exactly what is saved and how to delete it.

## What it shows

- **GitHub:** contribution levels for each day, public activity (pushes, new repos, pull requests, issues), and commit messages loaded when you pick a day. It also lists the repos you were most active in. Long lists show 4 items with a "Show all" button.
- **Runs:** connect Strava to see your real runs and walks, with your best and average pace over four weeks. You can also add runs by hand.
- **Music:** connect Last.fm (Spotify scrobbles to it) to see the selected day's soundtrack: number of plays, top artist, top 3 tracks, and what's playing right now on today. Days with plays get a small music note on the calendar, and your room gets a record player with floating notes. The Last.fm username is optional, and "Copy link" can include it so visitors see your music too.

## Accessibility

Sound is off by default. With reduced motion turned on, animations slow down instead of stopping, and flashy effects such as sparkles, flicker and screen wipes are left out. Days change with the arrow keys, and Space acts on the scene. Both light and dark themes are readable.

## How it works

There's no build step and no framework: plain HTML, CSS and JavaScript modules. GitHub Pages serves the files as they are. One small Cloudflare Worker keeps the Strava secret, a GitHub token and a Last.fm key private, and Supabase stores profiles for signed-in people.

```
pixel-daily-log/
├── index.html          page structure
├── privacy.html        what's saved and how to delete it
├── css/style.css       colors, pixel frames, layout, light and dark themes
├── js/
│   ├── main.js         starts the app: calendar, panels, controls, screens
│   ├── config.js       public settings only (Strava client ID, worker and Supabase addresses)
│   ├── scene.js        the 192x108 pixel world: sprites, phases, particles
│   ├── room.js         the isometric rooms, walking, camera, levels, events
│   ├── roomfloor.js    the tile floor, blocked tiles and pathing
│   ├── roomtoday.js    what you did today, shown in the room
│   ├── xp.js           XP rules and room levels
│   ├── characters.js   the character roster and unlock rules
│   ├── picker.js       the character select screen
│   ├── pets.js         how pets move in the pet room
│   ├── adopt.js        adoption rules and the Adopt panel
│   ├── profile.js      the saved profile, merging and streaks
│   ├── account.js      optional sign-in and profile sync (Supabase)
│   ├── login.js        the Sign in / Account box
│   ├── github.js       GitHub REST API and contribution levels
│   ├── strava.js       Strava login, tokens and activities
│   ├── lastfm.js       Last.fm plays, top artist and tracks, through the worker
│   ├── runs.js         runs logged by hand, and pace math
│   ├── art.js          the school pennant
│   └── dates.js, font.js, icons.js, sound.js, storage.js   small helpers
├── sprites/            room, pet room, characters, pets, events and today art
├── supabase/           the profiles table and its access rules
├── tools/              the Python scripts that generate the pet art and the pet room (not part of the site)
└── worker/             the Cloudflare Worker (strava-worker.js) and how to deploy it
```

- The public GitHub REST API supplies profiles, activity and commit messages (through the worker when it can).
- The community-run github-contributions-api supplies daily contribution levels.
- The pixel scene is a 192x108 canvas scaled up with `image-rendering: pixelated`, and the rooms are drawn at whole device pixels.

## Run it on your computer

The JavaScript files load each other as modules, and browsers only allow that from a web server, not from double-clicking `index.html`. In the project folder, run:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000 in your browser. Press Ctrl+C in the terminal to stop it.

On localhost, add `?dev` to the address to try things out without saving anything: `?dev` unlocks every character, `?dev&xp=500` fakes your XP, `?dev&pets=all` gives you every pet, and `?dev&event=halloween` turns an event on. The room also gets a level picker.

## Limits

- GitHub's public activity feed covers about the last 90 days and only public repos.
- Visitors who aren't signed in get about 60 GitHub requests an hour per network when the worker can't be used.
- The Strava app is limited to 10 athletes until Strava reviews it.

## Roadmap

1. GitHub by username ✅
2. Strava login through a small serverless backend ✅
3. Rooms, characters, XP and levels ✅
4. Sign in and profiles that follow you ✅
5. Pets and the pet room ✅
6. Music through Last.fm ✅
7. Talk to your character
8. Friends: visit a friend's room and play together
