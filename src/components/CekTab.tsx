"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, Chips, Meter, resizeImage, speak, useToast } from "./ui";
import { AssessResult, PendingCheck, Profile } from "./types";
import { ConditionId, conditionInfo, normalizeConditions, spokenAlergen } from "@/lib/conditions";
import { play } from "@/lib/sound";
import { refreshLimits, useLimits } from "@/lib/limits";
import LimitNote from "./LimitNote";
import CharCount from "./CharCount";
import { cleanSpoken, useSpeech } from "@/lib/speech";

// contoh makanan yang paling "menguji" tiap kondisi
const EXAMPLES: Record<ConditionId, string[]> = {
  diabetes: ["nasi uduk", "es teh manis", "martabak manis", "nasi + mi goreng"],
  hipertensi: ["bakso", "mi instan", "ikan asin", "indomie ketoprak"],
  asam_urat: ["sate kambing", "emping", "seafood", "soto betawi"],
  kolesterol: ["gorengan", "rendang", "martabak telur", "sop buntut"],
  stroke_jantung: ["soto betawi", "ikan asin", "gulai kambing", "pepes ikan"],
  darah_rendah: ["nasi padang", "teh manis", "bir", "sayur sop"],
  alergi: ["gado-gado", "siomay", "kerupuk", "pempek"],
  sehat: ["nasi goreng", "boba", "ayam geprek", "salad"],
};
const DIM_LABEL: Record<string, string> = { purin: "Purin", garam: "Garam", karbo: "Karbo", gula: "Gula", lemak: "Lemak jenuh", ig: "Indeks glikemik" };
const DIMS: Record<ConditionId, string[]> = {
  asam_urat: ["purin"], hipertensi: ["garam"], diabetes: ["karbo", "gula", "ig"], kolesterol: ["lemak"],
  stroke_jantung: ["garam", "lemak"], darah_rendah: ["karbo"], alergi: [], sehat: ["gula", "garam", "lemak"],
};
const COND_EMOJI = (c: string) => (c === "umum" ? "⚕️" : c === "obat" ? "💊" : conditionInfo(c)?.emoji ?? "•");
const NOTE_CHIPS = ["Ditraktir teman", "Kondangan", "Di rumah", "Beli sendiri"] as const;
const VERDICT: Record<string, string> = { hijau: "Aman", kuning: "Boleh, dibatasi", merah: "Sebaiknya jangan" };

interface PhotoInfo {
  food: string; nama: string; komponen: string[]; model_guess: string;
  corrected: boolean; in_table: boolean; alternatives: string[];
}

