// ═══════════════════════════════════════════════════════════════
//  SOUND EFFECTS — Web Audio API (no external files needed)
// ═══════════════════════════════════════════════════════════════

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  const ctx = audioCtx;
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function playTone(freq: number, duration: number, type: OscillatorType = 'sine', volume: number = 0.08) {
  try {
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch {}
}

function playChord(freqs: number[], duration: number, type: OscillatorType = 'sine', volume: number = 0.06) {
  freqs.forEach(f => playTone(f, duration, type, volume));
}

// ── Public API ──

export function playSend() {
  playTone(880, 0.1, 'sine', 0.06);
  setTimeout(() => playTone(1100, 0.08, 'sine', 0.04), 60);
}

export function playReceive() {
  playChord([523, 659], 0.2, 'sine', 0.05); // C5 + E5 — gentle ding
}

export function playReminder() {
  playTone(698, 0.15, 'sine', 0.07); // F5
  setTimeout(() => playTone(880, 0.15, 'sine', 0.07), 150); // A5
  setTimeout(() => playTone(1047, 0.25, 'sine', 0.06), 300); // C6
}

export function playError() {
  playTone(300, 0.15, 'triangle', 0.06);
  setTimeout(() => playTone(250, 0.2, 'triangle', 0.05), 120);
}

export function playVideoCall() {
  playTone(523, 0.12, 'sine', 0.05);
  setTimeout(() => playTone(659, 0.12, 'sine', 0.05), 140);
  setTimeout(() => playTone(784, 0.12, 'sine', 0.05), 280);
  setTimeout(() => playTone(1047, 0.2, 'sine', 0.06), 420);
}
