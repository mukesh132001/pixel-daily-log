// What you did TODAY, for the room: which props show (shoes, bottle, medal, candle), how the monitor glows,
// and placeholder art for the props until real PNGs exist.
//
// Where everything goes is in sprites/today/today_manifest.json (same coordinates and layers as the room).
// To swap a placeholder for your own art: put the PNG in sprites/today/ and set that prop's "sprite" there.

import { isRun } from "./runs.js";

const LONG_RUN_MI = 3.1;   // 5 km
const STREAK_CANDLE = 3;   // the candle shows from a 3-day streak
const NIGHT_HOUR = 21;     // after 9pm with nothing logged, the character gets sleepy

// day: { count (GitHub contributions), level (GitHub's 0-4), pushed (a push today), runs (runs and walks) }
// streak: the current streak in days. hour: 0-23, the viewer's local time.
export function todayState({ count = 0, level = 0, pushed = false, runs = [] } = {}, streak = 0, hour = new Date().getHours()) {
  const coded = count > 0 || pushed;
  const ran = runs.some(r => isRun(r) && (Number(r.mi) || 0) > 0);
  const quiet = !coded && !runs.some(r => (Number(r.mi) || 0) > 0);   // nothing logged yet (a walk counts)
  return {
    coded,
    level: coded ? Math.max(1, Math.min(4, level || 1)) : 0,
    ran,
    longRun: runs.some(r => isRun(r) && (Number(r.mi) || 0) >= LONG_RUN_MI),
    streak,
    quiet,
    night: quiet && hour >= NIGHT_HOUR
  };
}

// The dev previews (?dev&today=...). Each is a whole day, so every state can be checked.
export const DEV_DAYS = {
  coded: { count: 6, level: 3 },
  ran: { runs: [{ mi: 4, type: "run" }] },
  both: { count: 12, level: 4, runs: [{ mi: 5, type: "run" }] },
  none: {}
};

// Does a prop from today_manifest.json show? when: "ran", "longRun" or "streak".
// needs / without: a room piece that must (or must not) be in the room, like the bookshelf for the candle.
export function propShows(prop, state, hasPiece) {
  const when = prop.when === "streak" ? state.streak >= STREAK_CANDLE : !!state[prop.when];
  if (!when) return false;
  if (prop.needs && !hasPiece(prop.needs)) return false;
  if (prop.without && hasPiece(prop.without)) return false;
  return true;
}

// How the monitor looks on a coding day, by GitHub's contribution level 1-4: brighter on bigger days.
export const SCREEN_LOOKS = [
  { bg: "#253046", line: "#4f9a74", glow: 0.10 },
  { bg: "#263a4a", line: "#6cc08f", glow: 0.16 },
  { bg: "#28444c", line: "#8fdcae", glow: 0.22 },
  { bg: "#2c5050", line: "#c4f7d6", glow: 0.30 }
];

// ----- placeholder art -----
// Text grids like scene.js: each letter is a color, "." is empty. Several grids = animation frames.

const COLORS = {
  // shoes: coral sneakers, cream soles
  c: "#e8737a", C: "#b8505a", s: "#f8f5f1", S: "#c9c2b6",
  // bottle: sky blue with a dark cap
  k: "#3a3f4b", b: "#79c7e3", B: "#4f9cbf", h: "#d6f1fa",
  // medal: coral and blue ribbon, gold disc
  r: "#e8737a", u: "#79c7e3", g: "#c9962f", y: "#f2c96b", Y: "#fff1b8",
  // candle: cream wax, warm flame, brass holder
  w: "#f4f0ea", W: "#d8cfc2", f: "#fff1b8", o: "#f2a33a", n: "#3d2e3f", p: "#c9962f", P: "#9c6f22",
  // zzz bubble
  l: "#fff8ee", L: "#7b6a7e", z: "#7a5fa8"
};

export const PLACEHOLDERS = {
  shoes: [[
    "..cc..........",
    ".cscC.....cc..",
    "cccccC...cscC.",
    "SssssS..cccccC",
    "........SssssS"
  ]],
  bottle: [[
    ".kk.",
    ".kk.",
    "bhbB",
    "bhbB",
    "bhbB",
    "bhbB",
    "bhbB",
    "bbbB",
    ".BB."
  ]],
  medal: [[
    "rr...uu",
    ".rr.uu.",
    "..ruu..",
    "...g...",
    "..ggg..",
    ".gyyyg.",
    ".gyYyg.",
    ".gyyyg.",
    "..ggg.."
  ]],
  candle: [[
    "..f..",
    ".fof.",
    ".fof.",
    "..n..",
    ".wwW.",
    ".wwW.",
    ".wwW.",
    ".wwW.",
    "ppppp",
    ".PPP."
  ], [
    ".f...",
    ".ff..",
    ".fof.",
    "..n..",
    ".wwW.",
    ".wwW.",
    ".wwW.",
    ".wwW.",
    "ppppp",
    ".PPP."
  ]],
  zzz: [[
    ".LLLLLLLLL.",
    "LlllllzzzlL",
    "LllllllzllL",
    "LlzzzlzzzlL",
    "LllzllllllL",
    "LlzzzlllllL",
    ".LLLLLLLLL.",
    "..LL.......",
    ".L........."
  ]]
};

// A placeholder as canvases, one per frame, so the room can draw it like any loaded image.
export function placeholderFrames(name) {
  return (PLACEHOLDERS[name] || []).map(rows => {
    const c = document.createElement("canvas");
    c.width = Math.max(...rows.map(r => r.length));
    c.height = rows.length;
    const x = c.getContext("2d");
    rows.forEach((row, r) => [...row].forEach((ch, col) => {
      if (ch === "." || !COLORS[ch]) return;
      x.fillStyle = COLORS[ch];
      x.fillRect(col, r, 1, 1);
    }));
    return c;
  });
}
