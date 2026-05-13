// Bright, modern two-note chime using Web Audio. Plays in both the desktop
// dashboards and inside the Capacitor Android WebView, so the same call site
// fires from desktop and the bundled mobile APK.
//
// Sound design:
//   • Two-note ascending chime: E5 → A5 (a perfect 4th — pleasant, alerting
//     without being saccharine).
//   • Each note is a stack of 4 sine partials (1× / 2× / 3× / 4×) so the
//     timbre reads as a real bell, not a square-wave beep.
//   • Lowpass at ~5 kHz rolls off the harshness from the higher partials.
//   • A tiny noise burst at t0 gives a percussive "strike" without a click.
//   • A high E7 "sparkle" rides over the second note so it ends with a
//     little bit of Apple-style shimmer.

let _ctx = null;
let _unlocked = false;

const getCtx = () => {
  if (typeof window === 'undefined') return null;
  if (_ctx) return _ctx;
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) return null;
  try { _ctx = new Ctor(); } catch { _ctx = null; }
  return _ctx;
};

// Browsers block AudioContext.resume() and navigator.vibrate() until the user
// has interacted with the page once. Gate both on the same flag.
const armUnlock = () => {
  if (_unlocked || typeof window === 'undefined') return;
  const unlock = () => {
    const ctx = getCtx();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    _unlocked = true;
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
    window.removeEventListener('touchstart', unlock);
  };
  window.addEventListener('pointerdown', unlock, { once: true });
  window.addEventListener('keydown', unlock, { once: true });
  window.addEventListener('touchstart', unlock, { once: true });
};
armUnlock();

// Stack of harmonics that gives a sine note a bell-like timbre.
const PARTIALS = [
  { mult: 1.0, gain: 1.00 },
  { mult: 2.0, gain: 0.42 },
  { mult: 3.0, gain: 0.18 },
  { mult: 4.0, gain: 0.08 },
];

// Schedule one "bell note" — a short attack, exponential decay, multiple
// sine partials summed through `outNode` (which is shared between notes so
// the lowpass + master gain chain only exists once).
const scheduleBell = (ctx, outNode, freq, startTime, duration, peakGain) => {
  for (const p of PARTIALS) {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * p.mult, startTime);
    env.gain.setValueAtTime(0, startTime);
    env.gain.linearRampToValueAtTime(peakGain * p.gain, startTime + 0.006);
    env.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    osc.connect(env).connect(outNode);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.05);
  }
};

// Quick noise burst that gives the bell a percussive "mallet strike" front
// without a clicky transient. Bandpassed around 4 kHz so it cuts through.
const scheduleStrike = (ctx, outNode, startTime) => {
  const dur = 0.06;
  const buf = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * dur)), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 4000;
  bp.Q.value = 6;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0, startTime);
  env.gain.linearRampToValueAtTime(0.18, startTime + 0.005);
  env.gain.exponentialRampToValueAtTime(0.0001, startTime + dur);
  src.connect(bp).connect(env).connect(outNode);
  src.start(startTime);
  src.stop(startTime + dur + 0.02);
};

export const playNotificationSound = () => {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});

  const t0 = ctx.currentTime + 0.01;

  // Shared output chain: oscillators → lowpass → master gain → speakers.
  const master = ctx.createGain();
  master.gain.value = 0.55;
  const lpf = ctx.createBiquadFilter();
  lpf.type = 'lowpass';
  lpf.frequency.value = 5200;
  lpf.Q.value = 0.7;
  lpf.connect(master);
  master.connect(ctx.destination);

  // Percussive "tick" at the start so the bell feels like it was struck.
  scheduleStrike(ctx, lpf, t0);

  // Two-note ascending chime — E5 to A5, ~140 ms apart.
  scheduleBell(ctx, lpf, 659.25, t0,        0.85, 0.32); // E5 — first strike
  scheduleBell(ctx, lpf, 880.00, t0 + 0.14, 1.10, 0.30); // A5 — answering note

  // High E7 sparkle on the second note for a touch of brightness.
  scheduleBell(ctx, lpf, 2637.0, t0 + 0.16, 0.55, 0.06);
};

export const triggerVibration = (pattern = [40, 30, 60]) => {
  if (typeof navigator === 'undefined') return;
  // Chrome blocks vibrate() before first gesture and logs an intervention
  // warning. Skip until the unlock handler has fired.
  if (!_unlocked) return;
  try { navigator.vibrate?.(pattern); } catch { /* noop */ }
};

// Single entry point — fires audio + a short two-tap haptic.
export const ringNotification = () => {
  playNotificationSound();
  triggerVibration([40, 30, 60]);
};
