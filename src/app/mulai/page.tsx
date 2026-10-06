"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import InstallGuide from "@/components/InstallGuide";
import { api } from "@/components/ui";
import { ALERGEN_LABEL, ALERGEN_LIST, CONDITIONS, ConditionId, EXCLUSIVE } from "@/lib/conditions";
import { ensureDevice, restoreDevice } from "@/lib/device";
import { installSkipped, isStandalone, skipInstall } from "@/lib/install";
import { mapLocally } from "@/lib/personalize";
import { enablePush, pushSupport } from "@/lib/push-client";
import { useClientValue } from "@/lib/use-client-value";

type Untuk = "diri" | "orang_tua" | "pasangan" | "anak" | "lainnya";
type Step = "welcome" | "siapa" | "kondisi" | "notif" | "kode" | "pulih";

const UNTUK: { id: Untuk; emoji: string; label: string; panggilan: string }[] = [
  { id: "diri", emoji: "🙋", label: "Diri sendiri", panggilan: "kamu" },
  { id: "orang_tua", emoji: "👴", label: "Orang tua", panggilan: "" },
  { id: "pasangan", emoji: "💑", label: "Pasangan", panggilan: "" },
  { id: "anak", emoji: "🧒", label: "Anak", panggilan: "" },
  { id: "lainnya", emoji: "👥", label: "Orang lain", panggilan: "" },
];

const WELCOME = [
  { emoji: "🚦", text: "Langsung tahu boleh, dibatasi, atau jangan" },
  { emoji: "🎤", text: "Cukup tanya pakai suara atau foto" },
  { emoji: "🔒", text: "Tanpa daftar akun, data tetap aman" },
];

