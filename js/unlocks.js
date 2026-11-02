// What you've done so far, worked out for the character unlocks. Only math here, no page, so it's easy to test.
//
// GitHub gives a year of daily contributions and about 90 days of pushes, Strava only the last 4 weeks. So each
// visit adds what it saw to a small record that stays in THIS browser (never in an account, because it holds
// Strava runs), and the numbers are worked out from the record. Days only ever get added or raised, so a
// deleted run or a feed that forgets old pushes never takes progress away.
//
// The record: {
//   code: { "2026-10-20": 3 }                  contributions that day (a push alone counts as 1)
//   late: ["2026-10-24T03:12:00Z", ...]        pushes made between midnight and 4am (their timestamps)
//   runs: { "2026-10-20": { n: 1, mi: 3.2, top: 3.2, early: 0 } }
//                                              runs that day: how many, miles, longest, started before 7am
// }

import { longestStreak } from "./profile.js";

export const EARLY_HOUR = 7;                     // "a run that starts before 7am"
export const HOLIDAYS = ["10-31", "12-25", "01-01"];

export const emptyRecord = () => ({ code: {}, late: [], runs: {} });

// ----- adding what this visit saw -----

// contrib: Map day -> { count } (only when GitHub's contribution calendar loaded, else null).
// pushes: PushEvents ({ created_at }). runs: { day: [run] } with hand-logged and Strava runs already merged
// (real runs only). Returns a new record; `old` isn't changed.
export function addToRecord(old, { contrib, pushes, runs }) {
  const rec = { code: { ...old.code }, late: [...old.late], runs: { ...old.runs } };

  if (contrib) contrib.forEach((c, k) => { if (c.count > 0) rec.code[k] = Math.max(rec.code[k] || 0, c.count); });
  pushes.forEach(e => {
    const d = new Date(e.created_at);
    if (isNaN(d)) return;
    const k = localKey(d);
    rec.code[k] = Math.max(rec.code[k] || 0, 1);
    if (d.getHours() < 4 && !rec.late.includes(e.created_at)) rec.late.push(e.created_at);
  });

  Object.entries(runs).forEach(([k, list]) => {
    if (!list.length) return;
    const was = rec.runs[k] || { n: 0, mi: 0, top: 0, early: 0 };
    rec.runs[k] = {
      n: Math.max(was.n, list.length),
      mi: Math.max(was.mi, round(list.reduce((s, r) => s + (r.mi || 0), 0))),
      top: Math.max(was.top, ...list.map(r => r.mi || 0)),
      early: Math.max(was.early, list.filter(r => Number.isFinite(r.hour) && r.hour < EARLY_HOUR).length)
    };
  });
  return rec;
}

const round = n => Math.round(n * 100) / 100;
const pad = n => String(n).padStart(2, "0");
const localKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// ----- the numbers the roster's rules ask about -----

const dayNumber = k => { const [y, m, d] = k.split("-").map(Number); return Math.round(Date.UTC(y, m - 1, d) / 86400000); };
// Which Monday-to-Sunday week a day is in (a whole number that goes up by 1 each week).
const weekOf = k => Math.floor((dayNumber(k) + 3) / 7);
const isWeekend = k => (dayNumber(k) + 3) % 7 >= 5;   // Monday is 0 (day 0, 1970-01-01, was a Thursday)

// The longest stretch of back-to-back numbers in a list.
function longestRun(nums) {
  const list = [...new Set(nums)].sort((a, b) => a - b);
  let best = 0, run = 0;
  list.forEach((n, i) => { run = i && n === list[i - 1] + 1 ? run + 1 : 1; best = Math.max(best, run); });
  return best;
}

// rec: the record. me: your profile (log, createdAt). today: "YYYY-MM-DD".
export function deriveFacts(rec, me, today) {
  const codeDays = Object.keys(rec.code), runDays = Object.keys(rec.runs).filter(k => rec.runs[k].n > 0);
  const both = codeDays.filter(k => rec.runs[k] && rec.runs[k].n > 0);

  const runsPerWeek = new Map();
  runDays.forEach(k => runsPerWeek.set(weekOf(k), (runsPerWeek.get(weekOf(k)) || 0) + rec.runs[k].n));

  const logged = (me.log && me.log.days) || [];
  const made = new Date(me.createdAt);

  return {
    totalCommits: codeDays.reduce((s, k) => s + rec.code[k], 0),
    commitStreak: longestStreak(codeDays),
    latePushes: rec.late.length,
    commitWeekends: longestRun(codeDays.filter(isWeekend).map(weekOf)),
    runCount: runDays.reduce((s, k) => s + rec.runs[k].n, 0),
    earlyRuns: runDays.reduce((s, k) => s + rec.runs[k].early, 0),
    runsInWeek: Math.max(0, ...runsPerWeek.values()),
    runWeeks: longestRun([...runsPerWeek.keys()]),
    longestRunMi: Math.max(0, ...runDays.map(k => rec.runs[k].top)),
    runMiles: runDays.reduce((s, k) => s + rec.runs[k].mi, 0),
    bothDays: both.length,
    bothStreak: longestStreak(both),
    bestStreak: (me.log && me.log.best) || 0,     // any logged day (commit, run or workout) in a row
    holidays: logged.filter(k => HOLIDAYS.includes(k.slice(5))).length,
    years: isNaN(made) ? 0 : yearsBetween(made, today)
  };
}

// Whole years from the day the profile was made to today (the 1-year anniversary is the same date a year later).
function yearsBetween(made, today) {
  const [y, m, d] = today.split("-").map(Number);
  let n = y - made.getFullYear();
  if (m < made.getMonth() + 1 || (m === made.getMonth() + 1 && d < made.getDate())) n--;
  return Math.max(0, n);
}
