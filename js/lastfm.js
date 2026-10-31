// Last.fm: what you listened to. Public data only, asked for through our Worker (it holds the API key).
//
// A day's plays are counted from midnight to midnight in your own time zone. Answers are saved in this browser
// like GitHub's (see github.js): about 5 minutes for today, a day for earlier days. If Last.fm is busy (the Worker
// says "rate limited") or unreachable, an older saved answer is better than nothing: we use it and remember how
// old it was (see savedSince).

import { store } from "./storage.js";
import { WORKER_URL } from "./config.js";

const BASE = WORKER_URL ? WORKER_URL.replace(/\/+$/, "") + "/lastfm/" : "";
export const isConfigured = () => !!BASE;

// Last.fm usernames: 2 to 15 letters, numbers, _ and -, starting with a letter.
export const isValidLastfm = u => /^[A-Za-z][A-Za-z0-9_-]{1,14}$/.test(u);

const CACHE = "pdl:lf:";
const TODAY_MS = 5 * 60 * 1000;
const PAST_MS = 24 * 60 * 60 * 1000;
const NOW_MS = 60 * 1000;
const KEEP_MS = 7 * 24 * 60 * 60 * 1000;   // saved answers older than a week get cleared out
const MAX_PAGES = 3;                        // 600 plays is plenty for one day's top tracks

store.keys(CACHE).forEach(k => {
  const saved = store.get(k, null);
  if (!saved || !(Date.now() - saved.when < KEEP_MS)) store.remove(k);
});

let savedFrom = null;   // when the oldest saved answer we fell back on was saved, or null
export const savedSince = () => savedFrom;
export const clearSaved = () => { savedFrom = null; };

// Dev only (?dev&lastfm=demo): made-up plays so the Music card can be tried without the Worker.
let demo = false;
export const useDemo = on => { demo = !!on; };

// One call to the Worker. Errors carry status, limited (Last.fm is busy) and reason (the Worker's short words:
// "user not found", "private", "rate limited", ...).
async function ask(path, params) {
  const r = await fetch(BASE + path + "?" + new URLSearchParams(params));
  if (!r.ok) {
    const e = new Error("HTTP " + r.status);
    e.status = r.status;
    e.limited = r.status === 429;
    try { e.reason = (await r.json()).error; } catch (x) {}
    throw e;
  }
  return r.json();
}

// Reuse a saved answer while it's fresh; otherwise make it, save it, and use it.
async function cached(name, fresh, make) {
  const k = CACHE + name, saved = store.get(k, null);
  if (saved && Date.now() - saved.when < fresh) return saved.data;
  try {
    const data = await make();
    store.set(k, { when: Date.now(), data });
    return data;
  } catch (e) {
    if (saved && (e.limited || !e.status || e.status >= 500)) {
      savedFrom = Math.min(savedFrom ?? saved.when, saved.when);
      return saved.data;
    }
    throw e;
  }
}

// A local day as seconds since 1970: [first second, last second]. How long its answers stay fresh follows
// the Worker's rule: a day that ended over an hour ago won't change.
function dayRange(date) {
  const a = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const b = new Date(a);
  b.setDate(b.getDate() + 1);
  const from = Math.floor(a.getTime() / 1000), to = Math.floor(b.getTime() / 1000) - 1;
  return { from, to, fresh: to < Date.now() / 1000 - 3600 ? PAST_MS : TODAY_MS };
}

const lower = u => u.toLowerCase();

// ----- the public calls -----

// { name, playcount }. Throws with reason "user not found" for a name that doesn't exist.
export async function userInfo(user) {
  if (demo) return { name: user, playcount: 12345 };
  return cached(`info:${lower(user)}`, PAST_MS, () => ask("info", { user: lower(user) }));
}

// How many plays on that day (a Date). Cheap: one tiny answer, for the calendar.
export async function playsOn(user, date) {
  if (demo) return demoPlays(date);
  const { from, to, fresh } = dayRange(date);
  const d = await cached(`count:${lower(user)}:${from}`, fresh, () => ask("recent", { user: lower(user), from, to, limit: 1, page: 1 }));
  return d.total;
}

// The day's soundtrack: { plays, artist: { name, plays } | null, tracks: top 3 [{ name, artist, plays }], partial }.
// partial: there were more plays than we looked at, so the top lists come from the latest ones.
export async function soundtrack(user, date) {
  if (demo) return summarize(demoTracks(date), demoPlays(date));
  const { from, to, fresh } = dayRange(date);
  return cached(`day:${lower(user)}:${from}`, fresh, async () => {
    const tracks = [];
    let total = 0, pages = 1;
    for (let page = 1; page <= Math.min(pages, MAX_PAGES); page++) {
      const d = await ask("recent", { user: lower(user), from, to, limit: 200, page });
      total = d.total; pages = d.pages;
      tracks.push(...d.tracks);
    }
    return summarize(tracks, total);
  });
}

// What's playing right now, { name, artist }, or null. Always asks for a recent answer (a minute old at most).
export async function nowPlaying(user) {
  if (demo) return { name: "Moon Song", artist: "Demo Band" };
  const d = await cached(`now:${lower(user)}`, NOW_MS, () => ask("now", { user: lower(user) }));
  return d.now ? { name: d.now.n, artist: d.now.a } : null;
}

// ----- the numbers -----

// tracks: [{ n, a }] (newest first). Top artist and top 3 tracks by plays; ties go to the one played most recently.
export function summarize(tracks, total = tracks.length) {
  const artists = new Map(), songs = new Map();
  tracks.forEach(t => {
    artists.set(t.a, (artists.get(t.a) || 0) + 1);
    const k = t.a + "\u0001" + t.n;
    songs.set(k, songs.has(k) ? { ...songs.get(k), plays: songs.get(k).plays + 1 } : { name: t.n, artist: t.a, plays: 1 });
  });
  const [artist] = [...artists.entries()].sort((a, b) => b[1] - a[1]);
  return {
    plays: total,
    artist: artist ? { name: artist[0], plays: artist[1] } : null,
    tracks: [...songs.values()].sort((a, b) => b.plays - a.plays).slice(0, 3),
    partial: total > tracks.length
  };
}

// ----- demo data (dev only) -----

const daySeed = date => Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
const demoPlays = date => (daySeed(date) % 5 === 0 ? 0 : 6 + (daySeed(date) * 7) % 17);
const DEMO_SONGS = [["Moon Song", "Demo Band"], ["Paper Planes", "The Pixels"], ["Late Build", "Demo Band"], ["Green Checks", "Commit Club"], ["Slow Run", "The Pixels"], ["Cache Me", "Commit Club"]];
function demoTracks(date) {
  const n = demoPlays(date), seed = daySeed(date);
  return Array.from({ length: n }, (_, i) => { const [name, artist] = DEMO_SONGS[(seed + i * (i % 3 + 1)) % DEMO_SONGS.length]; return { n: name, a: artist }; });
}
