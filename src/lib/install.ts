"use client";
/**
 * Pasang aplikasi (PWA) ke layar HP.
 * Kenapa wajib di awal: di iPhone, aplikasi yang dipasang punya penyimpanan TERPISAH dari Safari.
 * Kalau daftar di Safari lalu baru pasang, aplikasinya mulai kosong (ID perangkat berbeda).
 * Dengan memasang dulu, ID perangkat dibuat di dalam aplikasi dan tetap sama selamanya.
 * Notifikasi di iPhone juga hanya bisa untuk aplikasi yang sudah dipasang.
 */

export type Platform = "ios" | "ios-other" | "android" | "inapp" | "desktop";

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: InstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  // Chrome/Edge/Samsung Internet di Android: tahan event supaya bisa dipicu dari tombol kita sendiri
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e as InstallPromptEvent; emit(); });
  window.addEventListener("appinstalled", () => { installed = true; deferred = null; emit(); });
  // service worker aktif adalah syarat Chrome menampilkan tombol pasang
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
}

export function subscribeInstall(cb: () => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

/** "prompt" = bisa langsung pasang dengan satu tombol; "installed" = baru saja terpasang; "manual" = lewat menu browser. */
export type InstallState = "prompt" | "installed" | "manual";
export const installState = (): InstallState => (installed ? "installed" : deferred ? "prompt" : "manual");

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)").matches
    || window.matchMedia?.("(display-mode: fullscreen)").matches
    || Boolean((navigator as unknown as { standalone?: boolean }).standalone);
}

export function platform(): Platform {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent;
  // browser di dalam aplikasi lain (WhatsApp, Instagram, Facebook, TikTok, Line) tidak bisa memasang PWA
  if (/FBAN|FBAV|Instagram|Line\/|TikTok|musical_ly|WhatsApp|; wv\)/i.test(ua)) return "inapp";
  const ios = /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (ios) return /CriOS|FxiOS|EdgiOS/.test(ua) ? "ios-other" : "ios";
  if (/android/i.test(ua)) return "android";
  return "desktop";
}

export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  const e = deferred;
  await e.prompt();
  const { outcome } = await e.userChoice;
  deferred = null;
  if (outcome === "accepted") installed = true;
  emit();
  return outcome === "accepted";
}

const SKIP = "install-skip";
export const installSkipped = () => { try { return sessionStorage.getItem(SKIP) === "1"; } catch { return false; } };
export const skipInstall = () => { try { sessionStorage.setItem(SKIP, "1"); } catch {} };