export default function CekTab({ profile, flareJoint, prefill, welcome, onSaveUnknown }: {
  profile: Profile;
  flareJoint: string | null;
  prefill: { food: string; n: number } | null;
  welcome: boolean;
  onSaveUnknown: (name: string) => void;
}) {
  const conditions = normalizeConditions(profile.kondisi);
  const chips = [...new Set(conditions.flatMap((c) => EXAMPLES[c]))].slice(0, 8);
  const dims = [...new Set(conditions.flatMap((c) => DIMS[c]))];
  const toast = useToast();
  const [food, setFood] = useState(prefill?.food ?? "");
  const [note, setNote] = useState<(typeof NOTE_CHIPS)[number]>("Ditraktir teman");
  const [loading, setLoading] = useState(prefill ? "Lagi mikir…" : "");
  const [result, setResult] = useState<AssessResult | null>(null);
  const [preview, setPreview] = useState("");
  const [photo, setPhoto] = useState<PhotoInfo | null>(null);

  const clear = () => setResult(null);
  const limits = useLimits();
  const photoLeft = limits?.usage.photo.left ?? 1;

  // pertanyaan lewat suara → jawabannya dibacakan otomatis
  const speakNext = useRef(false);

  // Tidak mengubah state secara langsung: aman dipanggil dari effect maupun handler.
  const runAssess = useCallback((text: string) => {
    const t0 = performance.now();
    return api<AssessResult>("/api/assess", { profileId: profile.id, food: text, note })
      .then((r) => {
        setResult({ ...r, elapsed: Math.round((performance.now() - t0) / 1000) });
        play(r.status);
        if (speakNext.current) {
          speakNext.current = false;
          const label = { hijau: "Aman.", kuning: "Boleh, tapi dibatasi.", merah: "Sebaiknya jangan." }[r.status];
          speak(`${r.food}. ${label} ${r.headline} Porsinya: ${r.portion}.`, toast);
        }
        setTimeout(() => document.getElementById("result")?.scrollIntoView({ behavior: "smooth" }), 50);
      })
      .catch((e: Error) => { play("error"); toast.error(e.message, "Gagal mengecek"); })
      .finally(() => { setLoading(""); void refreshLimits(); });
  }, [profile.id, note, toast]);

  function check(text: string) {
    if (!text.trim()) return toast.warning("Ketik, foto, atau ucapkan makanannya dulu ya.");
    clear();
    setLoading("Lagi mikir…");
    runAssess(text);
  }

  const mic = useSpeech((heard) => {
    play("micOff");
    const text = cleanSpoken(heard) || heard;
    setFood(text);
    speakNext.current = true;
    check(text);
  });

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
      toast.error((err as Error).message || "Belum bisa baca foto. Ketik saja namanya ya.", "Foto belum terbaca");
    } finally {
      setLoading("");
      void refreshLimits();
    }
  }

  const [logging, setLogging] = useState(false);
  // bilah "Jadinya?" menempel di bawah layar selama tombol utamanya tidak terlihat
  const choicesRef = useRef<HTMLDivElement>(null);
  const [choicesVisible, setChoicesVisible] = useState(true);
  useEffect(() => {
    const el = choicesRef.current;
    if (!el || !result) return;
    const io = new IntersectionObserver(([e]) => setChoicesVisible(e.isIntersecting), { rootMargin: "0px 0px -80px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [result]);

  function reset() {
    setResult(null);
    setFood("");
    setPreview("");
    setPhoto(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function skip() {
    if (result?.checkId) await api("/api/checks", { id: result.checkId, resolution: "batal" }).catch(() => {});
    reset();
  }

  async function log(portion: Portion) {
    if (!result || logging) return;
    setLogging(true);
    try {
      if (result.checkId) await api("/api/checks", { id: result.checkId, resolution: portion });
      else await api("/api/meals", { profileId: profile.id, food: result.food, portion, status: portion === "ditolak" ? "hijau" : result.status, note });
      play("saved");
      toast.success(portion === "ditolak" ? "Berhasil menolak, tercatat. Mantap! 💪" : "Masuk ke catatan makan.", portion === "ditolak" ? "Hebat" : "Tercatat");
      reset();
    } catch (e) {
      play("error");
      toast.error((e as Error).message, "Gagal mencatat");
    } finally {
      setLogging(false);
    }
  }

  const r = result;
  const multi = (r?.components.length ?? 0) > 1;
  const typo = r?.components.some((c) => c.matched?.includes("(dari"));

  return (
    <>
      {flareJoint && <div className="banner">Asam urat lagi kambuh ({flareJoint}). Saran dibuat lebih ketat.</div>}
      {!result && !loading && <PendingChecks profileId={profile.id} />}
      {welcome && !result && (
        <div className="secure">
          <p>🎉 Siap! Coba cek satu makanan dulu.</p>
          <p className="small" style={{ fontWeight: 500 }}>Tekan tombol 🎤 dan tanya, misalnya &quot;boleh gak makan martabak?&quot;, atau ketuk salah satu contoh di bawah.</p>
        </div>
      )}

      <div className="card">
        <p className="eyebrow">Langkah 1</p>
        <h2>Lagi ditawari apa?</h2>
        {mic.supported && (
          <>
            <button type="button" className={`btn big mic${mic.listening ? " on" : ""}`}
              onClick={() => { if (mic.listening) mic.stop(); else { play("micOn"); clear(); mic.start(); } }}>
              <span className="mic-dot" aria-hidden="true">🎤</span>
              {mic.listening ? "Mendengarkan… ketuk untuk selesai" : "Tanya pakai suara"}
            </button>
            {mic.listening && <p className="mic-live">{mic.interim || "Contoh: \"boleh gak makan sate kambing?\""}</p>}
            {mic.error && <p className="small" style={{ color: "var(--merah)", fontWeight: 700 }}>{mic.error}</p>}
            <div style={{ height: 12 }} />
          </>
        )}
        {photoLeft > 0 ? (
          <label className="btn big ink">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
            Foto makanannya
            <input type="file" accept="image/*" capture="environment" hidden onChange={onPhoto} />
          </label>
        ) : (
          <button type="button" className="btn big ink resting" onClick={() => toast.info("Foto bisa dipakai lagi besok. Sementara ketik atau ucapkan nama makanannya ya.", "Kenali foto")}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
            Foto terisi lagi besok
          </button>
        )}
        <LimitNote kind="photo" />
        {preview && <img src={preview} className="preview" alt="Foto makanan" />}
        {photo && (
          <div className="photo-info">
            {photo.nama && <p className="small"><b>Terlihat:</b> {photo.nama}</p>}
            {photo.komponen.length > 0 && <p className="small"><b>Isinya:</b> {photo.komponen.join(", ")}</p>}
            {photo.corrected && photo.model_guess !== "lainnya" && <p className="small muted">Pilihan awal &quot;{photo.model_guess}&quot; tidak cocok dengan yang terlihat, jadi dikoreksi.</p>}
            {!photo.in_table && <p className="small"><b>⚠️ Belum ada di daftar.</b> Nanti dinilai AI, atau simpan ke daftar.</p>}
            <p className="eyebrow">Betul yang mana?</p>
            <div className="chips">
              {[photo.food, ...photo.alternatives].map((n) => (
                <button key={n} type="button" className={`chip${food === n ? " on" : ""}`} onClick={() => { setFood(n); clear(); }}>{n}</button>
              ))}
            </div>
          </div>
        )}
        <div className="or"><span>atau ketik</span></div>
        <form onSubmit={(e) => { e.preventDefault(); check(food); }}>
          <input type="text" value={food} maxLength={200} placeholder="mis. ketoprak" autoComplete="off" enterKeyHint="go"
            onChange={(e) => { setFood(e.target.value); clear(); }} />
          <div className="chips"><Chips items={chips} onPick={(f) => { setFood(f); clear(); }} /></div>
          <details className="situasi">
            <summary>Situasinya: <b>{note}</b> ✎</summary>
            <div className="chips"><Chips items={NOTE_CHIPS} value={note} onPick={setNote} /></div>
          </details>
          <CharCount value={food} max={200} />
          <button className="btn big primary" type="submit" disabled={Boolean(loading)}>Boleh gak? →</button>
          <LimitNote kind="assess" showBelow={5} />
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
            {!r.in_table && <span className="estimate">⚠️ Belum dikenal · tanyakan isinya ke penjual</span>}
            {r.in_table && r.estimated && (
              <span className="estimate">
                {r.basis?.some((b) => b.sumber === "kemasan") ? "🏷️ Dari label kemasan" : "📊 Dihitung dari bahan"}{r.learned ? " · makanan baru, disimpan" : ""}
              </span>
            )}
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
            {r.reasons.length > 0 && (
              <div className="reasons">
                {r.reasons.slice(0, 4).map((x, i) => (
                  <span className="reason" key={i}><i className={`dot ${x.status}`} />{COND_EMOJI(x.condition)} {x.text}</span>
                ))}
              </div>
            )}
            {r.nutrients && dims.length > 0 && (
              <div className="meters">{dims.map((d) => <Meter key={d} label={DIM_LABEL[d]} level={(r.nutrients as Record<string, string | null>)[d]} />)}</div>
            )}
            {conditions.includes("alergi") && r.alergen.length > 0 && <p className="small" style={{ marginTop: 10 }}><b>Mungkin mengandung:</b> {spokenAlergen(r.alergen)}. Tanyakan ke penjual.</p>}
            {r.flare_active && <span className="flare-tag">Lagi kambuh, lebih ketat</span>}
          </div>
          <div className="card log-card" ref={choicesRef}>
            <h2>Jadinya gimana?</h2>
            <LogChoices onPick={log} busy={logging} />
            <button className="linklike" onClick={skip}>Cuma tanya, tidak dimakan</button>
          </div>
          <button className="btn big listen" onClick={() => speak(`${r.food}. ${VERDICT[r.status]}. ${r.headline} Porsinya: ${r.portion}.`, toast)}>🔊 Dengarkan jawabannya</button>

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
                  <button className="btn sm" onClick={() => navigator.clipboard.writeText(x.text).then(() => toast.success("Kalimat tersalin."), () => toast.error("Tidak bisa menyalin di HP ini."))}>Salin</button>
                </div>
              </div>
            ))}
            <details><summary>Kalau tetap dimakan semua?</summary><p>{r.if_forced}</p></details>
            {r.basis && r.basis.length > 0 && <BasisDetails basis={r.basis} />}
            <details>
              <summary>Kenapa?</summary>
              <p>{r.why}</p>
              <p className="muted small">
                {!r.in_table ? "Tidak dikenal — hati-hati, tanyakan bahannya." : r.estimated ? "Angka gizi dihitung dari data (lihat \"Dari mana angkanya?\"), lampu ditentukan tabel aturan yang sama." : "Lampu dari tabel makanan."}{" "}
                {r.source === "ai" ? `Ditulis ${r.model} dalam ${r.elapsed} detik.` : r.source === "cache" ? "Jawaban tersimpan (tanpa biaya AI)." : "Mode tabel (AI tidak dipakai)."}
              </p>
            </details>
          </div>

          <div style={{ height: 140 }} aria-hidden="true" />
          {!choicesVisible && (
            <div className="log-bar" role="region" aria-label="Jadinya gimana">
              <p>Jadinya <b>{r.food}</b>?</p>
              <LogChoices compact onPick={log} busy={logging} />
            </div>
          )}
          {!r.in_table && <button className="btn big ink" onClick={() => onSaveUnknown(r.food)}>+ Simpan &quot;{r.food}&quot; ke daftar</button>}
        </div>
      )}
    </>
  );
}

