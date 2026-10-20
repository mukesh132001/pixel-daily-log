// Everything that talks to GitHub lives here.
// Public data only: no login, about 60 requests an hour per network.

import { key } from "./dates.js";

export const GH_COLORS = ["#0e4429", "#006d32", "#26a641", "#39d353"];

export const isValidUsername = u => /^[a-z\d](?:[a-z\d-]{0,38})$/i.test(u);

async function getJSON(url) {
  const r = await fetch(url, { headers: { Accept: "application/vnd.github+json" } });
  if (!r.ok) {
    const e = new Error("HTTP " + r.status);
    e.status = r.status;
    e.limited = r.status === 403 || r.status === 429;
    throw e;
  }
  return r.json();
}

export function fetchProfile(user) {
  return getJSON(`https://api.github.com/users/${encodeURIComponent(user)}`);
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
      batch = await getJSON(`https://api.github.com/users/${encodeURIComponent(login)}/events/public?per_page=100&page=${page}`);
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
  const p = getJSON(`https://api.github.com/repos/${repo}/commits/${sha}`)
    .then(d => String((d.commit && d.commit.message) || "").split("\n")[0].slice(0, 120) || "(no message)");
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
