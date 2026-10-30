// Your room: one cozy isometric room with your character in it and your school pennant on the wall.
// It has its own screen (#room in the address, see main.js).
//
// The art is Pixmod's own, in sprites/room/. room_manifest.json says where every piece goes, which tiles it
// blocks, what it does and at which room level it appears (see that folder's README). Everything is painted
// 1:1 into a hidden 256x256 buffer, then copied onto the screen canvas at a whole number of device pixels per
// room pixel (about 2x, or 3x on big screens), so pixels never get blurry or uneven.
//
// The camera: if the scaled room fits, it sits in the middle. If it doesn't (phones), it follows your
// character smoothly, stopped at the room's edges so there's never empty space past them.
//
// Your character lives on the floor (see roomfloor.js). Arrow keys or WASD walk it (a touch pad on phones),
// and clicking the floor sends it there. Standing still, it plays the front idle; walking, the side-view walk
// row, flipped when heading left. Left alone for a while, it wanders. Furniture and character are drawn in
// depth order, so it can walk behind the bed. Reduced motion: no wandering, but keys and clicks still work.
//
// Standing on a piece's interact tile shows a bubble: the closet opens the character picker (E or Enter),
// the door says it's locked until level 5.
//
// The room's level comes from your XP (see xp.js and main.js). Pieces show when their unlockLevel is at or
// below it, and after a level up the new ones drop in with a little bounce.
//
// Seasonal events (sprites/events/<id>/, listed in EVENTS) decorate the room while today is inside their
// `active` dates: their pieces follow the same rules, show at every level, and can replace a base piece.
//
// Your day shows too (sprites/today/, js/roomtoday.js): the monitor glows on coding days, shoes and a bottle
// appear after a run, a medal after a long one, a candle for a streak, a sparkle when you did both, and the
// room dims (zzz after 9pm) while nothing is logged yet. Reduced motion keeps the props but stills them.

import { drawPennant, cleanSchool } from "./art.js";
import { FRAME_MS, ROWS, drawFrame, loadImage as loadSprite } from "./characters.js";
import { createFloor, toScreen, toWorld, tileOf, tileMiddle } from "./roomfloor.js";
import { MAX_LEVEL } from "./xp.js";
import { drawText, textWidth } from "./font.js";
import { todayState, propShows, SCREEN_LOOKS, placeholderFrames } from "./roomtoday.js";

const DIR = "sprites/room/";
const EVENT_DIR = "sprites/events/";
const EVENTS = ["halloween"];         // each has sprites/events/<id>/<id>_manifest.json
const TODAY_DIR = "sprites/today/";
const SCROLL_MS = 260;                // the code lines on the monitor move up one row this often
const FLICKER_MS = 320;               // candle flame frames
const SPARK_MS = 600;                 // one sparkle, start to finish
const SPARK_EVERY = [2500, 5500];     // and a new one this often on a great day
const QUIET_IDLE = 1.6;               // nothing logged yet: the idle animation plays this much slower
const DIM = "rgba(40, 26, 52, 0.22)"; // and the room is a bit dimmer
const W = 256, H = 256;
const BIG = W * 3;                    // a room area at least this wide (CSS pixels) gets 3x instead of 2x

const DOOR_LEVEL = 5;                 // the door opens to a next room at this level
const POP_MS = 600;                   // how long new furniture takes to drop in after a level up

// Your school pennant: our own art (art.js), so it's drawn in code instead of coming from the manifest.
const PENNANT = { id: "pennant", layer: "wall", x: 31, y: 112, unlockLevel: 1 };

const SPEED = 24;                     // walking speed, in floor units a second (a tile is 10)
const WANDER_MS = [3000, 7000];       // stand somewhere between these before wandering again
const KEYS_REST_MS = 20000;           // after you walk it yourself, it waits this long before wandering
const CAMERA_EASE = 5;                // how quickly the camera catches up (bigger is snappier)
const FACE = { front: 16, right: 14, left: 18 };   // the middle of the feet, from the frame's left edge

