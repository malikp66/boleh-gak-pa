"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

/**
 * Alert global (pojok atas layar) untuk seluruh aplikasi.
 *   const toast = useToast();
 *   toast("Pesan biasa");                         // info
 *   toast.success("Tercatat");                    // sukses
 *   toast.error("Gagal menyimpan", "Koneksi");    // pesan + judul
 *   toast({ type: "warning", message: "…", action: { label: "Ulangi", onClick } });
 */
export type AlertType = "success" | "info" | "warning" | "error";

export interface AlertInput {
  type?: AlertType;
  title?: string;
  message: string;
  /** milidetik; 0 = tidak hilang sendiri */
  duration?: number;
  action?: { label: string; onClick: () => void };
}

interface AlertItem extends Required<Omit<AlertInput, "action" | "title">> {
  id: number;
  title?: string;
  action?: AlertInput["action"];
  leaving?: boolean;
}

type Shortcut = (message: string, title?: string) => void;
export type Toast = ((input: string | AlertInput, type?: AlertType) => void) & Record<AlertType, Shortcut>;

const META: Record<AlertType, { icon: string; label: string; duration: number }> = {
  success: { icon: "✅", label: "Berhasil", duration: 3200 },
  info: { icon: "💬", label: "Info", duration: 3600 },
  warning: { icon: "⚠️", label: "Perhatian", duration: 4500 },
  error: { icon: "⛔", label: "Gagal", duration: 6000 },
};
const MAX_VISIBLE = 3;

const noop = Object.assign(() => {}, { success: () => {}, info: () => {}, warning: () => {}, error: () => {} }) as Toast;
const AlertCtx = createContext<Toast>(noop);
export const useToast = () => useContext(AlertCtx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<AlertItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setItems((list) => list.map((a) => (a.id === id ? { ...a, leaving: true } : a)));
    setTimeout(() => setItems((list) => list.filter((a) => a.id !== id)), 220);
  }, []);

  const push = useCallback((input: string | AlertInput, type?: AlertType) => {
    const a: AlertInput = typeof input === "string" ? { message: input, type } : input;
    const t = a.type ?? type ?? "info";
    const item: AlertItem = {
      id: nextId.current++, type: t, title: a.title, message: a.message,
      duration: a.duration ?? META[t].duration, action: a.action,
    };
    setItems((list) => {
      // pesan yang sama persis tidak ditumpuk dua kali
      const rest = list.filter((x) => !(x.message === item.message && x.type === item.type));
      return [item, ...rest].slice(0, MAX_VISIBLE);
    });
  }, []);

  const toast = useMemo(() => {
    const fn = ((input: string | AlertInput, type?: AlertType) => push(input, type)) as Toast;
    (Object.keys(META) as AlertType[]).forEach((t) => {
      fn[t] = (message, title) => push({ type: t, message, title });
    });
    return fn;
  }, [push]);

  return (
    <AlertCtx.Provider value={toast}>
      {children}
      <div className="alerts" aria-live="polite">
        {items.map((a) => <AlertCard key={a.id} item={a} onClose={() => dismiss(a.id)} />)}
      </div>
    </AlertCtx.Provider>
  );
}

function AlertCard({ item, onClose }: { item: AlertItem; onClose: () => void }) {
  const [paused, setPaused] = useState(false);
  const left = useRef(item.duration);
  const startedAt = useRef(0);

  // hitung mundur yang bisa dijeda saat disentuh/diarahkan kursor
  useEffect(() => {
    if (!item.duration || paused || item.leaving) return;
    startedAt.current = Date.now();
    const t = setTimeout(onClose, left.current);
    return () => {
      clearTimeout(t);
      left.current -= Date.now() - startedAt.current;
    };
  }, [paused, item.duration, item.leaving, onClose]);

  const meta = META[item.type];
  return (
    <div
      className={`alert-card ${item.type}${item.leaving ? " leaving" : ""}`}
      role={item.type === "error" || item.type === "warning" ? "alert" : "status"}
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)} onTouchEnd={() => setPaused(false)}
    >
      <span className="alert-icon" aria-hidden="true">{meta.icon}</span>
      <div className="alert-body">
        <b className="alert-title">{item.title ?? meta.label}</b>
        <p className="alert-msg">{item.message}</p>
        {item.action && (
          <button className="alert-action" onClick={() => { item.action!.onClick(); onClose(); }}>{item.action.label}</button>
        )}
      </div>
      <button className="alert-close" onClick={onClose} aria-label="Tutup">×</button>
      {item.duration > 0 && (
        <i className="alert-timer" style={{ animationDuration: `${item.duration}ms`, animationPlayState: paused ? "paused" : "running" }} />
      )}
    </div>
  );
}
