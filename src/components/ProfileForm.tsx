"use client";
import { useState } from "react";
import { Personalisasi, Profile } from "./types";
import { api, useToast } from "./ui";
import { ALERGEN_LABEL, ALERGEN_LIST, CONDITIONS, ConditionId, EXCLUSIVE } from "@/lib/conditions";
import { MEDICATIONS } from "@/lib/medications";
import { play } from "@/lib/sound";
import { nameProblem, phoneProblem, profileProblem } from "@/lib/validation";

export type ProfileDraft = Omit<Profile, "id" | "family_id">;

export const emptyDraft = (): ProfileDraft => ({
  nama: "", panggilan: "", usia: null, untuk: "orang_tua", kondisi: [], alergen: [], diabetes_tipe: null, insulin: false,
  catatan_dokter: "", obat: [], target_gula_puasa: null, target_gula_2jam: null, target_sistolik: null, target_diastolik: null,
  kontak_nama: "", kontak_telepon: "", kondisi_lain: "", obat_lain: "", alergen_lain: "", personalisasi: null,
});

interface Suggestion {
  local: { kondisi: ConditionId[]; obat: string[]; alergen: string[] };
  ai: null | {
    ringkasan: string; fokus: string; hindari: string[]; batasi: string[];
    kondisi_terkait: ConditionId[]; alergen_terkait: string[]; obat_terkait: string[]; perlu_dokter: boolean; catatan_keamanan: string;
  };
  aiError?: string;
}

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
  const toast = useToast();
  const [sug, setSug] = useState<Suggestion | null>(null);
  const [thinking, setThinking] = useState(false);
  const [openMore, setOpenMore] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const touch = (k: string) => setTouched((t) => ({ ...t, [k]: true }));
  const nameErr = touched.nama ? nameProblem(d.nama) : null;
  const phoneErr = touched.telepon ? phoneProblem(d.kontak_telepon) : null;
  const hasOther = Boolean(d.kondisi_lain.trim() || d.obat_lain.trim() || d.alergen_lain.trim());

  async function understand() {
    setThinking(true);
    try {
      const r = await api<Suggestion>("/api/profiles/personalize", {
        usia: d.usia, kondisi: d.kondisi, kondisi_lain: d.kondisi_lain, obat_lain: d.obat_lain, alergen_lain: d.alergen_lain,
      });
      setSug(r);
      if (r.aiError) toast.warning(`${r.aiError}. Yang bisa dikenali tanpa AI tetap ditampilkan.`, "AI belum tersedia");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setThinking(false);
    }
  }

  function applySuggestion() {
    if (!sug) return;
    const kondisi = [...new Set([...d.kondisi.filter((x) => x !== "sehat"), ...sug.local.kondisi, ...(sug.ai?.kondisi_terkait ?? [])])] as ConditionId[];
    const alergen = [...new Set([...d.alergen, ...sug.local.alergen, ...(sug.ai?.alergen_terkait ?? [])])];
    const personalisasi: Personalisasi | null = sug.ai && (sug.ai.hindari.length || sug.ai.batasi.length || sug.ai.fokus) ? {
      ringkasan: sug.ai.ringkasan, fokus: sug.ai.fokus, hindari: sug.ai.hindari, batasi: sug.ai.batasi, perlu_dokter: sug.ai.perlu_dokter,
      sumber: [d.kondisi_lain, d.obat_lain, d.alergen_lain].filter(Boolean).join(" | ").slice(0, 800), dibuat: new Date().toISOString(),
    } : d.personalisasi;
    setD((x) => ({
      ...x,
      kondisi: alergen.length && !kondisi.includes("alergi") ? [...kondisi, "alergi"] : kondisi.length ? kondisi : x.kondisi,
      obat: [...new Set([...x.obat, ...sug.local.obat, ...(sug.ai?.obat_terkait ?? [])])],
      alergen,
      personalisasi,
    }));
    setSug(null);
    toast.success("Jangan lupa tekan Simpan di bawah.", "Usulan diterapkan");
  }
  const has = (c: ConditionId) => d.kondisi.includes(c);

  function pickCondition(c: ConditionId) {
    let next = c === "sehat" ? ["sehat"] : toggle(d.kondisi.filter((x) => x !== "sehat"), c);
    // kondisi yang saling bertentangan (darah tinggi vs darah rendah): yang baru dipilih menggantikan
    for (const [a, b] of EXCLUSIVE) if (c === a) next = next.filter((x) => x !== b); else if (c === b) next = next.filter((x) => x !== a);
    set("kondisi", next);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const problem = profileProblem({ ...d, alergen: has("alergi") ? d.alergen : [], panggilan: undefined });
    if (problem) {
      play("error");
      setError(problem);
      toast.warning(problem, "Belum lengkap");
      // bagian yang bermasalah mungkin ada di "Detail tambahan" yang tertutup
      if (/telepon|kontak|target|tensi|gula/i.test(problem)) setOpenMore(true);
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onSubmit({
        ...d,
        panggilan: (d.panggilan.trim() || d.nama.trim()).slice(0, 20),
        alergen: has("alergi") ? d.alergen : [],
        diabetes_tipe: has("diabetes") ? d.diabetes_tipe ?? "tidak_tahu" : null,
        insulin: has("diabetes") && d.insulin,
        target_gula_puasa: has("diabetes") ? d.target_gula_puasa : null,
        target_gula_2jam: has("diabetes") ? d.target_gula_2jam : null,
      });
    } catch (err) {
      play("error");
      setError((err as Error).message);
      toast.error((err as Error).message, "Gagal menyimpan");
    } finally {
      setBusy(false);
    }
  }

  const tensi = has("hipertensi") || has("stroke_jantung") || has("darah_rendah");

  return (
    <form onSubmit={submit}>
      <label className="field">Nama <input type="text" value={d.nama} maxLength={40} className={nameErr ? "invalid" : ""} aria-invalid={Boolean(nameErr)}
        onChange={(e) => set("nama", e.target.value)} onBlur={() => touch("nama")} placeholder="mis. Omah" /></label>
      {nameErr && <p className="field-error">{nameErr}</p>}

      <p className="eyebrow">Kondisi (boleh lebih dari satu)</p>
      <div className="cond-list">
        {CONDITIONS.map((c) => (
          <button type="button" key={c.id} className={`cond${has(c.id) ? " on" : ""}`} onClick={() => pickCondition(c.id)}>
            <span className="cond-emo">{c.emoji}</span>
            <span className="cond-text"><b>{c.label}</b><small>{c.desc}</small></span>
            {c.status === "beta" && <span className="beta">Beta</span>}
          </button>
        ))}
      </div>
      {has("alergi") && (
        <>
          <p className="eyebrow">⚠️ Alergi terhadap</p>
          <div className="chips">{ALERGEN_LIST.map((a) => <button type="button" key={a} className={`chip${d.alergen.includes(a) ? " on" : ""}`} onClick={() => set("alergen", toggle(d.alergen, a))}>{ALERGEN_LABEL[a]}</button>)}</div>
        </>
      )}

      <label className="field">Ada yang perlu diperhatikan lagi? (boleh kosong)
        <textarea rows={3} value={d.kondisi_lain} maxLength={300} onChange={(e) => set("kondisi_lain", e.target.value)}
          placeholder="Tulis bebas: obat yang diminum, penyakit lain, alergi. Mis. minum amlodipin, maag, alergi udang" />
      </label>
      {hasOther && !sug && (
        <button type="button" className="btn ink" style={{ margin: "0 0 4px" }} onClick={understand} disabled={thinking}>
          {thinking ? "Sedang dipahami…" : "🤖 Bantu pahami tulisan ini"}
        </button>
      )}
      {d.personalisasi && !sug && (
        <div className="review-head">
          <p className="eyebrow">Catatan khusus aktif</p>
          <p className="small"><b>{d.personalisasi.ringkasan}</b> {d.personalisasi.fokus}</p>
          {d.personalisasi.hindari.length > 0 && <p className="small">🚫 Hindari: {d.personalisasi.hindari.join(", ")}</p>}
          {d.personalisasi.batasi.length > 0 && <p className="small">⚖️ Batasi: {d.personalisasi.batasi.join(", ")}</p>}
          <button type="button" className="btn sm" style={{ marginTop: 6 }} onClick={() => set("personalisasi", null)}>Hapus catatan khusus</button>
        </div>
      )}
      {sug && (
        <div className="suggest">
          <p className="eyebrow">🤖 Usulan · periksa dulu sebelum dipakai</p>
          {(sug.local.kondisi.length > 0 || sug.local.obat.length > 0 || sug.local.alergen.length > 0) && (
            <p className="small"><b>Dikenali:</b> {[
              ...sug.local.kondisi.map((c) => CONDITIONS.find((x) => x.id === c)?.label ?? c),
              ...sug.local.obat.map((m) => MEDICATIONS.find((x) => x.id === m)?.label ?? m),
              ...sug.local.alergen.map((a) => `alergi ${a}`),
            ].join(" · ")}</p>
          )}
          {sug.ai ? (
            <>
              <p className="small"><b>{sug.ai.ringkasan}</b></p>
              <p className="small">{sug.ai.fokus}</p>
              {sug.ai.hindari.length > 0 && <div className="chips">{sug.ai.hindari.map((h) => <span key={h} className="chip">🚫 {h}</span>)}</div>}
              {sug.ai.batasi.length > 0 && <div className="chips">{sug.ai.batasi.map((h) => <span key={h} className="chip">⚖️ {h}</span>)}</div>}
              {sug.ai.perlu_dokter && <div className="alert perhatian small">Kondisi ini biasanya butuh diet khusus dari dokter/ahli gizi. Aplikasi hanya membantu mengingatkan.</div>}
              {sug.ai.catatan_keamanan && <p className="small muted">{sug.ai.catatan_keamanan}</p>}
            </>
          ) : <p className="small muted">AI belum tersedia. Tulisan tetap disimpan dan dibaca AI saat menulis saran nanti.</p>}
          <div className="row" style={{ marginTop: 8 }}>
            <button type="button" className="btn sm" onClick={() => setSug(null)}>Abaikan</button>
            <button type="button" className="btn sm good" onClick={applySuggestion}>Pakai usulan ini</button>
          </div>
        </div>
      )}

      <details className="more" open={openMore} onToggle={(e) => setOpenMore((e.target as HTMLDetailsElement).open)}>
        <summary>Detail tambahan <small>boleh dilewati, bisa diisi anak/keluarga nanti</small></summary>
        <div className="grid2">
          <label className="field">Dipanggil <input type="text" value={d.panggilan} onChange={(e) => set("panggilan", e.target.value)} placeholder="mis. Mah" /></label>
          <label className="field">Usia <input type="number" min={1} max={120} value={d.usia ?? ""} onChange={(e) => set("usia", num(e.target.value))} /></label>
        </div>
        <label className="field">Untuk
          <select value={d.untuk} onChange={(e) => set("untuk", e.target.value)}>{UNTUK.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        </label>

        {has("diabetes") && (
          <>
            <p className="eyebrow">🩸 Jenis diabetes</p>
            <div className="chips">{DM_TIPE.map(([v, l]) => <button type="button" key={v} className={`chip${d.diabetes_tipe === v ? " on" : ""}`} onClick={() => set("diabetes_tipe", v)}>{l}</button>)}</div>
            <label className="check"><input type="checkbox" checked={d.insulin} onChange={(e) => set("insulin", e.target.checked)} /> Memakai suntikan insulin</label>
          </>
        )}

        <p className="eyebrow">💊 Obat yang rutin diminum</p>
        <p className="small muted" style={{ margin: "0 0 6px" }}>Atau cukup tulis nama obatnya di kotak atas.</p>
        <div className="med-list">
          {MEDICATIONS.map((m) => (
            <label key={m.id} className={`care-item${d.obat.includes(m.id) ? " on-plain" : ""}`}>
              <input type="checkbox" checked={d.obat.includes(m.id)} onChange={() => set("obat", toggle(d.obat, m.id))} />
              <span><b>{m.label}</b><br /><small className="muted">{m.contoh}</small></span>
            </label>
          ))}
        </div>
        {(initial.obat_lain || initial.alergen_lain) && (
          <>
            <label className="field">Obat lain <input type="text" value={d.obat_lain} onChange={(e) => set("obat_lain", e.target.value)} /></label>
            <label className="field">Alergi lain <input type="text" value={d.alergen_lain} onChange={(e) => set("alergen_lain", e.target.value)} /></label>
          </>
        )}

        {(has("diabetes") || tensi) && (
          <>
            <p className="eyebrow">🎯 Target dari dokter</p>
            <p className="small muted" style={{ margin: "0 0 6px" }}>Kosongkan untuk memakai target umum.</p>
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
          <label className="field">Telepon <input type="tel" inputMode="tel" maxLength={24} value={d.kontak_telepon} className={phoneErr ? "invalid" : ""} aria-invalid={Boolean(phoneErr)}
            onChange={(e) => set("kontak_telepon", e.target.value)} onBlur={() => touch("telepon")} placeholder="08…" /></label>
        </div>
        {phoneErr && <p className="field-error">{phoneErr}</p>}

        <label className="field">Catatan dari dokter
          <textarea rows={2} value={d.catatan_dokter} onChange={(e) => set("catatan_dokter", e.target.value)} placeholder="mis. nasi maks ¾ gelas, hindari santan" />
        </label>
      </details>

      {error && <div className="error-box">{error}</div>}
      <div className="row" style={{ marginTop: 14 }}>
        {onCancel && <button type="button" className="btn" onClick={onCancel}>Batal</button>}
        <button className="btn big primary" disabled={busy}>{busy ? "Menyimpan…" : submitLabel}</button>
      </div>
    </form>
  );
}
