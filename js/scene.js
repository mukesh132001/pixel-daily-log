// The pixel world. A 192x108 canvas, redrawn about 60 times a second.
// Modes: attract (start screen), loading, run, code, rest, today.

import { GH_COLORS } from "./github.js";
import { sfx } from "./sound.js";

const W = 192, H = 108;
const GROUND = 90;   // y position of the runner's feet
const CX = 56;       // x position of the character

const PALETTES = {
  night: { sky: ["#1b1442", "#2a1d5c", "#3d2a74", "#5a3a86"], orb: "#fff1d0", far: "#2e2563", bld: "#231b4f", win: "#ffd23f", grass: "#2f7a3e", grassTop: "#4fa356", track: "#9c4436", lane: "#e9b8a6", field: "#2a6a37", glow: "#39d353" },
  day:   { sky: ["#7fc8ff", "#9fd8ff", "#c2e8ff", "#ffe3b8"], orb: "#ffd23f", far: "#8dbbe2", bld: "#6b9bd0", win: "#d9eeff", grass: "#4fae4a", grassTop: "#7bd160", track: "#d0603f", lane: "#ffe6d6", field: "#46a043", glow: "#26a641" }
};

// Sprites are drawn as text: each letter is a color, dots are empty.
const COLORS = { H: "#2b1b14", S: "#c98a5c", T: "#ff7a45", P: "#2a2140", K: "#fff1d0" };
const SPRITES = {
  run1: ["..HHH...", "..HSS...", "..SSS...", "...S....", ".TTTTS..", "S.TTT...", "..PPP...", "..P.P...", ".P...P..", "K.....K."],
  run2: ["..HHH...", "..HSS...", "..SSS...", "...S....", "..TTT...", "..STTS..", "..PPP...", "...PP...", "...PP...", "...KK..."],
  idle: ["..HHH...", "..HSS...", "..SSS...", "...S....", ".TTTTT..", "S.TTT.S.", "..PPP...", "..P.P...", "..P.P...", ".KK.KK.."],
  wave: ["..HHH..S", "..HSS..S", "..SSS.T.", "...S.T..", ".TTTTT..", "S.TTT...", "..PPP...", "..P.P...", "..P.P...", ".KK.KK.."]
};

// Same input always gives the same "random" number, so buildings don't flicker.
const hash = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

function isNight() {
  const t = document.documentElement.getAttribute("data-theme");
  if (t === "dark") return true;
  if (t === "light") return false;
  return matchMedia("(prefers-color-scheme: dark)").matches;
}

