// The pixel world. A 192x108 canvas, redrawn about 60 times a second.
//
// Modes:  attract (title screen), loading, run, walk, code, rest, today
// Phase:  dawn, day, dusk, night. Picked from when you actually ran or coded,
//         so a night run gets the moon and a morning run gets the sunrise.
// Extras: streak flame (top left), "PR!" burst on your fastest-pace day,
//         and the ghost mascot, who jogs on the title screen and haunts rest days.

import { GH_COLORS } from "./github.js";
import { sfx } from "./sound.js";
import { isRun } from "./runs.js";
import { drawText } from "./font.js";
import { FRAME_W, FRAME_H, ROWS, drawFrame, loadImage } from "./characters.js";

const W = 192, H = 108;
const GROUND = 90;   // y of the runner's feet
const CX = 56;       // x of the character
const FX = CX - 6;   // left edge of its 32x40 frame (the body sits a few pixels in from the edge)
const FEET = GROUND - 1;

// Cozy pastel skies for each time of day.
const PHASES = {
  dawn:  { sky: ["#f2b8a8", "#f6cdb6", "#f9dfc4", "#fdecd4"], orb: "#ffad7a", orbY: 38, orbX: 30, stars: 0,  far: "#d9a9b8", bld: "#c695ab", win: "#ffe9c4", lit: 0.8,  grass: "#7fbf7a", grassTop: "#a6d98f", track: "#d77a5f", lane: "#ffe8dc", field: "#76b06e", glow: "#4caf6e" },
  day:   { sky: ["#9fd2ec", "#b8e0f1", "#d2ebf2", "#f1ecd8"], orb: "#ffd77a", orbY: 9,  orbX: 148, stars: 0, far: "#a8c8de", bld: "#8fb1cf", win: "#eef7ff", lit: 0.75, grass: "#78bd6f", grassTop: "#9fd68a", track: "#d9805f", lane: "#fff0e6", field: "#6fae67", glow: "#3ea860" },
  dusk:  { sky: ["#5b4a86", "#8a5e9a", "#cf7f8f", "#f5b48a"], orb: "#ffcf7a", orbY: 44, orbX: 150, stars: 10, far: "#6f4f86", bld: "#56406f", win: "#ffd77a", lit: 0.5, grass: "#5a8f5e", grassTop: "#79ad72", track: "#b8604f", lane: "#f3c3ae", field: "#4f7f53", glow: "#5fd17e" },
  night: { sky: ["#211a33", "#2c2244", "#3a2c56", "#4d3866"], orb: "#fff1d6", orbY: 10, orbX: 150, stars: 34, far: "#33284d", bld: "#2a2140", win: "#ffcf6e", lit: 0.42, grass: "#2f6b45", grassTop: "#468a57", track: "#8f4a46", lane: "#d9b1a6", field: "#2a5c3d", glow: "#5fd17e" }
};

// Sprites are drawn as text: each letter is a color, dots are empty.
// (The character is a PNG sheet from characters.js; the ghost and flame are here.)
const COLORS = {
  W: "#f7f2ff", L: "#cfc6ea", E: "#ffc95c", M: "#3d2e3f", B: "#f08a5d", O: "#f08a5d", C: "#fff1d6"
};
const SPRITES = {
  // the ghost from the app icon: sweatband, sly glowing eyes, floating sneakers
  ghost: ["...WWWW...", "..WWWWWW..", ".BBBBBBBB.", ".WWWWWWWW.", ".WWLWWLWW.", ".WWEWWEWW.", ".WWWWWWWW.", ".WWWMMWWW.", ".WWWWWWWW.", ".WW.WW.WW."],
  flame1: ["...f....", "..ff....", "..fff.f.", ".fffyff.", ".ffyyff.", ".fyyyyf.", "..fyyf..", "........"],
  flame2: ["....f...", "...ff...", ".f.fff..", ".ffyfff.", ".ffyyff.", ".fyyyyf.", "..fyyf..", "........"]
};
const FLAME = { f: "#f08a5d", y: "#ffc95c" };

// Same input always gives the same "random" number, so buildings don't flicker.
const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

export function themePhase() {
  const t = document.documentElement.getAttribute("data-theme");
  if (t === "dark") return "night";
  if (t === "light") return "day";
  return matchMedia("(prefers-color-scheme: dark)").matches ? "night" : "day";
}

