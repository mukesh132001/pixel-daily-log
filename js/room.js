// Your room: one cozy isometric room with your character standing in it and your school pennant on the wall.
// It has its own screen (#room in the address, see main.js).
//
// The room and furniture are PNGs cut from the ToffeeCraft pack (see sprites/room/CREDITS.md). They're painted
// 1:1 into a hidden 323x256 buffer, then copied onto the screen canvas at a whole number of device pixels per
// room pixel (about 2x, or 3x on big screens), so pixels never get blurry or uneven.
//
// The camera: if the scaled room fits, it sits in the middle. If it doesn't (phones), we show a window
// centered on your character, stopped at the room's edges so there's never empty space past them.
//
// The room itself is still. Only your character moves: the 4-frame front idle from characters.js,
// drawn 1:1 like the furniture (or held on one frame if you prefer reduced motion).

import { drawPennant, cleanSchool } from "./art.js";
import { FRAME_W, FRAME_MS, drawFrame, loadImage as loadSprite } from "./characters.js";

const W = 323, H = 256;
const PENNANT_SCALE = 2;    // the felt pennant at 2x, so it reads at room size
const WALL_SLOPE = 3 / 8;   // the walls rise 3 pixels for every 8 across

// Furniture, painted in this order (later pieces cover earlier ones, so list back to front).
// Every piece in the pack faces the right wall; flip mirrors it onto the left wall.
const PLACES = [
  { img: "window",   x: 248, y: 48 },
  { img: "bookcase", x: 176, y: 92 },
  { img: "desk",     x: 50,  y: 120, flip: true },
  { img: "laptop",   x: 78,  y: 112 },
  { img: "lamp",     x: 222, y: 114 },
  { img: "rug",      x: 104, y: 165 },
  { img: "bed",      x: 240, y: 138 },
  { img: "chair",    x: 112, y: 150 },
  { img: "plant",    x: 22,  y: 146 }
];
const PENNANT = { x: 58, y: 80 };     // on the left wall, above the desk
const PLAYER = { x: 148, feet: 203 }; // left edge of the frame, and where the feet touch the rug
const FOCUS = { x: PLAYER.x + FRAME_W / 2, y: PLAYER.feet - 15 };   // the camera looks at the character's middle
const BIG = W * 3;                    // a room area at least this wide (CSS pixels) gets 3x instead of 2x

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
  let imgs = null, player = null, wanted = null, school = DEFAULT_SCHOOL, frame = 0;

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

  function sprite(img, x, y, flip) {
    if (!flip) return ctx.drawImage(img, x, y);
    ctx.save();
    ctx.translate(x + img.width, y);
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  }

  function draw() {
    if (!imgs) return;
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(imgs.room, 0, 0);
    drawPennant(onLeftWall(PENNANT.x, PENNANT.y), school, 0, 0);   // hangs perfectly still
    PLACES.forEach(p => sprite(imgs[p.img], p.x, p.y, p.flip));
    if (player) drawFrame(ctx, player, frame, 0, PLAYER.x, PLAYER.feet);
    present();
  }

  // Copy the room onto the screen canvas through the camera.
  function present() {
    view.imageSmoothingEnabled = false;   // resizing a canvas resets this, so set it every time
    view.clearRect(0, 0, canvas.width, canvas.height);
    view.drawImage(buf, offset(canvas.width, W, FOCUS.x), offset(canvas.height, H, FOCUS.y), W * k, H * k);
  }

  // Where the room's left (or top) edge goes on screen, in device pixels. Centered if it fits;
  // otherwise centered on the character, but never past the room's edges.
  function offset(screen, size, focus) {
    const room = size * k;
    if (room <= screen) return Math.floor((screen - room) / 2);
    return -Math.min(Math.max(0, Math.round(focus * k - screen / 2)), room - screen);
  }

  ready.then(loaded => { imgs = loaded; draw(); }).catch(e => console.warn(e.message));
  if (!reduced) setInterval(() => { frame = (frame + 1) % 4; if (player) draw(); }, FRAME_MS.idle);

  // CSS stretches the canvas over the whole room area. Match its pixels to the screen's real pixels,
  // and pick the scale: 2x, or 3x when the area is big. (Counting device pixels keeps it crisp on
  // screens set to 125% or 150%, where 2x becomes 2.5 device pixels and gets rounded to 3.)
  function fit(entries) {
    const dpr = window.devicePixelRatio || 1;
    const size = entries && entries[0].devicePixelContentBoxSize && entries[0].devicePixelContentBoxSize[0];
    canvas.width = size ? size.inlineSize : Math.round(canvas.clientWidth * dpr);
    canvas.height = size ? size.blockSize : Math.round(canvas.clientHeight * dpr);
    k = Math.max(1, Math.round((canvas.clientWidth >= BIG ? 3 : 2) * dpr));
    present();
  }
  const watch = new ResizeObserver(fit);
  try { watch.observe(canvas, { box: "device-pixel-content-box" }); }   // exact device pixels where supported
  catch (e) { watch.observe(canvas); }

  // Dress the room: a roster character (see characters.js) and your school (null for the default).
  function setPlayer(character, sch) {
    school = cleanSchool(sch) || DEFAULT_SCHOOL;
    draw();
    const want = wanted = character.front;
    loadSprite(want)
      .then(img => { if (want === wanted) { player = img; draw(); } })   // ignore a slower, older pick
      .catch(e => console.warn(e.message));
  }

  return { setPlayer };
}
