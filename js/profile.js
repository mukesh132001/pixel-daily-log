// Your profile: who you are in the pixel world. Saved in this browser for now.
// Runs and the Strava link belong to the profile's id, so GitHub is optional.

import { store, runsKey, LAST_USER } from "./storage.js";

const KEY = "pdl:profile";

// GitHub usernames can't contain "_", so an id can never be mistaken for one.
const newId = () => "p_" + Array.from(crypto.getRandomValues(new Uint8Array(12)), b => b.toString(16).padStart(2, "0")).join("");

// The character, school and pet get filled in by the character creator.
export function newProfile(fields = {}) {
  return {
    v: 1,
    id: newId(),
    name: "",
    about: "",
    school: null,
    character: null,
    pet: null,
    github: null,
    createdAt: new Date().toISOString(),
    ...fields
  };
}

export const isProfile = p => !!(p && p.v === 1 && /^p_[0-9a-f]{24}$/.test(p.id));

export function loadProfile() {
  const p = store.get(KEY, null);
  return isProfile(p) ? p : null;
}

export const saveProfile = p => store.set(KEY, p);

// Is this GitHub username the one on your profile?
export const isMine = (me, login) => !!(me && me.github && login && me.github.toLowerCase() === login.toLowerCase());

// Before profiles, everything was keyed by GitHub username. Turn that player into a profile,
// copying their hand-logged runs across (the old copy stays as a backup).
// The username Strava was linked to wins, since you'd only connect Strava to your own world.
export function migrateOldPlayer() {
  const conn = store.get("pdl:strava", null);
  const github = (conn && conn.ghUser) || store.get(LAST_USER, null);
  if (!github) return null;
  const me = newProfile({ github });
  const runs = store.get(runsKey(github), null);
  if (runs) store.set(runsKey(me.id), runs);
  saveProfile(me);
  return me;
}
