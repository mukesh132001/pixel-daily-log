# Pixel daily log

Type any GitHub username and watch the last four weeks turn into an 8-bit world. Code days put your character at a desk with commit blocks floating up. Run days send them running down the track. Rest days mean a nap on the bench.

## Try it

Open the site and type a GitHub username. You can also link straight to someone's world:

```
https://mukesh132001.github.io/pixel-daily-log/?user=USERNAME
```

## What it shows

- **GitHub:** contribution levels for each day, public activity (pushes, new repos, pull requests, issues), and commit messages loaded when you pick a day. It also lists the repos you were most active in.
- **Runs:** add runs by hand with distance and time, and the page works out your pace. Runs are saved in your own browser.
- **Music:** coming in a later round through Last.fm.

## How it works

There's no build step and no server. GitHub Pages serves the files as they are.

```
pixel-daily-log/
├── index.html        the page structure (what's on screen)
├── css/
│   └── style.css     colors, pixel frames, layout, dark mode
└── js/
    ├── main.js       starts the app, draws the calendar and panels, handles clicks
    ├── github.js     everything that talks to GitHub
    ├── scene.js      the pixel world: sprites, animation loop, particles
    ├── runs.js       runs logged by hand, and pace math
    ├── dates.js      date helpers and the four-week window
    ├── storage.js    saving things in the browser
    └── sound.js      retro beeps
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

## Roadmap

1. GitHub by username ✅
2. Strava login through a small serverless backend
3. Music through Last.fm
4. Sharing and streak badges
