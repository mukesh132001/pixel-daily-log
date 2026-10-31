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

// What kind of activity: "run", "walk", "ride", or "workout" (yoga, weights, stair stepper, anything else).
// Hand-logged entries have no type and are runs.
export const kindOf = r => { const t = r.type || "run"; return t === "run" || t === "walk" || t === "ride" ? t : "workout"; };

// Only real runs count toward pace and weekly distance: walks and rides would skew them.
export const isRun = r => kindOf(r) === "run";

export const KIND_ICON = { run: "shoe", walk: "walk", ride: "bike", workout: "dumbbell" };
// The kind that stands for a whole day, when it has several.
export const dayKind = runs => ["run", "ride", "walk", "workout"].find(k => runs.some(r => kindOf(r) === k)) || null;

// Miles of real runs only (the weekly bars and the 4-week total).
export const runMiles = runs => totalMiles(runs.filter(isRun));

// Strava's "StairStepper" -> "Stair Stepper"
export const sportLabel = sport => String(sport || "").replace(/([a-z])([A-Z])/g, "$1 $2");

// "Lunch Run, 3.1 mi" or, for a workout, "Morning Stair-Stepper, 32 min". A workout whose name doesn't
// say what it was gets its type added: "Leg day (Weight Training), 45 min".
export function describe(r) {
  const kind = kindOf(r);
  let name = r.name || (kind === "workout" ? sportLabel(r.sport) || "Workout" : "Run");
  const squash = s => s.toLowerCase().replace(/[^a-z]/g, "");
  if (kind === "workout" && r.sport && r.name && !squash(r.name).includes(squash(sportLabel(r.sport)))) name += ` (${sportLabel(r.sport)})`;
  if (kind === "workout") return r.min >= 1 ? `${name}, ${Math.round(r.min)} min` : name;
  return `${name}, ${r.mi.toFixed(1)} mi`;
}

// Average pace over several runs, weighted by distance.
export function averagePace(runs) {
  const timed = runs.filter(r => isRun(r) && paceValue(r));
  const mi = timed.reduce((s, r) => s + r.mi, 0);
  const min = timed.reduce((s, r) => s + r.min, 0);
  return mi ? min / mi : null;
}
