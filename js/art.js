// The art system: one shared body with swappable layers, so a few drawings make many characters.
//
// A look is { starter, skin, shirt, hairStyle, hairColor }. It is saved on the profile as plain
// keys (not colors), and normalizeLook() fills in anything missing so old saves keep working.
//
// Sprites are text grids, 8 columns wide. Each letter is a color, "." is empty:
//   S skin  M eye  T shirt  t darker shirt  P pants  K shoes  H hair
//   A / a  the outfit's accent and its darker shade   B / b  backpack and its shade
// Layers that sit above the head start at a negative row (see `oy` below).

import { drawText, textWidth } from "./font.js";

// ----- choices -----

export const SKINS = {
  fair:  { label: "Fair",  color: "#f3d2b3" },
  light: { label: "Light", color: "#e2b48a" },
  tan:   { label: "Tan",   color: "#d39a6a" },
  brown: { label: "Brown", color: "#a8714a" },
  deep:  { label: "Deep",  color: "#7a4a32" }
};

export const HAIR_COLORS = {
  brown:  { label: "Brown",  color: "#3b2a22" },
  black:  { label: "Black",  color: "#1f1826" },
  blonde: { label: "Blonde", color: "#e0b45a" },
  red:    { label: "Red",    color: "#b8512f" }
};

export const SHIRTS = {
  coral: { label: "Coral", color: "#f08a5d" },
  sun:   { label: "Sun",   color: "#ffc95c" },
  mint:  { label: "Mint",  color: "#7fd1a0" },
  sky:   { label: "Sky",   color: "#7fb3e6" },
  plum:  { label: "Plum",  color: "#a77fd1" },
  rose:  { label: "Rose",  color: "#ee8fb4" }
};

// Each hair style is a layer: the rows of the grid and the row it starts on (negative = above the head).
const HAIR = {
  messy: { label: "Messy short", oy: -1, rows: ["..H.H...", "..HHH...", ".HH.....", "........"] },
  bun:   { label: "Bun",         oy: -1, rows: [".HH.....", ".HHHH...", "..H.....", "........"] },
  curly: { label: "Curly",       oy: -1, rows: ["..HHH...", ".HHHHH..", "HHH.....", ".HH....."] }
};
export const HAIR_STYLES = Object.fromEntries(Object.entries(HAIR).map(([k, v]) => [k, { label: v.label }]));

// The three starters. Each is a bit of outfit on top of the shared body.
// hat: hair above the head gets flattened under it.
export const STARTERS = {
  runner: {
    label: "The Runner", shirt: "coral", hat: false,
    accent: ["#fff1d6", "#cfc6ea"],
    front: [{ oy: 0, rows: ["AAAAA..."] }]                                                    // sweatband, tied at the back
  },
  coder: {
    label: "The Coder", shirt: "plum", hat: false,
    accent: ["#4cc3b5", "#2f8f86"],
    front: [
      { oy: -1, rows: ["..aaa...", "..a.....", ".AA.....", ".AA....."] },                    // headphones: band, then ear cups
      { oy: 3, rows: ["..ttt..."] }                                                          // hood around the neck
    ]
  },
  student: {
    label: "The Student", shirt: "mint", hat: true,
    accent: ["#4f7fd1", "#35569a"],
    front: [{ oy: -1, rows: ["..AAA...", "..AAAaa."] }],                                      // cap with a brim
    back: [{ oy: 4, rows: ["BB......", ".B......", ".b......"] }]                           // backpack
  }
};

const POSES = {
  run1: ["..SSS...", "..SSM...", "..SSS...", "...S....", ".TTTTS..", "S.TTT...", "..PPP...", "..P.P...", ".P...P..", "K.....K."],
  run2: ["..SSS...", "..SSM...", "..SSS...", "...S....", "..TTT...", "..STTS..", "..PPP...", "...PP...", "...PP...", "...KK..."],
  idle: ["..SSS...", "..SSM...", "..SSS...", "...S....", ".TTTTT..", "S.TTT.S.", "..PPP...", "..P.P...", "..P.P...", ".KK.KK.."],
  wave: ["..SSS..S", "..SSM..S", "..SSS.T.", "...S.T..", ".TTTTT..", "S.TTT...", "..PPP...", "..P.P...", "..P.P...", ".KK.KK.."]
};
export const POSE_NAMES = Object.keys(POSES);

// ----- looks -----

const pick = (table, key, fallback) => (Object.hasOwn(table, key) ? key : fallback);

// Whatever is saved (or nothing at all) becomes a complete, valid look.
export function normalizeLook(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  const starter = pick(STARTERS, r.starter, "runner");
  return {
    starter,
    skin: pick(SKINS, r.skin, "tan"),
    shirt: pick(SHIRTS, r.shirt, STARTERS[starter].shirt),
    hairStyle: pick(HAIR, r.hairStyle, "messy"),
    hairColor: pick(HAIR_COLORS, r.hairColor, "brown")
  };
}

