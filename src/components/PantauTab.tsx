"use client";
import { useCallback, useEffect, useState } from "react";
import KambuhTab from "./KambuhTab";
import { api, Chips, fmtDay, fmtTime, useToast } from "./ui";
import { HealthLog, Profile } from "./types";
import type { MonitorKind } from "@/lib/conditions";
import { play } from "@/lib/sound";
import { bloodPressure, glucose, GLUCOSE_CONTEXTS, Reading } from "@/lib/monitor";

const LABEL: Record<MonitorKind, string> = { kambuh: "🦶 Kambuh", gula_darah: "🩸 Gula darah", tensi: "💓 Tensi" };

export default function PantauTab({ profile, monitors, onChanged }: { profile: Profile; monitors: MonitorKind[]; onChanged: () => void }) {
  const [view, setView] = useState<MonitorKind>(monitors[0]);
  return (
    <>
      {monitors.length > 1 && (
        <div className="seg">{monitors.map((m) => <button key={m} className={view === m ? "on" : ""} onClick={() => setView(m)}>{LABEL[m]}</button>)}</div>
      )}
      {view === "kambuh" ? <KambuhTab profile={profile} onChanged={onChanged} /> : <LogView key={view} profile={profile} kind={view} />}
    </>
  );
}

function LogView({ profile, kind }: { profile: Profile; kind: "gula_darah" | "tensi" }) {
  const toast = useToast();
  const [logs, setLogs] = useState<HealthLog[] | null>(null);
  const [v1, setV1] = useState("");
  const [v2, setV2] = useState("");
  const [ctx, setCtx] = useState<(typeof GLUCOSE_CONTEXTS)[number]>("puasa");
  const [last, setLast] = useState<Reading | null>(null);
  const isGlucose = kind === "gula_darah";
  const targets = {
    gulaPuasa: profile.target_gula_puasa, gula2jam: profile.target_gula_2jam,
    sistolik: profile.target_sistolik, diastolik: profile.target_diastolik,
  };

  const load = useCallback(() =>
    api<HealthLog[]>(`/api/health-logs?profileId=${profile.id}&kind=${kind}`).then(setLogs).catch((e: Error) => toast.error(e.message)),
  [profile.id, kind, toast]);
  useEffect(() => { void load(); }, [load]);

  const read = (l: { value1: number; value2: number | null; context: string }) =>
    isGlucose
      ? glucose(l.value1, l.context, profile.diabetes_tipe, targets)
      : bloodPressure(l.value1, l.value2 ?? 0, targets, profile.kondisi.includes("darah_rendah"));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const a = Number(v1), b = v2 ? Number(v2) : null;
    if (!a || (!isGlucose && !b)) return toast.warning("Isi angkanya dulu ya.");
    try {
      await api("/api/health-logs", { profileId: profile.id, kind, value1: a, value2: isGlucose ? null : b, context: isGlucose ? ctx : "" });
      const reading = read({ value1: a, value2: b, context: ctx });
      setLast(reading);
      play(reading.level === "bahaya" ? "merah" : reading.level === "perhatian" ? "kuning" : "saved");
      setV1("");
      setV2("");
      load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const recent = (logs ?? []).slice(0, 14).reverse();
  const max = isGlucose ? 300 : 200;

  let lastDay = "";
  return (
    <>
      <form className="card" onSubmit={save}>
        <div className="title-row"><span className="emo-box">{isGlucose ? "🩸" : "💓"}</span><h2>{isGlucose ? "Catat gula darah" : "Catat tensi"}</h2></div>
        {isGlucose ? (
          <>
            <label className="field">Hasil cek (mg/dL) <input type="number" inputMode="numeric" min={10} max={700} value={v1} onChange={(e) => setV1(e.target.value)} placeholder="mis. 110" /></label>
            <p className="eyebrow">Kapan dicek?</p>
            <div className="chips"><Chips items={GLUCOSE_CONTEXTS} value={ctx} onPick={setCtx} /></div>
          </>
        ) : (
          <div className="grid2">
            <label className="field">Atas (sistolik) <input type="number" inputMode="numeric" min={50} max={300} value={v1} onChange={(e) => setV1(e.target.value)} placeholder="mis. 130" /></label>
            <label className="field">Bawah (diastolik) <input type="number" inputMode="numeric" min={20} max={200} value={v2} onChange={(e) => setV2(e.target.value)} placeholder="mis. 85" /></label>
          </div>
        )}
        {last && (
          <div className={`alert ${last.level}`}>
            {last.level === "bahaya" ? "🚨 " : ""}{last.label}. {last.advice}
            {last.level === "bahaya" && <a className="btn sm danger" href="tel:119" style={{ marginTop: 8 }}>📞 Telepon 119</a>}
          </div>
        )}
        <button className="btn big primary">Simpan</button>
      </form>

      {recent.length > 1 && (
        <div className="card">
          <div className="title-row"><span className="emo-box">📈</span><h2>Grafik</h2></div>
          <div className="pain-chart">
            {recent.map((l) => {
              const r = read(l);
              return (
                <div className="pc-col" key={l.id}>
                  <span className="pc-val">{isGlucose ? l.value1 : `${l.value1}/${l.value2}`}</span>
                  <i className={r.level === "bahaya" ? "hi" : r.level === "perhatian" ? "mid" : "lo"} style={{ height: `${Math.min(100, Math.max(6, (l.value1 / max) * 100))}%` }} />
                  <small>{new Date(l.at).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</small>
                </div>
              );
            })}
          </div>
          <p className="small muted">{isGlucose
            ? profile.diabetes_tipe === "gestasional" ? "Target ADA saat hamil: puasa < 95, 2 jam setelah makan < 120. Ikuti target dari doktermu." : "Target umum ADA: 80–130 sebelum makan, < 180 dua jam setelah makan. Ikuti target dari doktermu."
            : "Normal < 120/80. Ikuti target dari doktermu."}</p>
        </div>
      )}

      <div className="card">
        <h2>Riwayat</h2>
        {!logs ? <p className="muted">Memuat…</p> : !logs.length ? (
          <div className="empty-state"><span className="emo-big">{isGlucose ? "🩸" : "💓"}</span><p><b>Belum ada catatan.</b><br />Catat setiap habis cek supaya polanya kelihatan.</p></div>
        ) : logs.map((l) => {
          const r = read(l);
          const d = fmtDay(l.at);
          const head = d !== lastDay ? <div className="day-group">{d}</div> : null;
          lastDay = d;
          return (
            <div key={l.id}>
              {head}
              <div className={`reading ${r.level}`}>
                <span className="val">{isGlucose ? l.value1 : `${l.value1}/${l.value2}`}</span>
                <span className="what"><b>{r.label}</b>{l.context && <><br /><span className="muted small">{l.context}</span></>}</span>
                <span className="when">{fmtTime(l.at)}</span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="card doctor">
        <div className="title-row"><span className="emo-box red">🏥</span><h2>Kapan ke dokter?</h2></div>
        <ul className="plain">
          {isGlucose ? (
            <>
              <li>Gula darah <b>&lt; 70 mg/dL</b>: makan/minum 15 g gula cepat, cek ulang 15 menit. <b>&lt; 54</b> atau tidak sadar: IGD.</li>
              <li>Gula darah <b>&gt; 250 mg/dL</b>, terutama saat sakit, mual, atau muntah.</li>
              <li>Sering di atas target walau sudah jaga makan.</li>
            </>
          ) : (
            <>
              <li>Tensi <b>≥ 180/120</b> setelah diukur ulang 5 menit kemudian.</li>
              <li>Tensi tinggi disertai nyeri dada, sesak, lemah/kesemutan, bicara pelo, atau pandangan kabur: <b>IGD</b>.</li>
              <li>Sering ≥ 140/90 walau sudah mengurangi garam.</li>
            </>
          )}
        </ul>
        <p className="small muted">Aplikasi ini tidak memberi saran obat atau dosis. Ikuti petunjuk doktermu.</p>
      </div>
    </>
  );
}
