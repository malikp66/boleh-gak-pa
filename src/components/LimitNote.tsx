"use client";
import { LIMIT_TEXT, LimitKind, useLimits } from "@/lib/limits";

/**
 * Catatan kecil tentang sisa jatah, ditaruh tepat di bawah fiturnya.
 * Diam saja selama jatahnya masih banyak; muncul pelan saat tinggal sedikit, dan menjelaskan
 * apa yang terjadi kalau habis (tanpa nada peringatan).
 */
export default function LimitNote({ kind, showBelow = 3, always = false }: { kind: LimitKind; showBelow?: number; always?: boolean }) {
  const limits = useLimits();
  const u = limits?.usage[kind];
  if (!u) return null;
  const t = LIMIT_TEXT[kind];
  if (!always && u.left > showBelow) return null;
  return (
    <p className={`limit-note${u.left === 0 ? " out" : ""}`}>
      {u.left === 0
        ? <>Jatah {t.label.toLowerCase()} hari ini sudah terpakai · {t.after}. Besok terisi lagi.</>
        : <>Sisa {u.left} {t.unit} hari ini · {t.after}.</>}
    </p>
  );
}
