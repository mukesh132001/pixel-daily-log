// Adopting pets: who you've adopted, what it costs, and the panel where you do it.
//
// The profile keeps  pets: { have: { shiba: ["2026-10-30", 0] }, room: ["shiba"] }
//   have: every pet you've adopted, the day, and the XP it cost (the first pet is free, so 0)
//   room: which of them are in the room right now (up to MAX_IN_ROOM; the others are resting)
// Adopting spends XP from a balance (total XP minus what you've spent), but your room's level always follows the
// total you've earned, so adopting never takes furniture away.
// The rules are plain functions (no page), so they're easy to test. createAdoptPanel() is the panel itself.

import { loadImage } from "./characters.js";
import { PET_FRAME } from "./pets.js";

export const MAX_IN_ROOM = 4;
const SHEETS = "sprites/pets/sheets/";

let data = null;
export const loadPetData = () => data ? Promise.resolve(data) : fetch("sprites/pets/pets.json")
  .then(r => { if (!r.ok) throw new Error("Couldn’t load sprites/pets/pets.json"); return r.json(); })
  .then(json => (data = json));

// ----- the rules -----

export const havePets = me => (me && me.pets && me.pets.have) || {};
export const hasPet = (me, id) => id in havePets(me);
export const roomPets = me => ((me && me.pets && me.pets.room) || []).filter(id => hasPet(me, id)).slice(0, MAX_IN_ROOM);
export const spentXp = me => Object.values(havePets(me)).reduce((n, h) => n + (Number(h[1]) || 0), 0);
export const balance = (me, total) => Math.max(0, total - spentXp(me));
export const isFirstPet = me => Object.keys(havePets(me)).length === 0;

// Can you adopt this pet right now? { ok, cost, why }: why is "owned", "first" (the free first pet must be a common
// one) or "xp" (not enough XP; need says how many more).
export function canAdopt(me, pet, total) {
  if (hasPet(me, pet.id)) return { ok: false, why: "owned" };
  if (isFirstPet(me)) return pet.rarity === "common" ? { ok: true, cost: 0 } : { ok: false, why: "first" };
  const have = balance(me, total);
  return have >= pet.cost ? { ok: true, cost: pet.cost } : { ok: false, why: "xp", need: pet.cost - have };
}

// The profile after adopting (null if you can't). The new pet goes in the room if there's space.
export function adopt(me, pet, total, dayKey) {
  const can = canAdopt(me, pet, total);
  if (!can.ok) return null;
  const room = roomPets(me);
  return { ...me, pets: { have: { ...havePets(me), [pet.id]: [dayKey, can.cost] }, room: room.length < MAX_IN_ROOM ? [...room, pet.id] : room } };
}

// Put a pet in the room or let it rest (null if the room is full or you don't have it).
export function setInRoom(me, id, inRoom) {
  if (!hasPet(me, id)) return null;
  const room = roomPets(me).filter(r => r !== id);
  if (inRoom && room.length >= MAX_IN_ROOM) return null;
  return { ...me, pets: { have: havePets(me), room: inRoom ? [...room, id] : room } };
}

// Two copies of your pets (this browser and your account): keep every pet either has, and the room list of both.
export function mergePets(a, b) {
  const have = { ...((b && b.have) || {}), ...((a && a.have) || {}) };
  const room = [...new Set([...((a && a.room) || []), ...((b && b.room) || [])])].filter(id => id in have).slice(0, MAX_IN_ROOM);
  return { have, room };
}

// ----- the panel -----

const WHY = { first: "Your first pet is free: pick a common one.", xp: n => `${n} more XP` };

// els: { dialog, grid, info, close }. deps: { owner() (an object with .pets), save(next), total() (XP earned),
// data (pets.json), today() (a day key), ask(title, text, yes, no) (the two-answer box), sound() }
export function createAdoptPanel(els, deps) {
  const sheets = new Map();
  const sheetFor = id => {
    if (!sheets.has(id)) sheets.set(id, loadImage(`${SHEETS}${id}.png`).catch(() => null));
    return sheets.get(id);
  };

  function card(pet, owner, total) {
    const li = document.createElement("div");
    li.className = "adopt-card";
    const art = document.createElement("canvas");
    art.width = PET_FRAME.w;
    art.height = PET_FRAME.h;
    art.setAttribute("aria-hidden", "true");
    sheetFor(pet.id).then(img => img && art.getContext("2d").drawImage(img, 0, 0, PET_FRAME.w, PET_FRAME.h, 0, 0, PET_FRAME.w, PET_FRAME.h));
    const name = document.createElement("b");
    name.textContent = pet.name;
    const meta = document.createElement("span");
    meta.className = "small";
    meta.textContent = `${pet.rarity[0].toUpperCase()}${pet.rarity.slice(1)} ${pet.kind} · ${pet.cost} XP`;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn px";

    if (hasPet(owner, pet.id)) {
      const inRoom = roomPets(owner).includes(pet.id);
      li.classList.add("owned");
      button.textContent = inRoom ? "In the room ✓" : "Bring to the room";
      button.setAttribute("aria-pressed", String(inRoom));
      button.disabled = !inRoom && roomPets(owner).length >= MAX_IN_ROOM;
      if (button.disabled) button.title = `The room holds ${MAX_IN_ROOM} pets. Let one rest first.`;
      button.addEventListener("click", () => {
        const next = setInRoom(owner, pet.id, !inRoom);
        if (next) { deps.save(next); deps.sound(); render(); }
      });
    } else {
      const can = canAdopt(owner, pet, total);
      button.textContent = can.ok ? (can.cost ? `Adopt · ${can.cost} XP` : "Adopt (free)") : can.why === "xp" ? `Need ${WHY.xp(can.need)}` : "Not your first";
      button.setAttribute("aria-label", can.ok ? `Adopt ${pet.name}${can.cost ? ` for ${can.cost} XP` : ", free"}` : `${pet.name}: ${can.why === "xp" ? WHY.xp(can.need) : WHY.first}`);
      button.disabled = !can.ok;
      button.addEventListener("click", async () => {
        const again = canAdopt(deps.owner(), pet, deps.total());
        if (!again.ok) return render();
        const sure = await deps.ask(`Adopt ${pet.name}?`, again.cost
          ? `This spends ${again.cost} XP. Your room’s level stays the same.`
          : "Your first pet is free! You can adopt more with XP later.", "Adopt", "Not now");
        if (!sure) return;
        const next = adopt(deps.owner(), pet, deps.total(), deps.today());
        if (next) { deps.save(next); deps.sound(); }
        render();
      });
    }
    li.append(art, name, meta, button);
    return li;
  }

  // Draw the whole panel again from the current profile.
  function render() {
    const owner = deps.owner(), total = deps.total();
    els.info.textContent = `XP to spend: ${balance(owner, total)} · In the room: ${roomPets(owner).length} of ${MAX_IN_ROOM}` +
      (isFirstPet(owner) ? ` · ${WHY.first}` : "");
    els.grid.textContent = "";
    deps.data.pets.forEach(pet => els.grid.appendChild(card(pet, owner, total)));
  }

  function open() {
    render();
    if (!els.dialog.open) els.dialog.showModal();
    els.close.focus();
  }

  els.close.addEventListener("click", () => els.dialog.close());
  els.dialog.addEventListener("click", e => { if (e.target === els.dialog) els.dialog.close(); });
  return { open, render };
}
