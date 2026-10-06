"use client";
/** Tampilan sederhana (default aktif): menu bawah hanya yang paling sering dipakai. Disimpan per HP. */
const KEY = "simple-mode";
export function simpleMode(): boolean {
  try { return localStorage.getItem(KEY) !== "0"; } catch { return true; }
}
export function setSimpleMode(on: boolean) {
  try { localStorage.setItem(KEY, on ? "1" : "0"); } catch {}
}
