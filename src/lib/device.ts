"use client";
import { clearMeCache } from "./me-cache";

// Cadangan kunci perangkat di browser. Kalau cookie hilang tapi cadangan masih ada, akun dipulihkan otomatis.
// Kalau dua-duanya hilang (data browser dihapus), pengguna memakai kode pemulihan.
const BACKUP = "bgy-backup";
const read = () => { try { return localStorage.getItem(BACKUP) ?? undefined; } catch { return undefined; } };
const write = (k: string) => { try { localStorage.setItem(BACKUP, k); } catch {} };

let inflight: Promise<void> | null = null;

/** Pastikan perangkat ini punya akun. Aman dipanggil berkali-kali. */
export function ensureDevice(): Promise<void> {
  inflight ??= (async () => {
    const res = await fetch("/api/device", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ backup: read() }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Gagal menyiapkan perangkat. Periksa koneksi lalu coba lagi.");
    if (data.key) write(data.key);
    try { await navigator.storage?.persist?.(); } catch {}
  })().finally(() => { inflight = null; });
  return inflight;
}

export async function getRecoveryCode(): Promise<string> {
  const res = await fetch("/api/device/recovery");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  return data.code;
}

export async function restoreDevice(code: string): Promise<void> {
  const res = await fetch("/api/device/restore", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Gagal memulihkan");
  write(code.toUpperCase().replace(/[^0-9A-Z]/g, ""));
  clearMeCache(); // akun berbeda: jangan tampilkan salinan data akun sebelumnya
}
