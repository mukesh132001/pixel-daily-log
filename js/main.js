// Entry point: loads a player, draws the calendar and panels, and wires up the buttons.

import { key, fmt, TODAY, TODAY_K, DAYS } from "./dates.js";
import { loadProfile, saveProfile, newProfile, isMine, migrateOldPlayer, recordDays } from "./profile.js";
import { setSound, sfx } from "./sound.js";
import {
  GH_COLORS, isValidUsername, fetchProfile, fetchContributions, fetchEvents,
  levelsFromEvents, fetchCommitMessage, groupEvents, savedSince, clearSaved
} from "./github.js";
import { loadRuns, saveRuns, pace, formatPace, paceValue, averagePace, isRun, totalMiles } from "./runs.js";
import * as strava from "./strava.js";
import { createScene } from "./scene.js";
import { createRoom } from "./room.js";
import { dayXp, streakEnding, updateLedger, totalXp, progress } from "./xp.js";
import { todayState, DEV_DAYS } from "./roomtoday.js";
import { ROSTER, DEFAULT_ID, byId, isUnlocked, meetsRule } from "./characters.js";
import { createPicker } from "./picker.js";
import { setupLogin, settleAccount } from "./login.js";
import { fillIcons, iconSpan } from "./icons.js";

const $ = id => document.getElementById(id);
fillIcons();
setupLogin();   // the Sign in button (only when Supabase is set up in config.js)
const canvas = $("scene");
const scene = createScene(canvas);
const room = createRoom($("room"), { bubble: $("roomBubble"), bubbleText: $("roomBubbleText"), open: $("roomOpen"), pad: $("roomPad") });

// Dev only: open http://localhost:8000/?dev to unlock every character for this visit (nothing is saved).
// In the room, ?dev also shows a level picker (or start on one with ?dev&level=3), and ?dev&xp=500 pretends
// you have 500 XP for this visit (nothing is saved, not even the level-up you saw).
const PARAMS = new URLSearchParams(location.search);
const DEV = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && PARAMS.has("dev");
const DEV_XP = DEV && PARAMS.has("xp") ? Math.max(0, Number(PARAMS.get("xp")) || 0) : null;
let devLevel = DEV ? Math.max(0, Math.min(5, Number(PARAMS.get("level")) || 0)) || null : null;   // the dev picker's level
// ?dev&event=halloween shows that event's decorations whatever the date; ?dev&event=none hides them all.
const DEV_EVENT = DEV && PARAMS.has("event") ? PARAMS.get("event") || "none" : null;
// ?dev&today=coded|ran|both|none pretends that's your day in the room; &hour=22 pretends it's 10pm (for the zzz),
// &streak=7 sets the streak (for the candle; "both" has 5 unless you say otherwise).
const DEV_TODAY = DEV && PARAMS.has("today") ? DEV_DAYS[PARAMS.get("today")] || DEV_DAYS.none : null;
const DEV_HOUR = DEV && PARAMS.has("hour") ? Number(PARAMS.get("hour")) : null;
const DEV_STREAK = DEV && PARAMS.has("streak") ? Number(PARAMS.get("streak")) : null;
const unlockedFor = me => (DEV ? Object.fromEntries(ROSTER.map(c => [c.id, "dev"])) : (me && me.unlocked) || {});
const EVERYONE = Object.fromEntries(ROSTER.map(c => [c.id, "closet"]));
// Your picked character, or the default for peeks and new players. (The closet lets you try on anyone for now,
// so a pick isn't checked against your unlocks.)
const characterFor = me => (me && byId(me.characterId)) || byId(DEFAULT_ID);
scene.setCharacter(characterFor(loadProfile()));

let fromCloset = false;   // the picker was opened from the room's closet
const picker = createPicker({
  dialog: $("picker"), art: $("pickArt"), name: $("pickName"), count: $("pickCount"), hint: $("pickHint"),
  dev: $("pickDev"), prev: $("pickPrev"), next: $("pickNext"), go: $("pickGo"), close: $("pickClose")
}, id => {
  if (!S || !S.me) return;
  S.me = { ...S.me, characterId: id };
  saveProfile(S.me);
  dressPlayer();
  if (fromCloset) room.standAt("closet");   // step out of the closet in the new look
  sfx.select();
});
$("picker").addEventListener("close", () => (fromCloset = false));

// The closet in your room opens the picker with every character in it.
room.onAction(action => {
  if (action !== "closet" || !S || !S.me) return;
  fromCloset = true;
  picker.open(characterFor(S.me).id, EVERYONE, false, true);
  sfx.select();
});

// The dev level picker shows the room at any level 1-5, whatever your XP says.
if (DEV) {
  if (DEV_EVENT) room.setEvent(DEV_EVENT);
  if (devLevel) $("roomLevel").value = String(devLevel);
  $("roomLevel").addEventListener("change", () => {
    devLevel = Number($("roomLevel").value);
    room.setLevel(devLevel);
    $("roomLevel").blur();
  });
  $("roomDev").hidden = false;
}

// The loaded world: { me, user, profile, contrib, events, yearTotal, eventsOk, eventsError, runs, strava, stravaError }
// me is your profile on your own world, or null when peeking at someone else's (read-only).
// user and profile are the GitHub login and profile, or null without GitHub.
let S = null;
let sel = DAYS.findIndex(d => key(d) === TODAY_K);
let buttons = [];

const WORLD_PARTS = ["calbox", "roomBtn", "panels", "tabs", "stats", "who", "share", "switch", "caption"];

// ---------- loading a world ----------

