"use client";
import { refreshLimits } from "./limits";
/**
 * Membacakan jawaban dengan suara yang paling halus yang tersedia.
 *   1. "ai"        → Gemini TTS lewat /api/tts (paling natural, berbayar kecil, butuh internet)
 *   2. "perangkat" → suara bawaan HP; dipilih otomatis suara Indonesia terbaik
 *                    (Google/Natural/Enhanced/Premium lebih halus dari suara default)
 * Teks dipecah per kalimat supaya Chrome tidak memotong bacaan panjang dan jedanya terdengar wajar.
 * Kalau suara AI gagal, otomatis kembali ke suara HP.
 */

export type VoiceMode = "perangkat" | "ai";
export interface VoiceSettings { mode: VoiceMode; voiceURI: string; rate: number; aiVoice: string }

const KEY = "voice-settings";
const DEFAULTS: VoiceSettings = { mode: "perangkat", voiceURI: "", rate: 0.95, aiVoice: "Sulafat" };

export const AI_VOICES: { id: string; label: string }[] = [
  { id: "Sulafat", label: "Perempuan, hangat" },
  { id: "Achird", label: "Laki-laki, ramah" },
  { id: "Kore", label: "Perempuan, tegas" },
  { id: "Charon", label: "Laki-laki, tenang" },
];

let cached: { raw: string; value: VoiceSettings } | null = null;
export function getVoiceSettings(): VoiceSettings {
  let raw = "";
  try { raw = localStorage.getItem(KEY) ?? ""; } catch {}
  if (cached?.raw === raw) return cached.value; // referensi stabil untuk useSyncExternalStore
  let value = DEFAULTS;
  try { if (raw) value = { ...DEFAULTS, ...JSON.parse(raw) }; } catch {}
  cached = { raw, value };
  return value;
}
export function setVoiceSettings(patch: Partial<VoiceSettings>) {
  const next = { ...getVoiceSettings(), ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  return next;
}

// ---------------------------------------------------------------- suara bawaan HP
const synth = () => (typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null);

/** Skor kehalusan: suara jaringan/neural jauh lebih enak didengar daripada suara offline lama. */
export function voiceScore(v: Pick<SpeechSynthesisVoice, "name" | "lang" | "localService">): number {
  const lang = v.lang.toLowerCase().replace("_", "-");
  if (!lang.startsWith("id") && !lang.startsWith("in")) return -1;
  let s = 10;
  const n = v.name.toLowerCase();
  if (/natural|neural|online/.test(n)) s += 50;
  if (/premium|enhanced|plus/.test(n)) s += 40;
  if (/google/.test(n)) s += 30;
  if (/gadis|ardi|damayanti|siti/.test(n)) s += 10;
  if (!v.localService) s += 5;
  if (/compact|espeak/.test(n)) s -= 20;
  return s;
}

let voiceList: { key: string; list: SpeechSynthesisVoice[] } = { key: "", list: [] };
/** Daftar suara Indonesia, terbaik di atas. Referensi stabil selama daftar tidak berubah. */
export function indonesianVoices(): SpeechSynthesisVoice[] {
  const all = synth()?.getVoices() ?? [];
  const list = all.filter((v) => voiceScore(v) >= 0).sort((a, b) => voiceScore(b) - voiceScore(a));
  const key = list.map((v) => v.voiceURI).join("|");
  if (key !== voiceList.key) voiceList = { key, list };
  return voiceList.list;
}
export function subscribeVoices(cb: () => void) {
  const s = synth();
  if (!s) return () => {};
  s.addEventListener("voiceschanged", cb);
  return () => s.removeEventListener("voiceschanged", cb);
}

/** Pecah per kalimat, gabungkan yang pendek, batasi ±180 huruf per potongan. */
export function chunkText(text: string, max = 180): string[] {
  const sentences = text.replace(/\s+/g, " ").trim().match(/[^.!?…]+[.!?…]*\s*/g) ?? [];
  const out: string[] = [];
  for (const raw of sentences) {
    const sent = raw.trim();
    if (!sent) continue;
    const parts = sent.length > max ? sent.split(/(?<=[,;:])\s+/) : [sent];
    for (const p of parts) {
      const last = out[out.length - 1];
      if (last && last.length + p.length + 1 <= max && last.length < 60) out[out.length - 1] = `${last} ${p}`;
      else out.push(p);
    }
  }
  return out;
}

function speakNative(text: string, st: VoiceSettings): boolean {
  const s = synth();
  if (!s) return false;
  s.cancel();
  const voices = indonesianVoices();
  const voice = voices.find((v) => v.voiceURI === st.voiceURI) ?? voices[0];
  for (const part of chunkText(text)) {
    const u = new SpeechSynthesisUtterance(part);
    u.lang = voice?.lang ?? "id-ID";
    if (voice) u.voice = voice;
    u.rate = st.rate;
    u.pitch = 1;
    s.speak(u);
  }
  return true;
}

// ---------------------------------------------------------------- suara AI
const audioCache = new Map<string, string>(); // teks → blob URL (selama tab terbuka)
let current: HTMLAudioElement | null = null;

async function speakAI(text: string, st: VoiceSettings) {
  const k = `${st.aiVoice}|${text}`;
  let url = audioCache.get(k);
  if (!url) {
    const res = await fetch("/api/tts", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text.slice(0, 700), voice: st.aiVoice }),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? "Suara AI tidak tersedia");
    url = URL.createObjectURL(await res.blob());
    audioCache.set(k, url);
    void refreshLimits();
  }
  current = new Audio(url);
  current.playbackRate = Math.max(0.8, Math.min(1.2, st.rate + 0.05));
  await current.play();
}

export function stopSpeaking() {
  synth()?.cancel();
  current?.pause();
  current = null;
}

/**
 * Bacakan teks. onFallback dipanggil (sekali per sesi) kalau suara AI gagal dan beralih ke suara HP.
 * Mengembalikan false kalau HP sama sekali tidak bisa membacakan.
 */
let warned = false;
export async function speakText(text: string, onFallback?: (reason: string) => void, override?: Partial<VoiceSettings>): Promise<boolean> {
  const st = { ...getVoiceSettings(), ...override };
  stopSpeaking();
  if (st.mode === "ai") {
    try {
      await speakAI(text, st);
      return true;
    } catch (e) {
      if (!warned || override) onFallback?.((e as Error).message);
      warned = true;
    }
  }
  return speakNative(text, st);
}
