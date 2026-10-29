// XP and room levels: real activity earns XP, XP raises your room's level, and the room gets new furniture
// at each level (unlockLevel in sprites/room/room_manifest.json). Only math here, no page, so it's easy to test.
// main.js feeds it your days; room.js shows the level.
//
// The profile keeps a small ledger: { days: { "2026-10-29": 42, ... }, older: 120 }. Each visit recalculates
// the days we have data for and overwrites them, so a day never counts twice and the same data always gives
// the same number. Days older than KEEP_DAYS are added into `older`, so the ledger stays small.

// Total XP needed for each level: level 1 at 0, level 2 at 50, ... level 10 at 3000.
export const LEVELS = [0, 50, 150, 300, 500, 800, 1200, 1700, 2300, 3000];
export const MAX_LEVEL = LEVELS.length;
const KEEP_DAYS = 60;

// How a day earns XP (the info box in the room shows these too).
export const RULES = {
  codeDay: 10, perContribution: 2, codeCap: 30,
  perRun: 15, perRunMile: 5, perWalkMile: 2, moveCap: 50,
  perStreakDay: 5, streakCap: 25
};

// One day's XP. contributions: GitHub contributions that day. runs: that day's runs and walks
// ({ mi, type }: type "run" (the default) or "walk"; rides and the rest earn nothing yet).
// streak: days in a row with activity, ending today (1 = just today).
// A rest day earns nothing, streak bonus included.
export function dayXp({ contributions = 0, runs = [], streak = 0 }) {
  const R = RULES;
  const code = contributions > 0 ? Math.min(R.codeCap, R.codeDay + R.perContribution * contributions) : 0;
  let move = 0;
  runs.forEach(r => {
    const mi = Math.max(0, Number(r.mi) || 0), type = r.type || "run";
    if (type === "run") move += R.perRun + R.perRunMile * mi;
    else if (type === "walk") move += R.perWalkMile * mi;
  });
  move = Math.min(R.moveCap, Math.round(move));
  if (!code && !move) return 0;
  return code + move + Math.min(R.streakCap, R.perStreakDay * Math.max(0, streak));
}

// "YYYY-MM-DD" <-> a day number, so we can step back one day at a time.
const dayNumber = k => { const [y, m, d] = k.split("-").map(Number); return Math.round(Date.UTC(y, m - 1, d) / 86400000); };
const dayKey = n => new Date(n * 86400000).toISOString().slice(0, 10);
export const daysBefore = (k, n) => dayKey(dayNumber(k) - n);

// How many days in a row up to and including k are in `active` (a Set of day keys), not counting
// anything before `from`.
export function streakEnding(k, active, from = "") {
  let n = 0, d = k;
  while (d >= from && active.has(d)) { n++; d = daysBefore(d, 1); }
  return n;
}

// The ledger with freshly calculated days written in.
// fresh: [{ k, xp }]. from: the first day that counts (the day the profile was made); earlier days are ignored.
// keepHigher: some data didn't load this time, so don't lower any day (a failed load shouldn't take XP away).
// today: used to fold days older than KEEP_DAYS into `older`.
export function updateLedger(old, fresh, { from = "", keepHigher = false, today } = {}) {
  const days = { ...((old && old.days) || {}) };
  let older = (old && old.older) || 0;
  fresh.forEach(({ k, xp }) => {
    if (k < from) return;
    const value = keepHigher ? Math.max(days[k] || 0, xp) : xp;
    if (value > 0) days[k] = value;
    else delete days[k];
  });
  const cutoff = today ? daysBefore(today, KEEP_DAYS) : "";
  const out = {};
  Object.keys(days).sort().forEach(k => {          // sorted, so the same ledger always saves the same way
    if (k < cutoff) older += days[k];
    else out[k] = days[k];
  });
  return { days: out, older };
}

export const totalXp = ledger => !ledger ? 0 : (ledger.older || 0) + Object.values(ledger.days || {}).reduce((s, n) => s + n, 0);

// Two copies of the same ledger (this browser and your account): keep the higher number for every day.
export function mergeLedgers(a, b) {
  const days = { ...((a && a.days) || {}) };
  Object.entries((b && b.days) || {}).forEach(([k, n]) => (days[k] = Math.max(days[k] || 0, n)));
  const out = {};
  Object.keys(days).sort().forEach(k => (out[k] = days[k]));
  return { days: out, older: Math.max((a && a.older) || 0, (b && b.older) || 0) };
}

export function levelFor(total) {
  let level = 1;
  LEVELS.forEach((need, i) => { if (total >= need) level = i + 1; });
  return level;
}

// Where you are: { level, total, start (this level's XP), next (the next level's XP, null at the top), frac (0..1) }.
export function progress(total) {
  const level = levelFor(total), start = LEVELS[level - 1], next = level < MAX_LEVEL ? LEVELS[level] : null;
  return { level, total, start, next, frac: next == null ? 1 : (total - start) / (next - start) };
}
