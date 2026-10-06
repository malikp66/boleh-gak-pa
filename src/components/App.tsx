"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import CatatanTab from "./CatatanTab";
import CekTab from "./CekTab";
import DaftarTab from "./DaftarTab";
import PantauTab from "./PantauTab";
import ReviewTab from "./ReviewTab";
import { api, ToastProvider } from "./ui";
import { Flare, Me } from "./types";
import { conditionInfo, MonitorKind, normalizeConditions } from "@/lib/conditions";
import { ensureDevice } from "@/lib/device";

type Tab = "cek" | "daftar" | "catatan" | "pantau" | "review";
const PROFILE_KEY = "active-profile";

export default function App() {
  const router = useRouter();
  const params = useSearchParams();
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState("");
  const [profileId, setProfileId] = useState("");
  const [tab, setTab] = useState<Tab>("cek");
  const [flareJoint, setFlareJoint] = useState<string | null>(null);
  const [prefill, setPrefill] = useState<{ food: string; n: number } | null>(null);
  const [addName, setAddName] = useState<{ name: string; n: number } | null>(null);
  const [reload, setReload] = useState(0);
  const welcome = params.get("welcome") === "1";

  const loadMe = useCallback(() =>
    ensureDevice()
      .then(() => api<Me>("/api/me"))
      .then((m) => {
        if (!m.consented || !m.profiles.length) return router.replace("/mulai");
        let saved = "";
        try { saved = localStorage.getItem(PROFILE_KEY) ?? ""; } catch {}
        setProfileId((cur) => cur || (m.profiles.some((p) => p.id === saved) ? saved : m.profiles[0].id));
        setMe(m);
      })
      .catch((e: Error) => setError(e.message)),
  [router]);

  useEffect(() => {
    void loadMe();
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, [loadMe]);

  const profile = me?.profiles.find((p) => p.id === profileId);
  const conditions = profile ? normalizeConditions(profile.kondisi) : [];
  const monitors = conditions.map((c) => conditionInfo(c)?.monitor).filter(Boolean) as MonitorKind[];
  const tabs: Tab[] = ["cek", "daftar", "catatan", ...(monitors.length ? (["pantau"] as Tab[]) : []), "review"];
  const hasGout = monitors.includes("kambuh");

  // banner "lagi kambuh" di tab Cek; dimuat ulang setiap ada perubahan di tab Pantau (reload)
  useEffect(() => {
    if (!profileId || !hasGout) return;
    api<Flare[]>(`/api/flares?profileId=${profileId}`).then((f) => setFlareJoint(f.find((x) => !x.ended)?.joint ?? null)).catch(() => {});
  }, [profileId, hasGout, reload]);

  const go = (t: Tab) => {
    setTab(t);
    window.scrollTo(0, 0);
  };

  if (error) return <main className="center-page"><div className="card"><div className="error-box">{error}</div><button className="btn" onClick={() => location.reload()}>Coba lagi</button></div></main>;
  if (!me || !profile) return <main><div className="card"><p className="muted">Menyiapkan…</p></div></main>;

  return (
    <ToastProvider>
      <header className="top">
        <div className="brand">
          <h1>Boleh Gak, Ya?</h1>
          <p className="sub">{profile.nama} · {conditions.map((c) => conditionInfo(c)!.short).join(" · ")}</p>
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
          <CekTab key={prefill?.n ?? 0} profile={profile} flareJoint={flareJoint} prefill={prefill} welcome={welcome && !prefill}
            onSaveUnknown={(name) => { setAddName({ name, n: Date.now() }); go("daftar"); }} />
        )}
        {tab === "daftar" && <DaftarTab key={addName?.n ?? 0} profile={profile} addName={addName} onCheck={(food) => { setPrefill({ food, n: Date.now() }); go("cek"); }} />}
        {tab === "catatan" && <CatatanTab profile={profile} me={me} />}
        {tab === "pantau" && <PantauTab profile={profile} monitors={monitors} onChanged={() => setReload((n) => n + 1)} />}
        {tab === "review" && <ReviewTab profile={profile} me={me} />}

        <p className="disclaimer">
          Bukan pengganti dokter. Lampu dari tabel gizi &amp; pedoman resmi, kata-katanya ditulis AI.<br />
          <a href="/privasi">Privasi</a>
        </p>
      </main>

      <nav className="bottom" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
        {tabs.map((t) => <button key={t} className={tab === t ? "active" : ""} onClick={() => go(t)}>{t}</button>)}
      </nav>
    </ToastProvider>
  );
}