// A darker or lighter copy of a "#rrggbb" color. amount: -1 (black) to 1 (white).
export function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const f = c => Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount);
  return "#" + [n >> 16, (n >> 8) & 255, n & 255].map(c => f(c).toString(16).padStart(2, "0")).join("");
}

// Letter -> color for one look. shirt overrides the shirt color (the gold shirt on a best-pace day).
export function lookColors(look, shirt) {
  const l = normalizeLook(look), s = STARTERS[l.starter];
  const T = shirt || SHIRTS[l.shirt].color;
  return {
    S: SKINS[l.skin].color, M: "#3d2e3f", T, t: shade(T, -0.22), P: "#3d2e3f", K: "#fff1d6",
    H: HAIR_COLORS[l.hairColor].color, A: s.accent[0], a: s.accent[1], B: "#d9a05b", b: "#a8743a"
  };
}

// Paint one grid. Row 0 of the grid lands on body row `oy`.
function blit(px, rows, oy, x, y, scale, pal, skipAbove) {
  for (let r = 0; r < rows.length; r++) {
    if (skipAbove && oy + r < 0) continue;
    for (let c = 0; c < rows[r].length; c++) {
      const ch = rows[r][c];
      if (ch !== ".") px(x + c * scale, y + (oy + r) * scale, scale, scale, pal[ch]);
    }
  }
}

// Draw a character. (x, y) is the top-left of the body's first row; scale is pixels per cell.
// px(x, y, w, h, color) paints a rectangle on whatever canvas you are using.
// opts.shirt: a shirt color to use instead of the look's. opts.bare: skip the starter's outfit pieces
// (the gallery uses it to show hair on its own).
export function drawCharacter(px, look, pose, x, y, scale, opts = {}) {
  const l = normalizeLook(look), s = STARTERS[l.starter], pal = lookColors(l, opts.shirt), h = HAIR[l.hairStyle];
  const worn = opts.bare ? { back: [], front: [], hat: false } : { back: s.back || [], front: s.front, hat: s.hat };
  worn.back.forEach(g => blit(px, g.rows, g.oy, x, y, scale, pal));
  blit(px, POSES[pose] || POSES.idle, 0, x, y, scale, pal);
  blit(px, h.rows, h.oy, x, y, scale, pal, worn.hat);
  worn.front.forEach(g => blit(px, g.rows, g.oy, x, y, scale, pal));
}

// ----- school pennant -----

export const PENNANT_COLORS = ["#7a5fa8", "#4f7fd1", "#3ea860", "#d9805f", "#c4473a", "#ffc95c", "#3d2e3f", "#fff1d6"];

const hexOr = (v, fallback) => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : fallback);

// Whatever was typed becomes a safe school: a short name, up to 3 letters/digits, and two colors. Or null.
export function cleanSchool(raw) {
  if (!raw || typeof raw !== "object") return null;
  const name = String(raw.name || "").trim().slice(0, 40);
  const initials = String(raw.initials || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3);
  if (!name && !initials) return null;
  return { name, initials, c1: hexOr(raw.c1, "#7a5fa8"), c2: hexOr(raw.c2, "#ffc95c") };
}

const PEN_W = 30, PEN_H = 15;
export const PENNANT_SIZE = { w: PEN_W, h: PEN_H };

// Our own felt pennant (never a real school logo): a triangle pinned to the wall, pointing right.
// c1 is the felt, c2 trims the edge and tip, and the letters pick whichever of light/dark reads better.
// It hangs perfectly still. (x, y) is its top-left corner.
// textPx paints the initials (default: px). The room leans the felt up its wall but keeps the tiny letters whole.
export function drawPennant(px, school, x, y, textPx = px) {
  const sc = cleanSchool(school);
  if (!sc) return;
  const n = parseInt(sc.c1.slice(1), 16);
  const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  const ink = lum > 0.6 ? "#3d2e3f" : "#fff1d6";

  for (let r = 0; r < PEN_H; r++) {
    const w = Math.max(1, Math.round(PEN_W * (1 - Math.abs(r - 7) / 7.5)));
    px(x, y + r, w, 1, sc.c1);
    px(x, y + r, Math.min(2, w), 1, sc.c2);                    // trim down the pinned edge
    if (w > 23) px(x + 23, y + r, w - 23, 1, sc.c2);           // trim at the tip
  }
  px(x, y - 1, 1, 1, "#3d2e3f"); px(x, y + PEN_H, 1, 1, "#3d2e3f");   // the two pins

  const w = textWidth(sc.initials);
  drawText(textPx, sc.initials, x + 4 + Math.max(0, Math.floor((13 - w) / 2)), y + 5, ink);
}
