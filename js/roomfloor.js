// The room's floor: where the character can stand, how to walk around the furniture, and what's in front.
//
// The floor of room.png is a diamond. We give it its own grid: u runs along the right wall, v along the
// left wall, both starting at the back corner. Floor units are room pixels measured along those walls
// (the walls rise 0.388 pixels for every pixel across). The diamond is u 0..129 by v 0..147.
// Furniture footprints are rectangles on that grid, so walking around them is simple grid pathing.

const ORIGIN = { x: 168, y: 131 };   // the back corner of the floor, in room pixels
const SLOPE = 0.388;
const SIZE = { u: 129, v: 147 };
const BACK = 7;      // keep the feet this far from the back walls (the body is in front of them)
const FRONT = 4;     // and this far from the front edges
const CLEAR = 5;     // room around furniture, so the character never stands inside it
const CELL = 3;      // pathing grid size, in floor units

export const toScreen = (u, v) => ({ x: ORIGIN.x + u - v, y: ORIGIN.y + (u + v) * SLOPE });
export function toFloor(x, y) {
  const a = x - ORIGIN.x, b = (y - ORIGIN.y) / SLOPE;
  return { u: (a + b) / 2, v: (b - a) / 2 };
}

// feet: [u0, u1, v0, v1] for each piece of furniture that stands on the floor.
export function createFloor(feet) {
  const blocked = (u, v) => feet.some(f => u > f[0] - CLEAR && u < f[1] + CLEAR && v > f[2] - CLEAR && v < f[3] + CLEAR);
  const inside = (u, v) => u >= 0 && v >= 0 && u <= SIZE.u && v <= SIZE.v;   // anywhere on the floor
  const free = (u, v) => u >= BACK && v >= BACK && u <= SIZE.u - FRONT && v <= SIZE.v - FRONT && !blocked(u, v);

  // A straight walk is fine if every unit along it is free.
  function clearLine(a, b) {
    const n = Math.ceil(Math.hypot(b.u - a.u, b.v - a.v));
    for (let i = 1; i <= n; i++) if (!free(a.u + (b.u - a.u) * i / n, a.v + (b.v - a.v) * i / n)) return false;
    return true;
  }

  // The pathing grid: one cell every CELL units, true where the cell's middle is free.
  const cols = Math.floor(SIZE.u / CELL) + 1, rows = Math.floor(SIZE.v / CELL) + 1;
  const spot = i => ({ u: (i % cols) * CELL, v: Math.floor(i / cols) * CELL });
  const open = Array.from({ length: cols * rows }, (_, i) => { const p = spot(i); return free(p.u, p.v); });
  const cellOf = p => Math.round(p.v / CELL) * cols + Math.round(p.u / CELL);

  function nearestOpen(p) {
    let best = -1, d = Infinity;
    open.forEach((ok, i) => { if (ok) { const q = spot(i), e = (q.u - p.u) ** 2 + (q.v - p.v) ** 2; if (e < d) { d = e; best = i; } } });
    return best;
  }

  function neighbours(i) {
    const c = i % cols, r = Math.floor(i / cols), out = [];
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const cc = c + dc, rr = r + dr, j = rr * cols + cc;
      if (cc < 0 || rr < 0 || cc >= cols || rr >= rows || !open[j]) continue;
      if (dr && dc && !(open[r * cols + cc] && open[rr * cols + c])) continue;   // no cutting corners
      out.push([j, dr && dc ? Math.SQRT2 : 1]);
    }
    return out;
  }

  // A* on the grid, then drop every corner we can see past, so the walk is a few straight lines.
  function findPath(from, to) {
    if (!free(to.u, to.v)) return null;
    if (clearLine(from, to)) return [to];
    const start = free(from.u, from.v) && open[cellOf(from)] ? cellOf(from) : nearestOpen(from);
    const goal = open[cellOf(to)] ? cellOf(to) : nearestOpen(to);
    if (start < 0 || goal < 0) return null;
    const g = new Map([[start, 0]]), came = new Map(), todo = [[0, start]], done = new Set();
    const h = i => { const a = spot(i), b = spot(goal); return Math.hypot(a.u - b.u, a.v - b.v) / CELL; };
    while (todo.length) {
      todo.sort((a, b) => a[0] - b[0]);
      const [, i] = todo.shift();
      if (i === goal) break;
      if (done.has(i)) continue;
      done.add(i);
      for (const [j, cost] of neighbours(i)) {
        const next = g.get(i) + cost;
        if (next < (g.has(j) ? g.get(j) : Infinity)) { g.set(j, next); came.set(j, i); todo.push([next + h(j), j]); }
      }
    }
    if (!g.has(goal)) return null;
    const cells = [goal];
    while (cells[0] !== start) cells.unshift(came.get(cells[0]));
    const points = [...cells.map(spot), to];
    const path = [];
    let here = from;
    for (let i = 0; i < points.length; ) {
      let far = i;
      while (far + 1 < points.length && clearLine(here, points[far + 1])) far++;
      here = points[far];
      path.push(here);
      i = far + 1;
    }
    return path;
  }

  // Somewhere free to wander to, at least `away` units from where we are.
  function randomSpot(from, away = 25) {
    const cells = open.map((ok, i) => (ok ? i : -1)).filter(i => i >= 0);
    for (let tries = 0; tries < 30; tries++) {
      const p = spot(cells[Math.floor(Math.random() * cells.length)]);
      if (Math.hypot(p.u - from.u, p.v - from.v) >= away && findPath(from, p)) return p;
    }
    return null;
  }

  // The nearest free place to p (where to stand if p itself isn't free).
  function settle(p) {
    if (free(p.u, p.v)) return p;
    const i = nearestOpen(p);
    return i < 0 ? p : spot(i);
  }

  return { inside, free, findPath, randomSpot, settle };
}

// Does this footprint cover someone standing at p? Yes when they're behind it along either wall direction.
export function inFront(f, p) {
  return (p.u < f[0] && p.v < f[3] + CLEAR) || (p.v < f[2] && p.u < f[1] + CLEAR);
}
