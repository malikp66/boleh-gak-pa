"use client";
import { useState } from "react";
import { Profile } from "./types";
import { ALERGEN_LABEL, ALERGEN_LIST, CONDITIONS, ConditionId, EXCLUSIVE } from "@/lib/conditions";
import { MEDICATIONS } from "@/lib/medications";

export type ProfileDraft = Omit<Profile, "id" | "family_id">;

export const emptyDraft = (): ProfileDraft => ({
  nama: "", panggilan: "", usia: null, untuk: "orang_tua", kondisi: [], alergen: [], diabetes_tipe: null, insulin: false,
  catatan_dokter: "", obat: [], target_gula_puasa: null, target_gula_2jam: null, target_sistolik: null, target_diastolik: null,
  kontak_nama: "", kontak_telepon: "",
});

const DM_TIPE = [["pradiabetes", "Pradiabetes"], ["tipe_2", "Tipe 2"], ["tipe_1", "Tipe 1"], ["gestasional", "Saat hamil"], ["tidak_tahu", "Tidak tahu"]] as const;
const UNTUK = [["diri", "Diri sendiri"], ["orang_tua", "Orang tua"], ["pasangan", "Pasangan"], ["anak", "Anak"], ["lainnya", "Lainnya"]] as const;

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
const num = (v: string) => (v === "" ? null : Number(v));

