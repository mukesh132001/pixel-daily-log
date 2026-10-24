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

// unlock.type: "start" (yours from day one), "lateCommit" (a push between midnight and 4am),
// "streak" (logged days in a row), "runsInWeek" (runs in one Mon-Sun week). See meetsRule().
export const ROSTER = [
  {
    id: "leo", name: "Leo",
    front: "sprites/characters/front/leo_front.png", side: "sprites/characters/sheets/leo.png",
    unlock: { type: "start" }, hint: ""
  },
  {
    id: "night_owl", name: "Night Owl",
    front: "sprites/characters/front/night_owl_front.png", side: "sprites/characters/sheets/night_owl.png",
    unlock: { type: "lateCommit" }, hint: "Push a commit between midnight and 4am."
  },
  {
    id: "ghost_kid", name: "Ghost Kid",
    front: "sprites/characters/front/ghost_kid_front.png", side: "sprites/characters/sheets/ghost_kid.png",
    unlock: { type: "streak", days: 7 }, hint: "Log 7 days in a row. A commit or a run counts."
  },
  {
    // Strava's activity list has no weather, so "rain" waits; for now it's about showing up.
    id: "rain_runner", name: "Rain Runner",
    front: "sprites/characters/front/rain_runner_front.png", side: "sprites/characters/sheets/rain_runner.png",
    unlock: { type: "runsInWeek", runs: 3 }, hint: "Run 3 times in one week (Monday to Sunday)."
  }
];

export const DEFAULT_ID = "leo";
export const byId = id => ROSTER.find(c => c.id === id) || null;

// facts: { lateCommit: bool, bestStreak: number, mostRunsInAWeek: number }
export function meetsRule(rule, facts) {
  switch (rule.type) {
    case "start": return true;
    case "lateCommit": return !!facts.lateCommit;
    case "streak": return facts.bestStreak >= rule.days;
    case "runsInWeek": return facts.mostRunsInAWeek >= rule.runs;
    default: return false;
  }
}

// Is this character yours? unlocked is the profile's { id: "date it was earned" }.
export const isUnlocked = (c, unlocked) => c.unlock.type === "start" || !!(unlocked && unlocked[c.id]);

// The character to show: your pick if you have it, otherwise the default.
export function currentCharacter(id, unlocked) {
  const c = byId(id);
  return c && isUnlocked(c, unlocked) ? c : byId(DEFAULT_ID);
}

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