export function createScene(canvas) {
  const ctx = canvas.getContext("2d");
  canvas.width = W;
  canvas.height = H;
  ctx.imageSmoothingEnabled = false;
  // Reduced motion slows everything down (SLOW times) instead of freezing it; only flashy things (twinkling stars,
  // flame flicker, sparkles and bursts, the day-change wipe) are left out.
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const SLOW = reduced ? 3 : 1;

  const stars = Array.from({ length: 34 }, (_, i) => ({ x: Math.floor(hash(i) * W), y: Math.floor(hash(i + 99) * 58), p: Math.floor(hash(i + 7) * 90) }));

  let mode = "attract", day = {}, P = PHASES[themePhase()], phaseFromTheme = true;
  let t = 0, at = 0, scroll = 0, speed = 0, target = 1.1;
  let jumpY = 0, vy = 0, parts = [], wipe = 0;
  let ghostX = -30, prTimer = 0, runStep = 0;
  let sheet = null, wanted = null;   // the character's side-view sheet (see setCharacter)

  // Follow light/dark changes when the day has no time of its own.
  const refresh = () => { if (phaseFromTheme) P = PHASES[themePhase()]; };
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", refresh);
  new MutationObserver(refresh).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  // ----- drawing helpers -----
  const px = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
  function sprite(s, x, y, scale, palette = COLORS) {
    for (let r = 0; r < s.length; r++) for (let c = 0; c < s[r].length; c++) {
      const ch = s[r][c];
      if (ch !== ".") px(x + c * scale, y + r * scale, scale, scale, palette[ch]);
    }
  }
  const text = (str, x, y, color, shadow) => drawText(px, str, x, y, color, shadow);
  // The player's character: one frame of a sheet row (idle, walk, run, jump), feet on feetY.
  const body = (row, col, x, feetY) => { if (sheet) drawFrame(ctx, sheet, col, ROWS[row], x, feetY); };
  // Jump frames: 1 rising, 2 at the top, 3 coming down.
  const jumpFrame = () => (vy > 1 ? 1 : vy > -1 ? 2 : 3);
  // Napping: the first idle frame turned on its back, centered on (cx, cy).
  function lyingDown(cx, cy) {
    if (!sheet) return;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-Math.PI / 2);
    ctx.drawImage(sheet, 0, 0, FRAME_W, FRAME_H, -FRAME_W / 2, -FRAME_H / 2, FRAME_W, FRAME_H);
    ctx.restore();
  }
  const spawn = (x, y, vx, vy2, color, kind, life = 110) => parts.push({ x, y, vx, vy: vy2, color, kind, life });

  // The ghost: floats, bobs, and its sneakers shuffle.
  // scale 2 up close (title screen), scale 1 far away (drifting across the sky).
  function ghost(x, y, k = 1) {
    const bob = Math.round(Math.sin(at / 10) * 1.5) * k;
    sprite(SPRITES.ghost, x, y + bob, k);
    const step = Math.floor(at / 6) % 2;
    const shoe = (sx, lift) => { px(x + sx * k, y + (11 - lift) * k + bob, 2 * k, k, COLORS.O); px(x + sx * k, y + (12 - lift) * k + bob, 2 * k, k, COLORS.C); };
    shoe(2, step); shoe(6, 1 - step);
  }

  // ----- layers -----
  function drawWorld() {
    const bandH = 17;
    P.sky.forEach((c, i) => px(0, i * bandH, W, bandH + 1, c));
    for (let i = 1; i < P.sky.length; i++) for (let x = 0; x < W; x += 2) px(x + (i % 2), i * bandH - 1, 1, 1, P.sky[i]);

    stars.slice(0, P.stars).forEach(s => { if (reduced || (t + s.p) % 90 > 6) px(s.x, s.y, 1, 1, "#fff1d6"); });

    if (P === PHASES.night) {                       // crescent moon
      px(P.orbX, P.orbY, 10, 10, P.orb); px(P.orbX + 4, P.orbY, 6, 6, P.sky[0]);
    } else {                                        // round, chunky sun
      const big = P === PHASES.day ? 0 : 2;
      px(P.orbX, P.orbY + 2, 12 + big, 8 + big, P.orb);
      px(P.orbX + 2, P.orbY, 8 + big, 12 + big, P.orb);
    }

    // far hills move slowest (parallax)
    const fo = scroll * 0.15;
    for (let x = 0; x < W; x += 2) {
      const h = Math.round((12 + 6 * Math.sin((x + fo) / 19) + 3 * Math.sin((x + fo) / 7)) / 2) * 2;
      px(x, 72 - h, 2, h + 8, P.far);
    }

    // buildings move a bit faster; more windows glow at night
    const so = scroll * 0.4, step = 24, base = Math.floor(so / step), off = so % step;
    for (let j = -1; j <= W / step + 1; j++) {
      const i = base + j, h = 12 + Math.floor(hash(i) * 18), x = j * step - off;
      px(x, 78 - h, 18, h, P.bld);
      for (let wy = 78 - h + 3; wy < 74; wy += 5) for (let wx = 3; wx < 16; wx += 5)
        if (hash(i * 13 + wx * 7 + wy) > P.lit) px(x + wx, wy, 2, 2, P.win);
    }

    // ground and track move at full speed
    px(0, 78, W, 12, P.grass); px(0, 78, W, 2, P.grassTop);
    px(0, GROUND - 4, W, 16, P.track);
    const lo = scroll % 14;
    for (let x = -14; x < W + 14; x += 14) px(x - lo, GROUND + 3, 7, 1, P.lane);
    px(0, GROUND + 12, W, H - GROUND - 12, P.field);
  }

  // In the air: rise, peak, fall. On the ground: the run cycle (about 100-120 ms a frame, a little faster as speed
  // goes up). Frames 1 and 3 are the passing poses, so the body hops up 1px there, and the feet only kick up dust
  // on the stride frames 0 and 2, at the moment the frame changes.
  function runner(feet) {
    const per = Math.max(6, 8 - Math.round(speed * 1.5));
    if (jumpY > 0) { body("jump", jumpFrame(), FX, feet); return; }
    const n = Math.floor(at / per), f = n % 4;
    body("run", f, FX, feet - (f % 2 ? 1 : 0));
    if (n !== runStep && f % 2 === 0) spawn(CX + 2, GROUND - 2, -speed * 0.6, -0.15, P.lane, "dust");
    runStep = n;
  }

  function drawCharacter() {
    const feet = FEET - Math.round(jumpY);
    const top = feet - 28;   // about where the head starts, for signs and sparks
    const idle = Math.floor(at / 16) % 4;

    if (mode === "attract" || mode === "loading") {
      // title screen: the ghost jogs along behind the runner
      ghost(CX - 36, GROUND - 30 - Math.round(Math.abs(Math.sin(at / 8)) * 2), 2);
      runner(feet);
      if (mode === "loading") for (let i = 0; i < 3; i++) if (Math.floor(at / 10) % 4 > i) px(90 + i * 6, 74, 3, 3, "#fff1d6");

    } else if (mode === "run") {
      runner(feet);
      if (day.level && t % (14 * SLOW) === 0) spawn(CX, top + 10, -speed * 0.8, -0.2, GH_COLORS[day.level - 1], "sq");
      if (day.pr) {
        const bob = Math.round(Math.sin(at / 8));
        px(CX - 3, top - 11 + bob, 19, 9, "#3d2e3f");
        px(CX - 2, top - 10 + bob, 17, 7, "#ffc95c");
        text("PR!", CX + 1, top - 9 + bob, "#3d2e3f");
        if (!reduced && prTimer > 0) { prTimer--; if (prTimer % 4 === 0) spawn(CX + 8 + (Math.random() - 0.5) * 30, top + (Math.random() - 0.5) * 16, (Math.random() - 0.5) * 0.8, -0.4 - Math.random() * 0.6, Math.random() < 0.5 ? "#ffc95c" : "#fff1d6", "star", 60); }
      }

    } else if (mode === "walk") {
      if (jumpY > 0) body("jump", jumpFrame(), FX, feet);
      else body("walk", Math.floor(at / 9) % 4, FX, feet);

    } else if (mode === "code") {
      px(70, 74, 38, 3, "#9a6a4c"); px(72, 77, 3, GROUND - 73, "#7a5038"); px(103, 77, 3, GROUND - 73, "#7a5038"); // desk
      px(98, 70, 4, 4, "#f7f2ff"); px(102, 71, 1, 2, "#f7f2ff");                                               // mug
      if (Math.floor(at / 20) % 2) px(99, 67, 1, 2, "#e6dccb");                                      // steam
      px(78, 72, 18, 2, "#a7a3b8"); px(80, 61, 14, 11, "#3d3a52"); px(81, 62, 12, 9, P.glow);                   // laptop
      for (let r = 0; r < 4; r++) if ((Math.floor(at / 12) + r) % 3) px(82, 63 + r * 2, 3 + ((r * 5 + Math.floor(at / 12)) % 7), 1, "#0e4429");
      body("idle", idle, FX - 4, FEET);
      const lvl = Math.max(1, day.level || 1);
      if (t % (Math.max(10, 34 - lvl * 6) * SLOW) === 0) spawn(86, 61, (Math.random() - 0.5) * 0.5, -0.5, GH_COLORS[lvl - 1], "sq");

    } else if (mode === "rest") {
      px(44, 80, 44, 3, "#9a6a4c"); px(46, 83, 3, GROUND - 79, "#7a5038"); px(83, 83, 3, GROUND - 79, "#7a5038"); // bench
      const breathe = Math.floor(at / 40) % 2;
      lyingDown(62, 70 - breathe);
      if (t % (70 * SLOW) === 0) spawn(54, 70, 0.2, -0.3, "#fff1d6", "z");
      // every so often the ghost drifts across the sky
      { ghostX -= 0.35 / SLOW; if (ghostX < -20) ghostX = W + 60 + Math.floor(hash(t) * 120); ghost(ghostX, 30 + Math.round(Math.sin(ghostX / 14) * 4)); }

    } else if (mode === "today") {
      if (jumpY > 0) body("jump", jumpFrame(), FX, feet);
      else body("idle", idle, FX, feet);
      px(78, 50, 22, 11, "#fff1d6"); px(80, 61, 3, 2, "#fff1d6");
      for (let i = 0; i < 3; i++) if (Math.floor(at / 15) % 4 > i) px(82 + i * 6, 55, 3, 2, "#3d2e3f");
    }
  }

  // Streak flame with the count, top left, on days that are part of the current streak.
  function drawStreak() {
    if (!day.streakDay || !day.streak) return;
    px(3, 3, 9 + String(day.streak).length * 4 + 4, 12, "rgba(61,46,63,.55)");
    sprite(reduced || Math.floor(at / 12) % 2 ? SPRITES.flame1 : SPRITES.flame2, 4, 5, 1, FLAME);
    text(day.streak, 13, 7, "#fff1d6");
  }

  function drawParticles() {
    parts.forEach(p => {
      p.x += p.vx / SLOW; p.y += p.vy / SLOW; p.life -= 1 / SLOW;
      if (p.kind === "dust") px(p.x, p.y, 1, 1, p.color);
      else if (p.kind === "sq") px(p.x, p.y, 3, 3, p.color);
      else if (p.kind === "star") { px(p.x, p.y - 1, 1, 3, p.color); px(p.x - 1, p.y, 3, 1, p.color); }
      else if (p.kind === "z") { px(p.x, p.y, 4, 1, p.color); px(p.x + 2, p.y + 1, 1, 1, p.color); px(p.x + 1, p.y + 2, 1, 1, p.color); px(p.x, p.y + 3, 4, 1, p.color); }
    });
    parts = parts.filter(p => p.life > 0 && p.y > -5);
  }

  // Changing days covers the scene in 8x8 blocks that disappear in a random order.
  function drawWipe() {
    if (wipe <= 0) return;
    for (let cy = 0; cy < H / 8; cy++) for (let cx = 0; cx < W / 8; cx++)
      if (hash(cx * 31 + cy * 17) < wipe) px(cx * 8, cy * 8, 8, 8, P.sky[0]);
    wipe -= 1 / 14;
  }

  function loop() {
    t++;
    at = t / SLOW;
    speed += (target - speed) * 0.06;
    scroll += speed;
    if (jumpY > 0 || vy > 0) { jumpY += vy / SLOW; vy -= 0.26 / SLOW; if (jumpY <= 0) { jumpY = 0; vy = 0; } }
    drawWorld();
    drawCharacter();
    drawParticles();
    drawStreak();
    drawWipe();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // ----- public controls -----
  // x: { mode, runs, level, phase, pr, streakDay, streak }
  function setMode(x) {
    day = x || {};
    mode = day.mode || "attract";
    phaseFromTheme = !day.phase;
    P = PHASES[day.phase] || PHASES[themePhase()];
    wipe = mode === "loading" || reduced ? 0 : 1;
    parts = [];
    ghostX = W + 10;
    prTimer = day.pr ? 90 : 0;
    const miles = (day.runs || []).filter(isRun).reduce((s, r) => s + (r.mi || 0), 0);   // a ride doesn't speed up the runner
    target = mode === "run" ? 0.9 + Math.min(miles, 6) * 0.16
           : mode === "walk" ? 0.36
           : mode === "attract" ? 1.1
           : mode === "loading" ? 2.1 : 0;
    if (reduced) target /= 3;   // the same scene, three times slower
    if (day.pr) sfx.pr();
  }

  // Click or space: jump, burst commits, or wake the sleeper.
  function action() {
    if (mode === "run" || mode === "walk" || mode === "today" || mode === "attract" || mode === "loading") {
      if (jumpY === 0) { vy = 3.3; sfx.jump(); }
    } else if (mode === "code") {
      if (!reduced) for (let i = 0; i < 10; i++) spawn(86 + Math.random() * 4, 64, (Math.random() - 0.5) * 1.2, -0.6 - Math.random() * 0.8, GH_COLORS[Math.floor(Math.random() * 4)], "sq");
      sfx.commit();
    } else if (mode === "rest") {
      for (let i = 0; i < 3; i++) spawn(52 + i * 3, 70 - i * 4, 0.25, -0.35, "#fff1d6", "z");
      sfx.snore();
    }
  }

  // Who's playing: a roster character from characters.js. Shows up as soon as its sheet loads.
  function setCharacter(character) {
    const want = wanted = character.side;
    loadImage(want)
      .then(img => { if (want === wanted) sheet = img; })   // ignore a slower, older pick
      .catch(e => console.warn(e.message));
  }

  return { setMode, setCharacter, action };
}