// name: a GitHub username, or null for a profile without GitHub.
// me: your profile if this is your world, null to peek at someone else's.
async function loadWorld(name, me) {
  const user = name ? name.trim().replace(/^@/, "") : null;
  if (user && !isValidUsername(user)) {
    say("That doesn’t look like a GitHub username. Use letters, numbers and dashes.", true);
    return;
  }
  $("go").disabled = true;
  clearSaved();
  say(user ? `Loading ${user}’s world…` : "Loading your world…");
  scene.setMode({ mode: "loading" });

  let profile = null;
  if (user) {
    try {
      profile = await fetchProfile(user);
    } catch (e) {
      showStart(user);
      if (e.status === 404) say(`No GitHub user called “${user}”. Check the spelling and try again.`, true);
      else if (e.limited) say(`GitHub’s hourly limit for this network is used up. Try again ${retryWhen(e)}.`, true);
      else say("Couldn’t reach GitHub. Check your connection and try again.", true);
      return;
    }
  }

  const login = profile ? profile.login : null;
  const none = Promise.resolve(null);
  const [contribR, eventsR, stravaR] = await Promise.allSettled([
    login ? fetchContributions(login) : none,
    login ? fetchEvents(login) : none,
    me ? loadStrava(me.id) : none
  ]);
  const events = (eventsR.status === "fulfilled" && eventsR.value) || new Map();
  const contribOk = contribR.status === "fulfilled" && !!contribR.value;

  // Save your profile (the first time, this is where it's created), with GitHub's spelling of the name.
  if (me && login) {
    me = { ...me, github: login };
    saveProfile(me);
  }

  S = {
    me,
    user: login,
    profile,
    events,
    eventsOk: eventsR.status === "fulfilled",
    contribOk,
    stravaFailed: stravaR.status === "rejected",
    eventsError: eventsR.status === "rejected" ? eventsR.reason : null,
    contrib: contribOk ? contribR.value.byDay : levelsFromEvents(events),
    yearTotal: contribOk ? contribR.value.yearTotal : null,
    runs: me ? loadRuns(me.id) : {},
    strava: stravaR.status === "fulfilled" ? stravaR.value : null,
    stravaError: stravaR.status === "rejected" ? stravaErrorText(stravaR.reason) : ""
  };

  try {
    const u = new URL(location.href);
    if (login) u.searchParams.set("user", login);
    else u.searchParams.delete("user");
    history.replaceState(null, "", u);
  } catch (e) {}

  $("go").disabled = false;
  say("");
  if (!S.eventsOk) say("Activity details didn’t load (GitHub’s hourly limit may be used up). Showing contribution levels only.", true);
  showWorld();
  sfx.start();
}

function loadMyWorld() {
  const me = loadProfile();
  return me ? loadWorld(me.github, me) : showStart();
}

// Strava activities for your profile, if this browser connected Strava to it.
async function loadStrava(profileId) {
  if (!strava.isConfigured() || !strava.isLinkedTo(profileId)) return null;
  return strava.toDays(await strava.fetchActivities(DAYS[0]));
}

function stravaErrorText(e) {
  if (e && e.needsReconnect) { strava.disconnect(); return "Strava disconnected. Connect again to bring your runs back."; }
  if (e && e.limited) return "Strava’s request limit was reached. Your runs will be back in about 15 minutes.";
  return "Couldn’t load your Strava runs right now.";
}

// "after 3:42 PM" when GitHub told us when its hourly limit resets, otherwise "in a little while".
function retryWhen(e) {
  return e && e.resetAt ? "after " + e.resetAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "in a little while";
}

