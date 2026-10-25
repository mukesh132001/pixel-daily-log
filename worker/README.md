# Strava worker (and GitHub proxy)

A tiny server on Cloudflare Workers that keeps secrets out of the public website. It handles the Strava login, refreshes tokens, and fetches activities; it also passes the site's few GitHub API calls on with a GitHub token, so everyone shares 5,000 requests an hour instead of 60 each. It stores nothing except public GitHub answers in Cloudflare's cache for 10 minutes; Strava tokens stay in each visitor's own browser.

## Deploy it (Cloudflare dashboard, no installs)

1. In dash.cloudflare.com, open **Workers & Pages**, then **Create**, then **Create Worker** (start from "Hello World").
2. Name it `pixel-daily-log-strava` and click **Deploy**.
3. Click **Edit code**, delete everything, paste in all of `strava-worker.js`, and click **Deploy**.
4. Go to the worker's **Settings**, then **Variables and Secrets**, and add:
   - `STRAVA_CLIENT_ID`, type **Text**, value `289322`
   - `STRAVA_CLIENT_SECRET`, type **Secret**, value from strava.com/settings/api
   - `GITHUB_TOKEN`, type **Secret**, a GitHub token that can read public data (a fine-grained token with "Public repositories (read-only)" is enough). Never paste it anywhere else.
5. Click **Deploy** to save the variables.
6. Copy the worker's address (like `https://pixel-daily-log-strava.yourname.workers.dev`) into `js/config.js` as `WORKER_URL`, then commit and push.

## Check it's running

Open `https://YOUR-WORKER-ADDRESS/token` in a browser. You should see `{"error":"origin not allowed"}`. That means the worker is up and correctly refusing requests that don't come from your site.

## Update it after changing the code

Worker changes don't deploy with git. After editing `strava-worker.js`:

1. Copy the whole file. In VS Code: open `worker/strava-worker.js`, press Ctrl + A, then Ctrl + C. (On a Mac terminal: `cat worker/strava-worker.js | pbcopy`.)
2. In dash.cloudflare.com, open **Workers & Pages**, then `pixel-daily-log-strava`, then **Edit code**.
3. Select everything in the editor, paste, and click **Deploy**.

Secrets (like `GITHUB_TOKEN`) stay where they are; pasting new code doesn't touch them.

## Check the GitHub proxy

In a terminal (Git Bash or macOS Terminal), run this twice:

```bash
curl -s -o /dev/null -D - -H "Origin: https://mukesh132001.github.io"   https://pixel-daily-log-strava.mukeshethiraj0.workers.dev/github/users/mukesh132001 | grep -i "^HTTP\|x-proxy-cache"
```

The first run should say `200` and `x-proxy-cache: MISS`, the second `x-proxy-cache: HIT` (Cloudflare kept the answer). (Checked on Oct 25, 2026: the cache works on the `workers.dev` address.) Opening the address straight in a browser shows `{"error":"origin not allowed"}`, which is correct.

## Endpoints

| Path | What it does |
|---|---|
| `POST /token` | Swaps Strava's one-time login code for tokens |
| `POST /refresh` | Gets a fresh access token |
| `GET /activities` | Fetches the signed-in athlete's activities |
| `POST /deauthorize` | Disconnects Strava |
| `GET/POST /webhook` | Strava's webhook endpoint, needed before applying for Strava's app review |
| `GET /github/...` | Only these GitHub calls, with our token, cached 10 minutes: `users/<name>`, `users/<name>/events/public?per_page=&page=`, `repos/<owner>/<repo>/commits/<sha>` |

## Allowed websites

Only the sites in `ALLOWED_ORIGINS` at the top of `strava-worker.js` can use this worker: your GitHub Pages site, plus these for testing: `http://localhost:8000` (python's server) and `http://localhost:5500` / `http://127.0.0.1:5500` (VS Code's Live Server).