export function createScene(canvas) {
  const ctx = canvas.getContext("2d");
  canvas.width = W;
  canvas.height = H;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  let P = PALETTES[isNight() ? "night" : "day"];
  const refreshPalette = () => { P = PALETTES[isNight() ? "night" : "day"]; };
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", refreshPalette);
  new MutationObserver(refreshPalette).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  const stars = Array.from({ length: 34 }, (_, i) => ({ x: Math.floor(hash(i) * W), y: Math.floor(hash(i + 99) * 58), p: Math.floor(hash(i + 7) * 90) }));

  let mode = "attract", day = null, t = 0, scroll = 0, speed = 0, target = 1.4;
  let jumpY = 0, vy = 0, parts = [], wipe = 0;

  // ----- drawing helpers -----
  const px = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
  function sprite(s, x, y, scale, shirt) {
    for (let r = 0; r < s.length; r++) for (let c = 0; c < s[r].length; c++) {
      const ch = s[r][c];
      if (ch === ".") continue;
      px(x + c * scale, y + r * scale, scale, scale, ch === "T" && shirt ? shirt : COLORS[ch]);
    }
  }
  const spawn = (x, y, vx, vy2, color, kind) => parts.push({ x, y, vx, vy: vy2, color, kind, life: 110 });

  // ----- layers -----
  function drawWorld() {
    const bandH = 17;
    P.sky.forEach((c, i) => px(0, i * bandH, W, bandH + 1, c));
    for (let i = 1; i < P.sky.length; i++) for (let x = 0; x < W; x += 2) px(x + (i % 2), i * bandH - 1, 1, 1, P.sky[i]);

    if (isNight()) {
      stars.forEach(s => { if (reduced || (t + s.p) % 90 > 6) px(s.x, s.y, 1, 1, P.orb); });
      px(150, 10, 10, 10, P.orb); px(154, 10, 6, 6, P.sky[0]);          // moon
    } else {
      px(148, 9, 12, 12, P.orb); px(146, 11, 16, 8, P.orb); px(150, 7, 8, 16, P.orb); // sun
    }

    // far hills move slowest (parallax)
    const fo = scroll * 0.15;
    for (let x = 0; x < W; x += 2) {
      const h = Math.round((12 + 6 * Math.sin((x + fo) / 19) + 3 * Math.sin((x + fo) / 7)) / 2) * 2;
      px(x, 72 - h, 2, h + 8, P.far);
    }

    // buildings move a bit faster
    const so = scroll * 0.4, step = 24, base = Math.floor(so / step), off = so % step;
    for (let j = -1; j <= W / step + 1; j++) {
      const i = base + j, h = 12 + Math.floor(hash(i) * 18), x = j * step - off;
      px(x, 78 - h, 18, h, P.bld);
      for (let wy = 78 - h + 3; wy < 74; wy += 5) for (let wx = 3; wx < 16; wx += 5)
        if (hash(i * 13 + wx * 7 + wy) > (isNight() ? 0.45 : 0.7)) px(x + wx, wy, 2, 2, P.win);
    }

    // ground and track move at full speed
    px(0, 78, W, 12, P.grass); px(0, 78, W, 2, P.grassTop);
    px(0, GROUND - 4, W, 16, P.track);
    const lo = scroll % 14;
    for (let x = -14; x < W + 14; x += 14) px(x - lo, GROUND + 3, 7, 1, P.lane);
    px(0, GROUND + 12, W, H - GROUND - 12, P.field);
  }

  function drawCharacter() {
    const top = GROUND - 20 - Math.round(jumpY);

    if (mode === "run" || mode === "attract" || mode === "loading") {
      const per = Math.max(3, 9 - Math.round(speed * 2.5));
      const frame = jumpY > 0 ? SPRITES.run1 : (Math.floor(t / per) % 2 ? SPRITES.run1 : SPRITES.run2);
      sprite(frame, CX, top, 2);
      if (!reduced && t % 6 === 0) spawn(CX + 2, GROUND - 2, -speed * 0.6, -0.15, P.lane, "dust");
      if (mode === "run" && day && day.level && t % 14 === 0) spawn(CX, top + 10, -speed * 0.8, -0.2, GH_COLORS[day.level - 1], "sq");
      if (mode === "loading") for (let i = 0; i < 3; i++) if (Math.floor(t / 10) % 4 > i) px(84 + i * 6, 40, 3, 3, P.orb);

    } else if (mode === "code") {
      px(70, 74, 38, 3, "#8a5a3c"); px(72, 77, 3, GROUND - 73, "#6d452d"); px(103, 77, 3, GROUND - 73, "#6d452d"); // desk
      px(78, 72, 18, 2, "#9aa0b5"); px(80, 61, 14, 11, "#3a3f55"); px(81, 62, 12, 9, P.glow);                   // laptop
      for (let r = 0; r < 4; r++) if ((Math.floor(t / 12) + r) % 3) px(82, 63 + r * 2, 3 + ((r * 5 + Math.floor(t / 12)) % 7), 1, "#0e4429");
      sprite(SPRITES.idle, CX - 4, GROUND - 20, 2, "#5fa8ff");
      const lvl = Math.max(1, (day && day.level) || 1);
      if (!reduced && t % Math.max(10, 34 - lvl * 6) === 0) spawn(86, 61, (Math.random() - 0.5) * 0.5, -0.5, GH_COLORS[lvl - 1], "sq");

    } else if (mode === "rest") {
      px(44, 80, 44, 3, "#8a5a3c"); px(46, 83, 3, GROUND - 79, "#6d452d"); px(83, 83, 3, GROUND - 79, "#6d452d"); // bench
      const breathe = reduced ? 0 : Math.floor(t / 40) % 2;
      px(46, 74 + breathe, 6, 2, COLORS.H); px(46, 76 + breathe, 6, 4 - breathe, COLORS.S);
      px(52, 75, 14, 5, COLORS.T); px(66, 76, 8, 4, COLORS.P); px(74, 77, 6, 3, COLORS.S); px(80, 76, 4, 4, COLORS.K);
      if (!reduced && t % 70 === 0) spawn(54, 70, 0.2, -0.3, P.orb, "z");

    } else if (mode === "today") {
      const frame = Math.floor(t / 22) % 2 && !reduced ? SPRITES.wave : SPRITES.idle;
      sprite(frame, CX, top, 2);
      px(78, 50, 22, 11, "#fff1d0"); px(80, 61, 3, 2, "#fff1d0");      // speech bubble
      for (let i = 0; i < 3; i++) if (reduced || Math.floor(t / 15) % 4 > i) px(82 + i * 6, 55, 3, 2, "#2a2140");
    }
  }

  function drawParticles() {
    parts.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.life--;
      if (p.kind === "dust") px(p.x, p.y, 1, 1, p.color);
      else if (p.kind === "sq") px(p.x, p.y, 3, 3, p.color);
      else if (p.kind === "z") { px(p.x, p.y, 4, 1, p.color); px(p.x + 2, p.y + 1, 1, 1, p.color); px(p.x + 1, p.y + 2, 1, 1, p.color); px(p.x, p.y + 3, 4, 1, p.color); }
    });
    parts = parts.filter(p => p.life > 0 && p.y > -5);
  }

  // Changing days covers the scene in 8x8 blocks that disappear in a random order.
  function drawWipe() {
    if (wipe <= 0) return;
    for (let cy = 0; cy < H / 8; cy++) for (let cx = 0; cx < W / 8; cx++)
      if (hash(cx * 31 + cy * 17) < wipe) px(cx * 8, cy * 8, 8, 8, P.sky[0]);
    wipe -= reduced ? 1 : 1 / 14;
  }

  function loop() {
    t++;
    speed += (target - speed) * 0.06;   // ease toward the target speed
    scroll += speed;
    if (jumpY > 0 || vy > 0) { jumpY += vy; vy -= 0.26; if (jumpY <= 0) { jumpY = 0; vy = 0; } }
    drawWorld();
    drawCharacter();
    drawParticles();
    drawWipe();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // ----- public controls -----
  function setMode(x) {
    day = x;
    mode = x.mode;
    wipe = mode === "loading" ? 0 : 1;
    parts = [];
    const miles = (x.runs || []).reduce((s, r) => s + r.mi, 0);
    target = mode === "run" ? 1.1 + Math.min(miles, 6) * 0.2
           : mode === "attract" ? 1.4
           : mode === "loading" ? 2.6 : 0;
    if (reduced) target = target ? 0.3 : 0;
  }

  // Click or space: jump, burst commits, or snore, depending on the day.
  function action() {
    if (mode === "run" || mode === "today" || mode === "attract" || mode === "loading") {
      if (jumpY === 0) { vy = 3.3; sfx.jump(); }
    } else if (mode === "code") {
      for (let i = 0; i < 10; i++) spawn(86 + Math.random() * 4, 64, (Math.random() - 0.5) * 1.2, -0.6 - Math.random() * 0.8, GH_COLORS[Math.floor(Math.random() * 4)], "sq");
      sfx.commit();
    } else if (mode === "rest") {
      for (let i = 0; i < 3; i++) spawn(52 + i * 3, 70 - i * 4, 0.25, -0.35, P.orb, "z");
      sfx.snore();
    }
  }

  return { setMode, action };
}