// "20 min ago", "3 hours ago", "2 days ago".
function ago(ms) {
  const min = Math.max(1, Math.round((Date.now() - ms) / 60000));
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

// The small note in the GitHub card: saved data standing in for GitHub, or when the limit resets.
function renderGitHubNote() {
  const note = $("ghNote"), since = savedSince(), e = S && S.eventsError;
  note.textContent = since ? `Showing saved data from ${ago(since)}.`
    : e && e.limited ? `GitHub’s hourly limit is used up. Activity details are back ${retryWhen(e)}.`
    : "";
  note.hidden = !note.textContent;
}

function say(text, bad) {
  const m = $("msg");
  m.textContent = text;
  m.classList.toggle("bad", !!bad);
}

// ---------- one day's info ----------

function info(i) {
  const d = DAYS[i], k = key(d);
  const c = S.contrib.get(k) || { count: 0, level: 0 };
  const ev = S.events.get(k) || [];
  const manual = S.runs[k] || [];
  const fromStrava = (S.strava && S.strava[k]) || [];
  const runs = [...fromStrava, ...manual];
  const future = d > TODAY, today = k === TODAY_K;
  const realActivity = ev.some(e => e.type !== "WatchEvent");

  let mode = "rest";
  if (future) mode = "future";
  else if (runs.some(r => r.type !== "walk")) mode = "run";
  else if (runs.length) mode = "walk";
  else if (c.count > 0 || realActivity) mode = "code";
  else if (today) mode = "today";

  // When did it happen? Strava start time first, otherwise the latest GitHub activity.
  let hour = null;
  const timed = fromStrava.filter(r => Number.isFinite(r.hour));
  if (timed.length) hour = timed[timed.length - 1].hour;
  else {
    const real = ev.filter(e => e.type !== "WatchEvent");
    if (real.length) hour = Math.max(...real.map(e => new Date(e.created_at).getHours()));
  }

  return {
    i, d, k, count: c.count, level: c.level || (ev.length ? 1 : 0), ev, runs, manual, fromStrava,
    future, today, mode, active: runs.length > 0 || c.count > 0,
    hour, phase: phaseFor(hour),
    pr: !!(S.best && runs.includes(S.best)),
    streakDay: !!(S.streakKeys && S.streakKeys.has(k)), streak: S.streak || 0
  };
}

// Sky for the time of day: 5–10 sunrise, 11–16 daytime, 17–19 sunset, otherwise night.
function phaseFor(h) {
  if (h == null || !Number.isFinite(h)) return null;
  if (h >= 5 && h <= 10) return "dawn";
  if (h >= 11 && h <= 16) return "day";
  if (h >= 17 && h <= 19) return "dusk";
  return "night";
}

// How big was this day, from 0 to 4? Used for the calendar glow.
function energy(x) {
  const mi = totalMiles(x.runs);
  const runLevel = mi >= 5 ? 4 : mi >= 3 ? 3 : mi >= 1.5 ? 2 : x.runs.length ? 1 : 0;
  let e = Math.max(x.level, runLevel);
  if (x.level && x.runs.length) e = Math.min(4, e + 1);
  return e;
}

function summary(x) {
  if (x.future) return "This day hasn’t happened yet.";
  const parts = [];
  x.runs.forEach(r => parts.push(`${r.name || "Run"} ${r.mi.toFixed(1)} mi`));
  if (x.count) parts.push(`${x.count} contribution${x.count === 1 ? "" : "s"} on GitHub`);
  else if (x.ev.some(e => e.type !== "WatchEvent")) parts.push("some GitHub activity");
  if (!parts.length) return x.today ? "Nothing yet today. Go make some pixels." : "Rest day. Recovery counts too.";
  return parts.join(", ") + ".";
}

// ---------- showing the world ----------

function showWorld() {
  document.body.classList.remove("is-title");
  $("start").hidden = true;
  WORLD_PARTS.forEach(id => ($(id).hidden = false));

  // Peeking at someone else's world is read-only: no adding runs, no Strava, no picking characters.
  const peek = !S.me;
  if (!peek) checkUnlocks();
  else refreshLevel();
  dressPlayer();
  $("pick").hidden = peek;
  $("share").hidden = !S.user;
  $("addRun").hidden = peek;
  $("runsNote").hidden = peek;
  $("whoVerb").textContent = peek ? "Peeking at" : "Playing as";
  $("switch").textContent = !peek ? "Change player" : loadProfile() ? "Back to my world" : "Make your own";

  const ghName = S.profile && S.profile.name;
  const name = (S.me && S.me.name) || ghName || (S.user ? S.user : "You");
  $("whoName").textContent = S.user ? (name !== S.user ? `${name} (@${S.user})` : "@" + S.user) : name;
  $("bio").textContent = (S.me && S.me.about) || (S.profile && S.profile.bio) || "What you did";
  drawAvatar(S.profile && S.profile.avatar_url);
  document.title = `${name}’s pixel daily log`;
  $("roomBtnText").textContent = peek ? "Their room" : "My room";
  $("hRoom").textContent = peek ? `${name}’s room` : "My room";

  refreshPace();
  refreshStats();
  buildCalendar();
  refreshBars();
  renderStravaBox();
  renderTopRepos();
  renderGitHubNote();

  // Start on the most recent day with something in it.
  sel = DAYS.findIndex(d => key(d) === TODAY_K);
  for (let i = sel; i >= 0; i--) {
    const x = info(i);
    if (x.active || x.ev.length) { sel = i; break; }
  }
  select(sel, false);
  route();   // a link ending in #room goes straight to the room
}

// Your own character in the scene and the room, never someone else's.
function dressPlayer() {
  const c = characterFor(S.me);
  scene.setCharacter(c);
  room.setPlayer(c, S.me ? S.me.school : null, !S.me);   // a visitor can watch, not steer
}

// ---------- unlocking characters ----------

// Adds the days you logged to your profile, then unlocks any character whose rule you now meet.
// A day counts if it has a commit (GitHub contributions or a push) or a run. Unlocks are never taken away.
function checkUnlocks() {
  const infos = DAYS.map((_, i) => info(i)).filter(x => !x.future);
  const logged = infos.filter(x => x.count > 0 || x.ev.some(e => e.type === "PushEvent") || x.runs.some(isRun));
  let me = recordDays(S.me, logged.map(x => x.k));

  // The public feed has push times, not each commit's time, so a push counts as the commit.
  const pushes = [...S.events.values()].flat().filter(e => e.type === "PushEvent");
  const weeks = [0, 1, 2, 3].map(w => infos.filter(x => Math.floor(x.i / 7) === w)
    .reduce((n, x) => n + x.runs.filter(isRun).length, 0));
  const facts = {
    lateCommit: pushes.some(e => new Date(e.created_at).getHours() < 4),
    bestStreak: me.log.best,
    mostRunsInAWeek: Math.max(...weeks)
  };

  const unlocked = { ...(me.unlocked || {}) };
  const fresh = ROSTER.filter(c => !isUnlocked(c, unlocked) && meetsRule(c.unlock, facts));
  fresh.forEach(c => (unlocked[c.id] = TODAY_K));

  // XP: work out every day we have data for again and write it into the ledger. If GitHub's contributions
  // or Strava didn't load this time, days are only raised, never lowered.
  const from = createdKey(me), first = key(DAYS[0]);
  const fresher = xpDays(infos, from, me.log.days.filter(k => k < first));
  const keepHigher = (!!S.user && !S.contribOk) || S.stravaFailed;
  const xp = updateLedger(me.xp, fresher, { from, keepHigher, today: TODAY_K });

  S.me = me = { ...me, unlocked, xp };
  saveProfile(me);

  if (fresh.length) {
    $("pickNew").hidden = $("roomNew").hidden = false;
    sfx.pr();
  }
  refreshLevel();
}

// ---------- XP and the room's level ----------

// The first day that earns XP: the day your profile was made, so everyone starts at level 1.
const createdKey = me => { const d = new Date(me.createdAt); return isNaN(d) ? TODAY_K : key(d); };

// XP for each day (from `from` on): its GitHub contributions, runs and walks, and the streak it's part of.
// earlier: active days before the 4 weeks (from your saved log), so a long streak keeps its bonus.
function xpDays(infos, from, earlier) {
  const days = infos.filter(x => x.k >= from);
  const active = new Set([...earlier, ...days.filter(x => dayXp({ contributions: x.count, runs: x.runs }) > 0).map(x => x.k)]);
  return days.map(x => ({ k: x.k, xp: dayXp({ contributions: x.count, runs: x.runs, streak: streakEnding(x.k, active, from) }) }));
}

// Your total XP, or for a peek, an estimate from their last 4 weeks of public GitHub (nothing is saved).
function xpTotal() {
  if (DEV_XP != null) return DEV_XP;
  if (S.me) return totalXp(S.me.xp);
  const infos = DAYS.map((_, i) => info(i)).filter(x => !x.future);
  return xpDays(infos, "", []).reduce((n, d) => n + d.xp, 0);
}

// "rug, lamp and string lights"
function pieceNames(ids) {
  const names = ids.map(id => id.replace(/_/g, " "));
  return names.length < 2 ? names.join("") : names.slice(0, -1).join(", ") + " and " + names[names.length - 1];
}

// The level and XP bar in the room header, and the furniture that goes with the level.
function refreshLevel() {
  const p = progress(xpTotal()), approx = S.me ? "" : "~";
  $("xpLevel").textContent = `${approx}Lv ${p.level}`;
  $("xpFill").style.width = `${Math.round(p.frac * 100)}%`;
  $("xpText").textContent = p.next == null ? `${approx}${p.total} XP · max` : `${approx}${p.total} / ${p.next} XP`;
  $("roomXp").setAttribute("aria-label", `${S.me ? "" : "About "}level ${p.level}, ${p.total} XP` +
    (p.next == null ? ", the top level" : ` of ${p.next} for level ${p.level + 1}`) + ". How XP works");
  $("roomXp").hidden = false;
  room.setLevel(devLevel || p.level);
  if (DEV && !devLevel) $("roomLevel").value = String(Math.min(5, p.level));
}

// Banners across the top of the room, one at a time: each stays 6 seconds (or until you tap it).
const BANNER_MS = 6000;
const banners = [];
let bannerTimer = null;
function showBanner(title, text) {
  banners.push({ title, text });
  if ($("roomBanner").hidden) nextBanner();
}
function nextBanner() {
  clearTimeout(bannerTimer);
  const b = banners.shift();
  $("roomBanner").hidden = !b;
  if (!b) return;
  $("bannerTitle").textContent = b.title;
  $("bannerText").textContent = b.text || "";
  $("bannerText").hidden = !b.text;
  bannerTimer = setTimeout(nextBanner, BANNER_MS);
}
$("roomBanner").addEventListener("click", nextBanner);

// Opening your room: celebrate a new level, then say hello for any seasonal event that's on.
async function celebrate() {
  if (!S || !S.me) return;
  await levelUp();
  await seasonHello();
}

// A new level: a "Level up!" banner and the new furniture drops in.
// levelSeen remembers it, so each level gets celebrated once (on any device, if you're signed in).
async function levelUp() {
  const level = progress(xpTotal()).level, seen = S.me.levelSeen || 1;
  if (level <= seen) return;
  if (DEV_XP == null) { S.me = { ...S.me, levelSeen: level }; saveProfile(S.me); }
  const ids = await room.piecesBetween(seen, level);
  showBanner(`Level up! Lv ${level}`, ids.length ? `New in your room: ${pieceNames(ids)}.` : "More furniture is on the way.");
  if (!devLevel) room.popIn(ids);
  sfx.pr();
}

// A seasonal event's banner (its manifest's "banner", e.g. "Happy Halloween! 🎃"), once a year per event.
// eventsSeen remembers the year: { halloween: 2026 }. A dev preview (?dev&event=) saves nothing.
async function seasonHello() {
  for (const e of await room.currentEvents()) {
    const seen = S.me.eventsSeen || {};
    if (seen[e.id] === e.season) continue;
    if (DEV_EVENT == null) { S.me = { ...S.me, eventsSeen: { ...seen, [e.id]: e.season } }; saveProfile(S.me); }
    showBanner(e.banner || `Happy ${e.name}!`, "");
  }
}

// The box that opens from the XP bar: where you are, how XP is earned, and what the next level brings.
async function openXpBox() {
  if (!S) return;
  const p = progress(xpTotal());
  $("xpNow").textContent = `${S.me ? "Level" : "About level"} ${p.level}, ${p.total} XP` +
    (p.next == null ? ". That’s the top level!" : `. ${p.next - p.total} XP to level ${p.level + 1}.`);
  $("xpApprox").hidden = !!S.me;
  $("xpRules").textContent = "";
  [
    "GitHub: 10 XP on a day with contributions, plus 2 for each one (up to 30 a day).",
    "Runs: 15 XP each, plus 5 per mile. Walks: 2 per mile. Up to 50 a day together.",
    "Streaks: plus 5 XP for each day in a row (up to 25 a day).",
    "Rest days don’t earn XP, and they never cost you any.",
    "XP counts from the day you made your profile."
  ].forEach(t => { const li = document.createElement("li"); li.textContent = t; $("xpRules").appendChild(li); });
  $("xpNextTitle").hidden = $("xpNext").hidden = p.next == null;
  if (p.next != null) {
    const ids = await room.piecesBetween(p.level, p.level + 1);
    $("xpNext").textContent = `Level ${p.level + 1} at ${p.next} XP: ` +
      (ids.length ? `${pieceNames(ids)} for your room` : "more furniture is coming") +
      (p.level + 1 === 5 ? ", and the door opens (the next room is coming soon)." : ".");
  }
  if (!$("xpBox").open) $("xpBox").showModal();
  $("xpClose").focus();
}
$("roomXp").addEventListener("click", () => { openXpBox(); sfx.select(); });
$("xpClose").addEventListener("click", () => $("xpBox").close());
$("xpBox").addEventListener("click", e => { if (e.target === $("xpBox")) $("xpBox").close(); });

// ---------- the room screen (#room) ----------

// The room is its own screen at #room, so the browser's back button works and the link can be bookmarked.
// roomPushed: we added the #room history entry ourselves (clicked "My room"), so going back is safe.
let roomOpen = false, roomPushed = false, mainTitle = "";

// Show whichever screen the address asks for. The room needs a loaded world.
function route() {
  const want = location.hash === "#room" && !!S;
  if (want === roomOpen) return;
  roomOpen = want;
  document.body.classList.toggle("is-room", want);
  $("roomScreen").hidden = !want;
  if (want) {
    mainTitle = document.title;
    document.title = `${$("hRoom").textContent} · Pixel daily log`;
    window.scrollTo(0, 0);
    $("hRoom").focus();
    celebrate();
    // Opened while the page is still loading (a #room link): the browser resets focus when loading ends.
    if (document.readyState !== "complete") addEventListener("load", () => roomOpen && $("hRoom").focus(), { once: true });
  } else {
    document.title = mainTitle;
    if (S) $("roomBtn").focus();
  }
}

function openRoom() {
  roomPushed = true;
  location.hash = "room";   // the hashchange listener calls route()
}

function closeRoom() {
  if (roomPushed) { roomPushed = false; history.back(); }   // same as the browser's back button
  else {
    // Came straight from a #room link: going back would leave the site, so just drop the #room.
    history.replaceState(null, "", location.pathname + location.search);
    route();
  }
}

window.addEventListener("hashchange", route);

// typed: what to leave in the username box (after a failed load).
function showStart(typed = "") {
  S = null;
  route();   // no world, so no room either
  document.body.classList.add("is-title");
  $("start").hidden = false;
  WORLD_PARTS.forEach(id => ($(id).hidden = true));
  document.title = "Pixel daily log";
  try {
    const u = new URL(location.href);
    u.searchParams.delete("user");
    history.replaceState(null, "", u);
  } catch (e) {}
  scene.setCharacter(characterFor(loadProfile()));
  scene.setMode({ mode: "attract" });
  $("go").disabled = false;
  $("userInput").value = typed;
  $("userInput").focus();
}

// Shrink the profile picture to 16x16; CSS scales it back up with sharp pixels.
// Without GitHub there's no picture yet (the pixel character's face comes later).
function drawAvatar(url) {
  const c = $("ava"), x = c.getContext("2d");
  x.clearRect(0, 0, 16, 16);
  if (!url) return;
  const img = new Image();
  img.onload = () => { x.imageSmoothingEnabled = true; x.drawImage(img, 0, 0, 16, 16); };
  img.src = url + (url.includes("?") ? "&" : "?") + "s=64";
}

// ---------- calendar ----------

function buildCalendar() {
  const cal = $("cal");
  cal.textContent = "";
  ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].forEach(n => {
    const el = document.createElement("div");
    el.className = "dow";
    el.textContent = n;
    cal.appendChild(el);
  });
  buttons = DAYS.map((d, i) => {
    const b = document.createElement("button");
    b.className = "day" + (key(d) === TODAY_K ? " today" : "");
    b.addEventListener("click", () => select(i, true));
    cal.appendChild(b);
    return b;
  });
  refreshTiles();
}

