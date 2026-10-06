"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/components/ui";
import { ALERGEN_LABEL, ALERGEN_LIST, CONDITIONS, ConditionId } from "@/lib/conditions";
import { ensureDevice, restoreDevice } from "@/lib/device";

type Untuk = "diri" | "orang_tua" | "pasangan" | "anak" | "lainnya";
type Step = "welcome" | "untuk" | "setuju" | "kondisi" | "detail" | "profil" | "kode" | "pulih";

const UNTUK: { id: Untuk; emoji: string; label: string; panggilan: string }[] = [
  { id: "diri", emoji: "🙋", label: "Diri sendiri", panggilan: "kamu" },
  { id: "orang_tua", emoji: "👴", label: "Orang tua", panggilan: "" },
  { id: "pasangan", emoji: "💑", label: "Pasangan", panggilan: "" },
  { id: "anak", emoji: "🧒", label: "Anak", panggilan: "" },
  { id: "lainnya", emoji: "👥", label: "Orang lain", panggilan: "" },
];

const DM_TIPE = [
  ["pradiabetes", "Pradiabetes"], ["tipe_2", "Tipe 2"], ["tipe_1", "Tipe 1"], ["gestasional", "Saat hamil"], ["tidak_tahu", "Tidak tahu"],
] as const;

const WELCOME = [
  { emoji: "🍽️", title: "Ragu sebelum makan?", text: "Ketik atau foto makanannya. Langsung tahu aman, dibatasi, atau sebaiknya jangan, sesuai kondisimu." },
  { emoji: "🚦", title: "Lampu dari tabel gizi", text: "Penilaian memakai tabel 271 makanan Indonesia dan aturan dari pedoman Kemenkes, PERKENI, dan WHO. AI hanya menulis sarannya." },
  { emoji: "🔒", title: "Tanpa daftar, tetap aman", text: "Langsung pakai tanpa login atau email. Datamu hanya bisa dilihat olehmu dan keluarga yang kamu undang, dan bisa dipulihkan dengan kode pemulihan." },
];

