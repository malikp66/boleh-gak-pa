"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import CatatanTab from "./CatatanTab";
import CekTab from "./CekTab";
import DaftarTab from "./DaftarTab";
import PantauTab from "./PantauTab";
import ReviewTab from "./ReviewTab";
import { api } from "./ui";
import { Flare, Me } from "./types";
import { conditionInfo, MonitorKind, normalizeConditions } from "@/lib/conditions";
import { ensureDevice } from "@/lib/device";
import { play } from "@/lib/sound";
import Link from "next/link";
import { EmergencyButton, EmergencySheet } from "./Emergency";
import { simpleMode } from "@/lib/simple-mode";
import { installSkipped, isStandalone, platform } from "@/lib/install";
import InstallGuide from "./InstallGuide";
import { Splash } from "./Loading";
import { readMeCache, writeMeCache } from "@/lib/me-cache";
import { useClientValue } from "@/lib/use-client-value";

type Tab = "cek" | "daftar" | "catatan" | "pantau" | "review";
const PROFILE_KEY = "active-profile";
const TAB_LABEL: Record<Tab, [string, string]> = {
  cek: ["🍽️", "Tanya"], daftar: ["📋", "Daftar"], catatan: ["📒", "Catatan"], pantau: ["📈", "Pantau"], review: ["⭐", "Rangkuman"],
};

export default function App() {
  const router = useRouter();
  const params = useSearchParams();
  const [fresh, setMe] = useState<Me | null>(null);
  // tampil langsung dari salinan terakhir di HP; data segar menyusul di belakang layar
  const cachedMe = useClientValue(readMeCache, null);
  const me = fresh ?? cachedMe;
  const savedProfile = useClientValue(() => { try { return localStorage.getItem(PROFILE_KEY) ?? ""; } catch { return ""; } }, "");
  const [error, setError] = useState("");
  const [profileId, setProfileId] = useState("");
  const [tab, setTab] = useState<Tab>(() => {
    const t = params.get("tab");
    return t === "daftar" || t === "catatan" || t === "pantau" || t === "review" ? t : "cek";
  });
  const [sos, setSos] = useState(false);
  const needsInstall = useClientValue(() => !isStandalone() && platform() !== "desktop", false);
  const skippedInstall = useClientValue(installSkipped, false);
  const [installOpen, setInstallOpen] = useState(false);
  const [installHidden, setInstallHidden] = useState(false);
  const [flareJoint, setFlareJoint] = useState<string | null>(null);
  const [prefill, setPrefill] = useState<{ food: string; n: number } | null>(null);
  const [addName, setAddName] = useState<{ name: string; n: number } | null>(null);
  const [reload, setReload] = useState(0);
  const welcome = params.get("welcome") === "1";

  // satu permintaan saja: /api/me langsung (kalau cookie hilang, api() memulihkan perangkat lalu mengulang).
  // Perpanjangan cookie & penyegaran cadangan berjalan di belakang, tidak menahan tampilan.
  const loadMe = useCallback(() =>
    api<Me>("/api/me")
      .then((m) => {
        if (!m.consented || !m.profiles.length) return router.replace("/mulai");
        writeMeCache(m);
        setMe(m);
        void ensureDevice().catch(() => {});
      })
      .catch((e: Error) => { if (!readMeCache()) setError(e.message); }),
  [router]);

  useEffect(() => {
    void loadMe();
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, [loadMe]);

  const activeId = profileId || (me?.profiles.some((p) => p.id === savedProfile) ? savedProfile : me?.profiles[0]?.id ?? "");
  const profile = me?.profiles.find((p) => p.id === activeId);
  const conditions = profile ? normalizeConditions(profile.kondisi) : [];
  const monitors = conditions.map((c) => conditionInfo(c)?.monitor).filter(Boolean) as MonitorKind[];
  const simple = useClientValue(simpleMode, false);
  const tabs: Tab[] = simple
    ? ["cek", "catatan", ...(monitors.length ? (["pantau"] as Tab[]) : [])]
    : ["cek", "daftar", "catatan", ...(monitors.length ? (["pantau"] as Tab[]) : []), "review"];
  const hasGout = monitors.includes("kambuh");

  // banner "lagi kambuh" di tab Cek; dimuat ulang setiap ada perubahan di tab Pantau (reload)
  useEffect(() => {
    if (!activeId || !hasGout) return;
    api<Flare[]>(`/api/flares?profileId=${activeId}`).then((f) => setFlareJoint(f.find((x) => !x.ended)?.joint ?? null)).catch(() => {});
  }, [activeId, hasGout, reload]);

  const go = (t: Tab) => {
    play("tap");
    setTab(t);
    window.scrollTo(0, 0);
  };

  if (error) return <Splash error={`Belum bisa terhubung: ${error}`} onRetry={() => { setError(""); void loadMe(); }} />;
  if (!me || !profile) return <Splash />;

  return (
    <>
      <header className="top">
        <div className="brand">
          <h1>Boleh Gak, Ya?</h1>
          <p className="sub">{profile.nama} · {conditions.map((c) => conditionInfo(c)!.short).join(" · ")}</p>
        </div>
        <div className="top-actions">
          {conditions.includes("stroke_jantung") && <EmergencyButton onOpen={() => setSos(true)} />}
          {me.profiles.length > 1 && (
            <select className="profile-switch" value={activeId} onChange={(e) => {
              play("tap");
              setProfileId(e.target.value);
              try { localStorage.setItem(PROFILE_KEY, e.target.value); } catch {}
            }}>
              {me.profiles.map((p) => <option key={p.id} value={p.id}>{p.nama}</option>)}
            </select>
          )}
          <Link className="gear" href="/profil" aria-label="Profil & pengaturan">⚙️</Link>
        </div>
      </header>

      <main key={`${activeId}-${reload}`}>
        {needsInstall && !installHidden && (
          <div className="install-banner">
            <span aria-hidden="true">📲</span>
            <p><b>Pasang di layar HP</b><small>biar datanya aman &amp; bisa dapat pengingat</small></p>
            <button className="btn sm primary" onClick={() => setInstallOpen(true)}>Pasang</button>
            {skippedInstall && <button className="alert-close" aria-label="Tutup" onClick={() => setInstallHidden(true)}>×</button>}
          </div>
        )}
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

      {installOpen && (
        <div className="sheet-backdrop" onClick={() => setInstallOpen(false)}>
          <div className="card sheet" onClick={(e) => e.stopPropagation()}>
            <InstallGuide existing />
            <button className="btn" style={{ marginTop: 14 }} onClick={() => setInstallOpen(false)}>Tutup</button>
          </div>
        </div>
      )}
      {sos && <EmergencySheet profile={profile} onClose={() => setSos(false)} />}
      <nav className="bottom" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
        {tabs.map((t) => <button key={t} className={tab === t ? "active" : ""} onClick={() => go(t)}><span aria-hidden="true">{TAB_LABEL[t][0]}</span>{TAB_LABEL[t][1]}</button>)}
      </nav>
    </>
  );
}
