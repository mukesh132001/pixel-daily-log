// Runs: logged by hand (saved per profile in this browser) or pulled from Strava.
// Shape: { "2026-10-19": [{ mi: 2.1, min: 20, name: "Pace training", type: "run" }] }

import { store, runsKey } from "./storage.js";
import { pad } from "./dates.js";

export const loadRuns = profileId => store.get(runsKey(profileId), {});
export const saveRuns = (profileId, runs) => store.set(runsKey(profileId), runs);

// Minutes per mile as a number, or null if there's no time.
export const paceValue = run => (run.min && run.mi ? run.min / run.mi : null);

// Format a pace like "9:41 /mi".
export function formatPace(p) {
  if (!p) return "";
  let m = Math.floor(p), s = Math.round((p - m) * 60);
  if (s === 60) { m += 1; s = 0; }
  return `${m}:${pad(s)} /mi`;
}

export const pace = run => formatPace(paceValue(run));

export const totalMiles = runs => runs.reduce((s, r) => s + (r.mi || 0), 0);

// Only real runs count toward pace: walks and rides would skew it.
export const isRun = r => (r.type || "run") === "run";

// Average pace over several runs, weighted by distance.
export function averagePace(runs) {
  const timed = runs.filter(r => isRun(r) && paceValue(r));
  const mi = timed.reduce((s, r) => s + r.mi, 0);
  const min = timed.reduce((s, r) => s + r.min, 0);
  return mi ? min / mi : null;
}
