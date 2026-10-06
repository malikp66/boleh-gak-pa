"use client";
import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function google() {
    setBusy(true);
    setError("");
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${location.origin}/auth/callback` },
    });
    if (error) {
      setError("Gagal membuka login Google. Coba lagi.");
      setBusy(false);
    }
  }

  return (
    <main className="center-page">
      <div className="card">
        <p className="eyebrow">Teman makan yang jujur</p>
        <h1 className="hero-title">Boleh Gak, Ya?</h1>
        <p className="lead">Ditawari makanan dan ragu? Cek dulu: aman atau tidak untuk kondisimu, porsi yang pas, tips di warung, sampai cara menolak dengan sopan.</p>
        {error && <div className="error-box">{error}</div>}
        <button className="btn big google-btn" onClick={google} disabled={busy}>
          <svg viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.8 6C12.4 13.6 17.7 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z" />
            <path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.3.8-4.7l-7.8-6C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.8-6z" />
            <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.8 2.3-8.5 2.3-6.3 0-11.6-4.2-13.5-9.8l-7.8 6C6.6 42.6 14.6 48 24 48z" />
          </svg>
          {busy ? "Membuka Google…" : "Masuk dengan Google"}
        </button>
        <p className="small muted" style={{ marginTop: 16 }}>
          Data kesehatanmu hanya bisa dilihat olehmu dan keluarga yang kamu undang. <Link href="/privasi">Kebijakan privasi</Link>
        </p>
      </div>
    </main>
  );
}