export default function Mulai() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("welcome");
  const [untuk, setUntuk] = useState<Untuk>("diri");
  const [agree, setAgree] = useState(false);
  const [kondisi, setKondisi] = useState<ConditionId[]>([]);
  const [alergen, setAlergen] = useState<string[]>([]);
  const [lain, setLain] = useState("");
  const [nama, setNama] = useState("");
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [newProfileId, setNewProfileId] = useState("");
  const standalone = useClientValue<boolean | null>(isStandalone, null);
  const skippedBefore = useClientValue(installSkipped, false);
  const [skipped, setSkipped] = useState(false);

  // pengguna yang sudah punya profil langsung ke aplikasi
  useEffect(() => {
    ensureDevice()
      .then(() => fetch("/api/me"))
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => { if (m?.consented && m.profiles?.length) router.replace("/"); })
      .catch((e: Error) => setError(e.message));
  }, [router]);

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  async function finish() {
    setBusy(true);
    setError("");
    try {
      await ensureDevice();
      await api("/api/consent", {});
      // kata yang dikenali dari isian "lainnya" langsung ikut dipakai (tanpa AI); sisanya dibaca AI saat menulis saran
      const m = mapLocally(lain, "", "");
      const allKondisi = [...new Set([...kondisi.filter((k) => k !== "sehat" || !m.kondisi.length), ...m.kondisi])];
      const allAlergen = [...new Set([...(kondisi.includes("alergi") ? alergen : []), ...m.alergen])];
      if (allAlergen.length && !allKondisi.includes("alergi")) allKondisi.push("alergi");
      const name = nama.trim() || (untuk === "diri" ? "Saya" : "Keluargaku");
      const created = await api<{ profile: { id: string } }>("/api/onboarding", {
        action: "create",
        familyName: `Keluarga ${name}`.slice(0, 60),
        profile: {
          nama: name, panggilan: untuk === "diri" ? "kamu" : name.slice(0, 20), usia: null, untuk,
          kondisi: EXCLUSIVE.some(([a, b]) => allKondisi.includes(a) && allKondisi.includes(b)) ? kondisi : allKondisi,
          alergen: allAlergen, diabetes_tipe: allKondisi.includes("diabetes") ? "tidak_tahu" : null, insulin: false,
          catatan_dokter: "", obat: m.obat, kondisi_lain: lain.trim(),
        },
      });
      if (pushSupport() === "ok") {
        setNewProfileId(created.profile.id);
        setBusy(false);
        setStep("notif");
      } else router.replace("/?welcome=1");
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  async function join() {
    setBusy(true);
    setError("");
    try {
      await ensureDevice();
      await api("/api/consent", {});
      await api("/api/onboarding", { action: "join", code });
      router.replace("/");
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  async function pulih() {
    setBusy(true);
    setError("");
    try {
      await restoreDevice(recovery);
      router.replace("/");
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const progress = ["siapa", "kondisi"].indexOf(step);

  async function turnOnNotif() {
    setBusy(true);
    try { await enablePush(newProfileId, true, true, true); } catch (e) { setError((e as Error).message); setBusy(false); return; }
    router.replace("/?welcome=1");
  }

  if (standalone === null) return <main className="center-page" />;
  // wajib dipasang dulu, supaya ID perangkat dibuat di dalam aplikasi (lihat lib/install.ts)
  if (!standalone && !skipped && !skippedBefore) {
    return (
      <main className="center-page">
        <div className="card onboard">
          <p className="eyebrow">Selamat datang di</p>
          <h1 className="hero-title">Boleh Gak, Ya?</h1>
          <InstallGuide onSkip={() => { skipInstall(); setSkipped(true); }} />
        </div>
      </main>
    );
  }

  return (
    <main className="center-page">
      <div className="card onboard">
        {progress >= 0 && <div className="steps">{[0, 1].map((i) => <i key={i} className={i <= progress ? "on" : ""} />)}</div>}

        {step === "welcome" && (
          <>
            <p className="eyebrow">Selamat datang di</p>
            <h1 className="hero-title">Boleh Gak, Ya?</h1>
            <p className="lead">Ragu sebelum makan? Tanya dulu di sini.</p>
            <ul className="welcome-list">{WELCOME.map((w) => <li key={w.text}><span>{w.emoji}</span>{w.text}</li>)}</ul>
            <button className="btn big primary" onClick={() => setStep("siapa")}>Mulai →</button>
            <div className="row" style={{ marginTop: 12 }}>
              <button className="btn sm" onClick={() => setStep("kode")}>Punya kode keluarga</button>
              <button className="btn sm" onClick={() => setStep("pulih")}>Punya kode pemulihan</button>
            </div>
          </>
        )}

        {step === "kode" && (
          <>
            <h2>Gabung keluarga</h2>
            <p className="small">Masukkan kode undangan dari anggota keluargamu (ada di menu ⚙️ Profil mereka).</p>
            <label className="field">Kode undangan
              <input type="text" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="mis. 8F3A21C9" />
            </label>
            <Consent agree={agree} setAgree={setAgree} />
            {error && <div className="error-box">{error}</div>}
            <div className="row">
              <button className="btn" onClick={() => setStep("welcome")}>← Kembali</button>
              <button className="btn primary" disabled={busy || !agree || code.length < 4} onClick={join}>{busy ? "Bergabung…" : "Gabung"}</button>
            </div>
          </>
        )}

        {step === "pulih" && (
          <>
            <h2>Pulihkan data</h2>
            <p className="small">Masukkan kode pemulihan yang kamu simpan (ada di menu ⚙️ Profil di HP lama). Huruf besar/kecil dan tanda strip tidak masalah.</p>
            <label className="field">Kode pemulihan
              <input type="text" value={recovery} onChange={(e) => setRecovery(e.target.value)} placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX" autoCapitalize="characters" autoComplete="off" />
            </label>
            <p className="small muted">Data yang sudah dibuat di perangkat ini sebelumnya tidak ikut dipindah.</p>
            {error && <div className="error-box">{error}</div>}
            <div className="row">
              <button className="btn" onClick={() => setStep("welcome")}>← Kembali</button>
              <button className="btn primary" disabled={busy || recovery.replace(/[^0-9a-z]/gi, "").length < 24} onClick={pulih}>{busy ? "Memulihkan…" : "Pulihkan"}</button>
            </div>
          </>
        )}

        {step === "notif" && (
          <>
            <span className="emo-big" aria-hidden="true">🔔</span>
            <h2>Nyalakan pengingat?</h2>
            <ul className="welcome-list">
              <li><span>🌅</span>Pagi: cek gula darah atau tensi</li>
              <li><span>🌙</span>Malam: catat makan hari ini</li>
              <li><span>👪</span>Keluarga bisa membunyikan bel kalau lupa</li>
            </ul>
            {error && <div className="error-box">{error}</div>}
            <button className="btn big primary" disabled={busy} onClick={turnOnNotif}>{busy ? "Menyalakan…" : "🔔 Nyalakan"}</button>
            <button className="linklike" onClick={() => router.replace("/?welcome=1")}>Nanti saja</button>
          </>
        )}

        {step === "siapa" && (
          <>
            <h2>Untuk siapa?</h2>
            <div className="choice-grid">
              {UNTUK.map((u) => (
                <button key={u.id} className={`choice${untuk === u.id ? " on" : ""}`} onClick={() => setUntuk(u.id)}>
                  <span>{u.emoji}</span>{u.label}
                </button>
              ))}
            </div>
            <label className="field">{untuk === "diri" ? "Nama kamu" : "Dipanggil apa?"}
              <input type="text" value={nama} maxLength={40} onChange={(e) => setNama(e.target.value)} placeholder={untuk === "diri" ? "mis. Rina" : "mis. Omah, Papa, Om"} />
            </label>
            <Nav back={() => setStep("welcome")} next={() => setStep("kondisi")} />
          </>
        )}

        {step === "kondisi" && (
          <>
            <h2>{untuk === "diri" ? "Apa yang perlu dijaga?" : `Apa yang perlu dijaga ${nama.trim() || "dia"}?`}</h2>
            <p className="small muted">Boleh pilih lebih dari satu.</p>
            <div className="cond-list">
              {CONDITIONS.map((c) => (
                <button key={c.id} className={`cond${kondisi.includes(c.id) ? " on" : ""}`}
                  onClick={() => setKondisi((k) => {
                    let next = c.id === "sehat" ? (["sehat"] as ConditionId[]) : toggle(k.filter((x) => x !== "sehat"), c.id);
                    for (const [a, b] of EXCLUSIVE) if (c.id === a) next = next.filter((x) => x !== b); else if (c.id === b) next = next.filter((x) => x !== a);
                    return next;
                  })}>
                  <span className="cond-emo">{c.emoji}</span>
                  <span className="cond-text"><b>{c.label}</b><small>{c.desc}</small></span>
                </button>
              ))}
            </div>
            {kondisi.includes("alergi") && (
              <>
                <p className="eyebrow">⚠️ Alergi terhadap</p>
                <div className="chips">
                  {ALERGEN_LIST.map((a) => <button key={a} className={`chip${alergen.includes(a) ? " on" : ""}`} onClick={() => setAlergen((x) => toggle(x, a))}>{ALERGEN_LABEL[a]}</button>)}
                </div>
              </>
            )}
            <label className="field">Ada yang lain? (boleh kosong)
              <input type="text" value={lain} maxLength={300} onChange={(e) => setLain(e.target.value)} placeholder="mis. minum amlodipin, maag" />
            </label>
            <Consent agree={agree} setAgree={setAgree} />
            {error && <div className="error-box">{error}</div>}
            <Nav back={() => setStep("siapa")} next={finish} nextLabel={busy ? "Menyiapkan…" : "Selesai ✓"}
              disabled={busy || !agree || !kondisi.length || (kondisi.includes("alergi") && !alergen.length && !/alergi/i.test(lain))} />
          </>
        )}
      </div>
    </main>
  );
}

function Nav({ back, next, disabled, nextLabel = "Lanjut →" }: { back: () => void; next: () => void; disabled?: boolean; nextLabel?: string }) {
  return (
    <div className="row" style={{ marginTop: 18 }}>
      <button className="btn" onClick={back}>← Kembali</button>
      <button className="btn primary" onClick={next} disabled={disabled}>{nextLabel}</button>
    </div>
  );
}

function Consent({ agree, setAgree }: { agree: boolean; setAgree: (v: boolean) => void }) {
  return (
    <div className="consent">
      <ul>
        <li>Data hanya bisa dilihat kamu dan keluarga yang kamu undang.</li>
        <li>Ini pembantu, bukan pengganti dokter.</li>
      </ul>
      <label className="check" style={{ margin: "10px 0 0" }}>
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /> Saya setuju (<Link href="/privasi">baca lengkap</Link>)
      </label>
    </div>
  );
}
