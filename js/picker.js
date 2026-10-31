// Character select: one big front-facing character looking at you, with arrows to flip through the roster.
// Locked characters show as a dark silhouette with a hint of how to earn them.
//
// The art is drawn 1:1 on a 32x40 canvas and CSS scales it up by a whole number, so pixels stay crisp.

import { ROSTER, FRAME_W, FRAME_H, FRAME_MS, isUnlocked, loadImage } from "./characters.js";

const SILHOUETTE = "#1f1826";

// els: { dialog, art, name, count, hint, dev, prev, next, go, close }
// onChoose(id) runs when you pick an unlocked character.
export function createPicker(els, onChoose) {
  const ctx = els.art.getContext("2d");
  els.art.width = FRAME_W;
  els.art.height = FRAME_H;
  ctx.imageSmoothingEnabled = false;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  let i = 0, unlocked = {}, current = null, frame = 0, img = null, timer = null, closet = false;

  function draw() {
    ctx.clearRect(0, 0, FRAME_W, FRAME_H);
    if (!img) return;
    ctx.drawImage(img, frame * FRAME_W, 0, FRAME_W, FRAME_H, 0, 0, FRAME_W, FRAME_H);
    if (!closet && !isUnlocked(ROSTER[i], unlocked)) {
      ctx.globalCompositeOperation = "source-in";   // keep the shape, paint it all one dark color
      ctx.fillStyle = SILHOUETTE;
      ctx.fillRect(0, 0, FRAME_W, FRAME_H);
      ctx.globalCompositeOperation = "source-over";
    }
  }

  function show(n) {
    i = (n + ROSTER.length) % ROSTER.length;
    const c = ROSTER[i], open = closet || isUnlocked(c, unlocked);
    els.name.textContent = open ? c.name : "???";
    els.count.textContent = `${i + 1} / ${ROSTER.length}`;
    els.hint.textContent = !open ? "Locked. " + c.hint : c.id === current ? "You’re playing as " + c.name + "."
      : closet ? "Try it on!" : "Unlocked!";
    els.art.setAttribute("aria-label", open ? c.name + ", looking at you" : "A locked character, shown as a dark silhouette");
    if (!open && document.activeElement === els.go) els.next.focus();   // don't lose keyboard focus
    els.go.hidden = !open;
    els.go.textContent = c.id === current ? "Keep " + c.name : "Play as " + c.name;
    img = null;
    draw();
    loadImage(c.front).then(loaded => { if (ROSTER[i] === c) { img = loaded; draw(); } }).catch(e => console.warn(e.message));
  }

  // The biggest whole-number scale that fits, counted in device pixels so it stays sharp at 125% or 150% zoom.
  function fit() {
    const dpr = window.devicePixelRatio || 1;
    const room = Math.min(els.art.parentElement.clientWidth - 140, window.innerHeight * 0.55);
    const k = Math.max(2, Math.min(12, Math.floor(Math.min(room / FRAME_W, room / FRAME_H) * dpr)));
    els.art.style.width = `${(FRAME_W * k) / dpr}px`;
  }

  // Open on your current character. dev: everything is unlocked for this visit only.
  // fromCloset: opened from the room's closet, where every character is there to try on (no locks for now).
  function open(currentId, unlockedNow, dev, fromCloset = false) {
    current = currentId;
    unlocked = unlockedNow || {};
    closet = fromCloset;
    els.dev.hidden = !dev || closet;
    els.dialog.showModal();
    fit();
    show(Math.max(0, ROSTER.findIndex(c => c.id === currentId)));
    (els.go.hidden ? els.next : els.go).focus();
    frame = 0;
    timer = setInterval(() => { frame = (frame + 1) % 4; draw(); }, FRAME_MS.idle * (reduced ? 2.5 : 1));
  }

  els.dialog.addEventListener("close", () => { clearInterval(timer); timer = null; });
  els.prev.addEventListener("click", () => show(i - 1));
  els.next.addEventListener("click", () => show(i + 1));
  els.close.addEventListener("click", () => els.dialog.close());
  els.go.addEventListener("click", () => { onChoose(ROSTER[i].id); els.dialog.close(); });
  els.dialog.addEventListener("keydown", e => {
    if (e.key === "ArrowLeft") { e.preventDefault(); show(i - 1); }
    else if (e.key === "ArrowRight") { e.preventDefault(); show(i + 1); }
  });
  // A click on the dark backdrop (outside the box) closes it too.
  els.dialog.addEventListener("click", e => { if (e.target === els.dialog) els.dialog.close(); });
  window.addEventListener("resize", () => { if (els.dialog.open) fit(); });

  return { open };
}
