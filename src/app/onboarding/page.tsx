"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/components/ui";
import { KONDISI } from "@/lib/schemas";

interface Me { consented: boolean; profiles: unknown[]; user: { name: string } }

export default function Onboarding() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [mode, setMode] = useState<"create" | "join">("create");
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ familyName: "", nama: "", panggilan: "", usia: "", kondisi: [...KONDISI] as string[], catatan: "", code: "" });

  useEffect(() => {
    api<Me>("/api/me").then((m) => {
      if (m.consented && m.profiles.length) router.replace("/");
      setMe(m);
      setAgree(m.consented);
    });
  }, [router]);

  const set = (k: keyof typeof form, v: string | string[]) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!agree) return setError("Centang persetujuan dulu ya.");
    setBusy(true);
    setError("");
    try {
      if (!me?.consented) await api("/api/consent", {});
      if (mode === "join") {
        await api("/api/onboarding", { action: "join", code: form.code });
      } else {
        await api("/api/onboarding", {
          action: "create",
          familyName: form.familyName || "Keluarga",
          profile: {
            nama: form.nama, panggilan: form.panggilan, usia: form.usia ? Number(form.usia) : null,
            kondisi: form.kondisi, catatan_dokter: form.catatan,
          },
        });
      }
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menyimpan");
      setBusy(false);
    }
  }

  if (!me) return <main className="center-page"><div className="card"><p>Memuat…</p></div></main>;

  return (
    <main className="center-page">
      <form className="card" onSubmit={submit}>
        <p className="eyebrow">Halo, {me.user.name}</p>
        <h1 className="hero-title">Siapkan keluargamu</h1>
        <div className="tabs-2">
          <button type="button" className={`btn${mode === "create" ? " primary" : ""}`} onClick={() => setMode("create")}>Buat baru</button>
          <button type="button" className={`btn${mode === "join" ? " primary" : ""}`} onClick={() => setMode("join")}>Punya kode</button>
        </div>

        {mode === "join" ? (
          <label className="field">Kode undangan keluarga
            <input type="text" value={form.code} onChange={(e) => set("code", e.target.value.toUpperCase())} placeholder="mis. 8F3A21C9" required />
          </label>
        ) : (
          <>
            <label className="field">Nama keluarga
              <input type="text" value={form.familyName} onChange={(e) => set("familyName", e.target.value)} placeholder="mis. Keluarga Santoso" />
            </label>
            <p className="eyebrow">Siapa yang dijaga?</p>
            <div className="grid2">
              <label className="field">Nama <input type="text" value={form.nama} onChange={(e) => set("nama", e.target.value)} placeholder="mis. Budi / Ibu" required /></label>
              <label className="field">Panggilan <input type="text" value={form.panggilan} onChange={(e) => set("panggilan", e.target.value)} placeholder="mis. kamu / Bu" required /></label>
            </div>
            <label className="field">Usia <input type="number" min={1} max={120} value={form.usia} onChange={(e) => set("usia", e.target.value)} /></label>
            <p className="eyebrow">Kondisi</p>
            <div className="chips">
              {KONDISI.map((k) => (
                <button key={k} type="button" className={`chip${form.kondisi.includes(k) ? " on" : ""}`}
                  onClick={() => set("kondisi", form.kondisi.includes(k) ? form.kondisi.filter((x) => x !== k) : [...form.kondisi, k])}>
                  {k}
                </button>
              ))}
            </div>
            <p className="small muted">Kondisi lain (diabetes, darah rendah, pasca stroke) menyusul di versi berikutnya.</p>
            <label className="field">Catatan dokter (opsional)
              <textarea rows={2} value={form.catatan} onChange={(e) => set("catatan", e.target.value)} placeholder="mis. kurangi jeroan & garam" />
            </label>
          </>
        )}

        {!me.consented && (
          <div className="consent">
            <b>Persetujuan data kesehatan</b>
            <ul>
              <li>Data kondisi, catatan makan, dan kambuh disimpan di Supabase (Singapura).</li>
              <li>Hanya anggota keluargamu yang bisa melihatnya.</li>
              <li>Nama makanan dan kondisi dikirim ke Google AI Studio untuk membuat saran. Foto tidak disimpan.</li>
              <li>Bukan pengganti dokter.</li>
            </ul>
            <label className="check" style={{ margin: "10px 0 0" }}>
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /> Saya setuju (<Link href="/privasi">baca kebijakan</Link>)
            </label>
          </div>
        )}
        {error && <div className="error-box">{error}</div>}
        <button className="btn big primary" disabled={busy}>{busy ? "Menyimpan…" : mode === "join" ? "Gabung keluarga →" : "Mulai →"}</button>
      </form>
    </main>
  );
}
