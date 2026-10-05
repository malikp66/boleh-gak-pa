import App from "@/components/App";
import { supabaseConfigured } from "@/lib/supabase/env";

export default function Home() {
  if (!supabaseConfigured) {
    return (
      <main className="center-page">
        <div className="card">
          <h1 className="hero-title">Belum tersambung</h1>
          <p>Isi <code>NEXT_PUBLIC_SUPABASE_URL</code> dan <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> di <code>.env.local</code> (lihat <code>.env.example</code>), lalu jalankan ulang.</p>
        </div>
      </main>
    );
  }
  return <App />;
}
