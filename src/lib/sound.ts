"use client";
/**
 * Efek suara kecil dibuat langsung dengan Web Audio (tanpa file audio, ±0 KB).
 * Bisa dimatikan di Profil; pilihan disimpan di perangkat ini.
 */
const KEY = "bgy-sound";
let ctx: AudioContext | null = null;

export function soundOn(): boolean {
  try { return localStorage.getItem(KEY) !== "off"; } catch { return true; }
}
export function setSound(on: boolean) {
  try { localStorage.setItem(KEY, on ? "on" : "off"); } catch {}
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = "sine", gain = 0.12) {
  if (!ctx) return;
  const t0 = ctx.currentTime + start;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

const SOUNDS = {
  tap: () => tone(660, 0, 0.06, "triangle", 0.06),
  micOn: () => { tone(520, 0, 0.09); tone(780, 0.09, 0.12); },
  micOff: () => { tone(780, 0, 0.09); tone(520, 0.09, 0.12); },
  hijau: () => { tone(523, 0, 0.12); tone(659, 0.1, 0.12); tone(784, 0.2, 0.22); },
  kuning: () => { tone(587, 0, 0.14); tone(587, 0.18, 0.18); },
  merah: () => { tone(330, 0, 0.22, "square", 0.07); tone(262, 0.24, 0.3, "square", 0.07); },
  saved: () => { tone(880, 0, 0.08); tone(1175, 0.08, 0.16); },
  error: () => tone(200, 0, 0.25, "sawtooth", 0.05),
} as const;
export type SoundName = keyof typeof SOUNDS;

const VIBRATE: Partial<Record<SoundName, number | number[]>> = { merah: [80, 60, 80], saved: 30, micOn: 20 };

export function play(name: SoundName) {
  if (typeof window === "undefined" || !soundOn()) return;
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === "suspended") void ctx.resume();
    SOUNDS[name]();
    const v = VIBRATE[name];
    if (v) navigator.vibrate?.(v);
  } catch {}
}
