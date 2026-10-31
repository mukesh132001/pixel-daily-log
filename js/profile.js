// Your profile: who you are in the pixel world. Saved in this browser, and in your account if you sign in
// (see account.js). Runs and the Strava link belong to the profile's id, so GitHub is optional.

import { store, runsKey, LAST_USER } from "./storage.js";
import { mergeLedgers } from "./xp.js";
import { mergePets } from "./adopt.js";

const KEY = "pdl:profile";

// GitHub usernames can't contain "_", so an id can never be mistaken for one.
const newId = () => "p_" + Array.from(crypto.getRandomValues(new Uint8Array(12)), b => b.toString(16).padStart(2, "0")).join("");

// The school and pet get filled in later. Their shapes:
//   characterId: an id from the roster in characters.js (the character you picked)
//   unlocked:  { night_owl: "2026-10-24", ... }   characters you've earned, and when. Never taken away.
//   log:       { days: ["2026-10-20", ...], best: 7 }   every day you logged (a commit or a run), and your best streak
//   school:    { name, initials, c1, c2 }         (cleanSchool() in art.js makes it safe)
//   pet:       { type, name }
//   xp:        { days: { "2026-10-29": 42, ... }, older: 0 }   XP earned per day (see xp.js)
//   levelSeen: the last room level we celebrated, so each level up gets one "Level up!"
//   pets:      { have: { shiba: ["2026-10-30", 0] }, room: ["shiba"] }   adopted pets (day, XP paid) and who's in the room
//   eventsSeen: { halloween: 2026 }   the last year each seasonal banner was shown ("Happy Halloween!")
//   lastfm:    your Last.fm username, or "" (optional, for the Music card)
//   lastfmShare: true = "Copy link" includes your Last.fm username, so visitors see your day's music too
export function newProfile(fields = {}) {
  return {
    v: 1,
    id: newId(),
    name: "",
    about: "",
    school: null,
    characterId: "leo",
    unlocked: {},
    log: { days: [], best: 0 },
    pet: null,
    github: null,
    xp: { days: {}, older: 0 },
    levelSeen: 1,
    eventsSeen: {},
    pets: { have: {}, room: [] },
    lastfm: "",
    lastfmShare: true,
    createdAt: new Date().toISOString(),
    ...fields
  };
}

export const isProfile = p => !!(p && p.v === 1 && /^p_[0-9a-f]{24}$/.test(p.id));

export function loadProfile() {
  const p = store.get(KEY, null);
  return isProfile(p) ? p : null;
}

// Every save tells the listeners (the account uploads changes). quiet: don't tell them
// (used when the profile just came from the account, so there's nothing to upload).
const listeners = [];
export const onProfileSaved = fn => listeners.push(fn);
export function saveProfile(p, { quiet = false } = {}) {
  store.set(KEY, p);
  if (!quiet) listeners.forEach(fn => fn(p));
}

// The only fields that go to your account. Strava tokens and hand-logged runs aren't on the profile,
// and anything added to it later stays in this browser until it's listed here.
const CLOUD_FIELDS = ["v", "id", "name", "about", "school", "characterId", "unlocked", "log", "pet", "github", "createdAt", "xp", "levelSeen", "eventsSeen", "pets", "lastfm", "lastfmShare"];
export const cloudCopy = p => Object.fromEntries(CLOUD_FIELDS.filter(k => k in p).map(k => [k, p[k]]));

// Two copies of the same profile (this browser and your account): keep base's choices, and everything
// either one earned. Unlocks and logged days only ever add up, and each day's XP keeps the higher number.
export function mergeProgress(base, other) {
  const merged = recordDays({ ...base, unlocked: { ...(other.unlocked || {}), ...(base.unlocked || {}) } },
    (other.log && Array.isArray(other.log.days)) ? other.log.days : []);
  merged.log.best = Math.max(merged.log.best, (other.log && other.log.best) || 0);
  merged.xp = mergeLedgers(base.xp, other.xp);
  merged.levelSeen = Math.max(base.levelSeen || 1, other.levelSeen || 1);
  merged.pets = mergePets(base.pets, other.pets);
  merged.lastfm = base.lastfm || other.lastfm || "";
  merged.lastfmShare = base.lastfmShare ?? other.lastfmShare ?? true;
  merged.eventsSeen = { ...(other.eventsSeen || {}) };
  Object.entries(base.eventsSeen || {}).forEach(([id, year]) => (merged.eventsSeen[id] = Math.max(merged.eventsSeen[id] || 0, year)));
  return merged;
}

// Is this GitHub username the one on your profile?
export const isMine = (me, login) => !!(me && me.github && login && me.github.toLowerCase() === login.toLowerCase());

// ----- the day-by-day log -----

const KEEP_DAYS = 400;   // enough for a year of streaks; best is kept even after old days drop off

const dayNumber = k => { const [y, m, d] = k.split("-").map(Number); return Math.round(Date.UTC(y, m - 1, d) / 86400000); };

// The longest run of back-to-back days in a list of "YYYY-MM-DD" keys.
export function longestStreak(days) {
  const nums = [...new Set(days)].map(dayNumber).sort((a, b) => a - b);
  let best = 0, run = 0;
  nums.forEach((n, i) => { run = i && n === nums[i - 1] + 1 ? run + 1 : 1; best = Math.max(best, run); });
  return best;
}

// Add newly logged days to the profile. Days only ever get added, so a streak you earned stays earned
// even after GitHub's feed forgets it. Returns a new profile.
export function recordDays(me, keys) {
  const old = (me.log && Array.isArray(me.log.days)) ? me.log.days : [];
  const days = [...new Set([...old, ...keys])].sort().slice(-KEEP_DAYS);
  const best = Math.max((me.log && me.log.best) || 0, longestStreak(days));
  return { ...me, log: { days, best } };
}

// Before profiles, everything was keyed by GitHub username. Turn that player into a profile,
// copying their hand-logged runs across (the old copy stays as a backup).
// The username Strava was linked to wins, since you'd only connect Strava to your own world.
export function migrateOldPlayer() {
  const conn = store.get("pdl:strava", null);
  const github = (conn && conn.ghUser) || store.get(LAST_USER, null);
  if (!github) return null;
  const me = newProfile({ github });
  const runs = store.get(runsKey(github), null);
  if (runs) store.set(runsKey(me.id), runs);
  saveProfile(me);
  return me;
}
