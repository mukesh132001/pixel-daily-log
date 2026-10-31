// Everything that talks to GitHub lives here.
// Public data only. GitHub calls go through our Worker first: it adds a token (5,000 requests an hour,
// shared by everyone) and keeps answers at Cloudflare for 10 minutes. If the Worker can't help, we ask
// GitHub directly, which allows about 60 requests an hour per network.

import { key } from "./dates.js";
import { store } from "./storage.js";
import { WORKER_URL } from "./config.js";

export const GH_COLORS = ["#0e4429", "#006d32", "#26a641", "#39d353"];

export const isValidUsername = u => /^[a-z\d](?:[a-z\d-]{0,38})$/i.test(u);

// ----- the cache -----
// Every answer is saved in this browser as { when, data } and reused for 15 minutes, so reloading or
// switching players doesn't spend the hourly limit. If GitHub says the limit is used up, an older saved
// answer is better than nothing: we use it and remember how old it was (see savedSince).

const CACHE = "pdl:gh:";
const FRESH_MS = 15 * 60 * 1000;
const KEEP_MS = 7 * 24 * 60 * 60 * 1000;   // saved answers older than a week get cleared out

store.keys(CACHE).forEach(k => {
  const saved = store.get(k, null);
  if (!saved || !(Date.now() - saved.when < KEEP_MS)) store.remove(k);
});

let savedFrom = null;   // when the oldest saved answer we fell back on was saved, or null

// When the oldest saved answer we had to use was saved (a time in ms), or null if everything is fresh.
export const savedSince = () => savedFrom;
export const clearSaved = () => { savedFrom = null; };

const GITHUB = "https://api.github.com/";
const PROXY = WORKER_URL ? WORKER_URL.replace(/\/+$/, "") + "/github/" : "";

// Ask the Worker for GitHub API addresses; if it's unreachable or answers with anything but
// "here it is" or "no such thing", ask GitHub directly.
async function request(url) {
  if (PROXY && url.startsWith(GITHUB)) {
    try {
      const r = await fetch(PROXY + url.slice(GITHUB.length));
      if (r.ok || r.status === 404) return r;
    } catch (e) {}
  }
  return fetch(url, { headers: { Accept: "application/vnd.github+json" } });
}

// shape: trims an answer down to what we use before it's saved and returned.
// Errors carry status, limited (the hourly limit is used up) and, when GitHub says, resetAt (a Date).
async function getJSON(url, shape = d => d) {
  const k = CACHE + url;
  const saved = store.get(k, null);
  if (saved && Date.now() - saved.when < FRESH_MS) return saved.data;

  const r = await request(url);
  if (!r.ok) {
    const e = new Error("HTTP " + r.status);
    e.status = r.status;
    e.limited = r.status === 403 || r.status === 429;
    if (e.limited && saved) {
      savedFrom = Math.min(savedFrom ?? saved.when, saved.when);
      return saved.data;
    }
    const reset = Number(r.headers.get("X-RateLimit-Reset"));   // seconds since 1970
    if (e.limited && reset) e.resetAt = new Date(reset * 1000);
    throw e;
  }
  const data = shape(await r.json());
  store.set(k, { when: Date.now(), data });
  return data;
}

// Only the bits of each answer the app reads, so saved copies stay small.
const slimProfile = p => ({ login: p.login, name: p.name, bio: p.bio, avatar_url: p.avatar_url });
const slimEvent = e => {
  const p = e.payload || {};
  return {
    type: e.type,
    created_at: e.created_at,
    repo: e.repo && { name: e.repo.name },
    payload: {
      head: p.head, ref: p.ref, ref_type: p.ref_type, action: p.action, number: p.number,
      pull_request: p.pull_request && { number: p.pull_request.number, merged: p.pull_request.merged, title: String(p.pull_request.title || "").slice(0, 80) },
      issue: p.issue && { number: p.issue.number },
      release: p.release && { tag_name: p.release.tag_name }
    }
  };
};

export function fetchProfile(user) {
  return getJSON(`https://api.github.com/users/${encodeURIComponent(user)}`, slimProfile);
}

// Daily contribution counts and levels (0 to 4) from the community-run github-contributions-api.
export async function fetchContributions(login) {
  const data = await getJSON(`https://github-contributions-api.jogruber.de/v4/${encodeURIComponent(login)}?y=last`);
  const byDay = new Map();
  (data.contributions || []).forEach(c => byDay.set(c.date, { count: c.count, level: c.level }));
  const yearTotal = data.total ? Object.values(data.total).reduce((a, b) => a + b, 0) : null;
  return { byDay, yearTotal };
}

