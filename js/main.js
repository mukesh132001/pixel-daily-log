// Entry point: loads a player, draws the calendar and panels, and wires up the buttons.

import { key, fmt, TODAY, TODAY_K, DAYS } from "./dates.js";
import { store, LAST_USER } from "./storage.js";
import { setSound, sfx } from "./sound.js";
import {
  GH_COLORS, isValidUsername, fetchProfile, fetchContributions, fetchEvents,
  levelsFromEvents, fetchCommitMessage, groupEvents
} from "./github.js";
import { loadRuns, saveRuns, pace, formatPace, paceValue, averagePace, isRun, totalMiles } from "./runs.js";
import * as strava from "./strava.js";
import { createScene } from "./scene.js";

const $ = id => document.getElementById(id);
const canvas = $("scene");
const scene = createScene(canvas);

// The loaded player: { user, profile, contrib, events, yearTotal, eventsOk, runs, strava, stravaError }
let S = null;
let sel = DAYS.findIndex(d => key(d) === TODAY_K);
let buttons = [];

const WORLD_PARTS = ["calbox", "panels", "stats", "who", "share", "switch"];

// ---------- loading a player ----------

async function loadUser(name) {
  const user = name.trim().replace(/^@/, "");
  if (!isValidUsername(user)) {
    say("That doesn’t look like a GitHub username. Use letters, numbers and dashes.", true);
    return;
  }
  $("go").disabled = true;
  say(`Loading ${user}’s world…`);
  scene.setMode({ mode: "loading" });

  let profile;
  try {
    profile = await fetchProfile(user);
  } catch (e) {
    $("go").disabled = false;
    scene.setMode({ mode: "attract" });
    if (e.status === 404) say(`No GitHub user called “${user}”. Check the spelling and try again.`, true);
    else if (e.limited) say("GitHub’s hourly limit for this network is used up. Try again in a little while.", true);
    else say("Couldn’t reach GitHub. Check your connection and try again.", true);
    return;
  }

  const login = profile.login;
  const [contribR, eventsR, stravaR] = await Promise.allSettled([
    fetchContributions(login),
    fetchEvents(login),
    loadStrava(login)
  ]);
  const events = eventsR.status === "fulfilled" ? eventsR.value : new Map();
  const contribOk = contribR.status === "fulfilled";

  S = {
    user: login,
    profile,
    events,
    eventsOk: eventsR.status === "fulfilled",
    contrib: contribOk ? contribR.value.byDay : levelsFromEvents(events),
    yearTotal: contribOk ? contribR.value.yearTotal : null,
    runs: loadRuns(login),
    strava: stravaR.status === "fulfilled" ? stravaR.value : null,
    stravaError: stravaR.status === "rejected" ? stravaErrorText(stravaR.reason) : ""
  };

  store.set(LAST_USER, login);
  try {
    const u = new URL(location.href);
    u.searchParams.set("user", login);
    history.replaceState(null, "", u);
  } catch (e) {}

  $("go").disabled = false;
  say("");
  if (!S.eventsOk) say("Activity details didn’t load (GitHub’s hourly limit may be used up). Showing contribution levels only.", true);
  showWorld();
  sfx.start();
}

// Strava activities for this player, if this browser connected Strava to them.
async function loadStrava(login) {
  if (!strava.isConfigured() || !strava.isLinkedTo(login)) return null;
  return strava.toDays(await strava.fetchActivities(DAYS[0]));
}

function stravaErrorText(e) {
  if (e && e.needsReconnect) { strava.disconnect(); return "Strava disconnected. Connect again to bring your runs back."; }
  if (e && e.limited) return "Strava’s request limit was reached. Your runs will be back in about 15 minutes.";
  return "Couldn’t load your Strava runs right now.";
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

  return { i, d, k, count: c.count, level: c.level || (ev.length ? 1 : 0), ev, runs, manual, fromStrava, future, today, mode, active: runs.length > 0 || c.count > 0 };
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
  $("start").hidden = true;
  $("tagline").hidden = true;
  WORLD_PARTS.forEach(id => ($(id).hidden = false));

  $("whoName").textContent = S.profile.name ? `${S.profile.name} (@${S.user})` : "@" + S.user;
  $("bio").textContent = S.profile.bio || "What you did";
  drawAvatar(S.profile.avatar_url);
  document.title = `${S.profile.name || S.user}’s pixel daily log`;

  buildCalendar();
  refreshStats();
  refreshBars();
  refreshPace();
  renderStravaBox();
  renderTopRepos();

  // Start on the most recent day with something in it.
  sel = DAYS.findIndex(d => key(d) === TODAY_K);
  for (let i = sel; i >= 0; i--) {
    const x = info(i);
    if (x.active || x.ev.length) { sel = i; break; }
  }
  select(sel, false);
}