function refreshTiles() {
  buttons.forEach((b, i) => {
    const x = info(i);
    const e = x.future ? 0 : energy(x);
    b.textContent = "";
    b.disabled = x.future;
    b.className = "day" + (x.today ? " today" : "") + (e ? " e" + e : "") +
      (x.level && x.runs.length ? " both" : x.runs.length ? " run" : x.level ? " code" : "") +
      (i % 7 >= 5 ? " tip-r" : i % 7 <= 1 ? " tip-l" : "");
    b.setAttribute("aria-pressed", i === sel);
    const tip = tileTip(x);
    b.setAttribute("aria-label", tip);
    if (x.future) b.removeAttribute("data-tip"); else b.dataset.tip = tip;

    const num = document.createElement("span");
    num.className = "num";
    num.textContent = x.d.getDate() + (x.future ? " ?" : "");
    const icons = document.createElement("span");
    icons.className = "icons";
    if (x.level || x.ev.some(ev => ev.type !== "WatchEvent")) icons.appendChild(iconSpan("laptop"));
    if (x.runs.length) icons.appendChild(iconSpan("shoe"));
    b.append(num, icons);
  });
}

// Short preview for the hover bubble and screen readers.
function tileTip(x) {
  const date = fmt(x.d);
  if (x.future) return date + ", not yet";
  const bits = [];
  if (x.runs.length) bits.push(`${x.runs.length} ${x.runs.length === 1 ? "activity" : "activities"}, ${totalMiles(x.runs).toFixed(1)} mi`);
  if (x.count) bits.push(`${x.count} contribution${x.count === 1 ? "" : "s"}`);
  if (x.pr) bits.push("best pace!");
  return `${date}: ${bits.length ? bits.join(", ") : x.today ? "nothing yet" : "rest day"}`;
}

