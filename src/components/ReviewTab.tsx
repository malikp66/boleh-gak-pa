"use client";
import { useCallback, useEffect, useState } from "react";
import { api, speak, useToast } from "./ui";
import { Me, Profile, Review } from "./types";

export default function ReviewTab({ profile, me }: { profile: Profile; me: Me }) {
  const toast = useToast();
  const [rv, setRv] = useState<Review | null>(null);
  const [asking, setAsking] = useState(false);

  const load = useCallback((ai = false) =>
    api<Review>(`/api/review?profileId=${profile.id}${ai ? "&ai=1" : ""}`)
      .then(setRv)
      .catch((e: Error) => toast(e.message)),
  [profile.id, toast]);
  useEffect(() => { void load(); }, [load]);

  if (!rv) return <div className="card"><p className="muted">Memuat…</p></div>;
  const { week: w, triggers: t, recovery: rec } = rv;
  const family = me.families.find((f) => f.id === profile.family_id);

  return (
    <>
      <div className="card">
        <h2>7 hari terakhir</h2>
        <div className="stat-grid">
          <div className="stat hijau"><b>{w.status.hijau ?? 0}</b><span>aman / tolak</span></div>
          <div className="stat kuning"><b>{w.status.kuning ?? 0}</b><span>dibatasi</span></div>
          <div className="stat merah"><b>{w.status.merah ?? 0}</b><span>berisiko</span></div>
        </div>
        <p><b>{w.garam_tinggi} dari {w.meals}</b> makanan tinggi garam — penting untuk tensi.</p>
      </div>

      <div className="card">
        <h2>Tersangka pemicu</h2>
        {t.suspects.length ? (
          <>
            <p className="muted small">Dimakan dalam 48 jam sebelum {t.flares} kali kambuh:</p>
            {t.suspects.map((s) => <div className="meal" key={s.food}><span className="what"><b>{s.food}</b></span><span className="when">{s.count}×</span></div>)}
          </>
        ) : <p className="muted">Belum cukup data. Catat makan &amp; kambuh, nanti polanya kelihatan.</p>}
      </div>

      <div className="card">
        <h2>Lama sembuh</h2>
        <p>{rec.basis === "riwayat"
          ? <>Dari {rec.history_count} kali kambuh, biasanya pulih dalam <b>{rec.typical_days} hari</b> ({rec.range[0]}–{rec.range[1]} hari).</>
          : <>Belum ada riwayat. Kisaran umum serangan asam urat: <b>3–10 hari</b>.</>}</p>
      </div>

      <div className="card">
        <h2>Kata AI</h2>
        {rv.summary ? (
          <>
            <div className="ai-summary">{rv.summary}</div>
            <div className="row" style={{ marginTop: 14 }}><button className="btn sm" onClick={() => speak(rv.summary!, toast)}>Bacakan</button></div>
          </>
        ) : (
          <button className="btn primary" disabled={asking} onClick={async () => { setAsking(true); await load(true); setAsking(false); }}>
            {asking ? "Lagi menulis…" : "Minta ringkasan minggu ini"}
          </button>
        )}
      </div>

      {family && (
        <div className="card">
          <h2>Ajak keluarga</h2>
          <p className="small">Bagikan kode ini supaya anggota keluarga lain bisa ikut mencatat dan melihat data {family.name}.</p>
          <div className="invite">
            <code>{family.invite_code}</code>
            <button className="btn sm" style={{ width: "auto" }} onClick={() => {
              const text = `Gabung "${family.name}" di Boleh Gak, Ya? → ${location.origin} (kode: ${family.invite_code})`;
              (navigator.share ? navigator.share({ text }) : navigator.clipboard.writeText(text)).then(() => toast("Siap dibagikan"), () => {});
            }}>Bagikan</button>
          </div>
        </div>
      )}
    </>
  );
}
