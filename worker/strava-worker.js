// Pixel daily log: Strava helper, GitHub proxy and Last.fm proxy, running on Cloudflare Workers.
//
// Why this exists: Strava gives your app a Client Secret, and GitHub allows far more requests with a token.
// Neither can live in the public website, so this tiny server keeps them and does the private steps:
//   POST /token        swap the one-time login code for tokens
//   POST /refresh      get a fresh access token when the old one expires
//   GET  /activities   fetch the signed-in athlete's activities
//   POST /deauthorize  disconnect Strava
//   GET/POST /webhook  Strava's webhook endpoint (required by Strava's API terms)
//   GET  /github/...   the few GitHub API calls the site makes, with our token, cached for 10 minutes
//   GET  /lastfm/...   the two Last.fm calls the site makes (recent plays, profile), with our key, cached 5 minutes
//                      for today and a day for earlier days
//
// Settings in Cloudflare (Worker > Settings > Variables and Secrets):
//   STRAVA_CLIENT_ID      Text    your Client ID (289322)
//   STRAVA_CLIENT_SECRET  Secret  your Client Secret from strava.com/settings/api
//   WEBHOOK_VERIFY_TOKEN  Secret  any random word you choose (only needed for webhooks)
//   GITHUB_TOKEN          Secret  a GitHub token (public read access is enough). Never print or log it.
//   LASTFM_API_KEY        Secret  your Last.fm API key (last.fm/api). Never print or log it, and never put it in a cache key.
//
// This worker stores nothing except public GitHub and Last.fm answers in Cloudflare's cache.
// Strava tokens live only in each visitor's own browser.

// The live site, plus local testing: python's http.server (8000) and VS Code's Live Server (5500).
const ALLOWED_ORIGINS = [
  "https://mukesh132001.github.io",
  "http://localhost:8000",
  "http://localhost:5500",
  "http://127.0.0.1:5500"
];

const STRAVA = "https://www.strava.com";
const GITHUB = "https://api.github.com";
const GITHUB_CACHE_SECONDS = 600;
const LASTFM = "https://ws.audioscrobbler.com/2.0/";
const LASTFM_TODAY_SECONDS = 300;        // plays from today (or the last hour of yesterday, which may still be syncing)
const LASTFM_PAST_SECONDS = 86400;       // plays from earlier days don't change
const LASTFM_NOW_SECONDS = 60;           // "now playing" has to stay fresh
const LASTFM_USER = /^[A-Za-z][A-Za-z0-9_-]{1,14}$/;   // Last.fm usernames: 2 to 15 letters, numbers, _ and -

// The only GitHub calls we pass on: exactly the ones js/github.js makes.
// path: a pattern for everything after /github/; query: the parameters allowed (small whole numbers only).
const GITHUB_ROUTES = [
  { path: /^users\/[A-Za-z0-9-]{1,39}$/, query: [] },                                                       // a profile
  { path: /^users\/[A-Za-z0-9-]{1,39}\/events\/public$/, query: ["per_page", "page"] },                     // public activity
  { path: /^repos\/[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}\/commits\/[0-9a-f]{7,40}$/, query: [] }        // one commit
];