function showStart() {
  S = null;
  $("start").hidden = false;
  $("tagline").hidden = false;
  WORLD_PARTS.forEach(id => ($(id).hidden = true));
  document.title = "Pixel daily log";
  $("capTitle").textContent = "Press start";
  $("capText").textContent = "Type a GitHub username to build a pixel world from real activity.";
  try {
    const u = new URL(location.href);
    u.searchParams.delete("user");
    history.replaceState(null, "", u);
  } catch (e) {}
  scene.setMode({ mode: "attract" });
  $("userInput").value = "";
  $("userInput").focus();
}

// Shrink the profile picture to 16x16; CSS scales it back up with sharp pixels.
function drawAvatar(url) {
  const c = $("ava"), x = c.getContext("2d");
  x.clearRect(0, 0, 16, 16);
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
    b.textContent = "";
    b.disabled = x.future;
    b.setAttribute("aria-pressed", i === sel);
    b.setAttribute("aria-label", fmt(x.d) + (x.future ? ", not yet" : `, ${x.count} contributions, ${x.runs.length} runs`));

    const num = document.createElement("span");
    num.className = "num";
    num.textContent = x.d.getDate() + (x.future ? " ?" : "");
    const dots = document.createElement("span");
    dots.className = "dots";
    if (x.level) {
      const s = document.createElement("span");
      s.style.background = GH_COLORS[x.level - 1];
      dots.appendChild(s);
    }
    x.runs.forEach(() => {
      const s = document.createElement("span");
      s.style.background = "var(--run)";
      dots.appendChild(s);
    });
    b.append(num, dots);
  });
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
  while (i >= 0 && infos[i].active) { streak++; i--; }

  $("stStreak").textContent = streak;
  $("stContrib").textContent = infos.reduce((s, x) => s + x.count, 0);
  $("stYearBox").hidden = S.yearTotal == null;
  if (S.yearTotal != null) $("stYear").textContent = S.yearTotal;
  $("stMiles").textContent = totalMiles(infos.flatMap(x => x.runs)).toFixed(1);
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
  $("meterText").textContent = x.count ? `${x.count} contribution${x.count === 1 ? "" : "s"}, level ${x.level} of 4` : "No contributions this day";

  const ul = $("ghList");
  ul.textContent = "";
  const groups = groupEvents(x.ev);

  if (!groups.length) {
    const li = document.createElement("li");
    li.className = "muted";
    li.textContent = !S.eventsOk ? "Activity details unavailable right now."
      : x.count ? "These contributions aren’t in GitHub’s public feed (private repos, or not synced yet)."
      : "No public activity.";
    ul.appendChild(li);
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
          .then(m => { c.textContent = "“" + m + "”"; })
          .catch(e => { c.textContent = e.limited ? "Commit details paused: GitHub’s hourly limit." : "Commit message unavailable."; });
      });
    } else {
      t.textContent = g.text;
      if (g.light) t.className = "muted";
      li.appendChild(t);
    }
    ul.appendChild(li);
  });
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
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  if (!top.length) {
    el.textContent = S.eventsOk ? "No public activity in the last four weeks." : "Activity details unavailable right now.";
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
    saveRuns(S.user, S.runs);
    refreshTiles(); refreshStats(); refreshPace(); select(sel, false);
  })));
}

// One line in the runs list. Strava activities can't be deleted here, hand-logged ones can.
function runRow(r, onDelete) {
  const li = document.createElement("li");
  li.className = "row";
  const name = document.createElement("span");
  name.textContent = r.name || "Run";
  if (r.source === "strava") {
    const tag = document.createElement("span");
    tag.className = "src";
    tag.textContent = r.type === "run" ? "Strava" : r.sport;
    name.appendChild(tag);
  }
  const right = document.createElement("span");
  const p = isRun(r) ? pace(r) : "";
  right.textContent = `${r.mi.toFixed(2)} mi${p ? ", " + p : ""}`;
  if (onDelete) {
    const del = document.createElement("button");
    del.className = "x";
    del.type = "button";
    del.textContent = "×";
    del.setAttribute("aria-label", "Remove " + (r.name || "run"));
    del.addEventListener("click", onDelete);
    right.appendChild(del);
  }
  li.append(name, right);
  return li;
}