export default function ProfileForm({ initial, submitLabel, onSubmit, onCancel }: {
  initial: ProfileDraft;
  submitLabel: string;
  onSubmit: (d: ProfileDraft) => Promise<void>;
  onCancel?: () => void;
}) {
  const [d, setD] = useState<ProfileDraft>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = <K extends keyof ProfileDraft>(k: K, v: ProfileDraft[K]) => setD((x) => ({ ...x, [k]: v }));
  const has = (c: ConditionId) => d.kondisi.includes(c);

  function pickCondition(c: ConditionId) {
    let next = c === "sehat" ? ["sehat"] : toggle(d.kondisi.filter((x) => x !== "sehat"), c);
    // kondisi yang saling bertentangan (darah tinggi vs darah rendah): yang baru dipilih menggantikan
    for (const [a, b] of EXCLUSIVE) if (c === a) next = next.filter((x) => x !== b); else if (c === b) next = next.filter((x) => x !== a);
    set("kondisi", next);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!d.kondisi.length) return setError("Pilih minimal satu kondisi.");
    if ((d.target_sistolik == null) !== (d.target_diastolik == null)) return setError("Isi target tensi atas dan bawah sekaligus.");
    setBusy(true);
    setError("");
    try {
      await onSubmit({
        ...d,
        alergen: has("alergi") ? d.alergen : [],
        diabetes_tipe: has("diabetes") ? d.diabetes_tipe ?? "tidak_tahu" : null,
        insulin: has("diabetes") && d.insulin,
        target_gula_puasa: has("diabetes") ? d.target_gula_puasa : null,
        target_gula_2jam: has("diabetes") ? d.target_gula_2jam : null,
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const tensi = has("hipertensi") || has("stroke_jantung") || has("darah_rendah");

  return (
    <form onSubmit={submit}>
      <div className="grid2">
        <label className="field">Nama <input type="text" value={d.nama} onChange={(e) => set("nama", e.target.value)} placeholder="mis. Omah" required /></label>
        <label className="field">Dipanggil <input type="text" value={d.panggilan} onChange={(e) => set("panggilan", e.target.value)} placeholder="mis. Mah" required /></label>
      </div>
      <div className="grid2">
        <label className="field">Usia <input type="number" min={1} max={120} value={d.usia ?? ""} onChange={(e) => set("usia", num(e.target.value))} /></label>
        <label className="field">Untuk
          <select value={d.untuk} onChange={(e) => set("untuk", e.target.value)}>{UNTUK.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        </label>
      </div>

      <p className="eyebrow">Kondisi</p>
      <div className="cond-list">
        {CONDITIONS.map((c) => (
          <button type="button" key={c.id} className={`cond${has(c.id) ? " on" : ""}`} onClick={() => pickCondition(c.id)}>
            <span className="cond-emo">{c.emoji}</span>
            <span className="cond-text"><b>{c.label}</b><small>{c.desc}</small></span>
            {c.status === "beta" && <span className="beta">Beta</span>}
          </button>
        ))}
      </div>

      {has("diabetes") && (
        <>
          <p className="eyebrow">🩸 Jenis diabetes</p>
          <div className="chips">{DM_TIPE.map(([v, l]) => <button type="button" key={v} className={`chip${d.diabetes_tipe === v ? " on" : ""}`} onClick={() => set("diabetes_tipe", v)}>{l}</button>)}</div>
          <label className="check"><input type="checkbox" checked={d.insulin} onChange={(e) => set("insulin", e.target.checked)} /> Memakai suntikan insulin</label>
        </>
      )}
      {has("alergi") && (
        <>
          <p className="eyebrow">⚠️ Alergi terhadap</p>
          <div className="chips">{ALERGEN_LIST.map((a) => <button type="button" key={a} className={`chip${d.alergen.includes(a) ? " on" : ""}`} onClick={() => set("alergen", toggle(d.alergen, a))}>{ALERGEN_LABEL[a]}</button>)}</div>
        </>
      )}

      <p className="eyebrow">💊 Obat yang rutin diminum (opsional)</p>
      <p className="small muted" style={{ margin: "0 0 6px" }}>Untuk peringatan interaksi makanan. Lihat nama di bungkus obat.</p>
      <div className="med-list">
        {MEDICATIONS.map((m) => (
          <label key={m.id} className={`care-item${d.obat.includes(m.id) ? " on-plain" : ""}`}>
            <input type="checkbox" checked={d.obat.includes(m.id)} onChange={() => set("obat", toggle(d.obat, m.id))} />
            <span><b>{m.label}</b><br /><small className="muted">{m.contoh}</small></span>
          </label>
        ))}
      </div>

      {(has("diabetes") || tensi) && (
        <>
          <p className="eyebrow">🎯 Target dari dokter (opsional)</p>
          <p className="small muted" style={{ margin: "0 0 6px" }}>Kalau dokter memberi target sendiri, isi di sini. Kosongkan untuk memakai target umum.</p>
          {has("diabetes") && (
            <div className="grid2">
              <label className="field">Gula puasa maks <input type="number" min={60} max={250} value={d.target_gula_puasa ?? ""} onChange={(e) => set("target_gula_puasa", num(e.target.value))} placeholder="mis. 130" /></label>
              <label className="field">Gula 2 jam maks <input type="number" min={80} max={300} value={d.target_gula_2jam ?? ""} onChange={(e) => set("target_gula_2jam", num(e.target.value))} placeholder="mis. 180" /></label>
            </div>
          )}
          {tensi && (
            <div className="grid2">
              <label className="field">Tensi atas maks <input type="number" min={80} max={200} value={d.target_sistolik ?? ""} onChange={(e) => set("target_sistolik", num(e.target.value))} placeholder="mis. 130" /></label>
              <label className="field">Tensi bawah maks <input type="number" min={50} max={130} value={d.target_diastolik ?? ""} onChange={(e) => set("target_diastolik", num(e.target.value))} placeholder="mis. 80" /></label>
            </div>
          )}
        </>
      )}

      <p className="eyebrow">📞 Kontak darurat keluarga</p>
      <div className="grid2">
        <label className="field">Nama <input type="text" value={d.kontak_nama} onChange={(e) => set("kontak_nama", e.target.value)} placeholder="mis. Malik" /></label>
        <label className="field">Telepon <input type="tel" inputMode="tel" value={d.kontak_telepon} onChange={(e) => set("kontak_telepon", e.target.value)} placeholder="08…" /></label>
      </div>

      <label className="field">Catatan dari dokter
        <textarea rows={2} value={d.catatan_dokter} onChange={(e) => set("catatan_dokter", e.target.value)} placeholder="mis. nasi maks ¾ gelas, hindari santan" />
      </label>

      {error && <div className="error-box">{error}</div>}
      <div className="row" style={{ marginTop: 14 }}>
        {onCancel && <button type="button" className="btn" onClick={onCancel}>Batal</button>}
        <button className="btn primary" disabled={busy}>{busy ? "Menyimpan…" : submitLabel}</button>
      </div>
    </form>
  );
}
