import { Suspense } from "react";
import App from "@/components/App";
import { dbConfigured } from "@/lib/db";

export const dynamic = "force-dynamic";

export default function Home() {
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
  return <Suspense><App /></Suspense>;
}