function select(i, byUser) {
  if (!S || i < 0 || i >= DAYS.length || DAYS[i] > TODAY) return;
  sel = i;
  const x = info(i);
  buttons.forEach((b, j) => b.setAttribute("aria-pressed", j === i));
  $("capTitle").textContent = fmt(x.d) + (x.today ? " (today)" : "");
  $("capText").textContent = summary(x);
  canvas.setAttribute("aria-label", fmt(x.d) + ". " + summary(x));
  renderGitHub(x);
  renderRuns(x);
  refreshBars();
  scene.setMode(x);
  if (byUser) sfx.select();
}

// ---------- stats ----------

function refreshStats() {
  const infos = DAYS.map((_, i) => info(i));
  let i = infos.findIndex(x => x.today), streak = 0;
  if (!infos[i].active) i--;
  S.streakKeys = new Set();
  while (i >= 0 && infos[i].active) { streak++; S.streakKeys.add(infos[i].k); i--; }
  S.streak = streak;

  $("stStreak").textContent = streak;
  $("stContrib").textContent = infos.reduce((s, x) => s + x.count, 0);
  $("stYearBox").hidden = S.yearTotal == null;
  if (S.yearTotal != null) $("stYear").textContent = S.yearTotal;
  $("stMiles").textContent = totalMiles(infos.flatMap(x => x.runs)).toFixed(1);
  refreshToday();
}

