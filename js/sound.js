// Retro square-wave beeps with the Web Audio API. Starts muted.

let on = false;
let actx = null;

export const isSoundOn = () => on;
export const setSound = value => { on = value; };

export function blip(freq, dur, type = "square") {
  if (!on) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.06, actx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur);
    o.connect(g).connect(actx.destination);
    o.start();
    o.stop(actx.currentTime + dur);
  } catch (e) {}
}

// A few named sounds so the rest of the code reads nicely.
export const sfx = {
  select() { blip(520, 0.06); setTimeout(() => blip(780, 0.06), 60); },
  jump()   { blip(440, 0.05); setTimeout(() => blip(880, 0.07), 50); },
  commit() { blip(990, 0.05); setTimeout(() => blip(1320, 0.05), 60); },
  snore()  { blip(220, 0.12, "triangle"); },
  addRun() { blip(660, 0.06); setTimeout(() => blip(990, 0.08), 70); },
  pr()     { blip(784, 0.08); setTimeout(() => blip(988, 0.08), 90); setTimeout(() => blip(1319, 0.14), 180); },
  start()  { blip(523, 0.07); setTimeout(() => blip(659, 0.07), 80); setTimeout(() => blip(784, 0.1), 160); }
};
