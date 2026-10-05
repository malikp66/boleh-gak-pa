"use client";
import { useCallback, useEffect, useState } from "react";
import { api, Chips, Meter, resizeImage, speak, useToast } from "./ui";
import { AssessResult, Profile } from "./types";

const FOOD_CHIPS = ["ketoprak", "sate kambing", "soto betawi", "bakso", "gado-gado", "nasi padang", "seafood", "martabak manis"] as const;
const NOTE_CHIPS = ["Ditraktir teman", "Kondangan", "Di rumah", "Beli sendiri"] as const;
const VERDICT: Record<string, string> = { hijau: "Aman", kuning: "Boleh, dibatasi", merah: "Sebaiknya jangan" };

interface PhotoInfo {
  food: string; nama: string; komponen: string[]; model_guess: string;
  corrected: boolean; in_table: boolean; alternatives: string[];
}

export default function CekTab({ profile, flareJoint, prefill, onSaveUnknown, onLogged }: {
  profile: Profile;
  flareJoint: string | null;
  prefill: { food: string; n: number } | null;
  onSaveUnknown: (name: string) => void;
  onLogged: () => void;
}) {
  const toast = useToast();
  const [food, setFood] = useState(prefill?.food ?? "");
  const [note, setNote] = useState<(typeof NOTE_CHIPS)[number]>("Ditraktir teman");
  const [loading, setLoading] = useState(prefill ? "Lagi mikir…" : "");
  const [result, setResult] = useState<AssessResult | null>(null);
  const [preview, setPreview] = useState("");
  const [photo, setPhoto] = useState<PhotoInfo | null>(null);

  const clear = () => setResult(null);

  // Tidak mengubah state secara langsung: aman dipanggil dari effect maupun handler.
  const runAssess = useCallback((text: string) => {
    const t0 = performance.now();
    return api<AssessResult>("/api/assess", { profileId: profile.id, food: text, note })
      .then((r) => {
        setResult({ ...r, elapsed: Math.round((performance.now() - t0) / 1000) });
        setTimeout(() => document.getElementById("result")?.scrollIntoView({ behavior: "smooth" }), 50);
      })
      .catch((e: Error) => toast("Gagal: " + e.message))
      .finally(() => setLoading(""));
  }, [profile.id, note, toast]);

  function check(text: string) {
    if (!text.trim()) return toast(`Ketik atau foto makanannya dulu, ${profile.panggilan}`);
    clear();
    setLoading("Lagi mikir…");
    runAssess(text);
  }

  // dari tab Daftar: komponen dipasang ulang (key) dengan makanan terisi → langsung cek
  const [autoFood] = useState(prefill?.food);
  useEffect(() => {
    if (autoFood) runAssess(autoFood);
  }, [autoFood, runAssess]);

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    clear();
    setFood("");
    setPhoto(null);
    const dataUrl = await resizeImage(file);
    setPreview(dataUrl);
    setLoading("Lagi melihat fotonya…");
    try {
      const r = await api<PhotoInfo>("/api/identify", { profileId: profile.id, image: dataUrl });
      setFood(r.food === "lainnya" ? "" : r.food);
      setPhoto(r);
    } catch (err) {
      toast((err as Error).message || "Belum bisa baca foto. Ketik saja namanya ya.");
    } finally {
      setLoading("");
    }
  }

  async function log(portion: "sesuai saran" | "porsi penuh" | "ditolak") {
    if (!result) return;
    try {
      await api("/api/meals", { profileId: profile.id, food: result.food, portion, status: portion === "ditolak" ? "hijau" : result.status, note });
      toast(portion === "ditolak" ? `Mantap, ${profile.panggilan}! Tercatat.` : "Tercatat di catatan makan");
      setResult(null);
      setFood("");
      setPreview("");
      setPhoto(null);
      onLogged();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      toast((e as Error).message);
    }
  }

  const r = result;
  const multi = (r?.components.length ?? 0) > 1;
  const typo = r?.components.some((c) => c.matched?.includes("(dari"));
  const salty = r?.components.filter((c) => c.garam === "tinggi") ?? [];

  return (
    <>
      {flareJoint && <div className="banner">Asam urat lagi kambuh ({flareJoint}). Saran dibuat lebih ketat.</div>}

      <div className="card">
        <p className="eyebrow">Langkah 1</p>
        <h2>Lagi ditawari apa, {profile.panggilan}?</h2>
        <label className="btn big ink">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
          Foto makanannya
          <input type="file" accept="image/*" capture="environment" hidden onChange={onPhoto} />
        </label>
        {preview && <img src={preview} className="preview" alt="Foto makanan" />}
        {photo && (
          <div className="photo-info">
            {photo.nama && <p className="small"><b>Terlihat:</b> {photo.nama}</p>}
            {photo.komponen.length > 0 && <p className="small"><b>Isinya:</b> {photo.komponen.join(", ")}</p>}
            {photo.corrected && photo.model_guess !== "lainnya" && <p className="small muted">Pilihan awal &quot;{photo.model_guess}&quot; tidak cocok dengan yang terlihat, jadi dikoreksi.</p>}
            {!photo.in_table && <p className="small"><b>⚠️ Belum ada di daftar.</b> Nanti dinilai AI, atau simpan ke daftar.</p>}
            <p className="eyebrow">Betul yang mana, {profile.panggilan}?</p>
            <div className="chips">
              {[photo.food, ...photo.alternatives].map((n) => (
                <button key={n} type="button" className={`chip${food === n ? " on" : ""}`} onClick={() => { setFood(n); clear(); }}>{n}</button>
              ))}
            </div>
          </div>
        )}
        <div className="or"><span>atau ketik</span></div>
        <form onSubmit={(e) => { e.preventDefault(); check(food); }}>
          <input type="text" value={food} placeholder="mis. ketoprak" autoComplete="off" enterKeyHint="go"
            onChange={(e) => { setFood(e.target.value); clear(); }} />
          <div className="chips"><Chips items={FOOD_CHIPS} onPick={(f) => { setFood(f); clear(); }} /></div>
          <p className="eyebrow">Situasinya</p>
          <div className="chips"><Chips items={NOTE_CHIPS} value={note} onPick={setNote} /></div>
          <button className="btn big primary" type="submit" disabled={Boolean(loading)}>Boleh gak? →</button>
        </form>
      </div>

      {loading && (
        <div className="card loading">
          <div className="bar"><span /></div>
          <p><b>{loading}</b></p>
        </div>
      )}

      {r && (
        <div id="result">
          <div className={`verdict ${r.status}`}>
            <span className="stamp">{VERDICT[r.status]}</span>
            {!r.in_table && <span className="estimate">⚠️ Belum ada di daftar · lampu ini perkiraan AI</span>}
            <div className="food-name">{multi ? `Kombinasi ${r.components.length} makanan` : r.food}</div>
            <div className="headline">{r.headline}</div>
            {(multi || typo) && (
              <div className="parts">
                {r.components.map((c, i) => (
                  <span key={c.name} style={{ display: "contents" }}>
                    {i > 0 && <span className="plus">+</span>}
                    <span className="part"><i className={`dot ${c.status}`} />{c.name}
                      {c.matched?.includes("(dari") && <small>{c.matched.split("(dari ")[1].replace(/[')]/g, "")}?</small>}
                    </span>
                  </span>
                ))}
              </div>
            )}
            {salty.length >= 2 && <p className="combo-warn">Dobel garam: {salty.map((c) => c.name).join(" + ")}</p>}
            {r.in_table && <div className="meters"><Meter label="Purin" level={r.purin} /><Meter label="Garam" level={r.garam} /></div>}
            {r.flare_active && <span className="flare-tag">Lagi kambuh, lebih ketat</span>}
          </div>

          <div className="card">
            <p className="eyebrow">Porsi aman</p>
            <p className="portion">{r.portion}</p>
            <p className="eyebrow">Biar lebih aman</p>
            <ol className="tips">{r.tips.map((t) => <li key={t}><span>{t}</span></li>)}</ol>
          </div>

          <div className="card">
            <h2>Cara bilang ke teman</h2>
            {r.refusals.map((x) => (
              <div className="refusal" key={x.label}>
                <b>{x.label}</b>
                <p>“{x.text}”</p>
                <div className="row">
                  <button className="btn sm" onClick={() => speak(x.text, toast)}>Bacakan</button>
                  <button className="btn sm" onClick={() => navigator.clipboard.writeText(x.text).then(() => toast("Tersalin"), () => toast("Tidak bisa menyalin"))}>Salin</button>
                </div>
              </div>
            ))}
            <details><summary>Kalau tetap dimakan semua?</summary><p>{r.if_forced}</p></details>
            <details>
              <summary>Kenapa?</summary>
              <p>{r.why}</p>
              <p className="muted small">
                {r.in_table ? "Lampu dari tabel makanan." : "Tidak ada di tabel — perkiraan AI, hati-hati."}{" "}
                {r.source === "ai" ? `Ditulis ${r.model} dalam ${r.elapsed} detik.` : r.source === "cache" ? "Jawaban tersimpan (tanpa biaya AI)." : "Mode tabel (AI tidak dipakai)."}
              </p>
            </details>
          </div>

          <div className="card">
            <h2>Jadinya gimana, {profile.panggilan}?</h2>
            <div className="stack">
              <button className="btn big good" onClick={() => log("sesuai saran")}>Makan sesuai saran</button>
              <button className="btn big" onClick={() => log("porsi penuh")}>Makan 1 porsi penuh</button>
              <button className="btn big primary" onClick={() => log("ditolak")}>Berhasil menolak!</button>
            </div>
          </div>
          {!r.in_table && <button className="btn big ink" onClick={() => onSaveUnknown(r.food)}>+ Simpan &quot;{r.food}&quot; ke daftar</button>}
        </div>
      )}
    </>
  );
}
