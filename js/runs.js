// Runs logged by hand, saved per player in this browser.
// Shape: { "2026-10-19": [{ mi: 2.1, min: 20, name: "Pace training" }] }

import { store, runsKey } from "./storage.js";
import { pad } from "./dates.js";

export const loadRuns = user => store.get(runsKey(user), {});
export const saveRuns = (user, runs) => store.set(runsKey(user), runs);

// Minutes per mile, like "9:41 /mi". Empty if no time was entered.
export function pace(run) {
  if (!run.min || !run.mi) return "";
  const p = run.min / run.mi;
  let m = Math.floor(p), s = Math.round((p - m) * 60);
  if (s === 60) { m += 1; s = 0; }
  return `${m}:${pad(s)} /mi`;
}

export const totalMiles = runs => runs.reduce((s, r) => s + r.mi, 0);
