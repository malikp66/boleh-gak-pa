"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import ProfileForm, { emptyDraft, ProfileDraft } from "@/components/ProfileForm";
import InviteCard from "@/components/InviteCard";
import RecoveryCard from "@/components/RecoveryCard";
import VoiceSettings from "@/components/VoiceSettings";
import { LIMIT_TEXT, LimitKind, useLimits } from "@/lib/limits";
import WaConnect from "@/components/WaConnect";
import { api, useToast } from "@/components/ui";
import { Me, Profile } from "@/components/types";
import { conditionInfo, normalizeConditions } from "@/lib/conditions";
import { ensureDevice } from "@/lib/device";
import { currentSubscription, disablePush, enablePush, pushSupport, PushSupport } from "@/lib/push-client";
import { play, setSound, soundOn } from "@/lib/sound";
import { setSimpleMode, simpleMode } from "@/lib/simple-mode";
import { useClientValue } from "@/lib/use-client-value";

const PROFILE_KEY = "active-profile";
const strip = (p: Profile): ProfileDraft => { const { id, family_id, ...rest } = p; void id; void family_id; return rest; };

export default function ProfilPage() {
  const [me, setMe] = useState<Me | null>(null);
  const [activeId, setActiveId] = useState("");
  const [mode, setMode] = useState<"list" | "edit" | "add">("list");
  const toast = useToast();
  const [loadError, setLoadError] = useState("");
  const initialSound = useClientValue(soundOn, true);
  const [soundOverride, setSoundState] = useState<boolean | null>(null);
  const sound = soundOverride ?? initialSound;
  const initialSimple = useClientValue(simpleMode, false);
  const [simpleOverride, setSimpleState] = useState<boolean | null>(null);
  const simple = simpleOverride ?? initialSimple;
  const support = useClientValue<PushSupport>(pushSupport, "unsupported");
  const [push, setPush] = useState<{ on: boolean; pagi: boolean; malam: boolean; keluarga: boolean }>({ on: false, pagi: true, malam: true, keluarga: true });

  const load = useCallback(() =>
    ensureDevice().then(() => api<Me>("/api/me")).then((m) => {
      let saved = "";
      try { saved = localStorage.getItem(PROFILE_KEY) ?? ""; } catch {}
      setActiveId((cur) => cur || (m.profiles.some((p) => p.id === saved) ? saved : m.profiles[0]?.id ?? ""));
      setMe(m);
    }).catch((e: Error) => setLoadError(e.message)),
  []);

  useEffect(() => {
    void load();
    if (pushSupport() === "ok") {
      currentSubscription().then(async (sub) => {
        if (!sub) return;
        const r = await api<{ subscription: { pagi: boolean; malam: boolean; keluarga: boolean } | null }>(`/api/push?endpoint=${encodeURIComponent(sub.endpoint)}`);
        if (r.subscription) setPush({ on: true, pagi: r.subscription.pagi, malam: r.subscription.malam, keluarga: r.subscription.keluarga });
      }).catch(() => {});
    }
  }, [load]);

  const profile = me?.profiles.find((p) => p.id === activeId);

  async function savePush(next: typeof push) {
    try {
      if (next.on) await enablePush(activeId, next.pagi, next.malam, next.keluarga);
      else await disablePush();
      setPush(next);
      play("saved");
      if (next.on) toast.success("Pengingat pagi/malam akan dikirim ke HP ini.", "Pengingat aktif");
      else toast.info("Pengingat dimatikan.");
    } catch (e) {
      play("error");
      toast.error((e as Error).message, "Pengingat gagal diatur");
    }
  }

  async function testPush() {
    const sub = await currentSubscription();
    if (!sub) return toast.warning("Aktifkan pengingat dulu.");
    await api("/api/push/test", { endpoint: sub.endpoint })
      .then(() => toast.success("Cek panel notifikasi HP-mu.", "Notifikasi uji dikirim"))
      .catch((e: Error) => toast.error(e.message));
  }

  if (!me) return <main><div className="card"><p className="muted">{loadError || "Memuat…"}</p></div></main>;

  return (
    <>
      <header className="top">
        <div className="brand"><h1>Profil &amp; pengaturan</h1><p className="sub">Boleh Gak, Ya?</p></div>
        <Link className="pill" href="/">← Kembali</Link>
      </header>
      <main>

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
              <label className="care-item">
                <input type="checkbox" checked={simple} onChange={(e) => { setSimpleMode(e.target.checked); setSimpleState(e.target.checked); }} />
                <span className="ce">👵</span><span>Tampilan sederhana<br /><small className="muted">menu bawah hanya Tanya, Catatan, Pantau. Matikan untuk melihat Daftar makanan &amp; Rangkuman</small></span>
              </label>

              <p className="eyebrow">🗣️ Suara bacaan</p>
              <VoiceSettings />

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
                      {me.profiles.length > 1 && <label className="care-item"><input type="checkbox" checked={push.keluarga} onChange={(e) => savePush({ ...push, keluarga: e.target.checked })} /><span className="ce">👪</span>21.00 · kabari saya kalau keluarga lupa mencatat</label>}
                      <button className="btn sm" onClick={testPush}>Kirim notifikasi uji</button>
                    </>
                  )}
                </div>
              )}
            </div>

            <UsageCard />

            {me.wa.available && (
              <div className="card">
                <h2>💬 WhatsApp</h2>
                {me.wa.phone ? (
                  <>
                    <p className="small">Terhubung dengan <b>{me.wa.phone}</b>{me.wa.profileId && <> · milik <b>{me.profiles.find((p) => p.id === me.wa.profileId)?.nama}</b></>}.</p>
                    <p className="small muted">Ganti HP atau aplikasi terhapus? Cukup pilih <b>Masuk dengan WhatsApp</b>, data langsung kembali.</p>
                    <button className="btn sm" onClick={async () => {
                      if (!confirm("Putuskan WhatsApp dari akun ini?")) return;
                      try { await api("/api/wa/link", undefined, "DELETE"); toast.info("WhatsApp diputuskan."); await load(); }
                      catch (e) { toast.error((e as Error).message); }
                    }}>Putuskan</button>
                  </>
                ) : (
                  <>
                    <p className="small">Hubungkan nomor WhatsApp {profile?.nama} supaya data <b>tidak hilang walau ganti HP</b>, dan keluarga bisa mengingatkan lewat WA.</p>
                    <WaConnect label="💬 Hubungkan WhatsApp" profileId={activeId || null} onDone={() => { void load(); }} />
                  </>
                )}
              </div>
            )}
            {(() => { const f = me.families.find((x) => x.id === profile?.family_id) ?? me.families[0]; return f ? <InviteCard family={f} /> : null; })()}
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
                toast.success(`Profil ${d.nama} tersimpan.`);
                setMode("list");
                await load();
              }} />
          </div>
        )}

        {mode === "add" && (
          <div className="card">
            <h2>Tambah orang</h2>
            <p className="small muted">Misalnya Omah, Papa, Om, atau Tante. Mereka bisa memakai HP-mu, atau kamu kirim kode undangan keluarga (di halaman ini) supaya mereka bisa membuka dari HP sendiri.</p>
            <ProfileForm initial={emptyDraft()} submitLabel="Tambahkan" onCancel={() => setMode("list")}
              onSubmit={async (d) => {
                const created = await api<Profile>("/api/profiles", { ...d, family_id: profile?.family_id ?? me.families[0]?.id });
                play("saved");
                try { localStorage.setItem(PROFILE_KEY, created.id); } catch {}
                setActiveId(created.id);
                toast.success(`${d.nama} ditambahkan dan dipilih.`, "Anggota baru");
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

/** Pemakaian hari ini: tenang & informatif, tanpa nada peringatan. */
function UsageCard() {
  const limits = useLimits();
  if (!limits) return null;
  const kinds: LimitKind[] = ["assess", "photo", "analyze", "summary", "tts"];
  return (
    <div className="card">
      <details>
        <summary><b>📊 Pemakaian hari ini</b> <small className="muted">· terisi lagi tiap 00.00 WIB</small></summary>
        <p className="small muted" style={{ marginTop: 8 }}>Supaya aplikasi tetap gratis, fitur AI punya jatah harian per HP. Kalau terpakai semua, aplikasi tetap jalan dengan tabel gizi.</p>
        {limits.budgetReached && <p className="limit-note out">AI sedang istirahat sampai bulan depan · semua jawaban sementara dari tabel gizi.</p>}
        <div className="usage">
          {kinds.map((k) => {
            const u = limits.usage[k];
            const pct = Math.round((u.left / u.limit) * 100);
            return (
              <div key={k} className="usage-row">
                <b>{LIMIT_TEXT[k].label}</b>
                <small>sisa {u.left} dari {u.limit}</small>
                <span className="usage-bar"><i className={pct <= 20 ? "low" : ""} style={{ width: `${pct}%` }} /></span>
              </div>
            );
          })}
          <div className="usage-row"><b>Bel ke keluarga</b><small>tiap {limits.nudgeGapHours} jam per orang</small></div>
        </div>
      </details>
    </div>
  );
}
