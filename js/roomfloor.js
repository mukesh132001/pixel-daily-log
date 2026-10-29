// The room's floor: where the character can stand, how it walks around the furniture, and screen <-> floor.
//
// It uses the world units of sprites/room/room_manifest.json (see that folder's README): x runs along the right
// wall (toward the door), y along the left wall (toward the bed), both 0..100 from the back corner.
// 10 units make a tile, so the floor is a 10x10 tile grid, and furniture blocks whole tiles.

export const TILE = 10, SIZE = 100;
const ORIGIN = { x: 128, y: 112 };   // the back corner of the floor, in room pixels
const BACK = 4;      // keep the feet this far from the back walls (the body is in front of them)
const FRONT = 3;     // and this far from the front edges
const BODY = 3;      // and this far from blocked tiles, so the character never stands inside furniture
const CELL = 5;      // pathing grid size (half a tile)

export const toScreen = (x, y) => ({ x: ORIGIN.x + x - y, y: ORIGIN.y + (x + y) / 2 });
export function toWorld(sx, sy) {
  const a = sx - ORIGIN.x, b = (sy - ORIGIN.y) * 2;
  return { x: (a + b) / 2, y: (b - a) / 2 };
}
export const tileOf = p => [Math.floor(p.x / TILE), Math.floor(p.y / TILE)];
export const tileMiddle = ([tx, ty]) => ({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 });

// blocks: [{ x, y, w, d }] in tiles, the manifest's blockedTiles of every piece in the room.
export function createFloor(blocks) {
  const blocked = (x, y) => blocks.some(b =>
    x > b.x * TILE - BODY && x < (b.x + b.w) * TILE + BODY && y > b.y * TILE - BODY && y < (b.y + b.d) * TILE + BODY);
  const inside = (x, y) => x >= 0 && y >= 0 && x <= SIZE && y <= SIZE;   // anywhere on the floor
  const free = (x, y) => x >= BACK && y >= BACK && x <= SIZE - FRONT && y <= SIZE - FRONT && !blocked(x, y);

  // One step of walking from p by (dx, dy). Blocked? Slide along whichever direction is still open.
  function move(p, dx, dy) {
    if (free(p.x + dx, p.y + dy)) return { x: p.x + dx, y: p.y + dy };
    if (dx && free(p.x + dx, p.y)) return { x: p.x + dx, y: p.y };
    if (dy && free(p.x, p.y + dy)) return { x: p.x, y: p.y + dy };
    return p;
  }

  // A straight walk is fine if every unit along it is free.
  function clearLine(a, b) {
    const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y));
    for (let i = 1; i <= n; i++) if (!free(a.x + (b.x - a.x) * i / n, a.y + (b.y - a.y) * i / n)) return false;
    return true;
  }

  // The pathing grid: one cell every CELL units, true where the cell's middle is free.
  const cols = SIZE / CELL + 1, rows = SIZE / CELL + 1;
  const spot = i => ({ x: (i % cols) * CELL, y: Math.floor(i / cols) * CELL });
  const open = Array.from({ length: cols * rows }, (_, i) => { const p = spot(i); return free(p.x, p.y); });
  const cellOf = p => Math.round(p.y / CELL) * cols + Math.round(p.x / CELL);

  function nearestOpen(p) {
    let best = -1, d = Infinity;
    open.forEach((ok, i) => { if (ok) { const q = spot(i), e = (q.x - p.x) ** 2 + (q.y - p.y) ** 2; if (e < d) { d = e; best = i; } } });
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
    if (!free(to.x, to.y)) return null;
    if (clearLine(from, to)) return [to];
    const start = free(from.x, from.y) && open[cellOf(from)] ? cellOf(from) : nearestOpen(from);
    const goal = open[cellOf(to)] ? cellOf(to) : nearestOpen(to);
    if (start < 0 || goal < 0) return null;
    const g = new Map([[start, 0]]), came = new Map(), todo = [[0, start]], done = new Set();
    const h = i => { const a = spot(i), b = spot(goal); return Math.hypot(a.x - b.x, a.y - b.y) / CELL; };
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
      if (Math.hypot(p.x - from.x, p.y - from.y) >= away && findPath(from, p)) return p;
    }
    return null;
  }

  // The nearest free place to p (where to stand if p itself isn't free).
  function settle(p) {
    if (free(p.x, p.y)) return p;
    const i = nearestOpen(p);
    return i < 0 ? p : spot(i);
  }

  return { inside, free, move, findPath, randomSpot, settle };
}
