"use client";
import { useState } from "react";
import { secureWithGoogle } from "@/lib/session";

/** Ajak pengguna anonim mengamankan datanya. Akun ditingkatkan di tempat: user ID sama, tidak perlu merge. */
export default function SecureCard({ compact = false }: { compact?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="secure">
      <p>🔐 Datamu baru tersimpan untuk perangkat ini.</p>
      {!compact && (
        <p className="small" style={{ fontWeight: 500 }}>
          Kalau data browser dihapus atau ganti HP, catatanmu tidak bisa dikembalikan. Amankan dengan Google supaya bisa dibuka lagi kapan saja. Semua catatanmu tetap utuh.
        </p>
      )}
      {error && <div className="error-box">{error}</div>}
      <button className="btn" disabled={busy} onClick={async () => {
        setBusy(true);
        try { await secureWithGoogle(); } catch (e) { setError((e as Error).message); setBusy(false); }
      }}>{busy ? "Membuka Google…" : "Amankan data dengan Google"}</button>
    </div>
  );
}
