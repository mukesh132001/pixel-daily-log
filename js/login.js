// The sign-in box, the Sign in / Account button, and the questions asked when you sign in.
// The account logic itself (Supabase, syncing) is in account.js. Without Supabase settings in config.js,
// none of this shows up and the game works as a guest, like before.

import * as account from "./account.js";
import { byId } from "./characters.js";

const $ = id => document.getElementById(id);

// A short description of a profile, so you can tell two apart.
function describe(p) {
  const who = p.name || (p.github ? "@" + p.github : "a profile");
  const c = byId(p.characterId);
  const days = (p.log && p.log.days && p.log.days.length) || 0;
  const unlocked = Object.keys(p.unlocked || {}).length;
  return `${who} (${c ? c.name : "Leo"}, ${days} logged day${days === 1 ? "" : "s"}, ${unlocked} unlock${unlocked === 1 ? "" : "s"})`;
}

// A question with two answers: resolves true for the first, false for the second.
// Escape doesn't close it, because both answers matter.
export function ask(title, text, yes, no) {
  return new Promise(resolve => {
    const box = $("askBox");
    $("askTitle").textContent = title;
    $("askText").textContent = text;
    $("askYes").textContent = yes;
    $("askNo").textContent = no;
    const done = answer => {
      $("askYes").onclick = $("askNo").onclick = box.oncancel = null;
      box.close();
      resolve(answer);
    };
    $("askYes").onclick = () => done(true);
    $("askNo").onclick = () => done(false);
    box.oncancel = e => e.preventDefault();
    box.showModal();
    $("askYes").focus();
  });
}

// ----- the sign-in box -----

function say(text, bad) {
  $("loginMsg").textContent = text || "";
  $("loginMsg").classList.toggle("bad", !!bad);
}

// Show the part of the box that fits: the email form, "check your email", or signed in.
function showState(sentTo) {
  const user = account.currentUser();
  $("loginTitle").textContent = user ? "Your account" : "Sign in";
  $("loginForm").hidden = !!user || !!sentTo;
  $("loginSent").hidden = !!user || !sentTo;
  $("loginIn").hidden = !user;
  if (sentTo) $("loginSentTo").textContent = sentTo;
  if (user) $("loginWho").textContent = user.email || "you";
}

export function openLogin(message, bad) {
  const box = $("loginBox");
  showState();
  say(message, bad);
  if (!box.open) box.showModal();
  (account.currentUser() ? $("loginOut") : $("loginEmail")).focus();
}

export function setupLogin() {
  if (!account.isConfigured()) return;
  const btn = $("account"), box = $("loginBox");
  btn.hidden = false;
  account.onChange(user => {
    btn.textContent = user ? "Account" : "Sign in";
    if (box.open) showState();
  });

  btn.addEventListener("click", () => openLogin(""));
  $("loginClose").addEventListener("click", () => box.close());
  box.addEventListener("click", e => { if (e.target === box) box.close(); });   // the dark backdrop

  $("loginForm").addEventListener("submit", async e => {
    e.preventDefault();
    const email = $("loginEmail").value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return say("That doesn’t look like an email address.", true);
    $("loginSend").disabled = true;
    say("Sending…");
    const problem = await account.sendLink(email);
    $("loginSend").disabled = false;
    if (problem) return say(problem, true);
    say("");
    showState(email);
  });

  $("loginOut").addEventListener("click", async () => {
    await account.signOut();
    showState();
    say("Signed out. Your profile stays in this browser.");
  });

  $("loginDelete").addEventListener("click", async () => {
    const sure = await ask("Delete your saved profile?",
      "It’s removed from your account and you’re signed out. This browser keeps its own copy.", "Delete it", "Keep it");
    if (!sure) return;
    const done = await account.deleteSaved();
    showState();
    say(done ? "Deleted from your account. This browser still has your profile." : "Couldn’t delete it right now. Try again in a moment.", !done);
  });
}

// ----- when the page loads -----

// If you're signed in, line up this browser's profile with your account, asking when it's your call.
// Returns the profile to play as (or null if there isn't one yet). Account trouble never blocks the game.
export async function settleAccount(local) {
  if (!account.isConfigured()) return local;
  const { user, error } = await account.start();
  if (error) openLogin(error, true);
  if (!user) return local;
  try {
    const plan = await account.reconcile(local);
    if (plan.ask === "upload") {
      const save = await ask("Save this profile to your account?",
        `You’re signed in. Save ${describe(local)} to your account, so you can open it on any device?`,
        "Save it", "Not now (sign out)");
      if (save) await account.upload(local);
      else await account.signOut();
      return local;
    }
    if (plan.ask === "choose") {
      const keepAccount = await ask("Which profile do you want to keep?",
        `This browser has ${describe(local)}. Your account has ${describe(plan.saved.profile)}. The one you don’t keep is replaced.`,
        "Keep my account’s", "Keep this browser’s");
      if (keepAccount) return account.keepSaved(plan.saved);
      await account.upload(local);
      return local;
    }
    return plan.use;
  } catch (e) {
    openLogin("Couldn’t reach your account just now, so you’re playing the profile saved in this browser.", true);
    return local;
  }
}
