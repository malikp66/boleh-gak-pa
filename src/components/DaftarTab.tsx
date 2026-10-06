"use client";
import { nameProblem } from "@/lib/validation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, Chips, useToast } from "./ui";
import { FoodItem, Profile } from "./types";
import { ConditionId, normalizeConditions } from "@/lib/conditions";

const STATUS_FILTER = ["semua", "hijau", "kuning", "merah"] as const;
const STATUS_LABEL = { semua: "Semua", hijau: "Aman", kuning: "Batasi", merah: "Hindari" };
const BADGE = { hijau: "rendah", kuning: "sedang", merah: "tinggi" } as const;

interface Analysis {
  kategori: string; purin: string; garam: string; karbo: string; gula: string; lemak: string; alergen: string[];
  porsi_aman: string; trik: string[]; pemicu: string[]; alasan: string; refs: string[];
}
const LEVELS = ["rendah", "sedang", "tinggi"];
const DIM_LABEL: Record<string, string> = { purin: "Purin", garam: "Garam", karbo: "Karbo", gula: "Gula", lemak: "Lemak jenuh", ig: "IG" };
const DIMS: Record<ConditionId, string[]> = {
  asam_urat: ["purin"], hipertensi: ["garam"], diabetes: ["karbo", "gula", "ig"], kolesterol: ["lemak"],
  stroke_jantung: ["garam", "lemak"], darah_rendah: ["karbo"], alergi: [], sehat: ["gula", "garam", "lemak"],
};