// Public activity (about the last 90 days), grouped by local date.
export async function fetchEvents(login) {
  const all = [];
  for (let page = 1; page <= 3; page++) {
    let batch;
    try {
      batch = await getJSON(`https://api.github.com/users/${encodeURIComponent(login)}/events/public?per_page=100&page=${page}`,
        list => list.map(slimEvent));
    } catch (e) {
      if (page === 1) throw e;
      break;
    }
    all.push(...batch);
    if (batch.length < 100) break;
  }
  const byDay = new Map();
  all.forEach(ev => {
    const k = key(new Date(ev.created_at));
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k).push(ev);
  });
  return byDay;
}

// If the contributions service is down, estimate levels from public activity.
export function levelsFromEvents(eventsByDay) {
  const byDay = new Map();
  eventsByDay.forEach((list, k) => {
    const n = list.filter(e => e.type !== "WatchEvent").length;
    if (n) byDay.set(k, { count: n, level: Math.min(4, Math.ceil(n / 2)) });
  });
  return byDay;
}

// Commit messages aren't in the activity feed anymore, so fetch them one at a time and cache.
const commitCache = new Map();
export function fetchCommitMessage(repo, sha) {
  const k = repo + "@" + sha;
  if (commitCache.has(k)) return commitCache.get(k);
  const firstLine = d => String((d.commit && d.commit.message) || "").split("\n")[0].slice(0, 120);
  const p = getJSON(`https://api.github.com/repos/${repo}/commits/${sha}`, d => ({ commit: { message: firstLine(d) } }))
    .then(d => firstLine(d) || "(no message)");
  commitCache.set(k, p);
  p.catch(() => commitCache.delete(k));
  return p;
}

// Turn one activity event into a short readable line.
export function describe(e) {
  const repo = (e.repo && e.repo.name) || "a repo";
  const p = e.payload || {};
  const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : "");
  switch (e.type) {
    case "PushEvent": return { kind: "push", repo, head: p.head, branch: (p.ref || "").replace("refs/heads/", "") };
    case "CreateEvent": return { text: p.ref_type === "repository" ? `Created the repo ${repo}` : `Created ${p.ref_type} ${p.ref || ""} in ${repo}`, repo };
    case "DeleteEvent": return { text: `Deleted ${p.ref_type} ${p.ref || ""} in ${repo}`, repo };
    case "PullRequestEvent": return { text: `${cap(p.action)} pull request #${p.number || (p.pull_request && p.pull_request.number) || ""} in ${repo}`, repo };
    case "PullRequestReviewEvent": return { text: `Reviewed a pull request in ${repo}`, repo };
    case "PullRequestReviewCommentEvent": return { text: `Commented on a pull request in ${repo}`, repo };
    case "IssuesEvent": return { text: `${cap(p.action)} issue #${(p.issue && p.issue.number) || ""} in ${repo}`, repo };
    case "IssueCommentEvent": return { text: `Commented on #${(p.issue && p.issue.number) || ""} in ${repo}`, repo };
    case "WatchEvent": return { text: `Starred ${repo}`, repo, light: true };
    case "ForkEvent": return { text: `Forked ${repo}`, repo };
    case "ReleaseEvent": return { text: `Released ${(p.release && p.release.tag_name) || ""} in ${repo}`, repo };
    case "PublicEvent": return { text: `Made ${repo} public`, repo };
    case "MemberEvent": return { text: `Joined ${repo} as a collaborator`, repo };
    default: return { text: `${String(e.type).replace(/Event$/, "")} in ${repo}`, repo };
  }
}

// Merge several pushes to the same repo into one line.
export function groupEvents(events) {
  const groups = [];
  events.slice().reverse().forEach(e => {
    const d = describe(e);
    if (d.kind === "push") {
      let g = groups.find(g => g.kind === "push" && g.repo === d.repo);
      if (!g) { g = { kind: "push", repo: d.repo, heads: [], branches: new Set() }; groups.push(g); }
      if (d.head) g.heads.push(d.head);
      if (d.branch) g.branches.add(d.branch);
    } else {
      groups.push(d);
    }
  });
  return groups;
}
