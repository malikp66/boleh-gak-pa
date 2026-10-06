"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import ProfileForm, { emptyDraft, ProfileDraft } from "@/components/ProfileForm";
import RecoveryCard from "@/components/RecoveryCard";
import { api } from "@/components/ui";
import { Me, Profile } from "@/components/types";
import { conditionInfo, normalizeConditions } from "@/lib/conditions";
import { ensureDevice } from "@/lib/device";
import { currentSubscription, disablePush, enablePush, pushSupport, PushSupport } from "@/lib/push-client";
import { play, setSound, soundOn } from "@/lib/sound";
import { useClientValue } from "@/lib/use-client-value";

const PROFILE_KEY = "active-profile";
const strip = (p: Profile): ProfileDraft => { const { id, family_id, ...rest } = p; void id; void family_id; return rest; };

export default function ProfilPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [activeId, setActiveId] = useState("");
  const [mode, setMode] = useState<"list" | "edit" | "add">("list");
  const [msg, setMsg] = useState("");
  const initialSound = useClientValue(soundOn, true);
  const [soundOverride, setSoundState] = useState<boolean | null>(null);
  const sound = soundOverride ?? initialSound;
  const support = useClientValue<PushSupport>(pushSupport, "unsupported");
  const [push, setPush] = useState<{ on: boolean; pagi: boolean; malam: boolean }>({ on: false, pagi: true, malam: true });

  const load = useCallback(() =>
    ensureDevice().then(() => api<Me>("/api/me")).then((m) => {
      let saved = "";
      try { saved = localStorage.getItem(PROFILE_KEY) ?? ""; } catch {}
      setActiveId((cur) => cur || (m.profiles.some((p) => p.id === saved) ? saved : m.profiles[0]?.id ?? ""));
      setMe(m);
    }).catch((e: Error) => setMsg(e.message)),
  []);

  useEffect(() => {
    void load();
    if (pushSupport() === "ok") {
      currentSubscription().then(async (sub) => {
        if (!sub) return;
        const r = await api<{ subscription: { pagi: boolean; malam: boolean } | null }>(`/api/push?endpoint=${encodeURIComponent(sub.endpoint)}`);
        if (r.subscription) setPush({ on: true, pagi: r.subscription.pagi, malam: r.subscription.malam });
      }).catch(() => {});
    }
  }, [load]);

  const profile = me?.profiles.find((p) => p.id === activeId);

  async function savePush(next: { on: boolean; pagi: boolean; malam: boolean }) {
    try {
      if (next.on) await enablePush(activeId, next.pagi, next.malam);
      else await disablePush();
      setPush(next);
      play("saved");
      setMsg(next.on ? "Pengingat aktif." : "Pengingat dimatikan.");
    } catch (e) {
      play("error");
      setMsg((e as Error).message);
    }
  }

  async function testPush() {
    const sub = await currentSubscription();
    if (!sub) return setMsg("Aktifkan pengingat dulu.");
    await api("/api/push/test", { endpoint: sub.endpoint }).then(() => setMsg("Notifikasi uji dikirim.")).catch((e: Error) => setMsg(e.message));
  }

  if (!me) return <main><div className="card"><p className="muted">{msg || "Memuat…"}</p></div></main>;

  return (
    <>
      <header className="top">
        <div className="brand"><h1>Profil &amp; pengaturan</h1><p className="sub">Boleh Gak, Ya?</p></div>
        <Link className="pill" href="/">← Kembali</Link>
      </header>
      <main>
        {msg && <div className="secure" style={{ padding: 10 }}><p style={{ margin: 0 }}>{msg}</p></div>}

        {mode === "list" && (
          <>
            <div className="card">
              <h2>Orang yang dijaga</h2>
              {me.profiles.map((p) => (
                <button key={p.id} className={`cond${p.id === activeId ? " on" : ""}`} style={{ width: "100%", marginBottom: 10 }}
                  onClick={() => { setActiveId(p.id); try { localStorage.setItem(PROFILE_KEY, p.id); } catch {} }}>
                  <span className="cond-emo">{p.id === activeId ? "✅" : "👤"}</span>
                  <span className="cond-text"><b>{p.nama}</b><small>{normalizeConditions(p.kondisi).map((c) => conditionInfo(c)!.short).join(" · ")}</small></span>
                </button>
              ))}
              <div className="row">
                <button className="btn" onClick={() => setMode("edit")} disabled={!profile}>✏️ Edit {profile?.nama}</button>
                <button className="btn primary" onClick={() => setMode("add")}>+ Tambah orang</button>
              </div>
            </div>

            <div className="card">
              <h2>Pengaturan</h2>
              <label className="care-item">
                <input type="checkbox" checked={sound} onChange={(e) => { setSound(e.target.checked); setSoundState(e.target.checked); if (e.target.checked) play("hijau"); }} />
                <span className="ce">🔊</span>Efek suara &amp; getar
              </label>

              <p className="eyebrow">🔔 Pengingat</p>
              {support === "ios-install" && <p className="small">Di iPhone, notifikasi hanya bisa untuk aplikasi yang sudah ditambahkan ke layar utama: buka menu <b>Bagikan → Tambah ke Layar Utama</b>, lalu buka dari ikon itu.</p>}
              {support === "unsupported" && <p className="small muted">Browser ini belum mendukung notifikasi.</p>}
              {support === "denied" && <p className="small">Izin notifikasi ditolak. Aktifkan di pengaturan browser untuk situs ini.</p>}
              {support === "ok" && (
                <div className="care">
                  <label className="care-item"><input type="checkbox" checked={push.on} onChange={(e) => savePush({ ...push, on: e.target.checked })} /><span className="ce">🔔</span>Aktifkan pengingat untuk {profile?.nama}</label>
                  {push.on && (
                    <>
                      <label className="care-item"><input type="checkbox" checked={push.pagi} onChange={(e) => savePush({ ...push, pagi: e.target.checked })} /><span className="ce">🌅</span>Pagi 07.00 · cek gula darah/tensi</label>
                      <label className="care-item"><input type="checkbox" checked={push.malam} onChange={(e) => savePush({ ...push, malam: e.target.checked })} /><span className="ce">🌙</span>Malam 19.00 · catat makan hari ini</label>
                      <button className="btn sm" onClick={testPush}>Kirim notifikasi uji</button>
                    </>
                  )}
                </div>
              )}
            </div>

            <RecoveryCard />
          </>
        )}

        {mode === "edit" && profile && (
          <div className="card">
            <h2>Edit {profile.nama}</h2>
            <ProfileForm initial={strip(profile)} submitLabel="Simpan" onCancel={() => setMode("list")}
              onSubmit={async (d) => {
                await api("/api/profiles", { id: profile.id, ...d }, "PATCH");
                play("saved");
                setMsg(`Profil ${d.nama} tersimpan.`);
                setMode("list");
                await load();
              }} />
          </div>
        )}

        {mode === "add" && (
          <div className="card">
            <h2>Tambah orang</h2>
            <p className="small muted">Misalnya Omah, Papa, Om, atau Tante. Mereka bisa memakai HP-mu, atau kamu kirim kode undangan keluarga (tab Review) supaya mereka bisa membuka dari HP sendiri.</p>
            <ProfileForm initial={emptyDraft()} submitLabel="Tambahkan" onCancel={() => setMode("list")}
              onSubmit={async (d) => {
                const created = await api<Profile>("/api/profiles", { ...d, family_id: profile?.family_id ?? me.families[0]?.id });
                play("saved");
                try { localStorage.setItem(PROFILE_KEY, created.id); } catch {}
                setActiveId(created.id);
                setMsg(`${d.nama} ditambahkan dan dipilih.`);
                setMode("list");
                await load();
              }} />
          </div>
        )}
        <p className="disclaimer">Obat & target dipakai untuk peringatan saja. Keputusan pengobatan tetap di dokter.</p>
      </main>
    </>
  );
}
