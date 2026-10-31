// The school pennant: our own felt pennant drawn in code (never a real school logo), and cleanSchool(), which
// turns whatever was typed into a safe school. (The old layered "build a character" art lived here too; it was
// removed once characters became Muki's own sprite pack, see characters.js.)

import { drawText, textWidth } from "./font.js";

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
