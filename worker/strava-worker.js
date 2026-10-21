// Pixel daily log: Strava helper, running on Cloudflare Workers.
//
// Why this exists: Strava gives your app a Client Secret. It can't live in the
// public website, so this tiny server keeps it and does the private steps:
//   POST /token        swap the one-time login code for tokens
//   POST /refresh      get a fresh access token when the old one expires
//   GET  /activities   fetch the signed-in athlete's activities
//   POST /deauthorize  disconnect Strava
//   GET/POST /webhook  Strava's webhook endpoint (required by Strava's API terms)
//
// Settings in Cloudflare (Worker > Settings > Variables and Secrets):
//   STRAVA_CLIENT_ID      Text    your Client ID (289322)
//   STRAVA_CLIENT_SECRET  Secret  your Client Secret from strava.com/settings/api
//   WEBHOOK_VERIFY_TOKEN  Secret  any random word you choose (only needed for webhooks)
//
// This worker stores nothing. Tokens live only in each visitor's own browser.

const ALLOWED_ORIGINS = [
  "https://mukesh132001.github.io",
  "http://localhost:8000"
];

const STRAVA = "https://www.strava.com";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const cors = {
      "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
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
