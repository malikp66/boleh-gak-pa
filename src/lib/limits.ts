"use client";
import { useEffect, useSyncExternalStore } from "react";

/**
 * Batas pemakaian harian (jatah AI, jeda bel) dari /api/limits, dibagi ke semua layar.
 * Dimuat sekali, lalu disegarkan setelah aksi yang memakai jatah (refreshLimits).
 */
export type LimitKind = "assess" | "photo" | "analyze" | "summary" | "tts";
export interface Limits {
  usage: Record<LimitKind, { limit: number; used: number; left: number }>;
  budgetReached: boolean;
  nudgeGapHours: number;
}

let state: Limits | null = null;
let loading: Promise<void> | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export function refreshLimits(): Promise<void> {
  loading ??= fetch("/api/limits")
    .then((r) => (r.ok ? r.json() : null))
    .then((d: Limits | null) => { if (d) { state = d; emit(); } })
    .catch(() => {})
    .finally(() => { loading = null; });
  return loading;
}

export function useLimits(): Limits | null {
  const value = useSyncExternalStore(
    (cb) => { subs.add(cb); return () => { subs.delete(cb); }; },
    () => state,
    () => null,
  );
  useEffect(() => { if (!state) void refreshLimits(); }, []);
  return value;
}

/** Kalimat ramah per jenis: apa yang terjadi kalau jatahnya habis. */
export const LIMIT_TEXT: Record<LimitKind, { label: string; unit: string; after: string }> = {
  assess: { label: "Jawaban AI", unit: "jawaban", after: "setelah itu tetap dijawab dari tabel gizi" },
  photo: { label: "Kenali foto", unit: "foto", after: "setelah itu ketik nama makanannya saja" },
  analyze: { label: "Pelajari makanan baru", unit: "makanan baru", after: "makanan baru dipelajari lagi besok" },
  summary: { label: "Ringkasan AI", unit: "ringkasan", after: "ringkasan biasa tetap tersedia" },
  tts: { label: "Suara natural", unit: "bacaan", after: "setelah itu memakai suara HP" },
};