// The only Last.fm calls we pass on (both read-only, public data), as /lastfm/<name>?<query>.
//   recent: user.getRecentTracks for one stretch of time (from, to: seconds since 1970, at most 25 hours apart).
//           limit is 1 (just to count the plays) or 200; page is 1 to 10.
//   now:    user.getRecentTracks, only the newest play (is something playing right now?)
//   info:   user.getInfo, to check a username exists
const LASTFM_ROUTES = {
  recent: { method: "user.getrecenttracks", query: ["user", "from", "to", "limit", "page"] },
  now: { method: "user.getrecenttracks", query: ["user"], fixed: { limit: "1" } },
  info: { method: "user.getinfo", query: ["user"] }
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const cors = {
      "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Expose-Headers": "X-RateLimit-Reset, X-Proxy-Cache",
      "Vary": "Origin"
    };
    const json = (data, status = 200) =>
      new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });

    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    // Webhooks come from Strava's servers, not from a browser, so no origin check here.
    if (url.pathname === "/webhook") {
      if (request.method === "GET") {
        const ok = url.searchParams.get("hub.mode") === "subscribe" &&
                   env.WEBHOOK_VERIFY_TOKEN &&
                   url.searchParams.get("hub.verify_token") === env.WEBHOOK_VERIFY_TOKEN;
        return ok ? json({ "hub.challenge": url.searchParams.get("hub.challenge") }) : json({ error: "forbidden" }, 403);
      }
      if (request.method === "POST") {
        // Deauthorizations and new activities arrive here. Nothing is stored on this
        // server, so there is nothing to delete; the browser drops its tokens when they stop working.
        return new Response("ok");
      }
    }

    if (!ALLOWED_ORIGINS.includes(origin)) return json({ error: "origin not allowed" }, 403);

    try {
      if (url.pathname === "/token" && request.method === "POST") {
        const { code } = await request.json();
        if (!code) return json({ error: "missing code" }, 400);
        return tokenRequest(env, { grant_type: "authorization_code", code }, json, true);
      }

      if (url.pathname === "/refresh" && request.method === "POST") {
        const { refresh_token } = await request.json();
        if (!refresh_token) return json({ error: "missing refresh_token" }, 400);
        return tokenRequest(env, { grant_type: "refresh_token", refresh_token }, json, false);
      }

      if (url.pathname === "/activities" && request.method === "GET") {
        const auth = request.headers.get("Authorization");
        if (!auth) return json({ error: "missing token" }, 401);
        const q = new URLSearchParams();
        for (const k of ["after", "before", "page", "per_page"]) {
          const v = url.searchParams.get(k);
          if (v && /^\d+$/.test(v)) q.set(k, v);
        }
        const r = await fetch(`${STRAVA}/api/v3/athlete/activities?${q}`, { headers: { Authorization: auth } });
        if (!r.ok) return json({ error: "strava error", status: r.status }, r.status);
        const list = await r.json();
        // Send back only what the page needs.
        return json(list.map(a => ({
          id: a.id, name: a.name, sport_type: a.sport_type || a.type,
          start_date_local: a.start_date_local, distance: a.distance,
          moving_time: a.moving_time, elapsed_time: a.elapsed_time
        })));
      }

      if (url.pathname.startsWith("/github/") && request.method === "GET") {
        return await githubRequest(url, env, ctx, cors, json);
      }

      if (url.pathname.startsWith("/lastfm/") && request.method === "GET") {
        return await lastfmRequest(url, env, ctx, cors, json);
      }

      if (url.pathname === "/deauthorize" && request.method === "POST") {
        const auth = request.headers.get("Authorization");
        if (!auth) return json({ error: "missing token" }, 401);
        const r = await fetch(`${STRAVA}/oauth/deauthorize`, { method: "POST", headers: { Authorization: auth } });
        return json({ ok: r.ok }, r.ok ? 200 : r.status);
      }

      return json({ error: "not found" }, 404);
    } catch (e) {
      return json({ error: "server error" }, 500);
    }
  }
};

async function tokenRequest(env, params, json, includeAthlete) {
  const body = new URLSearchParams({
    client_id: env.STRAVA_CLIENT_ID,
    client_secret: env.STRAVA_CLIENT_SECRET,
    ...params
  });
  const r = await fetch(`${STRAVA}/oauth/token`, { method: "POST", body });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    // 403 at this step usually means the app has hit Strava's limit of connected athletes.
    if (r.status === 403) return json({ error: "athlete limit", message: d.message || "" }, 403);
    return json({ error: "token request failed", status: r.status }, r.status === 400 || r.status === 401 ? r.status : 502);
  }
  const out = { access_token: d.access_token, refresh_token: d.refresh_token, expires_at: d.expires_at };
  if (includeAthlete && d.athlete) {
    out.athlete = { id: d.athlete.id, firstname: d.athlete.firstname, lastname: d.athlete.lastname };
  }
  return json(out);
}

