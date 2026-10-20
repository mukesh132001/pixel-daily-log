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

It's one file, `index.html`, with no build step and no server.

- The public GitHub REST API supplies profiles, activity and commit messages.
- The community-run github-contributions-api supplies daily contribution levels.
- The pixel scene is a 192x108 canvas scaled up with `image-rendering: pixelated`.

## Limits

- GitHub's public activity feed covers about the last 90 days and only public repos.
- Visitors who aren't signed in get about 60 GitHub requests an hour per network.

## Roadmap

1. GitHub by username ✅
2. Strava login through a small serverless backend
3. Music through Last.fm
4. Sharing and streak badges
