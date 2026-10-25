// Your room: one cozy isometric room with your character in it and your school pennant on the wall.
// It has its own screen (#room in the address, see main.js).
//
// The room and furniture are PNGs cut from the ToffeeCraft pack (see sprites/room/CREDITS.md). They're painted
// 1:1 into a hidden 323x256 buffer, then copied onto the screen canvas at a whole number of device pixels per
// room pixel (about 2x, or 3x on big screens), so pixels never get blurry or uneven.
//
// The camera: if the scaled room fits, it sits in the middle. If it doesn't (phones), it follows your
// character smoothly, stopped at the room's edges so there's never empty space past them.
//
// Your character lives on the floor (see roomfloor.js). Standing still, it plays the front idle; walking,
// the side-view walk row, flipped when heading left. Every few seconds it wanders somewhere new, and in
// your own room you can click the floor to send it there. Furniture and character are drawn in depth
// order, so it can walk behind the bed. Reduced motion: no wandering, but clicking still works.

import { drawPennant, cleanSchool } from "./art.js";
import { FRAME_MS, ROWS, drawFrame, loadImage as loadSprite } from "./characters.js";
import { createFloor, toScreen, toFloor, inFront } from "./roomfloor.js";

const W = 323, H = 256;
const PENNANT_SCALE = 2;    // the felt pennant at 2x, so it reads at room size
const WALL_SLOPE = 3 / 8;   // the walls rise 3 pixels for every 8 across

// Furniture, painted in this order (later pieces cover earlier ones, so list back to front).
// Every piece in the pack faces the right wall; flip mirrors it onto the left wall.
// foot: where it stands on the floor, as [u0, u1, v0, v1] (see roomfloor.js); the character walks around it.
// flat: lies on the floor and never covers the character. on: sits on another piece and moves with it.
const PLACES = [
  { img: "window",   x: 248, y: 48 },
  { img: "bookcase", x: 176, y: 92,  foot: [14, 36, 0, 8] },
  { img: "desk",     x: 50,  y: 120, foot: [0, 11, 45, 104], flip: true },
  { img: "laptop",   x: 78,  y: 112, on: "desk" },
  { img: "lamp",     x: 222, y: 114, foot: [67, 78, 9, 20] },
  { img: "rug",      x: 104, y: 165, flat: true },
  { img: "bed",      x: 240, y: 138, foot: [97, 129, 0, 26] },
  { img: "chair",    x: 112, y: 150, foot: [40, 58, 78, 97] },
  { img: "plant",    x: 22,  y: 146, foot: [8, 22, 136, 147] }
];
const PENNANT = { x: 58, y: 80 };     // on the left wall, above the desk
const START = { u: 91, v: 95 };       // on the rug, where you first find your character
const BIG = W * 3;                    // a room area at least this wide (CSS pixels) gets 3x instead of 2x

const SPEED = 22;                     // walking speed, in floor units a second (calm)
const WANDER_MS = [3000, 7000];       // stand somewhere between these before wandering again
const CAMERA_EASE = 5;                // how quickly the camera catches up (bigger is snappier)
const FACE = { front: 16, right: 14, left: 18 };   // the middle of the feet, from the frame's left edge

// Shown until you pick your own school.
const DEFAULT_SCHOOL = { name: "Pixel State", initials: "PS", c1: "#7a5fa8", c2: "#ffc95c" };

const loadImage = name => new Promise((ok, fail) => {
  const img = new Image();
  img.onload = () => ok(img);
  img.onerror = () => fail(new Error(`Couldn't load sprites/room/${name}.png`));
  img.src = `sprites/room/${name}.png`;
});