type Portion = "sesuai saran" | "porsi penuh" | "ditolak";
const CHOICES: [Portion, string, string, string][] = [
  ["sesuai saran", "✅", "Makan sesuai saran", "good"],
  ["porsi penuh", "🍛", "Makan 1 porsi penuh", ""],
  ["ditolak", "🙅", "Tidak jadi / menolak", "primary"],
];

/** Tiga tombol besar "jadinya gimana". compact = versi bilah bawah. */
function LogChoices({ onPick, compact = false, busy = false }: { onPick: (p: Portion) => void; compact?: boolean; busy?: boolean }) {
  return (
    <div className={`log-choices${compact ? " compact" : ""}`}>
      {CHOICES.map(([p, emo, label, cls]) => (
        <button key={p} type="button" className={`btn ${cls}`} disabled={busy} onClick={() => onPick(p)}>
          <span aria-hidden="true">{emo}</span>{label}
        </button>
      ))}
    </div>
  );
}

const jam = (iso: string) => new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
const hariIni = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();

/** Pertanyaan sebelumnya yang belum dijawab: "Tadi tanya soto ayam, jadinya?" */
function PendingChecks({ profileId, exclude }: { profileId: string; exclude?: string }) {
  const toast = useToast();
  const [items, setItems] = useState<PendingCheck[]>([]);
  const [busy, setBusy] = useState("");
  useEffect(() => { api<PendingCheck[]>(`/api/checks?profileId=${profileId}`).then(setItems).catch(() => {}); }, [profileId]);

  async function answer(c: PendingCheck, resolution: Portion | "batal") {
    setBusy(c.id);
    try {
      await api("/api/checks", { id: c.id, resolution });
      play(resolution === "batal" ? "tap" : "saved");
      if (resolution !== "batal") toast.success(`"${c.food}" masuk catatan jam ${jam(c.created_at)}.`, resolution === "ditolak" ? "Hebat, berhasil menolak" : "Tercatat");
      setItems((list) => list.filter((x) => x.id !== c.id));
    } catch (e) {
      play("error");
      toast.error((e as Error).message, "Gagal mencatat");
      setItems((list) => list.filter((x) => x.id !== c.id));
    } finally {
      setBusy("");
    }
  }

  const list = items.filter((c) => c.id !== exclude);
  if (!list.length) return null;
  return (
    <div className="card pending">
      <p className="eyebrow">⏰ Belum dijawab</p>
      {list.map((c) => (
        <div key={c.id} className="pending-item">
          <p>{hariIni(c.created_at) ? "Tadi" : "Kemarin"} jam {jam(c.created_at)} tanya <b>{c.food}</b> {{ hijau: "🟢", kuning: "🟡", merah: "🔴" }[c.status]}. Jadinya?</p>
          <LogChoices compact busy={busy === c.id} onPick={(p) => answer(c, p)} />
          <button className="linklike" disabled={busy === c.id} onClick={() => answer(c, "batal")}>Cuma tanya, tidak dimakan</button>
        </div>
      ))}
    </div>
  );
}