// Arrow keys and WASD walk along the floor: up = up-right on screen (toward the window wall),
// right = down-right, down = down-left, left = up-left. Values are [dx, dy] in floor units.
const KEYS = {
  ArrowUp: [0, -1], w: [0, -1], ArrowRight: [1, 0], d: [1, 0],
  ArrowDown: [0, 1], s: [0, 1], ArrowLeft: [-1, 0], a: [-1, 0]
};

// Shown until you pick your own school.
const DEFAULT_SCHOOL = { name: "Pixel State", initials: "PS", c1: "#7a5fa8", c2: "#ffc95c" };

const loadImage = src => new Promise((ok, fail) => {
  const img = new Image();
  img.onload = () => ok(img);
  img.onerror = () => fail(new Error(`Couldn't load ${src}`));
  img.src = src;
});
const loadJson = path => fetch(path).then(r => { if (!r.ok) throw new Error(`Couldn't load ${path}`); return r.json(); });

// Is a seasonal event on today? active: { from: "10-25", to: "11-01" } (month-day, inclusive, local time).
// A range like "12-20" to "01-05" wraps past New Year.
const monthDay = d => `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export function eventActive(active, date = new Date()) {
  if (!active || !active.from || !active.to) return false;
  const t = monthDay(date);
  return active.from <= active.to ? t >= active.from && t <= active.to : t >= active.from || t <= active.to;
}

// Which year's season this is (a December-to-January event belongs to the year it started).
export function seasonOf(active, date = new Date()) {
  const y = date.getFullYear();
  return active.from > active.to && monthDay(date) <= active.to ? y - 1 : y;
}

// els: { bubble, bubbleText, open, pad } (the speech bubble, its Open button, and the touch arrow pad)
export function createRoom(canvas, els) {
  const buf = document.createElement("canvas");   // the room at 1:1
  buf.width = W;
  buf.height = H;
  const ctx = buf.getContext("2d");
  const view = canvas.getContext("2d");           // what you see: the size of the room area, in device pixels
  let k = 2;                                      // device pixels per room pixel

  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const touch = matchMedia("(pointer: coarse)");
  let manifest = null, imgs = null, masks = {}, sprites = null, wanted = null;
  let events = [], eventChoice = null;   // the seasonal events that loaded; eventChoice: null = by date, "none", or an id
  let todayCfg = null, today = todayState({}, 0, 0);   // sprites/today/today_manifest.json, and what you did today
  today.quiet = false;                // until main.js says otherwise, don't dim
  let spark = null, nextSpark = 0, beat = -1;
  let school = DEFAULT_SCHOOL, canWalk = true, level = 1, items = [], floor = createFloor([]);
  const pops = new Map();             // pieces dropping in right now: id -> when they started
  let onAction = () => {};

  // The character: where it stands, the path it's walking, which way it faces, and its animation.
  const me = { at: { x: 55, y: 75 }, path: [], walking: false, facing: 1, frame: 0, frameAt: 0, restUntil: 0 };
  const held = new Set();             // the arrow keys (and touch pad arrows) held down right now
  let keysAt = -Infinity;             // when you last walked it yourself
  const cam = { x: 0, y: 0, set: false };
  let offX = 0, offY = 0, dirty = true, near = null;

  // The room's manifest and art, then each seasonal event's. Every piece gets src, the path of its image.
  // A seasonal event that doesn't load is just skipped; the room itself never waits on one.
  const eventManifest = id => loadJson(`${EVENT_DIR}${id}/${id}_manifest.json`)
    .then(m => ({ ...m, id, items: m.items.map(i => ({ ...i, src: `${EVENT_DIR}${id}/${i.sprite}` })) }));
  const todayManifest = loadJson(TODAY_DIR + "today_manifest.json").catch(e => console.warn(e.message));
  const ready = Promise.all([loadJson(DIR + "room_manifest.json"), Promise.all(EVENTS.map(id => eventManifest(id).catch(e => console.warn(e.message)))), todayManifest])
    .then(async ([m, seasonal, t]) => {
      manifest = { ...m, items: m.items.map(i => ({ ...i, src: DIR + i.sprite })) };
      const files = [DIR + m.shell, ...new Set(manifest.items.map(i => i.src))];
      const loaded = Object.fromEntries(await Promise.all(files.map(async f => [f, await loadImage(f)])));
      for (const e of seasonal.filter(Boolean)) {
        try {
          for (const f of new Set(e.items.map(i => i.src))) loaded[f] = await loadImage(f);
          events.push(e);
        } catch (err) { console.warn(err.message); }
      }
      if (t) todayCfg = await loadToday(t, loaded);
      return loaded;
    });

  // Today's props: each gets frames (image keys), from its PNG if it has one, otherwise its placeholder.
  async function loadToday(t, loaded) {
    const art = async thing => {
      if (thing.sprite) {
        const src = TODAY_DIR + thing.sprite;
        try { loaded[src] = await loadImage(src); return [src]; } catch (e) { console.warn(e.message); }
      }
      return placeholderFrames(thing.art).map((c, i) => { const key = `today:${thing.art}:${i}`; loaded[key] = c; return key; });
    };
    const items = [];
    for (const i of t.items || []) {
      const frames = await art(i);
      if (frames.length) items.push({ ...i, frames, src: frames[0], w: loaded[frames[0]].width, h: loaded[frames[0]].height });
    }
    const zzz = t.zzz ? { ...t.zzz, frames: await art(t.zzz) } : null;
    return { items, screen: t.screen || null, zzz };
  }

  // The events decorating the room right now.
  const eventsOn = () => events.filter(e => (eventChoice == null ? eventActive(e.active) : eventChoice === e.id));

  // ----- the pieces in the room -----

  // Everything at or below the room's level, plus the pennant and any seasonal pieces. Each piece has, from the
  // manifest: id, sprite, layer (wall/floor/object), x, y (top-left in room pixels), unlockLevel,
  // and maybe blockedTiles {x, y, w, d}, depthY (for depth sorting), interact {action, tile, locked},
  // replaces (a seasonal piece that hides a base piece while it's up).
  function furnish() {
    const seasonal = eventsOn().flatMap(e => e.items);
    const replaced = new Set(seasonal.map(i => i.replaces).filter(Boolean));
    items = [PENNANT, ...manifest.items.filter(i => i.unlockLevel <= level && !replaced.has(i.id)), ...seasonal];
    const has = id => items.some(i => i.id === id);
    if (todayCfg) items.push(...todayCfg.items.filter(i => propShows(i, today, has)));
    floor = createFloor(items.filter(i => i.blockedTiles).map(i => i.blockedTiles));
    me.at = floor.settle(me.at);   // a new piece might stand where you are
    me.path = [];
    near = null;
    dirty = true;
  }

  const px = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };

  // The pennant is drawn flat at (0, 0). Move it to (x0, y0), then lean each 1-pixel column up the
  // left wall's slope (the walls rise 1 pixel for every 2 across). The initials move up as one flat block,
  // by the slope at the felt's middle, because shearing 3-pixel letters scrambles them.
  const onLeftWall = (x0, y0) => (x, y, w, h, c) => {
    for (let i = 0; i < w; i++) px(x0 + x + i, y0 + y - Math.floor((x + i) / 2), 1, h, c);
  };
  const lettersOnLeftWall = (x0, y0) => (x, y, w, h, c) => px(x0 + x, y0 + y - 5, w, h, c);

  function drawItem(it) {
    if (it === PENNANT) return drawPennant(onLeftWall(it.x, it.y), school, 0, 0, lettersOnLeftWall(it.x, it.y));
    const src = it.frames ? it.frames[reduced ? 0 : Math.floor(performance.now() / FLICKER_MS) % it.frames.length] : it.src;
    ctx.drawImage(imgs[src], it.x, it.y + popOffset(it.id));
    if (todayCfg && todayCfg.screen && it.id === todayCfg.screen.item && today.coded) drawScreen(todayCfg.screen);
    if (it.label === "streak") drawTag(String(today.streak), it.x + it.w + 2, it.y + it.h - 6);   // resting beside it
  }

  // A coding day: the monitor's screen lights up with green code lines that scroll up (still with reduced
  // motion), brighter on bigger days, with a soft glow over the bezel. The screen leans like the wall, so each
  // column is its own span of rows, and the lines lean with it.
  function drawScreen(sc) {
    const look = SCREEN_LOOKS[today.level - 1], scroll = reduced ? 0 : Math.floor(performance.now() / SCROLL_MS);
    sc.columns.forEach(([top, bottom], c) => {
      const x = sc.x + c;
      px(x, sc.y + top, 1, bottom - top + 1, look.bg);
      for (let r = top + 1; r < bottom; r++) {
        const line = r - top + scroll;
        if (line % 2) continue;                                // a gap between lines
        const n = Math.floor(line / 2), indent = (n * 3) % 4, len = 4 + (n * 5) % 9;
        if (c >= indent && c < indent + len) px(x, sc.y + r, 1, 1, look.line);
      }
      px(x, sc.y + top - 2, 1, 2, `rgba(143, 220, 174, ${look.glow})`);
      px(x, sc.y + bottom + 1, 1, 2, `rgba(143, 220, 174, ${look.glow})`);
    });
  }

  // A number on a little cream tag (the streak on the candle).
  function drawTag(text, x, y) {
    px(x - 1, y - 1, textWidth(text) + 2, 7, "#fff1d6");
    drawText(px, text, x, y, "#3d2e3f");
  }

  // A new piece falls from 12 pixels up, then bounces once. Whole pixels, so it stays crisp.
  function popOffset(id) {
    if (!pops.has(id)) return 0;
    const t = (performance.now() - pops.get(id)) / POP_MS;
    if (t >= 1) { pops.delete(id); return 0; }
    if (t < 0.6) return -Math.round(12 * (1 - t / 0.6) ** 2);
    return -Math.round(3 * Math.sin((t - 0.6) / 0.4 * Math.PI));
  }

  // Paint the room the way the README says: shell, wall pieces, floor pieces, then the objects and the
  // character sorted by depthY (the character's is the screen y of its feet).
  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(imgs[DIR + manifest.shell], 0, 0);
    items.filter(i => i.layer === "wall").forEach(drawItem);
    items.filter(i => i.layer === "floor").forEach(drawItem);
    const feet = toScreen(me.at.x, me.at.y).y;
    const objects = items.filter(i => i.layer === "object").sort((a, b) => a.depthY - b.depthY);
    objects.filter(i => i.depthY <= feet).forEach(drawItem);
    drawMe();
    objects.filter(i => i.depthY > feet).forEach(drawItem);
    drawDay();
  }

  // Over everything: the dim of a day with nothing logged yet, the sleepy zzz, a great day's sparkle.
  function drawDay() {
    if (today.quiet) {
      ctx.save();
      ctx.globalCompositeOperation = "source-atop";   // only over the room, not the empty space around it
      ctx.fillStyle = DIM;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    const feet = toScreen(me.at.x, me.at.y), fx = Math.round(feet.x), fy = Math.round(feet.y);
    if (today.night && !me.walking && sprites && todayCfg && todayCfg.zzz && todayCfg.zzz.frames.length) {
      const z = todayCfg.zzz, bob = reduced ? 0 : Math.floor(performance.now() / 700) % 2;
      ctx.drawImage(imgs[z.frames[0]], fx + z.dx, fy + z.dy - bob);
    }
    if (spark) {
      const t = (performance.now() - spark.at) / SPARK_MS;
      if (t >= 1) spark = null;
      else {
        const size = [1, 2, 3, 1][Math.floor(t * 4)], x = fx + spark.dx, y = fy + spark.dy;
        px(x - size, y, size * 2 + 1, 1, "#ffd76b");
        px(x, y - size, 1, size * 2 + 1, "#ffd76b");
        px(x, y, 1, 1, "#fff8d6");
      }
    }
  }

  // Whole pixels only: the feet land on a room pixel, whichever way it's facing.
  function drawMe() {
    if (!sprites) return;
    const feet = toScreen(me.at.x, me.at.y), x = Math.round(feet.x), y = Math.round(feet.y);
    if (me.walking) {
      const left = me.facing < 0;
      drawFrame(ctx, sprites.side, me.frame, ROWS.walk, x - (left ? FACE.left : FACE.right), y, left);
    } else {
      drawFrame(ctx, sprites.front, me.frame, 0, x - FACE.front, y);
    }
  }

  // Copy the room onto the screen canvas through the camera.
  function present() {
    offX = offset(canvas.width, W, cam.x);
    offY = offset(canvas.height, H, cam.y);
    view.imageSmoothingEnabled = false;   // resizing a canvas resets this, so set it every time
    view.clearRect(0, 0, canvas.width, canvas.height);
    view.drawImage(buf, offX, offY, W * k, H * k);
  }

  // Where the room's left (or top) edge goes on screen, in device pixels. Centered if it fits;
  // otherwise centered on what the camera looks at, but never past the room's edges.
  function offset(screen, size, focus) {
    const room = size * k;
    if (room <= screen) return Math.floor((screen - room) / 2);
    return -Math.min(Math.max(0, Math.round(focus * k - screen / 2)), room - screen);
  }

  // ----- moving -----

  function startWalking(now) {
    if (!me.walking) { me.walking = true; me.frame = 0; me.frameAt = now; }
  }
  function stopWalking(now) {
    if (me.walking) { me.walking = false; me.frame = 0; me.frameAt = now; }
  }

  function walkTo(target) {
    const path = floor.findPath(me.at, target);
    if (!path) return false;
    me.path = path;
    startWalking(performance.now());
    dirty = true;
    return true;
  }

  const rest = now => { me.restUntil = now + WANDER_MS[0] + Math.random() * (WANDER_MS[1] - WANDER_MS[0]); };

  // Which way the held keys point, as [dx, dy] (0, 0 when none are held).
  function heldDirection() {
    let dx = 0, dy = 0;
    held.forEach(key => { dx += KEYS[key][0]; dy += KEYS[key][1]; });
    return [Math.sign(dx), Math.sign(dy)];
  }

  // Which way that is on screen: + right, - left (straight up or down keeps the old facing).
  const face = (dx, dy) => { const across = dx - dy; if (Math.abs(across) > 0.01) me.facing = across > 0 ? 1 : -1; };

  // One step of the world: walk with the keys or along the path, turn the animation, wander after a rest.
  function update(now, dt) {
    const [kx, ky] = canWalk ? heldDirection() : [0, 0];
    if (kx || ky) {
      keysAt = now;
      me.path = [];
      const n = Math.hypot(kx, ky), step = SPEED * dt;
      const to = floor.move(me.at, kx / n * step, ky / n * step);
      face(kx, ky);
      if (to !== me.at) { me.at = to; startWalking(now); }
      else stopWalking(now);   // walking into a wall: stand and face it
      dirty = true;
    } else if (me.path.length) {
      let step = SPEED * dt;
      while (step > 0 && me.path.length) {
        const to = me.path[0], dx = to.x - me.at.x, dy = to.y - me.at.y, d = Math.hypot(dx, dy);
        face(dx, dy);
        if (d <= step) { me.at = to; me.path.shift(); step -= d; }
        else { me.at = { x: me.at.x + dx / d * step, y: me.at.y + dy / d * step }; step = 0; }
      }
      if (!me.path.length) { stopWalking(now); rest(now); }
      dirty = true;
    } else {
      if (me.walking) { stopWalking(now); rest(now); dirty = true; }
      if (!reduced && now >= me.restUntil && now - keysAt >= KEYS_REST_MS) {
        const spot = floor.randomSpot(me.at);
        if (!spot || !walkTo(spot)) rest(now);
      }
    }

    const ms = me.walking ? FRAME_MS.walk : FRAME_MS.idle * (today.quiet ? QUIET_IDLE : 1);
    if ((me.walking || !reduced) && now - me.frameAt >= ms) {
      me.frame = (me.frame + 1) % 4;
      me.frameAt = now;
      dirty = true;
    }
  }

  // The camera looks at the character's middle and catches up smoothly (instantly with reduced motion).
  function follow(dt) {
    const feet = toScreen(me.at.x, me.at.y), tx = feet.x, ty = feet.y - 15;
    if (!cam.set || reduced) { cam.x = tx; cam.y = ty; cam.set = true; return; }
    const a = 1 - Math.exp(-CAMERA_EASE * dt);
    cam.x += (tx - cam.x) * a;
    cam.y += (ty - cam.y) * a;
  }

  // ----- the bubble over the closet and the door -----

  // The piece whose interact tile you're standing on (only the ones that do something yet).
  function pieceHere() {
    if (!canWalk) return null;
    const [tx, ty] = tileOf(me.at);
    return items.find(i => i.interact && (i.interact.action === "closet" || i.interact.action === "next_room") &&
      i.interact.tile[0] === tx && i.interact.tile[1] === ty) || null;
  }

  function bubbleFor(it) {
    if (it.interact.action === "closet") return { text: "Press E", button: "Open" };
    return { text: level >= DOOR_LEVEL ? "Coming soon" : `Locked, reach level ${DOOR_LEVEL}` };
  }

  // Show, hide or move the bubble. It sits above the piece, in the canvas's CSS pixels.
  function updateBubble() {
    const it = pieceHere();
    if (it !== near) {
      near = it;
      els.bubble.hidden = !it;
      if (it) {
        const b = bubbleFor(it), tap = !!b.button && touch.matches;
        els.bubbleText.textContent = tap ? "" : b.text;
        els.bubbleText.hidden = tap;
        els.open.textContent = b.button || "";
        els.open.hidden = !tap;
      }
    }
    if (!it) return;
    const css = canvas.clientWidth / canvas.width;   // CSS pixels per device pixel
    els.bubble.style.left = `${Math.round((offX + (it.x + it.w / 2) * k) * css)}px`;
    els.bubble.style.top = `${Math.round((offY + it.y * k) * css)}px`;
  }

  // E, Enter or the Open button: use the piece you're standing at.
  function use() {
    const it = pieceHere();
    if (!it || it.interact.action !== "closet") return false;
    held.clear();   // a box opens over the room, so stop walking
    onAction(it.interact.action);
    return true;
  }

  let last = 0;
  function tick(now) {
    requestAnimationFrame(tick);
    const dt = Math.min(0.1, (now - (last || now)) / 1000);
    last = now;
    if (!canvas.clientWidth) { held.clear(); return; }   // the room screen is closed
    update(now, dt);
    follow(dt);
    if (pops.size) dirty = true;   // furniture dropping in
    dayTick(now);
    if (dirty) { draw(); dirty = false; }
    present();
    updateBubble();
  }

  // Today's moving bits: a new sparkle now and then on a great day, and a redraw every 100 ms while
  // something moves (the code lines, the candle flame, the zzz, a sparkle). Reduced motion: nothing moves.
  function dayTick(now) {
    if (reduced) return;
    if (today.coded && today.ran && now >= nextSpark) {
      if (nextSpark) spark = { at: now, dx: Math.round(Math.random() * 28 - 14), dy: -Math.round(20 + Math.random() * 22) };
      nextSpark = now + SPARK_EVERY[0] + Math.random() * (SPARK_EVERY[1] - SPARK_EVERY[0]);
    }
    const moving = today.coded || today.night || spark || items.some(i => i.frames && i.frames.length > 1);
    const b = Math.floor(now / 100);
    if (moving && b !== beat) { beat = b; dirty = true; }
  }

  ready.then(loaded => {
    imgs = loaded;
    me.at = tileMiddle(manifest.spawnTile || [5, 7]);
    furnish();
    masks = alphaMasks();
    rest(performance.now());
    requestAnimationFrame(tick);
  }).catch(e => console.warn(e.message));

  // ----- keys, the touch pad and clicks -----

  // The room takes the keys only while it's on screen, yours, and no box is open over it.
  const listening = () => !!(imgs && canWalk && canvas.clientWidth && !document.querySelector("dialog[open]"));
  const keyName = e => (e.key.length === 1 ? e.key.toLowerCase() : e.key);

  document.addEventListener("keydown", e => {
    if (!listening() || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest && e.target.closest("input, textarea, select")) return;
    const key = keyName(e);
    if (KEYS[key]) { e.preventDefault(); held.add(key); return; }
    // Enter on a button presses that button; E works anywhere.
    if ((key === "e" || (key === "Enter" && !(e.target.closest && e.target.closest("button, a")))) && use()) e.preventDefault();
  });
  document.addEventListener("keyup", e => held.delete(keyName(e)));
  window.addEventListener("blur", () => held.clear());

  // The touch pad: hold an arrow to walk. Each button's data-key is the arrow key it stands for.
  els.pad.querySelectorAll("button").forEach(b => {
    const key = b.dataset.key, up = () => held.delete(key);
    b.addEventListener("pointerdown", e => {
      e.preventDefault();
      held.add(key);
      try { b.setPointerCapture(e.pointerId); } catch (err) { /* keeps walking until pointerup anyway */ }
    });
    ["pointerup", "pointercancel", "lostpointercapture"].forEach(t => b.addEventListener(t, up));
    b.addEventListener("contextmenu", e => e.preventDefault());   // a long press shouldn't open a menu
  });
  els.open.addEventListener("click", use);

  // Each piece's see-through pixels, so a click can tell the closet from the floor behind it.
  function alphaMasks() {
    const out = {};
    try {
      Object.entries(imgs).forEach(([file, img]) => {
        const c = document.createElement("canvas");
        c.width = img.width;
        c.height = img.height;
        const x = c.getContext("2d");
        x.drawImage(img, 0, 0);
        out[file] = x.getImageData(0, 0, img.width, img.height).data;
      });
    } catch (e) { /* can't read pixels (opened as a file): clicks just go to the floor */ }
    return out;
  }

  // The front-most piece at room pixel (x, y), not counting the rug and the room itself.
  function pieceAt(x, y) {
    const hit = it => {
      const m = masks[it.src], img = imgs[it.src];
      if (!m || it === PENNANT || x < it.x || y < it.y || x >= it.x + img.width || y >= it.y + img.height) return false;
      return m[((y - it.y) * img.width + (x - it.x)) * 4 + 3] > 0;
    };
    const objects = items.filter(i => i.layer === "object").sort((a, b) => b.depthY - a.depthY);
    return objects.find(hit) || items.filter(i => i.layer === "wall").reverse().find(hit) || null;
  }

  canvas.addEventListener("click", e => {
    if (!canWalk || !imgs) return;
    const r = canvas.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) * canvas.width / r.width - offX) / k);
    const y = Math.floor(((e.clientY - r.top) * canvas.height / r.height - offY) / k);
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    keysAt = performance.now() - KEYS_REST_MS + 2000;   // stay put a little longer after a click
    const it = pieceAt(x, y);
    if (it) { if (it.interact) walkTo(tileMiddle(it.interact.tile)); return; }   // the closet: go stand at it
    const p = toWorld(x + 0.5, y + 0.5);
    if (floor.inside(p.x, p.y)) walkTo(floor.settle(p));
  });

  // CSS stretches the canvas over the whole room area. Match its pixels to the screen's real pixels,
  // and pick the scale: 2x, or 3x when the area is big. (Counting device pixels keeps it crisp on
  // screens set to 125% or 150%, where 2x becomes 2.5 device pixels and gets rounded to 3.)
  function fit(entries) {
    const dpr = window.devicePixelRatio || 1;
    const size = entries && entries[0].devicePixelContentBoxSize && entries[0].devicePixelContentBoxSize[0];
    canvas.width = size ? size.inlineSize : Math.round(canvas.clientWidth * dpr);
    canvas.height = size ? size.blockSize : Math.round(canvas.clientHeight * dpr);
    k = Math.max(1, Math.round((canvas.clientWidth >= BIG ? 3 : 2) * dpr));
    cam.set = false;   // jump straight to the character after a resize
    dirty = true;
  }
  const watch = new ResizeObserver(fit);
  try { watch.observe(canvas, { box: "device-pixel-content-box" }); }   // exact device pixels where supported
  catch (e) { watch.observe(canvas); }

  // Dress the room: a roster character (see characters.js) and your school (null for the default).
  // visitor: it's someone else's room (a peek), so the character wanders but you can't steer it.
  function setPlayer(character, sch, visitor = false) {
    school = cleanSchool(sch) || DEFAULT_SCHOOL;
    canWalk = !visitor;
    canvas.style.cursor = canWalk ? "pointer" : "";
    els.pad.hidden = !canWalk;
    held.clear();
    dirty = true;
    const want = wanted = character;
    Promise.all([loadSprite(character.front), loadSprite(character.side)])
      .then(([front, side]) => { if (want === wanted) { sprites = { front, side }; dirty = true; } })   // ignore a slower, older pick
      .catch(e => console.warn(e.message));
  }

  // Show the room at another level (1 to MAX_LEVEL): pieces appear or go, and the floor changes with them.
  function setLevel(n) {
    const want = Math.max(1, Math.min(MAX_LEVEL, Math.round(n) || 1));
    if (want === level && items.length) return;   // nothing changes
    level = want;
    if (manifest) furnish();
  }

  // Drop these pieces in (after a level up). Reduced motion: they're simply there.
  function popIn(ids) {
    if (reduced) return;
    const now = performance.now();
    ids.forEach(id => pops.set(id, now));
    dirty = true;
  }

  // The ids of the pieces that arrive at each level from `above`+1 up to `upTo` (for the banner and the info box).
  const piecesBetween = (above, upTo) => ready.then(() =>
    manifest.items.filter(i => i.unlockLevel > above && i.unlockLevel <= upTo)
      .sort((a, b) => a.unlockLevel - b.unlockLevel).map(i => i.id)).catch(() => []);

  // Put the character at a piece's interact tile, standing still and facing you (after the closet).
  function standAt(id) {
    const it = items.find(i => i.id === id && i.interact);
    if (!it) return;
    const now = performance.now();
    me.at = floor.settle(tileMiddle(it.interact.tile));
    me.path = [];
    stopWalking(now);
    keysAt = now;   // stay there a while to show off the new look
    cam.set = false;
    dirty = true;
  }

  // Dev only: "none" hides every seasonal event, an id shows that one whatever the date, null goes by date.
  function setEvent(choice) {
    eventChoice = choice || null;
    if (manifest) furnish();
  }

  // The seasonal events on right now, for the banner: [{ id, name, banner, season (the year) }].
  const currentEvents = () => ready.then(() =>
    eventsOn().map(e => ({ id: e.id, name: e.name, banner: e.banner, season: seasonOf(e.active) }))).catch(() => []);

  // What you (or the person you're peeking at) did today: see todayState() in roomtoday.js.
  function setToday(state) {
    const before = JSON.stringify(today);
    today = state;
    if (JSON.stringify(state) === before) return;
    if (!today.coded || !today.ran) spark = null;
    if (manifest) furnish();
    dirty = true;
  }

  return { setPlayer, setLevel, popIn, piecesBetween, setEvent, currentEvents, setToday, standAt, onAction: fn => (onAction = fn) };
}