// Pass one allowed GitHub call on with our token. Answers that worked are kept in Cloudflare's cache
// for 10 minutes, so many visitors share one request. X-Proxy-Cache says HIT or MISS, for checking.
async function githubRequest(url, env, ctx, cors, json) {
  const path = url.pathname.slice("/github/".length);
  const route = GITHUB_ROUTES.find(r => r.path.test(path));
  if (!route) return json({ error: "not allowed" }, 403);

  // Rebuild the address from the checked pieces, in a fixed order, so it doubles as the cache key.
  const q = new URLSearchParams();
  for (const [k, v] of url.searchParams) {
    if (!route.query.includes(k) || !/^\d{1,3}$/.test(v)) return json({ error: "not allowed" }, 403);
  }
  route.query.forEach(k => { if (url.searchParams.has(k)) q.set(k, url.searchParams.get(k)); });
  const qs = q.toString();
  const target = `${GITHUB}/${path}${qs ? "?" + qs : ""}`;
  if (!env.GITHUB_TOKEN) return json({ error: "github token not set" }, 503);   // the site falls back to GitHub directly

  // If the cache isn't available (it does nothing in the dashboard's preview), we just skip it.
  const cache = caches.default;
  const key = new Request(target);
  const hit = await cache.match(key).catch(() => null);
  if (hit) return withCors(hit, cors, "HIT");

  const r = await fetch(target, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      "User-Agent": "pixel-daily-log-worker",
      "X-GitHub-Api-Version": "2022-11-28"
    }
  });
  if (!r.ok) {
    // Pass on only the status and, for the hourly limit, when it resets. Never GitHub's other headers.
    const headers = { ...cors, "Content-Type": "application/json", "X-Proxy-Cache": "MISS" };
    const reset = r.headers.get("X-RateLimit-Reset");
    if (reset && /^\d+$/.test(reset)) headers["X-RateLimit-Reset"] = reset;
    return new Response(JSON.stringify({ error: "github error", status: r.status }), { status: r.status, headers });
  }

  // A clean copy for the cache (no CORS headers: those depend on who's asking).
  const body = await r.text();
  const fresh = new Response(body, {
    headers: { "Content-Type": "application/json", "Cache-Control": `public, max-age=${GITHUB_CACHE_SECONDS}` }
  });
  ctx.waitUntil(cache.put(key, fresh.clone()).catch(() => {}));
  return withCors(fresh, cors, "MISS");
}

function withCors(response, cors, status) {
  const out = new Response(response.body, response);
  Object.entries(cors).forEach(([k, v]) => out.headers.set(k, v));
  out.headers.set("X-Proxy-Cache", status);
  return out;
}

