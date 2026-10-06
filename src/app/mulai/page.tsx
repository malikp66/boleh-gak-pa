"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import InstallGuide from "@/components/InstallGuide";
import { api, useToast } from "@/components/ui";
import { ALERGEN_LABEL, ALERGEN_LIST, CONDITIONS, ConditionId, EXCLUSIVE } from "@/lib/conditions";
import { ensureDevice, restoreDevice } from "@/lib/device";
import { installSkipped, isStandalone, skipInstall } from "@/lib/install";
import { mapLocally } from "@/lib/personalize";
import { nameProblem, normalizeInvite, profileProblem } from "@/lib/validation";
import { play } from "@/lib/sound";
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
  const [nameError, setNameError] = useState("");
  const toast = useToast();
  /** Tampilkan masalah isian: alert di atas + pesan di bawah tombol. */
  const warn = (msg: string) => { play("error"); setError(msg); toast.warning(msg, "Belum lengkap"); };
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

  function nextFromName() {
    const m = nameProblem(nama, untuk === "diri" ? "Nama kamu" : "Nama panggilan");
    setNameError(m ?? "");
    if (m) return warn(m);
    setError("");
    setStep("kondisi");
  }

  async function finish() {
    if (!kondisi.length) return warn("Pilih minimal satu kondisi. Kalau belum ada diagnosis, pilih yang paling bawah.");
    const problem = profileProblem({ nama, kondisi, alergen: kondisi.includes("alergi") ? alergen : [], kondisi_lain: lain });
    if (problem) return warn(problem);
    if (!agree) return warn("Centang \"Saya setuju\" dulu ya.");
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
      const name = nama.trim();
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
      toast.success(`Profil ${name} siap dipakai.`, "Berhasil");
      if (pushSupport() === "ok") {
        setNewProfileId(created.profile.id);
        setBusy(false);
        setStep("notif");
      } else router.replace("/?welcome=1");
    } catch (e) {
      play("error");
      setError((e as Error).message);
      toast.error((e as Error).message, "Gagal menyimpan");
      setBusy(false);
    }
  }

  async function join() {
    const c = normalizeInvite(code);
    if (c.length < 4) return warn("Ketik kode keluarga dulu. Biasanya 8 huruf/angka.");
    if (!agree) return warn("Centang \"Saya setuju\" dulu ya.");
    setBusy(true);
    setError("");
    try {
      await ensureDevice();
      await api("/api/consent", {});
      const r = await api<{ family: { name: string } }>("/api/onboarding", { action: "join", code: c });
      play("saved");
      toast.success(`Kamu sudah bergabung dengan ${r.family.name}.`, "Berhasil bergabung");
      router.replace("/");
    } catch (e) {
      play("error");
      setError((e as Error).message);
      toast.error((e as Error).message, "Belum bisa bergabung");
      setBusy(false);
    }
  }

  async function pulih() {
    const clean = recovery.replace(/[^0-9a-z]/gi, "");
    if (clean.length < 24) return warn(`Kode pemulihan berisi 24 huruf/angka. Yang diketik baru ${clean.length}.`);
    setBusy(true);
    setError("");
    try {
      await restoreDevice(recovery);
      play("saved");
      toast.success("Data kamu sudah kembali di HP ini.", "Berhasil dipulihkan");
      router.replace("/");
    } catch (e) {
      play("error");
      setError((e as Error).message);
      toast.error((e as Error).message, "Belum bisa dipulihkan");
      setBusy(false);
    }
  }

  const progress = ["siapa", "kondisi"].indexOf(step);

  async function turnOnNotif() {
    setBusy(true);
    try {
      await enablePush(newProfileId, true, true, true);
      toast.success("Pengingat pagi & malam sudah aktif.", "Notifikasi menyala");
    } catch (e) {
      setError((e as Error).message);
      toast.error(`${(e as Error).message}. Bisa dinyalakan nanti di ⚙️ Profil.`, "Notifikasi belum aktif");
      setBusy(false);
      return;
    }
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
              <input type="text" value={code} maxLength={20} autoCapitalize="characters" autoComplete="off" onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="mis. 8F3A21C9" />
            </label>
            <Consent agree={agree} setAgree={setAgree} />
            {error && <div className="error-box">{error}</div>}
            <div className="row">
              <button className="btn" onClick={() => setStep("welcome")}>← Kembali</button>
              <button className="btn primary" disabled={busy} onClick={join}>{busy ? "Bergabung…" : "Gabung"}</button>
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
              <button className="btn primary" disabled={busy} onClick={pulih}>{busy ? "Memulihkan…" : "Pulihkan"}</button>
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
              <input type="text" value={nama} maxLength={40} aria-invalid={Boolean(nameError)} className={nameError ? "invalid" : ""}
                onChange={(e) => { setNama(e.target.value); if (nameError) setNameError(nameProblem(e.target.value) ?? ""); }}
                placeholder={untuk === "diri" ? "mis. Rina" : "mis. Omah, Papa, Om"} />
            </label>
            {nameError && <p className="field-error">{nameError}</p>}
            <Nav back={() => setStep("welcome")} next={nextFromName} />
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
            <Nav back={() => setStep("siapa")} next={finish} nextLabel={busy ? "Menyiapkan…" : "Selesai ✓"} disabled={busy} />
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