export default function DaftarTab({ profile, addName, onCheck }: {
  profile: Profile; addName: { name: string; n: number } | null; onCheck: (food: string) => void;
}) {
  const toast = useToast();
  const conditions = normalizeConditions(profile.kondisi);
  const dims = [...new Set(conditions.flatMap((c) => DIMS[c]))];
  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("Semua");
  const [status, setStatus] = useState<(typeof STATUS_FILTER)[number]>("semua");
  const [adding, setAdding] = useState(Boolean(addName));
  const [form, setForm] = useState({ name: addName?.name ?? "", bahan: "", alias: "" });
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    () => api<FoodItem[]>(`/api/foods?profileId=${profile.id}`).then(setFoods).catch((e) => toast.error(e.message)),
    [profile.id, toast],
  );
  useEffect(() => { load(); }, [load]);

  const cats = useMemo(() => ["Semua", ...new Set(foods.map((f) => f.kategori))], [foods]);
  const list = foods.filter((f) =>
    (cat === "Semua" || f.kategori === cat) &&
    (status === "semua" || f.status === status) &&
    (!q || [f.name, ...f.aliases].some((n) => n.includes(q.trim().toLowerCase()))));

  async function analyze(e: React.FormEvent) {
    e.preventDefault();
    const m = nameProblem(form.name, "Nama makanan");
    if (m) return toast.warning(m, "Belum lengkap");
    setBusy(true);
    try {
      setAnalysis(await api<Analysis>("/api/foods/analyze", { name: form.name, bahan: form.bahan }));
    } catch (err) {
      toast.error((err as Error).message, "Gagal menganalisis");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!analysis) return;
    try {
      await api("/api/foods", {
        profileId: profile.id, name: form.name, bahan: form.bahan, kategori: analysis.kategori,
        purin: analysis.purin, garam: analysis.garam, karbo: analysis.karbo, gula: analysis.gula, lemak: analysis.lemak,
        alergen: analysis.alergen, porsi_aman: analysis.porsi_aman,
        trik: analysis.trik.filter(Boolean), pemicu: analysis.pemicu, alasan: analysis.alasan,
        aliases: form.alias.split(",").map((s) => s.trim()).filter(Boolean),
      });
      toast.success(`"${form.name}" masuk daftar keluarga.`, "Tersimpan");
      setAdding(false);
      setAnalysis(null);
      setQ(form.name.toLowerCase());
      setCat("Semua");
      load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function remove(f: FoodItem) {
    if (!f.id || !confirm(`Hapus "${f.name}" dari daftar?`)) return;
    try {
      await api(`/api/foods/${f.id}`, undefined, "DELETE");
      toast.success(`"${f.name}" dihapus dari daftar.`, "Terhapus");
      load();
    } catch (e) {
      toast.error((e as Error).message, "Gagal menghapus");
    }
  }

  const setA = (k: keyof Analysis, v: string | string[]) => setAnalysis((a) => (a ? { ...a, [k]: v } : a));

  return (
    <>
      {!adding ? (
        <button className="btn big primary add-open" onClick={() => { setAdding(true); setAnalysis(null); setForm({ name: "", bahan: "", alias: "" }); }}>
          + Tambah makanan sendiri
        </button>
      ) : (
        <div className="card">
          <p className="eyebrow">Makanan keluarga</p>
          <h2>Tambah ke daftar</h2>
          {!analysis ? (
            <form onSubmit={analyze}>
              <label className="field">Nama makanan
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="mis. nasi tutug oncom" required />
              </label>
              <label className="field">Bahan / cara masak <span className="muted small">(makin lengkap makin akurat)</span>
                <textarea rows={3} value={form.bahan} onChange={(e) => setForm({ ...form, bahan: e.target.value })} placeholder="mis. nasi, oncom bakar, ikan asin, sambal" />
              </label>
              {busy && <div className="bar"><span /></div>}
              <div className="row">
                <button type="button" className="btn" onClick={() => setAdding(false)}>Batal</button>
                <button className="btn ink" disabled={busy}>{busy ? "Menilai…" : "Analisis dengan AI"}</button>
              </div>
            </form>
          ) : (
            <>
              <div className="review-head"><p className="eyebrow">Usulan AI · periksa dulu</p><p className="small">{analysis.alasan}</p></div>
              <div className="grid2">
                {(["purin", "garam", "karbo", "gula", "lemak"] as const).map((k) => (
                  <label className="field" key={k}>{DIM_LABEL[k]}
                    <select value={analysis[k]} onChange={(e) => setA(k, e.target.value)}>{LEVELS.map((l) => <option key={l}>{l}</option>)}</select>
                  </label>
                ))}
              </div>
              {analysis.alergen.length > 0 && <p className="small"><b>Mungkin mengandung:</b> {analysis.alergen.join(", ")}</p>}
              <label className="field">Kategori
                <select value={analysis.kategori} onChange={(e) => setA("kategori", e.target.value)}>
                  {cats.filter((c) => c !== "Semua" && c !== "Buatan keluarga").map((c) => <option key={c}>{c}</option>)}
                </select>
              </label>
              <label className="field">Porsi aman <input type="text" value={analysis.porsi_aman} onChange={(e) => setA("porsi_aman", e.target.value)} /></label>
              <label className="field">Tips (satu per baris)
                <textarea rows={3} value={analysis.trik.join("\n")} onChange={(e) => setA("trik", e.target.value.split("\n"))} />
              </label>
              <label className="field">Nama lain <span className="muted small">(pisahkan koma)</span>
                <input type="text" value={form.alias} onChange={(e) => setForm({ ...form, alias: e.target.value })} />
              </label>
              {analysis.refs.length > 0 && <p className="muted small">Dibandingkan dengan: {analysis.refs.join(", ")}</p>}
              <div className="row">
                <button className="btn" onClick={() => setAnalysis(null)}>Ulangi</button>
                <button className="btn good" onClick={save}>Simpan ke daftar</button>
              </div>
            </>
          )}
        </div>
      )}

      <div className="card flat">
        <h2>Daftar makanan</h2>
        <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari: soto, sate, emping…" autoComplete="off" />
        <div className="filter-row"><Chips items={STATUS_FILTER} value={status} onPick={setStatus} labels={STATUS_LABEL} /></div>
        <div className="scroll-x"><Chips items={cats} value={cat} onPick={setCat} /></div>
        <p className="muted small">{list.length} dari {foods.length} makanan · ketuk untuk cek</p>
      </div>

      <div className="food-grid">
        {list.length ? list.slice(0, 120).map((f) => (
          <article className="food" key={f.id ?? f.name} onClick={() => onCheck(f.name)}>
            <div className={`rail ${f.status}`} />
            <div className="body">
              <div className="top-line"><h3>{f.name}</h3><span className="kat">{f.kategori}</span></div>
              {f.aliases.length > 0 && <div className="alias">{f.aliases.slice(0, 4).join(", ")}</div>}
              <div className="badges">
                <span className={`badge ${BADGE[f.status]}`}>{STATUS_LABEL[f.status]}</span>
                {dims.map((d) => {
                  const v = (f as unknown as Record<string, string | undefined>)[d];
                  return v ? <span key={d} className={`badge ${v}`}>{DIM_LABEL[d]} {v}</span> : null;
                })}
                {conditions.includes("alergi") && (f.alergen ?? []).length > 0 && <span className="badge tinggi">⚠️ {f.alergen!.join(", ")}</span>}
                {f.custom && <span className="badge keluarga">Buatan keluarga</span>}
                {f.ai && <span className="badge ai">{f.basis?.sumber === "kemasan" ? "🏷️ Label kemasan" : "📊 Dihitung dari bahan"}</span>}
              </div>
              {f.reason && f.status !== "hijau" && <p className="small" style={{ margin: "0 0 4px" }}>{f.reason}</p>}
              <p className="porsi">{f.porsi_aman}</p>
              {f.custom && <button className="btn del" onClick={(e) => { e.stopPropagation(); remove(f); }}>Hapus</button>}
            </div>
          </article>
        )) : <div className="card empty">Belum ada di daftar. Coba cek langsung di tab Cek, AI akan menilai.</div>}
        {list.length > 120 && <p className="muted small" style={{ textAlign: "center" }}>Ketik di kolom cari untuk melihat sisanya.</p>}
      </div>
    </>
  );
}