const fmt = (n: number) => n.toLocaleString("id-ID", { maximumFractionDigits: 1 });

/** "Dari mana angkanya?": angka per porsi, rincian bahan, dan sumber datanya. */
function BasisDetails({ basis }: { basis: NonNullable<AssessResult["basis"]> }) {
  return (
    <details className="basis">
      <summary>Dari mana angkanya?</summary>
      {basis.map((b) => (
        <div key={b.name} className="basis-item">
          <p><b>{b.name}</b> · 1 porsi ±{b.nutrisi.porsi_g} g</p>
          <div className="basis-grid">
            <span>Karbo <b>{fmt(b.nutrisi.karbo_g)} g</b></span>
            <span>Gula tambahan <b>{fmt(b.nutrisi.gula_g)} g</b></span>
            <span>Natrium <b>{fmt(b.nutrisi.natrium_mg)} mg</b></span>
            <span>Lemak jenuh <b>{fmt(b.nutrisi.lemak_jenuh_g)} g</b></span>
          </div>
          {b.rincian.length > 0 && (
            <ul className="basis-list">
              {b.rincian.map((x) => <li key={x.label}><span>{x.label}</span><small>{x.gram} g</small></li>)}
            </ul>
          )}
          {b.sumber === "bahan" && b.nutrisi.cakupan < 0.8 && (
            <p className="small muted">Sebagian bahan ({Math.round((1 - b.nutrisi.cakupan) * 100)}% berat) tidak ada di tabel bahan, jadi angkanya bisa lebih rendah dari sebenarnya.</p>
          )}
          <p className="small muted">
            {b.sumber === "kemasan" ? b.sumber_ref : "Resep diuraikan AI; angka per bahan dari USDA FoodData Central & label kemasan (Open Food Facts)."}
          </p>
        </div>
      ))}
    </details>
  );
}