// Pass one allowed Last.fm call on with our API key. The key is only ever added to the request we send to Last.fm:
// it is not in the cache key, not in the answer, and not in any error. We send back a trimmed copy of the answer
// (only what the page uses), cached at Cloudflare. X-Proxy-Cache says HIT or MISS, for checking.
async function lastfmRequest(url, env, ctx, cors, json) {
  const name = url.pathname.slice("/lastfm/".length);
  const route = Object.hasOwn(LASTFM_ROUTES, name) ? LASTFM_ROUTES[name] : null;
  if (!route) return json({ error: "not allowed" }, 403);

  // Check every parameter, then rebuild the query in a fixed order (this is also the cache key).
  for (const k of url.searchParams.keys()) if (!route.query.includes(k)) return json({ error: "not allowed" }, 403);
  const user = url.searchParams.get("user") || "";
  if (!LASTFM_USER.test(user)) return json({ error: "bad username" }, 400);
  const q = new URLSearchParams({ user: user.toLowerCase() });

  let seconds = LASTFM_NOW_SECONDS;
  if (name === "recent") {
    const from = url.searchParams.get("from"), to = url.searchParams.get("to");
    const limit = url.searchParams.get("limit") || "200", page = url.searchParams.get("page") || "1";
    if (!/^\d{10}$/.test(from || "") || !/^\d{10}$/.test(to || "") || Number(to) < Number(from) || Number(to) - Number(from) > 90000) return json({ error: "bad time" }, 400);
    if (!["1", "200"].includes(limit) || !/^([1-9]|10)$/.test(page)) return json({ error: "bad page" }, 400);
    q.set("from", from); q.set("to", to); q.set("limit", limit); q.set("page", page);
    // Today's plays can still change; a day that ended more than an hour ago won't.
    seconds = Number(to) < Date.now() / 1000 - 3600 ? LASTFM_PAST_SECONDS : LASTFM_TODAY_SECONDS;
  } else if (name === "info") {
    seconds = LASTFM_PAST_SECONDS;
  }
  if (!env.LASTFM_API_KEY) return json({ error: "lastfm key not set" }, 503);

  // The cache key is a made-up address with no API key in it. (If the cache isn't available, we skip it.)
  const cache = caches.default;
  const key = new Request(`https://lastfm.cache.invalid/${name}?${q}`);
  const hit = await cache.match(key).catch(() => null);
  if (hit) return withCors(hit, cors, "HIT");

  const params = new URLSearchParams({ method: route.method, format: "json", ...(route.fixed || {}) });
  for (const [k, v] of q) params.set(k, v);
  params.set("api_key", env.LASTFM_API_KEY);
  const r = await fetch(`${LASTFM}?${params}`, { headers: { "User-Agent": "pixel-daily-log-worker" } });
  const d = await r.json().catch(() => null);

  // Last.fm reports problems as { error: <number> }, sometimes with an ordinary 200. Pass on only our own words.
  if (!d || d.error || !r.ok) {
    const code = d && d.error;
    const [status, error] = code === 6 ? [404, "user not found"]
      : code === 17 ? [403, "private"]                  // the person hides their listening history
      : code === 29 ? [429, "rate limited"]
      : code === 10 || code === 26 ? [503, "lastfm key problem"]
      : r.status === 429 ? [429, "rate limited"]
      : [502, "lastfm error"];
    return new Response(JSON.stringify({ error }), { status, headers: { ...cors, "Content-Type": "application/json", "X-Proxy-Cache": "MISS" } });
  }

  const body = JSON.stringify(name === "info" ? slimLastfmInfo(d) : slimLastfmTracks(d));
  const fresh = new Response(body, { headers: { "Content-Type": "application/json", "Cache-Control": `public, max-age=${seconds}` } });
  ctx.waitUntil(cache.put(key, fresh.clone()).catch(() => {}));
  return withCors(fresh, cors, "MISS");
}

const clip = v => String(v == null ? "" : v).slice(0, 120);

// { total, page, pages, now: { n, a } or null, tracks: [{ n: name, a: artist, t: seconds since 1970 }] }
// "Now playing" has no time, so it's kept apart from the finished plays.
function slimLastfmTracks(d) {
  const rt = d.recenttracks || {};
  const list = Array.isArray(rt.track) ? rt.track : rt.track ? [rt.track] : [];   // one track comes as an object, not a list
  const at = rt["@attr"] || {};
  let now = null;
  const tracks = [];
  list.forEach(t => {
    const track = { n: clip(t.name), a: clip(t.artist && (t.artist["#text"] || t.artist.name)) };
    if (t["@attr"] && t["@attr"].nowplaying === "true") now = track;
    else tracks.push({ ...track, t: Number(t.date && t.date.uts) || 0 });
  });
  return { total: Number(at.total) || 0, page: Number(at.page) || 1, pages: Number(at.totalPages) || 1, now, tracks };
}

// { name, playcount }
function slimLastfmInfo(d) {
  const u = d.user || {};
  return { name: clip(u.name), playcount: Number(u.playcount) || 0 };
}
