// The character roster: who you can play as, and how each one is unlocked.
//
// Art is Muki's own pack in sprites/characters/ (see its README.txt). Every frame is 32x40:
//   side:  4x4 sheet facing right, rows idle, walk, run, jump
//   front: one row of 4 idle frames, looking at the player
// Feet touch the ground on pixel row 35 of every frame, so all views line up on the same floor.
//
// id is what gets saved on the profile and never changes. name is just for show, so renaming is safe.

export const FRAME_W = 32, FRAME_H = 40, FEET = 35;
export const ROWS = { idle: 0, walk: 1, run: 2, jump: 3 };
export const FRAME_MS = { idle: 260, walk: 150, run: 95, jump: 170 };

// How a character is unlocked: unlock is { type: "start" } (yours from day one) or { fact, min }, which means
// "your number for `fact` is at least `min`". The numbers come from deriveFacts() in unlocks.js:
//   totalCommits, commitStreak, latePushes (midnight-4am), commitWeekends (weekends in a row with a commit),
//   runCount, earlyRuns (before 7am), runsInWeek (best Mon-Sun week), runWeeks (weeks in a row with a run),
//   longestRunMi, runMiles (total), bothDays (a commit and a run), bothStreak, bestStreak (any logged day),
//   holidays (days logged on Halloween, Christmas Day or New Year's Day), years (since you made your profile).
// Only Run, TrailRun and VirtualRun count as runs (see runs.js). secret: true keeps the hint as "???".
export const ROSTER = [
  // Start
  { id: "leo", name: "Leo", front: "sprites/characters/front/leo_front.png", side: "sprites/characters/sheets/leo.png",
    unlock: { type: "start" }, hint: "" },
  // GitHub
  { id: "ben", name: "Ben", front: "sprites/characters/front/ben_front.png", side: "sprites/characters/sheets/ben.png",
    unlock: { fact: "totalCommits", min: 1 }, hint: "Log your first commit in Pixmod." },
  { id: "bolt", name: "Bolt", front: "sprites/characters/front/bolt_front.png", side: "sprites/characters/sheets/bolt.png",
    unlock: { fact: "commitStreak", min: 7 }, hint: "Commit 7 days in a row." },
  { id: "kage", name: "Kage", front: "sprites/characters/front/kage_front.png", side: "sprites/characters/sheets/kage.png",
    unlock: { fact: "latePushes", min: 3 }, hint: "Push 3 times between midnight and 4am." },
  { id: "night_owl", name: "Night Owl", front: "sprites/characters/front/night_owl_front.png", side: "sprites/characters/sheets/night_owl.png",
    unlock: { fact: "latePushes", min: 1 }, hint: "Push a commit between midnight and 4am." },
  { id: "park", name: "Park", front: "sprites/characters/front/park_front.png", side: "sprites/characters/sheets/park.png",
    unlock: { fact: "commitWeekends", min: 4 }, hint: "Commit on 4 weekends in a row." },
  { id: "dunmore", name: "Dunmore", front: "sprites/characters/front/dunmore_front.png", side: "sprites/characters/sheets/dunmore.png",
    unlock: { fact: "totalCommits", min: 100 }, hint: "Make 100 commits." },
  { id: "fennick", name: "Fennick", front: "sprites/characters/front/fennick_front.png", side: "sprites/characters/sheets/fennick.png",
    unlock: { fact: "commitStreak", min: 30 }, hint: "Commit 30 days in a row." },
  // Strava
  { id: "maya", name: "Maya", front: "sprites/characters/front/maya_front.png", side: "sprites/characters/sheets/maya.png",
    unlock: { fact: "runCount", min: 1 }, hint: "Log your first run." },
  { id: "kira", name: "Kira", front: "sprites/characters/front/kira_front.png", side: "sprites/characters/sheets/kira.png",
    unlock: { fact: "earlyRuns", min: 1 }, hint: "Start a run before 7am." },
  { id: "rain_runner", name: "Rain Runner", front: "sprites/characters/front/rain_runner_front.png", side: "sprites/characters/sheets/rain_runner.png",
    unlock: { fact: "runsInWeek", min: 3 }, hint: "Run 3 times in one week (Monday to Sunday)." },
  { id: "zoe", name: "Zoe", front: "sprites/characters/front/zoe_front.png", side: "sprites/characters/sheets/zoe.png",
    unlock: { fact: "runsInWeek", min: 5 }, hint: "Run 5 times in one week (Monday to Sunday)." },
  { id: "dre", name: "Dre", front: "sprites/characters/front/dre_front.png", side: "sprites/characters/sheets/dre.png",
    unlock: { fact: "longestRunMi", min: 6.2 }, hint: "Run 6.2 miles (10 km) or more in one go." },
  { id: "hana", name: "Hana", front: "sprites/characters/front/hana_front.png", side: "sprites/characters/sheets/hana.png",
    unlock: { fact: "runWeeks", min: 4 }, hint: "Run at least once a week, 4 weeks in a row." },
  { id: "cosmo", name: "Cosmo", front: "sprites/characters/front/cosmo_front.png", side: "sprites/characters/sheets/cosmo.png",
    unlock: { fact: "runMiles", min: 62 }, hint: "Run 62 miles (100 km) in total." },
  // Both
  { id: "marco", name: "Marco", front: "sprites/characters/front/marco_front.png", side: "sprites/characters/sheets/marco.png",
    unlock: { fact: "bothDays", min: 1 }, hint: "Commit and run on the same day." },
  { id: "ghost_kid", name: "Ghost Kid", front: "sprites/characters/front/ghost_kid_front.png", side: "sprites/characters/sheets/ghost_kid.png",
    unlock: { fact: "bestStreak", min: 7 }, hint: "Log 7 days in a row. A commit or a run counts." },
  { id: "vance", name: "Vance", front: "sprites/characters/front/vance_front.png", side: "sprites/characters/sheets/vance.png",
    unlock: { fact: "bothStreak", min: 7 }, hint: "Commit and run 7 days in a row." },
  { id: "grant", name: "Grant", front: "sprites/characters/front/grant_front.png", side: "sprites/characters/sheets/grant.png",
    unlock: { fact: "bothDays", min: 30 }, hint: "Commit and run on 30 different days." },
  { id: "pip", name: "Pip", front: "sprites/characters/front/pip_front.png", side: "sprites/characters/sheets/pip.png",
    unlock: { fact: "holidays", min: 1 }, hint: "???", secret: true },
  { id: "walt", name: "Walt", front: "sprites/characters/front/walt_front.png", side: "sprites/characters/sheets/walt.png",
    unlock: { fact: "years", min: 1 }, hint: "Come back on your profile’s 1-year anniversary." }
];