// ---------- your day in the room ----------

// The room shows what you (or whoever you're peeking at) did today: the same data as the main page.
function refreshToday() {
  if (!S) return;
  const i = DAYS.findIndex(d => key(d) === TODAY_K), x = i >= 0 ? info(i) : null;
  const day = DEV_TODAY || (x ? { count: x.count, level: x.level, pushed: x.ev.some(e => e.type === "PushEvent"), runs: x.runs } : {});
  const streak = DEV_STREAK != null ? DEV_STREAK : DEV_TODAY ? (DEV_TODAY === DEV_DAYS.both ? 5 : 0) : S.streak || 0;
  room.setToday(todayState(day, streak, DEV_HOUR != null ? DEV_HOUR : new Date().getHours()));
}
setInterval(refreshToday, 60000);   // so the zzz turns up at 9pm without a reload

// ---------- long lists fold up ----------

// Long lists show their first few items, then a "Show all N" button, so the cards stay even.
// Call after filling a list. where: what the list is about (a day's key); refilling the same list
// for the same day keeps it open, a different day folds it back up.
const FOLD_AT = 4;

function foldList(list, where) {
  let btn = $(list.id + "More");
  if (!btn) {
    btn = document.createElement("button");
    btn.type = "button";
    btn.id = list.id + "More";
    btn.className = "btn px more";
    btn.setAttribute("aria-controls", list.id);
    btn.addEventListener("click", () => { setFolded(list, btn, btn.getAttribute("aria-expanded") === "true"); sfx.select(); });
    list.after(btn);
  }
  const stayOpen = btn.dataset.where === where && btn.getAttribute("aria-expanded") === "true";
  btn.dataset.where = where;
  btn.hidden = list.children.length <= FOLD_AT;
  setFolded(list, btn, !stayOpen);
}

function setFolded(list, btn, folded) {
  [...list.children].forEach((item, i) => (item.hidden = folded && i >= FOLD_AT));
  btn.setAttribute("aria-expanded", !folded);
  btn.textContent = folded ? `Show all ${list.children.length} ▾` : "Show less ▴";
}

// ---------- GitHub panel ----------

function renderGitHub(x) {
  const meter = $("meter");
  meter.textContent = "";
  for (let j = 0; j < 4; j++) {
    const c = document.createElement("i");
    if (j < x.level) c.style.background = GH_COLORS[x.level - 1];
    meter.appendChild(c);
  }
  $("meterText").textContent = !S.user ? "GitHub isn’t connected"
    : x.count ? `${x.count} contribution${x.count === 1 ? "" : "s"}, level ${x.level} of 4` : "No contributions this day";

  const ul = $("ghList");
  ul.textContent = "";
  const groups = groupEvents(x.ev);

  if (!groups.length) {
    const li = document.createElement("li");
    li.className = "muted";
    li.textContent = !S.user ? "Connect GitHub to see your coding days here."
      : !S.eventsOk ? "Activity details unavailable right now."
      : x.count ? "These contributions aren’t in GitHub’s public feed (private repos, or not synced yet)."
      : "No public activity.";
    ul.appendChild(li);
    foldList(ul, x.k);
    return;
  }

  let budget = 4; // commit lookups per day, to save GitHub's hourly limit
  groups.forEach(g => {
    const li = document.createElement("li");
    const t = document.createElement("span");
    if (g.kind === "push") {
      const n = g.heads.length;
      t.textContent = `Pushed ${n > 1 ? n + " times " : ""}to ${g.repo}${g.branches.size ? " (" + [...g.branches].join(", ") + ")" : ""}`;
      li.appendChild(t);
      g.heads.slice(0, 2).forEach(sha => {
        if (budget <= 0) return;
        budget--;
        const c = document.createElement("span");
        c.className = "commit";
        c.textContent = "Loading commit…";
        li.appendChild(c);
        fetchCommitMessage(g.repo, sha)
          .then(m => { c.textContent = "“" + m + "”"; renderGitHubNote(); })   // it may have come from saved data
          .catch(e => { c.textContent = e.limited ? `Commit details paused by GitHub’s hourly limit. Back ${retryWhen(e)}.` : "Commit message unavailable."; });
      });
    } else {
      t.textContent = g.text;
      if (g.light) t.className = "muted";
      li.appendChild(t);
    }
    ul.appendChild(li);
  });
  foldList(ul, x.k);
}

