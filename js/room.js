// Your room: one cozy isometric room with your character standing in it and your school pennant on the wall.
// It has its own screen (#room in the address, see main.js) and is drawn as big as fits.
//
// The room and furniture are PNGs cut from the ToffeeCraft pack (see sprites/room/CREDITS.md), drawn 1:1
// so every pixel stays crisp. Everything is placed in room pixels on a 323x256 canvas, and CSS scales the
// whole canvas up by a whole number (2x, 3x...) so pixels never get blurry or uneven.
//
// The room itself is still. Only your character moves: the 4-frame front idle from characters.js,
// drawn 1:1 like the furniture (or held on one frame if you prefer reduced motion).

import { drawPennant, cleanSchool } from "./art.js";
import { FRAME_MS, drawFrame, loadImage as loadSprite } from "./characters.js";

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

// Shown until you pick your own school.
const DEFAULT_SCHOOL = { name: "Pixel State", initials: "PS", c1: "#7a5fa8", c2: "#ffc95c" };

const loadImage = name => new Promise((ok, fail) => {
  const img = new Image();
  img.onload = () => ok(img);
  img.onerror = () => fail(new Error(`Couldn't load sprites/room/${name}.png`));
  img.src = `sprites/room/${name}.png`;
});

export function createRoom(canvas) {
  const ctx = canvas.getContext("2d");
  canvas.width = W;
  canvas.height = H;
  ctx.imageSmoothingEnabled = false;

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
  }

  ready.then(loaded => { imgs = loaded; draw(); }).catch(e => console.warn(e.message));
  if (!reduced) setInterval(() => { frame = (frame + 1) % 4; if (player) draw(); }, FRAME_MS.idle);

  // Scale the canvas by the biggest whole number of *screen* pixels that still fits the frame,
  // both across and down. (Counting device pixels keeps it crisp on screens set to 125% or 150%.)
  function fit() {
    const dpr = window.devicePixelRatio || 1;
    const box = canvas.parentElement;
    const k = Math.max(1, Math.floor(Math.min(box.clientWidth * dpr / W, box.clientHeight * dpr / H)));
    canvas.style.width = `${(W * k) / dpr}px`;
  }
  new ResizeObserver(fit).observe(canvas.parentElement);

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