export const DEFAULT_ID = "leo";
export const byId = id => ROSTER.find(c => c.id === id) || null;

// facts: the numbers from deriveFacts() in unlocks.js
export const meetsRule = (rule, facts) => rule.type === "start" || (facts[rule.fact] || 0) >= rule.min;

// Is this character yours? unlocked is the profile's { id: "date it was earned" }.
export const isUnlocked = (c, unlocked) => c.unlock.type === "start" || !!(unlocked && unlocked[c.id]);

// Images load once and are shared by the room, the scene and the select screen.
const images = new Map();
export function loadImage(src) {
  if (!images.has(src)) {
    images.set(src, new Promise((ok, fail) => {
      const img = new Image();
      img.onload = () => ok(img);
      img.onerror = () => { images.delete(src); fail(new Error(`Couldn't load ${src}`)); };
      img.src = src;
    }));
  }
  return images.get(src);
}

// Draw one 32x40 frame so its feet land on (x, feetY). x is the frame's left edge.
// flip mirrors it to face left.
export function drawFrame(ctx, img, col, row, x, feetY, flip) {
  const sx = col * FRAME_W, sy = row * FRAME_H, y = Math.round(feetY) - FEET;
  x = Math.round(x);
  if (!flip) return ctx.drawImage(img, sx, sy, FRAME_W, FRAME_H, x, y, FRAME_W, FRAME_H);
  ctx.save();
  ctx.translate(x + FRAME_W, y);
  ctx.scale(-1, 1);
  ctx.drawImage(img, sx, sy, FRAME_W, FRAME_H, 0, 0, FRAME_W, FRAME_H);
  ctx.restore();
}