function renderTopRepos() {
  const counts = new Map();
  const first = key(DAYS[0]);
  S.events.forEach((list, k) => {
    if (k < first) return;
    list.forEach(e => {
      if (e.type === "WatchEvent") return;
      const r = e.repo && e.repo.name;
      if (r) counts.set(r, (counts.get(r) || 0) + 1);
    });
  });

  const el = $("topRepos");
  el.textContent = "";
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (!top.length) {
    el.textContent = !S.user ? "Connect GitHub to see your repos here."
      : S.eventsOk ? "No public activity in the last four weeks." : "Activity details unavailable right now.";
    foldList(el, "repos:" + S.user);
    return;
  }
  top.forEach(([r, n]) => {
    const a = document.createElement("a");
    a.className = "tag";
    a.href = "https://github.com/" + r;
    a.target = "_blank";
    a.rel = "noopener";
    a.textContent = `${r.split("/")[1]} (${n})`;
    el.appendChild(a);
  });
  foldList(el, "repos:" + S.user);
}

// ---------- Runs panel ----------

function renderRuns(x) {
  const ul = $("runList");
  ul.textContent = "";
  if (!x.runs.length) {
    const li = document.createElement("li");
    li.className = "muted";
    li.textContent = x.future ? "This day hasn’t happened yet." : "No runs logged this day.";
    ul.appendChild(li);
  }

  x.fromStrava.forEach(r => ul.appendChild(runRow(r, null)));
  x.manual.forEach((r, j) => ul.appendChild(runRow(r, () => {
    x.manual.splice(j, 1);
    if (!x.manual.length) delete S.runs[x.k];
    saveRuns(S.me.id, S.runs);
    checkUnlocks();   // that day's XP goes down again
    refreshPace(); refreshStats(); refreshTiles(); select(sel, false);
  })));
  foldList(ul, x.k);
}

// One line in the runs list: icon | name and source | distance and pace | delete.
// Strava activities can't be deleted here, hand-logged ones can.
function runRow(r, onDelete) {
  const li = document.createElement("li");
  li.className = "runrow";
  li.appendChild(iconSpan("shoe"));

  const main = document.createElement("div");
  const name = document.createElement("div");
  name.className = "rname";
  name.textContent = r.name || "Run";
  const sub = document.createElement("div");
  sub.className = "rsub";
  sub.textContent = r.source === "strava" ? `Strava, ${r.sport || "Run"}` : "Added by hand";
  main.append(name, sub);

  const nums = document.createElement("div");
  nums.className = "rnums";
  const dist = document.createElement("div");
  dist.className = "rdist";
  dist.textContent = `${r.mi.toFixed(2)} mi`;
  const p = document.createElement("div");
  p.className = "rpace";
  p.textContent = isRun(r) && pace(r) ? pace(r) : "";
  if (r === S.best) {
    const tag = document.createElement("span");
    tag.className = "prtag";
    tag.textContent = "Best";
    p.appendChild(tag);
  }
  nums.append(dist, p);
  li.append(main, nums);

  if (onDelete) {
    const del = document.createElement("button");
    del.className = "x";
    del.type = "button";
    del.textContent = "×";
    del.setAttribute("aria-label", "Remove " + (r.name || "run"));
    del.addEventListener("click", onDelete);
    li.appendChild(del);
  } else {
    li.appendChild(document.createElement("span"));
  }
  return li;
}

// Best and average pace across the four weeks: the "progress" part.
function refreshPace() {
  const all = DAYS.flatMap((d, i) => (d > TODAY ? [] : info(i).runs.map(r => ({ ...r, d, ref: r }))));
  const timed = all.filter(r => isRun(r) && paceValue(r) && r.mi >= 0.5);
  if (!timed.length) {
    S.best = null;
    $("paceBest").textContent = "—";
    $("paceBestDay").textContent = "add a timed run";
    $("paceAvg").textContent = "—";
    return;
  }
  const best = timed.reduce((a, b) => (paceValue(b) < paceValue(a) ? b : a));
  S.best = best.ref;
  $("paceBest").textContent = formatPace(paceValue(best));
  $("paceBestDay").textContent = best.d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  $("paceAvg").textContent = formatPace(averagePace(timed));
}

// The "Connect with Strava" button and connection status.
function renderStravaBox() {
  const box = $("stravaBox"), btn = $("stravaConnect"), status = $("stravaStatus");
  box.hidden = !strava.isConfigured() || !S.me;
  $("poweredBy").hidden = true;
  if (box.hidden) return;
  status.textContent = "";
  const conn = strava.getConnection();
  const linkedHere = strava.isLinkedTo(S.me.id);

  btn.hidden = !!conn;
  btn.textContent = "Connect with Strava";
  $("poweredBy").hidden = !(linkedHere && S.strava);

  if (linkedHere) {
    const who = conn.athlete && conn.athlete.firstname ? conn.athlete.firstname : "you";
    status.append(`Connected to Strava as ${who}. `);
    const out = document.createElement("button");
    out.className = "linkbtn";
    out.type = "button";
    out.textContent = "Disconnect";
    out.addEventListener("click", async () => {
      await strava.disconnect();
      S.strava = null;
      S.stravaError = "";
      refreshPace(); refreshStats(); refreshTiles(); refreshBars(); renderStravaBox(); select(sel, false);
    });
    status.appendChild(out);
    if (S.stravaError) {
      const err = document.createElement("div");
      err.className = "bad";
      err.style.color = "var(--bad)";
      err.textContent = S.stravaError;
      status.appendChild(err);
    }
  } else if (conn) {
    status.textContent = "Strava in this browser is linked to a different profile.";
  } else {
    status.textContent = "Shows your real runs and pace on your world. Only you see them, in this browser.";
  }
}

