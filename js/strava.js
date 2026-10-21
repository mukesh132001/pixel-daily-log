// Strava: login, tokens and activities.
// Tokens are kept in this browser only, and are linked to the GitHub player who connected them,
// so your Strava runs never appear on someone else's world.

import { STRAVA_CLIENT_ID, WORKER_URL } from "./config.js";
import { store } from "./storage.js";

const KEY = "pdl:strava";
const STATE_KEY = "pdl:stravaState";
const WORKER = WORKER_URL.replace(/\/+$/, "");

const RUN_TYPES = ["Run", "TrailRun", "VirtualRun"];
const WALK_TYPES = ["Walk", "Hike"];

export const isConfigured = () => !!WORKER;
export const getConnection = () => store.get(KEY, null);
export const isLinkedTo = user => {
  const c = getConnection();
  return !!(c && user && c.ghUser.toLowerCase() === user.toLowerCase());
};

const redirectUri = () => location.origin + location.pathname;

// Step 1: send the visitor to Strava's "Authorize" page.
export function startConnect(ghUser) {
  const state = Array.from(crypto.getRandomValues(new Uint8Array(12)), b => b.toString(16).padStart(2, "0")).join("");
  try { sessionStorage.setItem(STATE_KEY, JSON.stringify({ state, ghUser })); } catch (e) {}
  const q = new URLSearchParams({
    client_id: STRAVA_CLIENT_ID,
    response_type: "code",
    redirect_uri: redirectUri(),
    approval_prompt: "auto",
    scope: "read,activity:read_all",
    state
  });
  location.href = "https://www.strava.com/oauth/authorize?" + q;
}

// Step 2: Strava sends them back with ?code=...  Swap it for tokens through the worker.
// Returns null if this page load isn't a Strava return, otherwise { ghUser, ok, error }.
export async function handleRedirect() {
  const params = new URLSearchParams(location.search);
  const code = params.get("code"), error = params.get("error"), state = params.get("state");
  if (!code && !error) return null;

  let saved = null;
  try { saved = JSON.parse(sessionStorage.getItem(STATE_KEY) || "null"); sessionStorage.removeItem(STATE_KEY); } catch (e) {}

  // Tidy the address bar: drop Strava's parameters, keep the player.
  const clean = new URL(location.href);
  ["code", "scope", "state", "error"].forEach(k => clean.searchParams.delete(k));
  if (saved && saved.ghUser) clean.searchParams.set("user", saved.ghUser);
  history.replaceState(null, "", clean);

  const ghUser = saved && saved.ghUser;
  if (error) return { ghUser, ok: false, error: "You cancelled the Strava connection." };
  if (!saved || saved.state !== state) return { ghUser, ok: false, error: "That Strava login didn’t match. Please try connecting again." };
  if (!params.get("scope") || !params.get("scope").includes("activity:read")) {
    return { ghUser, ok: false, error: "Strava needs permission to view your activities. Please connect again and leave that box ticked." };
  }

  try {
    const r = await fetch(WORKER + "/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code })
    });
    if (r.status === 403) {
      return { ghUser, ok: false, full: true,
        error: "Strava connections are full while Pixel daily log is in testing. Your GitHub world still works, and you can add runs by hand." };
    }
    if (!r.ok) throw new Error("token " + r.status);
    const t = await r.json();
    store.set(KEY, { ...t, ghUser });
    return { ghUser, ok: true };
  } catch (e) {
    return { ghUser, ok: false, error: "Couldn’t finish connecting to Strava. Please try again in a moment." };
  }
}

async function refresh(conn) {
  const r = await fetch(WORKER + "/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: conn.refresh_token })
  });
  if (!r.ok) {
    const e = new Error("refresh " + r.status);
    e.needsReconnect = r.status === 400 || r.status === 401;
    throw e;
  }
  const t = await r.json();
  const next = { ...conn, ...t };
  store.set(KEY, next);
  return next;
}

// Access tokens last about six hours; refresh a minute early.
async function validConnection() {
  let c = getConnection();
  if (!c) throw new Error("not connected");
  if (!c.expires_at || c.expires_at * 1000 < Date.now() + 60000) c = await refresh(c);
  return c;
}

// Activities since a date, newest first.
export async function fetchActivities(sinceDate) {
  const after = Math.floor(sinceDate.getTime() / 1000) - 86400;
  const get = c => fetch(`${WORKER}/activities?after=${after}&per_page=100`, { headers: { Authorization: "Bearer " + c.access_token } });
  let c = await validConnection();
  let r = await get(c);
  if (r.status === 401) { c = await refresh(c); r = await get(c); }
  if (r.status === 401) { const e = new Error("unauthorized"); e.needsReconnect = true; throw e; }
  if (r.status === 429) { const e = new Error("rate limited"); e.limited = true; throw e; }
  if (!r.ok) throw new Error("activities " + r.status);
  return r.json();
}

export async function disconnect() {
  const c = getConnection();
  store.set(KEY, null);
  try { localStorage.removeItem(KEY); } catch (e) {}
  if (!c) return;
  try {
    await fetch(WORKER + "/deauthorize", { method: "POST", headers: { Authorization: "Bearer " + c.access_token } });
  } catch (e) {}
}

// Group activities by date, in the same shape as hand-logged runs.
// Strava's start_date_local is local time, so its first 10 characters are the local date.
export function toDays(activities) {
  const byDay = {};
  activities.forEach(a => {
    const k = String(a.start_date_local || "").slice(0, 10);
    if (!k) return;
    const sport = a.sport_type || "Workout";
    const type = RUN_TYPES.includes(sport) ? "run" : WALK_TYPES.includes(sport) ? "walk" : "other";
    (byDay[k] = byDay[k] || []).push({
      id: a.id,
      name: a.name || sport,
      sport,
      type,
      mi: Math.round((a.distance || 0) / 1609.344 * 100) / 100,
      min: (a.moving_time || 0) / 60 || null,
      hour: parseInt(String(a.start_date_local || "").slice(11, 13), 10),
      source: "strava"
    });
  });
  return byDay;
}
