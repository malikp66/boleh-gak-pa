"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useClientValue } from "./use-client-value";

/* Pengenalan suara bawaan browser (Web Speech API): Chrome Android & Safari iOS 14.5+.
   Kalau tidak didukung, tombol mic disembunyikan. */
interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

function getRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

// Kata pembuka yang sering diucapkan tapi bukan nama makanan.
const FILLER = /\b(boleh\s*(gak|ga|nggak|enggak|tidak)|bolehkah|aku|saya|mau|pengen|ingin|makan|minum|nih|dong|ya|yah|kah|tadi|ditawari|ditawarin|dikasih|apa|aman|nggak|gak|ga)\b/gi;
export const cleanSpoken = (t: string) => t.replace(/[?.!,]/g, " ").replace(FILLER, " ").replace(/\s+/g, " ").trim();

const ERRORS: Record<string, string> = {
  "not-allowed": "Izin mikrofon ditolak. Izinkan mikrofon di pengaturan browser.",
  "no-speech": "Tidak terdengar suara. Coba lagi, bicara lebih dekat ke HP.",
  "audio-capture": "Mikrofon tidak ditemukan.",
  network: "Butuh internet untuk mengenali suara.",
};

export function useSpeech(onFinal: (text: string) => void) {
  const supported = useClientValue(() => Boolean(getRecognition()), false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState("");
  const rec = useRef<SpeechRecognitionLike | null>(null);
  const finalCb = useRef(onFinal);
  useEffect(() => { finalCb.current = onFinal; }, [onFinal]);

  const start = useCallback(() => {
    const R = getRecognition();
    if (!R) return;
    setError("");
    setInterim("");
    const r = new R();
    r.lang = "id-ID";
    r.interimResults = true;
    r.continuous = false;
    r.maxAlternatives = 1;
    let finalText = "";
    r.onresult = (e) => {
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalText += res[0].transcript;
        else live += res[0].transcript;
      }
      setInterim((finalText + " " + live).trim());
    };
    r.onerror = (e) => { if (e.error !== "aborted") setError(ERRORS[e.error] ?? "Gagal mendengar. Coba lagi."); };
    r.onend = () => {
      setListening(false);
      if (finalText.trim()) finalCb.current(finalText.trim());
    };
    rec.current = r;
    setListening(true);
    r.start();
  }, []);

  const stop = useCallback(() => rec.current?.stop(), []);
  useEffect(() => () => rec.current?.abort(), []);

  return { supported, listening, interim, error, start, stop };
}