export default function Mulai() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("welcome");
  const [slide, setSlide] = useState(0);
  const [untuk, setUntuk] = useState<Untuk>("diri");
  const [agree, setAgree] = useState(false);
  const [kondisi, setKondisi] = useState<ConditionId[]>([]);
  const [alergen, setAlergen] = useState<string[]>([]);
  const [dmTipe, setDmTipe] = useState<string>("tipe_2");
  const [insulin, setInsulin] = useState(false);
  const [profil, setProfil] = useState({ nama: "", panggilan: "kamu", usia: "", catatan: "" });
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // pengguna yang sudah punya profil langsung ke aplikasi
  useEffect(() => {
    ensureDevice()
      .then(() => fetch("/api/me"))
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => { if (m?.consented && m.profiles?.length) router.replace("/"); })
      .catch((e: Error) => setError(e.message));
  }, [router]);

  const needsDetail = kondisi.includes("diabetes") || kondisi.includes("alergi");
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  async function finish() {
    setBusy(true);
    setError("");
    try {
      await ensureDevice();
      await api("/api/consent", {});
      const nama = profil.nama.trim() || (untuk === "diri" ? "Saya" : "Keluargaku");
      await api("/api/onboarding", {
        action: "create",
        familyName: `Keluarga ${nama}`.slice(0, 60),
        profile: {
          nama, panggilan: profil.panggilan.trim() || "kamu", usia: profil.usia ? Number(profil.usia) : null, untuk,
          kondisi, alergen: kondisi.includes("alergi") ? alergen : [],
          diabetes_tipe: kondisi.includes("diabetes") ? dmTipe : null, insulin: kondisi.includes("diabetes") && insulin,
          catatan_dokter: profil.catatan,
        },
      });
      router.replace("/?welcome=1");
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

  const progress = ["untuk", "setuju", "kondisi", "detail", "profil"].indexOf(step);

  return (
    <main className="center-page">
      <div className="card onboard">
        {progress >= 0 && <div className="steps">{[0, 1, 2, 3, 4].map((i) => <i key={i} className={i <= progress ? "on" : ""} />)}</div>}

        {step === "welcome" && (
          <>
            <p className="eyebrow">Selamat datang di</p>
            <h1 className="hero-title">Boleh Gak, Ya?</h1>
            <div className="slide">
              <span className="emo-big">{WELCOME[slide].emoji}</span>
              <h2>{WELCOME[slide].title}</h2>
              <p>{WELCOME[slide].text}</p>
              <div className="dots">{WELCOME.map((_, i) => <button key={i} aria-label={`Kartu ${i + 1}`} className={i === slide ? "on" : ""} onClick={() => setSlide(i)} />)}</div>
            </div>
            {slide < WELCOME.length - 1
              ? <button className="btn big" onClick={() => setSlide(slide + 1)}>Lanjut →</button>
              : <button className="btn big primary" onClick={() => setStep("untuk")}>Mulai sekarang →</button>}
            <div className="row" style={{ marginTop: 12 }}>
              <button className="btn sm" onClick={() => setStep("kode")}>Punya kode keluarga</button>
              <button className="btn sm" onClick={() => setStep("pulih")}>Punya kode pemulihan</button>
            </div>
          </>
        )}

        {step === "kode" && (
          <>
            <h2>Gabung keluarga</h2>
            <p className="small">Masukkan kode undangan dari anggota keluargamu (ada di tab Review mereka).</p>
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
            <p className="small">Masukkan kode pemulihan yang kamu simpan (ada di tab Review di perangkat lama). Huruf besar/kecil dan tanda strip tidak masalah.</p>
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

        {step === "untuk" && (
          <>
            <h2>Untuk siapa?</h2>
            <p className="small muted">Kamu bisa menambah anggota keluarga lain nanti.</p>
            <div className="choice-grid">
              {UNTUK.map((u) => (
                <button key={u.id} className={`choice${untuk === u.id ? " on" : ""}`} onClick={() => { setUntuk(u.id); setProfil((p) => ({ ...p, panggilan: u.panggilan })); }}>
                  <span>{u.emoji}</span>{u.label}
                </button>
              ))}
            </div>
            <Nav back={() => setStep("welcome")} next={() => setStep("setuju")} />
          </>
        )}

        {step === "setuju" && (
          <>
            <h2>Sebelum lanjut</h2>
            <p className="small">Berikutnya kamu akan mengisi data kesehatan. Ini yang perlu kamu tahu:</p>
            <Consent agree={agree} setAgree={setAgree} />
            <Nav back={() => setStep("untuk")} next={() => setStep("kondisi")} disabled={!agree} />
          </>
        )}

        {step === "kondisi" && (
          <>
            <h2>Kondisi apa yang dijaga?</h2>
            <p className="small muted">Boleh pilih lebih dari satu.</p>
            <div className="cond-list">
              {CONDITIONS.map((c) => (
                <button key={c.id} className={`cond${kondisi.includes(c.id) ? " on" : ""}`}
                  onClick={() => setKondisi((k) => (c.id === "sehat" ? ["sehat"] : toggle(k.filter((x) => x !== "sehat"), c.id)))}>
                  <span className="cond-emo">{c.emoji}</span>
                  <span className="cond-text"><b>{c.label}</b><small>{c.desc}</small></span>
                  {c.status === "beta" && <span className="beta">Beta</span>}
                </button>
              ))}
            </div>
            <Nav back={() => setStep("setuju")} next={() => setStep(needsDetail ? "detail" : "profil")} disabled={!kondisi.length} />
          </>
        )}

        {step === "detail" && (
          <>
            <h2>Sedikit detail</h2>
            {kondisi.includes("diabetes") && (
              <>
                <p className="eyebrow">🩸 Jenis diabetes</p>
                <div className="chips">
                  {DM_TIPE.map(([id, label]) => <button key={id} className={`chip${dmTipe === id ? " on" : ""}`} onClick={() => setDmTipe(id)}>{label}</button>)}
                </div>
                <label className="check"><input type="checkbox" checked={insulin} onChange={(e) => setInsulin(e.target.checked)} /> Memakai suntikan insulin</label>
              </>
            )}
            {kondisi.includes("alergi") && (
              <>
                <p className="eyebrow">⚠️ Alergi terhadap</p>
                <div className="chips">
                  {ALERGEN_LIST.map((a) => <button key={a} className={`chip${alergen.includes(a) ? " on" : ""}`} onClick={() => setAlergen((x) => toggle(x, a))}>{ALERGEN_LABEL[a]}</button>)}
                </div>
              </>
            )}
            <Nav back={() => setStep("kondisi")} next={() => setStep("profil")} disabled={kondisi.includes("alergi") && !alergen.length} />
          </>
        )}

        {step === "profil" && (
          <>
            <h2>{untuk === "diri" ? "Tentang kamu" : "Tentang dia"}</h2>
            <div className="grid2">
              <label className="field">Nama <input type="text" value={profil.nama} onChange={(e) => setProfil({ ...profil, nama: e.target.value })} placeholder={untuk === "diri" ? "mis. Rina" : "mis. Ibu"} /></label>
              <label className="field">Dipanggil <input type="text" value={profil.panggilan} onChange={(e) => setProfil({ ...profil, panggilan: e.target.value })} placeholder="mis. Bu / Pak" /></label>
            </div>
            <label className="field">Usia (opsional) <input type="number" min={1} max={120} value={profil.usia} onChange={(e) => setProfil({ ...profil, usia: e.target.value })} /></label>
            <label className="field">Catatan dari dokter (opsional)
              <textarea rows={2} value={profil.catatan} onChange={(e) => setProfil({ ...profil, catatan: e.target.value })} placeholder="mis. nasi maksimal ¾ gelas, kurangi santan" />
            </label>
            {error && <div className="error-box">{error}</div>}
            <Nav back={() => setStep(needsDetail ? "detail" : "kondisi")} next={finish} nextLabel={busy ? "Menyiapkan…" : "Selesai →"} disabled={busy} />
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
        <li>Data kondisi dan catatan disimpan di database Neon (Singapura), terhubung ke perangkat ini.</li>
        <li>Hanya kamu dan keluarga yang kamu undang yang bisa melihatnya.</li>
        <li>Nama makanan dan kondisi dikirim ke Google AI Studio untuk membuat saran. Foto tidak disimpan.</li>
        <li>Simpan kode pemulihan (ada di tab Review). Tanpa kode itu, data tidak bisa dibuka lagi kalau data browser dihapus.</li>
        <li>Ini bukan pengganti dokter.</li>
      </ul>
      <label className="check" style={{ margin: "10px 0 0" }}>
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /> Saya setuju (<Link href="/privasi">baca kebijakan</Link>)
      </label>
    </div>
  );
}
