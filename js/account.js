// Your account: optional email sign-in (Supabase), so your profile can be restored on any device.
// Guests never need this: without sign-in, everything stays in this browser like before.
//
// What goes to the account: the profile's cloudCopy (see profile.js). Never Strava tokens or runs.
// The database only lets each person read and write their own row (supabase/profiles.sql).
//
// The Supabase library is only downloaded when it's needed: when you click Sign in, when this browser
// is already signed in, or when you arrive from a sign-in link.

import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";
import { store } from "./storage.js";
import { onProfileSaved, saveProfile, cloudCopy, mergeProgress, isProfile } from "./profile.js";

const LIBRARY = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3/+esm";
const SYNC = "pdl:sync";   // { user, at, dirty }: the account this browser's profile last matched, and when
const SAVE_DELAY = 1500;   // wait for a quiet moment before uploading, so a burst of changes is one save

let client = null, user = null, saveTimer = null;
let sent = "";             // the profile the account has right now (as JSON), so unchanged saves aren't uploaded
const same = p => JSON.stringify(cloudCopy(p)) === sent;
const matched = p => { sent = JSON.stringify(cloudCopy(p)); };
const listeners = [];

export const isConfigured = () => !!(SUPABASE_URL && SUPABASE_ANON_KEY);
export const currentUser = () => user;
export const onChange = fn => listeners.push(fn);
const announce = () => listeners.forEach(fn => fn(user));

// Signs of a session: Supabase keeps it as "sb-<project>-auth-token", and sign-in links come back
// with #access_token=... (or #error=... when a link has expired).
const sessionHint = () => {
  try { return Object.keys(localStorage).some(k => /^sb-.+-auth-token$/.test(k)); } catch (e) { return false; }
};
const linkHint = () => /(^|[#&])(access_token|error_description)=/.test(location.hash);

async function connect() {
  if (client) return client;
  const { createClient } = await import(LIBRARY);
  // "implicit" returns the sign-in in the #... part of the address. (The other flow uses ?code=,
  // which is what Strava's login uses too.)
  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { flowType: "implicit", detectSessionInUrl: true, persistSession: true }
  });
  client.auth.onAuthStateChange((event, session) => {
    const next = session ? session.user : null;
    if ((next && next.id) !== (user && user.id)) { user = next; announce(); }
  });
  return client;
}

// On page load: are we signed in? Returns { user, error } (error: a sign-in link that didn't work).
export async function start() {
  if (!isConfigured()) return { user: null };
  const hash = new URLSearchParams(location.hash.slice(1));
  const linkError = hash.get("error_description");
  if (linkError) history.replaceState(null, "", location.pathname + location.search);
  if (!sessionHint() && !linkHint()) return { user: null, error: linkError && linkProblem(linkError) };
  try {
    const { data } = await (await connect()).auth.getSession();
    user = data.session ? data.session.user : null;
  } catch (e) {
    user = null;
  }
  announce();
  return { user, error: linkError && linkProblem(linkError) };
}

const linkProblem = text => (/expired|invalid/i.test(text)
  ? "That sign-in link has expired or was already used. Ask for a new one."
  : "That sign-in link didn't work. Ask for a new one.");

// Email a sign-in link that comes back to this page. Returns an error message, or "" when it's sent.
export async function sendLink(email) {
  try {
    const { error } = await (await connect()).auth.signInWithOtp({
      email,
      options: { emailRedirectTo: location.origin + location.pathname }
    });
    if (!error) return "";
    if (error.status === 429 || /rate|limit|seconds/i.test(error.message)) return "Too many sign-in emails just now. Wait a minute and try again.";
    return "Couldn’t send the email. Check the address and try again.";
  } catch (e) {
    return "Couldn’t reach the sign-in service. Check your connection and try again.";
  }
}

export async function signOut() {
  clearTimeout(saveTimer);
  sent = "";
  store.set(SYNC, null);
  try { await (await connect()).auth.signOut(); } catch (e) {}
  user = null;
  announce();
}

// ----- your saved profile -----

async function fetchSaved() {
  const { data, error } = await client.from("profiles").select("data, updated_at").eq("user_id", user.id).maybeSingle();
  if (error) throw error;
  return data && isProfile(data.data) ? { profile: data.data, at: data.updated_at } : null;
}

// Upload the profile now. Remembers that this browser and the account match.
export async function upload(profile) {
  if (!user) return;
  try {
    const { data, error } = await client.from("profiles")
      .upsert({ user_id: user.id, data: cloudCopy(profile), updated_at: new Date().toISOString() })
      .select("updated_at").single();
    if (error) throw error;
    matched(profile);
    store.set(SYNC, { user: user.id, at: data.updated_at, dirty: false });
  } catch (e) {
    store.set(SYNC, { ...(store.get(SYNC, null) || {}), user: user.id, dirty: true });   // try again next time
  }
}

// Delete your saved profile from the account (it stays in this browser), then sign out.
export async function deleteSaved() {
  if (!user) return false;
  const { error } = await client.from("profiles").delete().eq("user_id", user.id);
  if (error) return false;
  await signOut();
  return true;
}

// Once this browser is linked to the account, every profile save uploads (after a quiet moment).
const linked = () => { const s = store.get(SYNC, null); return !!(user && s && s.user === user.id); };
onProfileSaved(p => {
  if (!linked() || same(p)) return;
  store.set(SYNC, { ...store.get(SYNC, null), dirty: true });
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => upload(p), SAVE_DELAY);
});

// Line up this browser's profile (local, or null) with the account's. Returns what to do:
//   { use: profile }               settled: play as this profile
//   { ask: "upload" }              the account is empty: save this browser's profile to it?
//   { ask: "choose", saved }       both have a different profile: which one to keep? (keepSaved(saved) or upload)
// Throws if the account can't be reached.
export async function reconcile(local) {
  const saved = await fetchSaved();
  const sync = store.get(SYNC, null);
  const wasLinked = !!(sync && sync.user === user.id);

  if (!saved) {
    if (!local) { store.set(SYNC, { user: user.id, at: null, dirty: false }); return { use: null }; }
    if (wasLinked) { await upload(local); return { use: local }; }   // the account was emptied; this browser still has it
    return { ask: "upload" };
  }
  if (!local) return { use: keepSaved(saved) };
  if (local.id !== saved.profile.id) return { ask: "choose", saved };

  // The same profile in both places: keep the newer choices, and everything either one earned.
  const accountNewer = !wasLinked || (!sync.dirty && (!sync.at || saved.at > sync.at));
  const merged = accountNewer ? mergeProgress(saved.profile, local) : mergeProgress(local, saved.profile);
  saveProfile(merged, { quiet: true });
  matched(saved.profile);
  if (!same(merged)) await upload(merged);
  else store.set(SYNC, { user: user.id, at: saved.at, dirty: false });
  return { use: merged };
}

// Play as the account's profile in this browser. saved: { profile, at } from reconcile().
export function keepSaved(saved) {
  saveProfile(saved.profile, { quiet: true });
  matched(saved.profile);
  store.set(SYNC, { user: user.id, at: saved.at, dirty: false });
  return saved.profile;
}
