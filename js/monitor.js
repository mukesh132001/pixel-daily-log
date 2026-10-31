// The monitor on your desk: your latest GitHub work, from the activity we already load for the page.
//
// workItems() picks the five latest things worth showing (pushes, pull requests opened or merged, new repos) and
// where each one links on GitHub. createMonitor() fills the panel (a <dialog>, see index.html) and opens it.
// The only extra requests are the commit messages of the pushes shown (at most 5, and the same ones the GitHub
// card asks for are already saved, see fetchCommitMessage in github.js).

import { fetchCommitMessage } from "./github.js";

const SHOWN = 5;
const GITHUB = "https://github.com/";

// "just now", "12m ago", "2h ago", "3d ago"
export function shortAgo(ms, now = Date.now()) {
  const min = Math.floor((now - ms) / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// events: GitHub activity events (see slimEvent in github.js), in any order.
// Returns up to 5, newest first: { kind, repo, text, at (ms), url, sha (pushes only) }.
export function workItems(events, limit = SHOWN) {
  const items = [];
  events.forEach(e => {
    const repo = e.repo && e.repo.name, p = e.payload || {}, at = Date.parse(e.created_at);
    if (!repo || !Number.isFinite(at)) return;
    const base = { repo, at, kind: "" };
    if (e.type === "PushEvent" && p.head) {
      const branch = (p.ref || "").replace("refs/heads/", "");
      items.push({ ...base, kind: "push", sha: p.head, text: `Pushed to ${branch || "a branch"}`, url: `${GITHUB}${repo}/commit/${p.head}` });
    } else if (e.type === "PullRequestEvent") {
      const pr = p.pull_request || {}, n = p.number || pr.number;
      if (!n) return;
      const merged = pr.merged === true, title = pr.title ? `: ${pr.title}` : "";
      if (p.action === "opened") items.push({ ...base, kind: "pr", text: `Opened pull request #${n}${title}`, url: `${GITHUB}${repo}/pull/${n}` });
      else if (p.action === "closed" && pr.merged !== false) items.push({ ...base, kind: "pr", text: `${merged ? "Merged" : "Closed"} pull request #${n}${title}`, url: `${GITHUB}${repo}/pull/${n}` });
    } else if (e.type === "CreateEvent" && p.ref_type === "repository") {
      items.push({ ...base, kind: "repo", text: "Created a new repository", url: `${GITHUB}${repo}` });
    }
  });
  return items.sort((a, b) => b.at - a.at).slice(0, limit);
}

// els: { box (the dialog), title, stats, list, note, close }
export function createMonitor(els) {
  let token = 0;   // opening again (or closing) makes older commit-message answers stop

  els.close.addEventListener("click", () => els.box.close());
  els.box.addEventListener("click", e => { if (e.target === els.box) els.box.close(); });
  els.box.addEventListener("close", () => token++);

  function stat(label, value) {
    const d = document.createElement("div");
    d.className = "mon-stat";
    const b = document.createElement("b");
    b.textContent = value;
    const s = document.createElement("span");
    s.textContent = label;
    d.append(b, s);
    return d;
  }

  function row(item) {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = item.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    const repo = document.createElement("span");
    repo.className = "mon-repo";
    repo.textContent = item.repo;
    const text = document.createElement("span");
    text.className = "mon-text";
    text.textContent = item.text;
    const when = document.createElement("time");
    when.className = "mon-when";
    when.dateTime = new Date(item.at).toISOString();
    when.textContent = shortAgo(item.at);
    const hint = document.createElement("span");
    hint.className = "sr-only";
    hint.textContent = " (opens GitHub in a new tab)";
    a.append(repo, text, when, hint);
    li.appendChild(a);
    return { li, text };
  }

  // model: { own (your own desk, or someone else's), name (whose work, for a visit), user (a GitHub login or null),
  //          ok (the activity loaded), events (list), today (contributions today), streak (days) }
  function open(model) {
    const mine = model.own;
    els.title.textContent = mine ? "My latest work" : `${model.name || model.user || "Their"}’s latest work`;
    els.stats.textContent = "";
    els.stats.append(stat(model.today === 1 ? "contribution today" : "contributions today", model.today), stat(model.streak === 1 ? "day streak" : "days streak", model.streak));
    els.list.textContent = "";
    els.note.textContent = "";

    const items = model.user && model.ok ? workItems(model.events) : [];
    if (!model.user) els.note.textContent = mine ? "Connect GitHub to see your work here." : "They haven’t connected GitHub.";
    else if (!model.ok) els.note.textContent = "Activity details aren’t available right now.";
    else if (!items.length) els.note.textContent = "No public pushes, pull requests or new repos lately.";

    const run = ++token;
    items.forEach(item => {
      const { li, text } = row(item);
      els.list.appendChild(li);
      if (item.sha) {   // the push's commit message, when it arrives (otherwise the branch stays)
        fetchCommitMessage(item.repo, item.sha).then(msg => { if (run === token) text.textContent = msg; }).catch(() => {});
      }
    });

    if (!els.box.open) els.box.showModal();
    els.close.focus();
  }

  return { open, close: () => els.box.close() };
}
