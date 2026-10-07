"use client";
import { useEffect, useState } from "react";

const TIPS = [
  "Kuah soto dan bakso menyumbang sebagian besar garamnya.",
  "Makan sayur dulu, baru nasi, bikin gula darah naik lebih pelan.",
  "Es teh manis segelas bisa berisi 4 sendok teh gula.",
  "Emping, jeroan, dan kaldu pekat termasuk tinggi purin.",
  "Air putih membantu ginjal membuang asam urat.",
  "Santan kental tinggi lemak jenuh, coba yang encer.",
];

/** Layar pembuka di tengah layar: lampu lalu lintas berkedip + tips gizi bergantian. */
export function Splash({ text = "Menyiapkan aplikasi", error, onRetry }: { text?: string; error?: string; onRetry?: () => void }) {
  const [tip, setTip] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTip((i) => (i + 1) % TIPS.length), 3200);
    return () => clearInterval(t);
  }, []);
  return (
    <main className="splash" aria-busy={!error}>
      <div className="splash-light" aria-hidden="true"><i /><i /><i /></div>
      <h1 className="splash-title">Boleh Gak, Ya?</h1>
      {error ? (
        <>
          <p className="splash-error">{error}</p>
          {onRetry && <button className="btn primary" style={{ width: "auto" }} onClick={onRetry}>Coba lagi</button>}
        </>
      ) : (
        <>
          <p className="splash-text">{text}<span className="dots"><b>.</b><b>.</b><b>.</b></span></p>
          <p className="splash-tip" key={tip}>💡 {TIPS[tip]}</p>
        </>
      )}
    </main>
  );
}

/** Kerangka kartu berkilau pengganti tulisan "Memuat…". */
export function SkeletonCard({ rows = 3, title = true }: { rows?: number; title?: boolean }) {
  return (
    <div className="card skeleton" aria-busy="true" aria-label="Memuat">
      {title && <span className="sk sk-title" />}
      {Array.from({ length: rows }, (_, i) => <span key={i} className="sk sk-row" style={{ width: `${92 - i * 14}%` }} />)}
    </div>
  );
}