// Best and average pace across the four weeks: the "progress" part.
function refreshPace() {
  const all = DAYS.flatMap((d, i) => info(i).runs.map(r => ({ ...r, d })));
  const timed = all.filter(r => isRun(r) && paceValue(r) && r.mi >= 0.5);
  if (!timed.length) {
    $("paceBest").textContent = "—";
    $("paceAvg").textContent = "—";
    return;
  }
  const best = timed.reduce((a, b) => (paceValue(b) < paceValue(a) ? b : a));
  $("paceBest").textContent = `${formatPace(paceValue(best))} (${best.d.toLocaleDateString("en-US", { month: "short", day: "numeric" })})`;
  $("paceAvg").textContent = formatPace(averagePace(timed));
}

// The "Connect with Strava" button and connection status.
function renderStravaBox() {
  const box = $("stravaBox"), btn = $("stravaConnect"), status = $("stravaStatus");
  box.hidden = !strava.isConfigured();
  if (box.hidden) return;
  status.textContent = "";
  const conn = strava.getConnection();
  const linkedHere = strava.isLinkedTo(S.user);

  btn.hidden = !!conn;
  btn.textContent = "Connect with Strava";
  $("poweredBy").hidden = !(linkedHere && S.strava);

  if (linkedHere) {
    const who = conn.athlete && conn.athlete.firstname ? conn.athlete.firstname : "you";
    status.append(`Connected to Strava as ${who}. `);
    const out = document.createElement("button");
    out.className = "x";
    out.type = "button";
    out.textContent = "Disconnect";
    out.addEventListener("click", async () => {
      await strava.disconnect();
      S.strava = null;
      S.stravaError = "";
      refreshTiles(); refreshStats(); refreshPace(); refreshBars(); renderStravaBox(); select(sel, false);
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
    status.textContent = `Strava in this browser is linked to @${conn.ghUser}’s world.`;
  } else {
    status.textContent = `Shows your real runs and pace on @${S.user}’s world. Only you see them, in this browser.`;
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

$("startForm").addEventListener("submit", e => {
  e.preventDefault();
  loadUser($("userInput").value);
});

$("runForm").addEventListener("submit", e => {
  e.preventDefault();
  const mi = parseFloat($("rMi").value), min = parseFloat($("rMin").value);
  if (!(mi > 0)) return;
  const k = key(DAYS[sel]);
  (S.runs[k] = S.runs[k] || []).push({ mi, min: min > 0 ? min : null, name: $("rName").value.trim().slice(0, 40) });
  saveRuns(S.user, S.runs);
  $("runForm").reset();
  refreshTiles(); refreshStats(); refreshPace(); select(sel, false);
  sfx.addRun();
});

$("switch").addEventListener("click", showStart);

$("stravaConnect").addEventListener("click", () => {
  if (S) strava.startConnect(S.user);
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
  if (e.target.matches && e.target.matches("input, a, textarea")) return;
  if (e.key === "ArrowRight" && S) { e.preventDefault(); select(sel + 1, true); buttons[sel] && buttons[sel].focus({ preventScroll: true }); }
  else if (e.key === "ArrowLeft" && S) { e.preventDefault(); select(sel - 1, true); buttons[sel] && buttons[sel].focus({ preventScroll: true }); }
  else if ((e.key === " " || e.key === "Enter") && e.target === canvas) { e.preventDefault(); scene.action(); }
});

// ---------- start ----------

(async () => {
  // Coming back from Strava's login page?
  const back = strava.isConfigured() ? await strava.handleRedirect() : null;

  const fromUrl = new URLSearchParams(location.search).get("user");
  const who = (back && back.ghUser) || fromUrl || store.get(LAST_USER, null);
  if (who) {
    $("userInput").value = who;
    await loadUser(who);
  }
  if (back && S) {
    $("stravaStatus").append(document.createElement("br"),
      back.ok ? "Strava connected. Your runs are on the calendar now." : back.error);
    if (back.ok) sfx.start();
  } else if (back && !back.ok) {
    say(back.error, true);
  }
})();
