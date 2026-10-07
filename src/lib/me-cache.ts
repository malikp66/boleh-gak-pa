"use client";
import type { Me } from "@/components/types";

/**
 * Salinan terakhir /api/me di HP ini, supaya aplikasi langsung tampil saat dibuka
 * (data segar diambil di belakang layar). Hanya berisi data milik pengguna HP ini sendiri.
 */
const KEY = "me-cache-v1";
let memo: { raw: string; value: Me | null } = { raw: "", value: null };

export function readMeCache(): Me | null {
  let raw = "";
  try { raw = localStorage.getItem(KEY) ?? ""; } catch {}
  if (raw === memo.raw) return memo.value; // referensi stabil untuk useSyncExternalStore
  let value: Me | null = null;
  try { value = raw ? (JSON.parse(raw) as Me) : null; } catch {}
  memo = { raw, value };
  return value;
}

export function writeMeCache(me: Me) {
  try { localStorage.setItem(KEY, JSON.stringify(me)); } catch {}
}

/** Dipanggil saat HP pindah akun (kode pemulihan, masuk dengan WhatsApp). */
export function clearMeCache() {
  try { localStorage.removeItem(KEY); } catch {}
}
