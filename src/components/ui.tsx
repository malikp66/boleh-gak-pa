"use client";
import { createContext, useCallback, useContext, useRef, useState } from "react";

export async function api<T = unknown>(path: string, body?: unknown, method?: string): Promise<T> {
  const res = await fetch(path, body === undefined && !method ? {} : {
    method: method ?? "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) location.href = "/mulai";
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data as T;
}

// ---------------------------------------------------------------- toast
const ToastCtx = createContext<(msg: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [msg, setMsg] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const show = useCallback((m: string) => {
    setMsg(m);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(""), 2600);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {msg && <div className="toast">{msg}</div>}
    </ToastCtx.Provider>
  );
}

// ---------------------------------------------------------------- kecil-kecil
export function Chips<T extends string>({ items, value, onPick, labels }: {
  items: readonly T[]; value?: T; onPick: (v: T) => void; labels?: Partial<Record<T, string>>;
}) {
  return (
    <>
      {items.map((it) => (
        <button key={it} type="button" data-s={it} className={`chip${it === value ? " on" : ""}`} onClick={() => onPick(it)}>
          {labels?.[it] ?? it}
        </button>
      ))}
    </>
  );
}

const LEVEL_N: Record<string, number> = { rendah: 1, sedang: 2, tinggi: 3 };
export function Meter({ label, level }: { label: string; level: string | null }) {
  const n = LEVEL_N[level ?? ""] ?? 0;
  return (
    <div className="meter">
      <span>{label}</span>
      <span className="segs">{[1, 2, 3].map((i) => <i key={i} className={i <= n ? "f" : ""} />)}</span>
      <span>{level ?? "?"}</span>
    </div>
  );
}

export function speak(text: string, toast: (m: string) => void) {
  if (!("speechSynthesis" in window)) return toast("HP ini belum bisa membacakan");
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "id-ID";
  u.rate = 0.95;
  speechSynthesis.speak(u);
}

export const fmtDay = (iso: string) => new Date(iso).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "short" });
export const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
export const fmtShort = (iso: string) => new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
export const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const CAT_EMOJI: Record<string, string> = {
  "Kaki lima": "🥜", "Nasi & lauk": "🍚", Berkuah: "🍲", "Sate & bakar": "🍢", "Daging & jeroan": "🥩",
  Seafood: "🦐", "Mi & bakso": "🍜", "Gorengan & camilan": "🍘", "Kue & manis": "🍰", "Sayur & lalapan": "🥬",
  Buah: "🍉", Minuman: "🥤", "Fast food & western": "🍔", "Chinese & oriental": "🥟", "Jepang & Korea": "🍣",
  "Masakan daerah": "🍛", "Buatan keluarga": "🏠",
};

export function painFace(n: number): [string, string] {
  if (n <= 2) return ["🙂", "ringan"];
  if (n <= 4) return ["😐", "lumayan"];
  if (n <= 6) return ["😣", "sakit"];
  if (n <= 8) return ["😖", "sakit sekali"];
  return ["😭", "tak tertahankan"];
}

/** Perkecil foto di HP sebelum dikirim: hemat kuota & biaya AI. */
export function resizeImage(file: File, max = 768): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
