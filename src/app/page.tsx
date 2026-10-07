import { Suspense } from "react";
import { cookies } from "next/headers";
import App from "@/components/App";
import Landing from "@/components/public/Landing";
import { dbConfigured } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Beranda: tamu baru & mesin pencari (belum punya cookie perangkat) melihat halaman perkenalan,
 * pengguna yang sudah punya perangkat terdaftar langsung masuk aplikasi.
 */
export default async function Home() {
  if (!dbConfigured) {
    return (
      <main className="center-page">
        <div className="card">
          <h1 className="hero-title">Belum tersambung</h1>
          <p>Isi <code>DATABASE_URL</code> di <code>.env</code> (jalankan <code>neon env pull</code>), lalu jalankan ulang.</p>
        </div>
      </main>
    );
  }
  if (!(await cookies()).has("bgy_key")) return <Landing />;
  return <Suspense><App /></Suspense>;
}