export function createRoom(canvas) {
  const buf = document.createElement("canvas");   // the room at 1:1
  buf.width = W;
  buf.height = H;
  const ctx = buf.getContext("2d");
  const view = canvas.getContext("2d");           // what you see: the size of the room area, in device pixels
  let k = 2;                                      // device pixels per room pixel

  const names = ["room", ...new Set(PLACES.map(p => p.img))];
  const ready = Promise.all(names.map(loadImage)).then(imgs => Object.fromEntries(names.map((n, i) => [n, imgs[i]])));
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const floor = createFloor(PLACES.filter(p => p.foot).map(p => p.foot));
  let imgs = null, sprites = null, wanted = null, school = DEFAULT_SCHOOL, canWalk = true, solid = null;

  // The character: where it stands, the path it's walking, which way it faces, and its animation.
  const me = { at: floor.settle(START), path: [], facing: 1, frame: 0, frameAt: 0, restUntil: 0 };
  const cam = { x: 0, y: 0, set: false };
  let offX = 0, offY = 0, dirty = true;

  const px = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };

  // The pennant is drawn flat at (0, 0). Blow it up to PENNANT_SCALE, move it to (x0, y0),
  // then lean each 1-pixel column up the left wall's slope.
  const onLeftWall = (x0, y0) => (x, y, w, h, c) => {
    const k = PENNANT_SCALE;
    for (let i = 0; i < w * k; i++) {
      const col = x * k + i;
      px(x0 + col, y0 + y * k - Math.floor(col * WALL_SLOPE), 1, h * k, c);
    }
  };

  function sprite(target, img, x, y, flip) {
    if (!flip) return target.drawImage(img, x, y);
    target.save();
    target.translate(x + img.width, y);
    target.scale(-1, 1);
    target.drawImage(img, 0, 0);
    target.restore();
  }

  // Does this piece cover the character right now? (The laptop goes wherever the desk goes.)
  const byName = name => PLACES.find(p => p.img === name);
  const covers = p => (p.foot ? inFront(p.foot, me.at) : p.on ? covers(byName(p.on)) : false);

  // Paint the room: furniture behind the character, then the character, then furniture in front of it.
  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(imgs.room, 0, 0);
    drawPennant(onLeftWall(PENNANT.x, PENNANT.y), school, 0, 0);   // hangs perfectly still
    const front = PLACES.filter(covers);
    PLACES.forEach(p => { if (!front.includes(p)) sprite(ctx, imgs[p.img], p.x, p.y, p.flip); });
    drawMe();
    front.forEach(p => sprite(ctx, imgs[p.img], p.x, p.y, p.flip));
  }

  // Whole pixels only: the feet land on a room pixel, whichever way it's facing.
  function drawMe() {
    if (!sprites) return;
    const feet = toScreen(me.at.u, me.at.v), x = Math.round(feet.x), y = Math.round(feet.y);
    if (me.path.length) {
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

  function walkTo(target) {
    const path = floor.findPath(me.at, target);
    if (!path) return false;
    if (!me.path.length) { me.frame = 0; me.frameAt = performance.now(); }
    me.path = path;
    dirty = true;
    return true;
  }

  const rest = now => { me.restUntil = now + WANDER_MS[0] + Math.random() * (WANDER_MS[1] - WANDER_MS[0]); };

  // One step of the world: walk along the path, turn the animation, wander after a rest.
  function update(now, dt) {
    if (me.path.length) {
      let step = SPEED * dt;
      while (step > 0 && me.path.length) {
        const to = me.path[0], du = to.u - me.at.u, dv = to.v - me.at.v, d = Math.hypot(du, dv);
        const across = du - dv;                    // which way that is on screen: + right, - left
        if (Math.abs(across) > 0.01) me.facing = across > 0 ? 1 : -1;
        if (d <= step) { me.at = to; me.path.shift(); step -= d; }
        else { me.at = { u: me.at.u + du / d * step, v: me.at.v + dv / d * step }; step = 0; }
      }
      if (!me.path.length) { me.frame = 0; me.frameAt = now; rest(now); }
      dirty = true;
    } else if (!reduced && now >= me.restUntil) {
      const spot = floor.randomSpot(me.at);
      if (!spot || !walkTo(spot)) rest(now);
    }

    const ms = me.path.length ? FRAME_MS.walk : FRAME_MS.idle;
    if ((me.path.length || !reduced) && now - me.frameAt >= ms) {
      me.frame = (me.frame + 1) % 4;
      me.frameAt = now;
      dirty = true;
    }
  }

  // The camera looks at the character's middle and catches up smoothly (instantly with reduced motion).
  function follow(dt) {
    const feet = toScreen(me.at.u, me.at.v), tx = feet.x, ty = feet.y - 15;
    if (!cam.set || reduced) { cam.x = tx; cam.y = ty; cam.set = true; return; }
    const a = 1 - Math.exp(-CAMERA_EASE * dt);
    cam.x += (tx - cam.x) * a;
    cam.y += (ty - cam.y) * a;
  }

  let last = 0;
  function tick(now) {
    requestAnimationFrame(tick);
    const dt = Math.min(0.1, (now - (last || now)) / 1000);
    last = now;
    if (!canvas.clientWidth) return;   // the room screen is closed
    update(now, dt);
    follow(dt);
    if (dirty) { draw(); dirty = false; }
    present();
  }

  ready.then(loaded => {
    imgs = loaded;
    solid = furnitureMask();
    rest(performance.now());
    requestAnimationFrame(tick);
  }).catch(e => console.warn(e.message));

  // ----- clicking the floor -----

  // Which room pixels are furniture (clicks there do nothing). The rug counts as floor.
  function furnitureMask() {
    try {
      const c = document.createElement("canvas");
      c.width = W;
      c.height = H;
      const x = c.getContext("2d");
      PLACES.filter(p => !p.flat).forEach(p => sprite(x, imgs[p.img], p.x, p.y, p.flip));
      return x.getImageData(0, 0, W, H).data;
    } catch (e) {
      return null;
    }
  }

  canvas.addEventListener("click", e => {
    if (!canWalk || !imgs) return;
    const r = canvas.getBoundingClientRect();
    const x = Math.floor(((e.clientX - r.left) * canvas.width / r.width - offX) / k);
    const y = Math.floor(((e.clientY - r.top) * canvas.height / r.height - offY) / k);
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    if (solid && solid[(y * W + x) * 4 + 3] > 0) return;          // a piece of furniture
    const p = toFloor(x + 0.5, y + 0.5);
    if (!floor.inside(p.u, p.v)) return;                           // a wall
    if (walkTo(floor.settle(p))) rest(performance.now() + 2000);  // stay put a little longer after a click
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
  // visitor: it's someone else's room (a peek), so the character wanders but clicks don't move it.
  function setPlayer(character, sch, visitor = false) {
    school = cleanSchool(sch) || DEFAULT_SCHOOL;
    canWalk = !visitor;
    canvas.style.cursor = canWalk ? "pointer" : "";
    dirty = true;
    const want = wanted = character;
    Promise.all([loadSprite(character.front), loadSprite(character.side)])
      .then(([front, side]) => { if (want === wanted) { sprites = { front, side }; dirty = true; } })   // ignore a slower, older pick
      .catch(e => console.warn(e.message));
  }

  return { setPlayer };
}
