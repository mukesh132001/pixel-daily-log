// Pets in the pet room: who is where, and how they move. Only logic here (no page), so it's easy to test;
// room.js draws what this says.
//
// Pet art is sprites/pets/sheets/<id>.png: 8 frames of 28x30, with no walk cycle. So a pet doesn't walk: it moves
// between the room's spots (sprites/petroom/petroom_manifest.json, "petSpots") with a small hop, and at each spot it
// does one thing: sit (tail wag and blinks), eat at the bowl, or sleep on a bed.
// Reduced motion: pets stay where they are with their first frame (no wag, blink, hop or wandering).

import { toScreen } from "./roomfloor.js";

export const PET_FRAME = { w: 28, h: 30, feetX: 14, feetY: 28 };   // feet: the middle of the bottom row
export const FRAMES = { sitA: 0, sitB: 1, blink: 2, happy: 3, eatA: 4, eatB: 5, sleepA: 6, sleepB: 7 };

const WAG_MS = 420;                 // tail wag: sitA, sitB
const BLINK_EVERY = [2500, 5500];   // and a blink now and then
const BLINK_MS = 160;
const EAT_MS = 380;
const SLEEP_MS = 1000;              // slow breathing
const MOVE_EVERY = [7000, 15000];   // a pet stays at a spot this long before hopping somewhere else
const HOP_MS = 380;                 // one hop; a far spot takes a few
const HOP_UNITS = 28;               // floor units covered by one hop
const HOP_HEIGHT = 6;               // how high a hop goes, in room pixels
const HAPPY_MS = 1400;              // the heart after you click a pet

// spots: petSpots from the manifest. depthOf(itemId): that item's depthY, for pets that sit on or in front of it.
export function createPetLife(spots, { rand = Math.random, reduced = false, depthOf = () => 0 } = {}) {
  let pets = [];
  const spotById = Object.fromEntries(spots.map(s => [s.id, s]));
  const between = ([a, b]) => a + rand() * (b - a);
  const fits = (spot, pet) => spot.kind === "any" || spot.kind === pet.kind;
  const isTaken = (id, except) => pets.some(p => p !== except && (p.to || p.spot) === id);
  const choices = pet => spots.filter(s => fits(s, pet) && s.id !== pet.spot && !isTaken(s.id, pet));
  const pick = list => list[Math.min(list.length - 1, Math.floor(rand() * list.length))];

  // list: [{ id, kind }] (kind: "dog" or "cat"). Each pet gets a spot of its own.
  function set(list, now = 0) {
    pets = [];
    list.forEach(({ id, kind }) => {
      const pet = { id, kind, spot: null, to: null, from: null, hopAt: 0, hopMs: 0, hops: 1, happyUntil: 0,
        phase: rand() * 1000, nextBlink: now + between(BLINK_EVERY), blinkUntil: 0, nextMove: now + between(MOVE_EVERY), frame: 0 };
      const free = spots.filter(s => fits(s, pet) && !isTaken(s.id, pet));
      if (!free.length) return;   // no room for this one (the manifest has more spots than the room holds pets)
      pet.spot = pick(free).id;
      pets.push(pet);
    });
  }

  const here = pet => spotById[pet.spot];
  const world = (pet, now) => {
    const a = spotById[pet.from || pet.spot], b = spotById[pet.to || pet.spot];
    if (!pet.to) return { x: a.x, y: a.y, z: a.z || 0 };
    const t = Math.min(1, Math.max(0, (now - pet.hopAt) / pet.hopMs));
    return {
      x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t,
      z: (a.z || 0) + ((b.z || 0) - (a.z || 0)) * t + HOP_HEIGHT * Math.abs(Math.sin(t * pet.hops * Math.PI))
    };
  };

  const depthAt = spot => (spot.on ? depthOf(spot.on) + 0.1 : toScreen(spot.x, spot.y).y);

  function frameFor(pet, now) {
    if (pet.to) return FRAMES.sitA;                    // mid-hop
    if (now < pet.happyUntil) return FRAMES.happy;
    const spot = here(pet), tick = Math.floor((now + pet.phase) / (spot.pose === "eat" ? EAT_MS : spot.pose === "sleep" ? SLEEP_MS : WAG_MS)) % 2;
    if (spot.pose === "eat") return reduced ? FRAMES.eatA : FRAMES.eatA + tick;
    if (spot.pose === "sleep") return reduced ? FRAMES.sleepA : FRAMES.sleepA + tick;
    if (reduced) return FRAMES.sitA;
    if (now >= pet.nextBlink) { pet.blinkUntil = now + BLINK_MS; pet.nextBlink = now + BLINK_MS + between(BLINK_EVERY); }
    return now < pet.blinkUntil ? FRAMES.blink : FRAMES.sitA + tick;
  }

  // Move things along. Returns true when something you can see changed (a frame, a hop), so the room should redraw.
  function update(now) {
    let changed = false;
    pets.forEach(pet => {
      if (pet.to && now >= pet.hopAt + pet.hopMs) {            // landed
        pet.spot = pet.to; pet.to = pet.from = null;
        pet.nextMove = now + between(MOVE_EVERY);
        changed = true;
      } else if (!pet.to && !reduced && now >= pet.nextMove) {
        const options = choices(pet);
        if (!options.length) pet.nextMove = now + 2000;        // everywhere's busy: try again soon
        else {
          const target = pick(options), a = here(pet);
          pet.from = pet.spot; pet.to = target.id;
          pet.hops = Math.max(1, Math.round(Math.hypot(target.x - a.x, target.y - a.y) / HOP_UNITS));
          pet.hopMs = pet.hops * HOP_MS;
          pet.hopAt = now;
        }
      }
      const frame = frameFor(pet, now);
      if (frame !== pet.frame || pet.to) changed = true;
      pet.frame = frame;
    });
    return changed;
  }

  // What to draw: [{ id, index (the frame), x, y (screen pixels of the feet, hop included), depth }].
  function list(now) {
    return pets.map(pet => {
      const w = world(pet, now), s = toScreen(w.x, w.y);
      const spot = pet.to && (now - pet.hopAt) / pet.hopMs >= 0.5 ? spotById[pet.to] : here(pet);
      return { id: pet.id, index: frameFor(pet, now), x: s.x, y: s.y - w.z, depth: depthAt(spot) };
    });
  }

  // The front-most pet under room pixel (x, y), or null.
  function hit(x, y, now) {
    const found = list(now).filter(p => x >= p.x - 12 && x <= p.x + 12 && y >= p.y - 26 && y <= p.y + 2).sort((a, b) => b.depth - a.depth)[0];
    return found || null;
  }

  // A pet gets a heart (you clicked it).
  function cheer(id, now) {
    const pet = pets.find(p => p.id === id);
    if (pet) pet.happyUntil = now + HAPPY_MS;
    return !!pet;
  }

  const state = () => pets.map(p => ({ id: p.id, kind: p.kind, spot: p.spot, to: p.to, hopping: !!p.to }));
  return { set, update, list, hit, cheer, state, count: () => pets.length };
}
