"use client";
import { useEffect, useState } from "react";
import { api, fmtTime, useToast } from "./ui";
import { play } from "@/lib/sound";

interface Status { profile_id: string; nama: string; logged_today: boolean; last_log: string | null; devices: number; last_nudge: string | null }

/** Siapa yang sudah/belum mencatat hari ini, plus tombol bel untuk mengingatkan. Tampil kalau keluarga > 1 orang. */
export default function FamilyCard() {
  const toast = useToast();
  const [rows, setRows] = useState<Status[] | null>(null);
  const [busy, setBusy] = useState("");

  useEffect(() => { api<Status[]>("/api/family").then(setRows).catch(() => setRows([])); }, []);
  if (!rows || rows.length < 2) return null;

  async function ring(r: Status) {
    setBusy(r.profile_id);
    try {
      const res = await api<{ viaWa: boolean }>("/api/nudge", { profileId: r.profile_id });
      play("saved");
      toast.success(res.viaWa ? `Pengingat terkirim ke WhatsApp ${r.nama}.` : `Pengingat terkirim ke HP ${r.nama}.`, "🔔 Bel terkirim");
      setRows((list) => list?.map((x) => (x.profile_id === r.profile_id ? { ...x, last_nudge: new Date().toISOString() } : x)) ?? null);
    } catch (e) {
      play("error");
      toast.warning((e as Error).message);
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="card family">
      <h2>Keluarga hari ini</h2>
      {rows.map((r) => (
        <div key={r.profile_id} className={`fam-row${r.logged_today ? " done" : ""}`}>
          <span className="fam-icon" aria-hidden="true">{r.logged_today ? "✅" : "⏰"}</span>
          <span className="fam-text">
            <b>{r.nama}</b>
            <small>{r.logged_today ? `sudah mencatat · ${fmtTime(r.last_log!)}` : "belum mencatat hari ini"}</small>
          </span>
          {!r.logged_today && (
            r.devices > 0
              ? <button className="btn sm bell" disabled={busy === r.profile_id} onClick={() => ring(r)}>🔔 Ingatkan</button>
              : <small className="muted fam-note">belum pasang notifikasi / WA</small>
          )}
        </div>
      ))}
    </div>
  );
}
