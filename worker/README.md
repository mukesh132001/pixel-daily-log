# Strava worker

A tiny server on Cloudflare Workers that keeps the Strava Client Secret out of the public website. It handles the Strava login, refreshes tokens, and fetches activities. It stores nothing: each visitor's tokens stay in their own browser.

## Deploy it (Cloudflare dashboard, no installs)

1. In dash.cloudflare.com, open **Workers & Pages**, then **Create**, then **Create Worker** (start from "Hello World").
2. Name it `pixel-daily-log-strava` and click **Deploy**.
3. Click **Edit code**, delete everything, paste in all of `strava-worker.js`, and click **Deploy**.
4. Go to the worker's **Settings**, then **Variables and Secrets**, and add:
   - `STRAVA_CLIENT_ID`, type **Text**, value `289322`
   - `STRAVA_CLIENT_SECRET`, type **Secret**, value from strava.com/settings/api
5. Click **Deploy** to save the variables.
6. Copy the worker's address (like `https://pixel-daily-log-strava.yourname.workers.dev`) into `js/config.js` as `WORKER_URL`, then commit and push.

## Check it's running

Open `https://YOUR-WORKER-ADDRESS/token` in a browser. You should see `{"error":"origin not allowed"}`. That means the worker is up and correctly refusing requests that don't come from your site.

## Endpoints

| Path | What it does |
|---|---|
| `POST /token` | Swaps Strava's one-time login code for tokens |
| `POST /refresh` | Gets a fresh access token |
| `GET /activities` | Fetches the signed-in athlete's activities |
| `POST /deauthorize` | Disconnects Strava |
| `GET/POST /webhook` | Strava's webhook endpoint, needed before applying for Strava's app review |

## Allowed websites

Only the sites in `ALLOWED_ORIGINS` at the top of `strava-worker.js` can use this worker: your GitHub Pages site and `http://localhost:8000` for testing.
