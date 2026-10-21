// Tiny pixel icons, drawn as 8x8 SVGs so they stay crisp at any size.
// Each letter is a color; dots are empty.

const ICONS = {
  laptop: { rows: ["........", ".######.", ".#ssss#.", ".#ssss#.", ".######.", "########", "########", "........"], colors: { "#": "var(--ink)", s: "var(--code)" } },
  shoe:   { rows: ["........", "..##....", "..#rr#..", "..#rrr#.", ".#rrrrr#", "#rrrrrr#", "wwwwwwww", "........"], colors: { "#": "var(--ink)", r: "var(--run)", w: "var(--ink-soft)" } },
  tape:   { rows: ["........", "########", "#mmmmmm#", "#m#mm#m#", "#mmmmmm#", "########", "........", "........"], colors: { "#": "var(--ink)", m: "var(--music)" } },
  flame:  { rows: ["...f....", "..ff....", "..fff.f.", ".fffyff.", ".ffyyff.", ".fyyyyf.", "..fyyf..", "........"], colors: { f: "var(--run)", y: "var(--accent)" } },
  star:   { rows: ["...yy...", "...yy...", "yyyyyyyy", ".yyyyyy.", "..yyyy..", ".yy..yy.", ".y....y.", "........"], colors: { y: "var(--accent)" } }
};

export function icon(name) {
  const def = ICONS[name];
  if (!def) return null;
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 8 8");
  svg.setAttribute("shape-rendering", "crispEdges");
  svg.setAttribute("aria-hidden", "true");
  def.rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === ".") return;
    const r = document.createElementNS(NS, "rect");
    r.setAttribute("x", x); r.setAttribute("y", y); r.setAttribute("width", 1); r.setAttribute("height", 1);
    r.style.fill = def.colors[ch];
    svg.appendChild(r);
  }));
  return svg;
}

// Fill every <span data-icon="..."> on the page.
export function fillIcons(root = document) {
  root.querySelectorAll("[data-icon]").forEach(el => {
    if (el.firstChild) return;
    const svg = icon(el.dataset.icon);
    if (svg) el.appendChild(svg);
  });
}

export function iconSpan(name, extraClass = "") {
  const s = document.createElement("span");
  s.className = "ico " + extraClass;
  const svg = icon(name);
  if (svg) s.appendChild(svg);
  return s;
}
