"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import CatatanTab from "./CatatanTab";
import CekTab from "./CekTab";
import DaftarTab from "./DaftarTab";
import KambuhTab from "./KambuhTab";
import ReviewTab from "./ReviewTab";
import { api, ToastProvider } from "./ui";
import { Flare, Me } from "./types";
import { createClient } from "@/lib/supabase/client";

const TABS = ["cek", "daftar", "catatan", "kambuh", "review"] as const;
type Tab = (typeof TABS)[number];
const PROFILE_KEY = "active-profile";

export default function App() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [profileId, setProfileId] = useState("");
  const [tab, setTab] = useState<Tab>("cek");
  const [flareJoint, setFlareJoint] = useState<string | null>(null);
  const [prefill, setPrefill] = useState<{ food: string; n: number } | null>(null);
  const [addName, setAddName] = useState<{ name: string; n: number } | null>(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    api<Me>("/api/me").then((m) => {
      if (!m.consented || !m.profiles.length) return router.replace("/onboarding");
      let saved = "";
      try { saved = localStorage.getItem(PROFILE_KEY) ?? ""; } catch {}
      setProfileId(m.profiles.some((p) => p.id === saved) ? saved : m.profiles[0].id);
      setMe(m);
    }).catch(() => {});
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, [router]);

  const profile = me?.profiles.find((p) => p.id === profileId);

  const refreshFlare = useCallback(() => {
    if (!profileId) return;
    api<Flare[]>(`/api/flares?profileId=${profileId}`).then((f) => setFlareJoint(f.find((x) => !x.ended)?.joint ?? null)).catch(() => {});
  }, [profileId]);
  useEffect(refreshFlare, [refreshFlare]);

  const go = (t: Tab) => {
    setTab(t);
    window.scrollTo(0, 0);
  };

  if (!me || !profile) return <main><div className="card"><p className="muted">Memuat…</p></div></main>;

  return (
    <ToastProvider>
      <header className="top">
        <div className="brand">
          <h1>Boleh Gak, {profile.panggilan}?</h1>
          <p className="sub">{profile.kondisi.map((k) => k.split(" (")[0]).join(" · ")}</p>
        </div>
        {me.profiles.length > 1 ? (
          <select className="profile-switch" value={profileId} onChange={(e) => {
            setProfileId(e.target.value);
            try { localStorage.setItem(PROFILE_KEY, e.target.value); } catch {}
          }}>
            {me.profiles.map((p) => <option key={p.id} value={p.id}>{p.nama}</option>)}
          </select>
        ) : (
          <span className={`pill${me.ai.ready ? " on" : ""}`} title={me.ai.model}>{me.ai.ready ? "AI aktif" : "Mode tabel"}</span>
        )}
      </header>

      <main key={`${profileId}-${reload}`}>
        {tab === "cek" && (
          <CekTab key={prefill?.n ?? 0} profile={profile} flareJoint={flareJoint} prefill={prefill}
            onSaveUnknown={(name) => { setAddName({ name, n: Date.now() }); go("daftar"); }}
            onLogged={() => {}} />
        )}
        {tab === "daftar" && <DaftarTab key={addName?.n ?? 0} profile={profile} addName={addName} onCheck={(food) => { setPrefill({ food, n: Date.now() }); go("cek"); }} />}
        {tab === "catatan" && <CatatanTab profile={profile} />}
        {tab === "kambuh" && <KambuhTab profile={profile} onChanged={() => { refreshFlare(); setReload((n) => n + 1); }} />}
        {tab === "review" && <ReviewTab profile={profile} me={me} />}

        <p className="disclaimer">
          Bukan pengganti dokter. Lampu ditentukan tabel makanan, kata-katanya ditulis AI.<br />
          {me.user.email} · <a href="/privasi">Privasi</a> ·{" "}
          <a href="#" onClick={async (e) => { e.preventDefault(); await createClient().auth.signOut(); location.href = "/login"; }}>Keluar</a>
        </p>
      </main>

      <nav className="bottom">
        {TABS.map((t) => (
          <button key={t} className={tab === t ? "active" : ""} onClick={() => go(t)}>{t}</button>
        ))}
      </nav>
    </ToastProvider>
  );
}