function refreshBars() {
  const el = $("bars");
  el.textContent = "";
  for (let w = 0; w < 4; w++) {
    const mi = totalMiles(DAYS.slice(w * 7, w * 7 + 7).flatMap((d, j) => info(w * 7 + j).runs));
    const row = document.createElement("div");
    row.className = "bar" + (Math.floor(sel / 7) === w ? " cur" : "");
    const l = document.createElement("span");
    l.className = "lbl";
    l.textContent = DAYS[w * 7].toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const b = document.createElement("span");
    b.className = "blocks";
    for (let n = 0; n < Math.min(40, Math.round(mi / 0.5)); n++) b.appendChild(document.createElement("i"));
    const v = document.createElement("span");
    v.className = "val";
    v.textContent = mi.toFixed(1);
    row.append(l, b, v);
    el.appendChild(row);
  }
}

// ---------- controls ----------

// Until the character creator arrives, the first username typed here becomes yours.
// After that, any other username opens as a peek.
$("startForm").addEventListener("submit", e => {
  e.preventDefault();
  const typed = $("userInput").value.trim().replace(/^@/, "");
  if (!isValidUsername(typed)) return say("That doesn’t look like a GitHub username. Use letters, numbers and dashes.", true);
  const me = loadProfile();
  loadWorld(typed, !me ? newProfile() : isMine(me, typed) ? me : null);
});

$("runForm").addEventListener("submit", e => {
  e.preventDefault();
  if (!S || !S.me) return;
  const mi = parseFloat($("rMi").value), min = parseFloat($("rMin").value);
  if (!(mi > 0)) return;
  const k = key(DAYS[sel]);
  (S.runs[k] = S.runs[k] || []).push({ mi, min: min > 0 ? min : null, name: $("rName").value.trim().slice(0, 40) });
  saveRuns(S.me.id, S.runs);
  $("runForm").reset();
  checkUnlocks();
  refreshPace(); refreshStats(); refreshTiles(); select(sel, false);
  sfx.addRun();
});

// Your world: go back to the title screen. Peeking: back to your world, or make one.
$("switch").addEventListener("click", () => {
  if (S && !S.me && loadProfile()) loadMyWorld();
  else showStart();
});

// Phone tabs: show one panel at a time (on wide screens all three show).
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.setAttribute("aria-pressed", t === tab));
    document.querySelectorAll(".panel").forEach(p => p.classList.toggle("active", p.id === tab.dataset.panel));
    sfx.select();
  });
});

$("pick").addEventListener("click", () => {
  if (!S || !S.me) return;
  $("pickNew").hidden = $("roomNew").hidden = true;
  picker.open(characterFor(S.me).id, unlockedFor(S.me), DEV);
  sfx.select();
});

$("roomBtn").addEventListener("click", () => { openRoom(); sfx.select(); });
$("roomBack").addEventListener("click", () => { closeRoom(); sfx.select(); });

$("stravaConnect").addEventListener("click", () => {
  if (S && S.me) strava.startConnect(S.me.id);
});

$("share").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(location.href);
    $("share").textContent = "Link copied";
  } catch (e) {
    $("share").textContent = "Copy failed";
  }
  setTimeout(() => ($("share").textContent = "Copy link"), 1600);
});

$("sound").addEventListener("click", () => {
  const on = $("sound").getAttribute("aria-pressed") !== "true";
  setSound(on);
  $("sound").setAttribute("aria-pressed", on);
  $("sound").textContent = on ? "Sound on" : "Sound off";
  if (on) sfx.addRun();
});

canvas.addEventListener("click", () => scene.action());

document.addEventListener("keydown", e => {
  if (document.querySelector("dialog[open]")) return;   // the picker and the sign-in boxes use the keys themselves
  if (roomOpen) {                 // in the room, Escape goes back and the day keys rest
    if (e.key === "Escape") { e.preventDefault(); closeRoom(); }
    return;
  }
  if (e.target.matches && e.target.matches("input, a, textarea")) return;
  if (e.key === "ArrowRight" && S) { e.preventDefault(); select(sel + 1, true); buttons[sel] && buttons[sel].focus({ preventScroll: true }); }
  else if (e.key === "ArrowLeft" && S) { e.preventDefault(); select(sel - 1, true); buttons[sel] && buttons[sel].focus({ preventScroll: true }); }
  else if ((e.key === " " || e.key === "Enter") && e.target === canvas) { e.preventDefault(); scene.action(); }
});

// ---------- start ----------

(async () => {
  // Coming back from Strava's login page?
  const back = strava.isConfigured() ? await strava.handleRedirect() : null;

  // Your profile, or one made from this browser's pre-profile data. If you're signed in,
  // it's lined up with your account first (that may ask you a question).
  const me = await settleAccount(loadProfile() || migrateOldPlayer());
  if (me) strava.adopt(me);

  // A shared link opens that world as a peek, unless it's your own.
  const fromUrl = new URLSearchParams(location.search).get("user");
  if (fromUrl) {
    $("userInput").value = fromUrl;
    await loadWorld(fromUrl, isMine(me, fromUrl) ? me : null);
  } else if (me) {
    await loadWorld(me.github, me);
  }
  if (back && S && S.me) {
    $("stravaStatus").append(document.createElement("br"),
      back.ok ? "Strava connected. Your runs are on the calendar now." : back.error);
    if (back.ok) sfx.start();
  } else if (back && !back.ok) {
    say(back.error, true);
  }
})();
