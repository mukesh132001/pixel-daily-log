# Pixel daily log

Type any GitHub username and watch the last four weeks turn into a cozy 8-bit world. Code days put your character at a desk with commit blocks floating up. Run days send them running down the track. Rest days mean a nap on the bench.

## Try it

Open the site and type a GitHub username. You can also link straight to someone's world:

```
https://mukesh132001.github.io/pixel-daily-log/?user=USERNAME
```

## The pixel world

- **Time of day:** the sky follows when you actually ran or coded: sunrise for morning runs, sunset in the evening, moonlight at night.
- **Streak flame:** a little flame and your streak count glow in the corner on streak days.
- **Personal best:** on your fastest-pace day the runner wears gold and a "PR!" badge pops up.
- **The ghost:** the mascot from the app icon jogs along on the title screen and drifts across the sky on rest days.
- **Glowing calendar:** brighter tiles mean bigger days, with a preview when you hover.

## What it shows

- **GitHub:** contribution levels for each day, public activity (pushes, new repos, pull requests, issues), and commit messages loaded when you pick a day. It also lists the repos you were most active in.
- **Runs:** connect Strava to see your real runs and walks, with your best and average pace over four weeks. You can also add runs by hand. Strava runs only show in the browser that connected them, and only on that player's world.
- **Music:** coming in a later round through Last.fm.

## How it works

There's no build step. GitHub Pages serves the website as it is, and one small Cloudflare Worker handles the private part of the Strava login.

```
pixel-daily-log/
├── index.html        the page structure (what's on screen)
├── css/
│   └── style.css     colors, pixel frames, layout, dark mode
├── js/
│   ├── main.js       starts the app, draws the calendar and panels, handles clicks
│   ├── config.js     public settings: Strava Client ID and the worker's address
│   ├── github.js     everything that talks to GitHub
│   ├── strava.js     Strava login, tokens and activities
    ├── scene.js      the pixel world: sprites, animation loop, particles
│   ├── runs.js       runs logged by hand, and pace math
│   ├── icons.js      tiny pixel icons (shoe, laptop, flame, star, tape)
│   ├── dates.js      date helpers and the four-week window
│   ├── storage.js    saving things in the browser
│   └── sound.js      retro beeps
└── worker/
    ├── strava-worker.js  the small Cloudflare server that keeps the Strava secret safe
    └── README.md         how to deploy it
```

- The public GitHub REST API supplies profiles, activity and commit messages.
- The community-run github-contributions-api supplies daily contribution levels.
- The pixel scene is a 192x108 canvas scaled up with `image-rendering: pixelated`.

## Run it on your computer

The JavaScript files load each other as modules, and browsers only allow that from a web server, not from double-clicking `index.html`. In the project folder, run:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000 in your browser. Press Ctrl+C in the terminal to stop it.

## Limits

- GitHub's public activity feed covers about the last 90 days and only public repos.
- Visitors who aren't signed in get about 60 GitHub requests an hour per network.
- New Strava apps can connect only one athlete (the owner). Strava allows up to 10 after an upgrade, and more after Strava reviews the app.

## Roadmap

1. GitHub by username ✅
2. Strava login through a small serverless backend ✅
3. Music through Last.fm
4. Sharing and streak badges
