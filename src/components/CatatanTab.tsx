"use client";
import { useEffect, useState } from "react";
import { api, CAT_EMOJI, dayKey, fmtDay, fmtTime, useToast } from "./ui";
import { FoodItem, Me, Meal, Profile } from "./types";
import RecoveryCard from "./RecoveryCard";
import { normalizeConditions } from "@/lib/conditions";

const PORTION_TAG: Record<string, [string, string, string]> = {
  "sesuai saran": ["✅", "sesuai saran", "hijau"],
  "porsi penuh": ["🍛", "porsi penuh", "merah"],
  ditolak: ["🙅", "berhasil menolak", "biru"],
};
// Patokan sederhana harian (bukan angka medis): lebih dari 2 porsi "tinggi" sehari = terlalu banyak.
const DAILY = {
  garam: { emoji: "🧂", label: "Garam tinggi hari ini", limit: 2,
    msg: ["Belum ada makanan asin hari ini. Mantap! 👍", "Masih aman. Makan berikutnya pilih yang tidak asin ya.", "Sudah cukup garamnya hari ini. Sisanya pilih yang hijau. 🥬", "Garam sudah lewat batas. Minum air putih dan cek tensi. 💧"] },
  karbo: { emoji: "🍚", label: "Karbo tinggi hari ini", limit: 2,
    msg: ["Belum ada porsi karbo besar hari ini. Mantap! 👍", "Masih aman. Makan berikutnya perbanyak sayur & protein.", "Karbo hari ini sudah cukup. Pilih sayur, lauk, atau buah utuh. 🥬", "Karbo sudah banyak. Kalau punya alat, cek gula darah 2 jam setelah makan. 🩸"] },
} as const;
type DailyKey = keyof typeof DAILY;

export default function CatatanTab({ profile, me }: { profile: Profile; me: Me }) {
  const conditions = normalizeConditions(profile.kondisi);
  const meters: DailyKey[] = [
    ...(conditions.includes("hipertensi") || conditions.includes("sehat") ? (["garam"] as DailyKey[]) : []),
    ...(conditions.includes("diabetes") ? (["karbo"] as DailyKey[]) : []),
  ];
  const toast = useToast();
  const [meals, setMeals] = useState<Meal[] | null>(null);
  const [foods, setFoods] = useState<FoodItem[]>([]);

  useEffect(() => {
    api<Meal[]>(`/api/meals?profileId=${profile.id}`).then(setMeals).catch((e) => toast.error(e.message));
    api<FoodItem[]>(`/api/foods?profileId=${profile.id}`).then(setFoods).catch(() => {});
  }, [profile.id, toast]);

  if (!meals) return <div className="card"><p className="muted">Memuat…</p></div>;

  const emoji = (name: string) => CAT_EMOJI[foods.find((f) => f.name === name.split(" + ")[0])?.kategori ?? ""] ?? "🍽️";
  const today = dayKey(new Date());
  const eaten = (arr: Meal[]) => arr.filter((m) => m.portion !== "ditolak");
  const todays = eaten(meals.filter((m) => dayKey(new Date(m.at)) === today));
  const count = (arr: Meal[], s: string) => arr.filter((m) => m.status === s).length;
  const high = (arr: Meal[], k: DailyKey) => arr.filter((m) => m[k] === "tinggi").length;
  const refused = meals.filter((m) => m.portion === "ditolak").length;

  const redDays = new Set(eaten(meals).filter((m) => m.status === "merah").map((m) => dayKey(new Date(m.at))));
  let streak = 0;
  for (let i = 0; i < 60; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    if (redDays.has(dayKey(d))) break;
    streak++;
  }

  const days = Array.from({ length: 7 }, (_, k) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - k));
    const dm = meals.filter((m) => dayKey(new Date(m.at)) === dayKey(d));
    const de = eaten(dm);
    return {
      key: dayKey(d), label: d.toLocaleDateString("id-ID", { weekday: "short" }), date: d.getDate(), today: k === 6,
      h: count(de, "hijau"), k: count(de, "kuning"), m: count(de, "merah"),
      g: high(de, "garam"), c: high(de, "karbo"), t: dm.length - de.length,
    };
  });

  const freq = new Map<string, number>();
  meals.forEach((m) => m.food.split(" + ").forEach((f) => freq.set(f, (freq.get(f) ?? 0) + 1)));
  const top = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxTop = top[0]?.[1] ?? 1;

  let lastDay = "";
  return (
    <>
      {meals.length >= 3 && meals.length <= 5 && <RecoveryCard />}
      <div className="sticker-row">
        <div className="sticker yellow"><span className="emo">🔥</span><b>{streak}</b><small>hari tanpa merah</small></div>
        <div className="sticker blue"><span className="emo">🙅</span><b>{refused}</b><small>kali menolak</small></div>
        <div className="sticker pink"><span className="emo">📒</span><b>{meals.length}</b><small>total catatan</small></div>
      </div>

      <div className="card">
        <div className="title-row"><span className="emo-box">📅</span><h2>Hari ini</h2></div>
        <div className="stat-grid">
          <div className="stat hijau"><b>{count(todays, "hijau")}</b><span>aman</span></div>
          <div className="stat kuning"><b>{count(todays, "kuning")}</b><span>dibatasi</span></div>
          <div className="stat merah"><b>{count(todays, "merah")}</b><span>berisiko</span></div>
        </div>
        {meters.map((k) => {
          const cfg = DAILY[k];
          const n = high(todays, k);
          return (
            <div className="salt" key={k} style={{ marginTop: 12 }}>
              <div className="salt-head"><span>{cfg.emoji} {cfg.label}</span><b>{n}/{cfg.limit}</b></div>
              <div className="salt-bar">
                {Array.from({ length: Math.max(cfg.limit + 1, n) }, (_, i) => <i key={i} className={i < n ? (i >= cfg.limit ? "over" : "f") : ""} />)}
              </div>
              <p className="small">{cfg.msg[n === 0 ? 0 : n < cfg.limit ? 1 : n === cfg.limit ? 2 : 3]}</p>
            </div>
          );
        })}
      </div>

      <div className="card">
        <div className="title-row"><span className="emo-box">🗓️</span><h2>7 hari terakhir</h2></div>
        <div className="table-wrap">
          <table className="neo-table">
            <thead><tr><th>Hari</th><th>🟢</th><th>🟡</th><th>🔴</th>{meters.map((k) => <th key={k}>{DAILY[k].emoji}</th>)}<th>🙅</th></tr></thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.key} className={`${d.today ? "today" : ""}${d.m ? " bad" : ""}`}>
                  <td><b>{d.label}</b> {d.date}</td>
                  <td>{d.h || "·"}</td><td>{d.k || "·"}</td><td>{d.m || "·"}</td>
                  {meters.map((k) => { const v = k === "garam" ? d.g : d.c; return <td key={k} className={v > DAILY[k].limit ? "warn" : ""}>{v || "·"}</td>; })}
                  <td>{d.t || "·"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small muted">🟢 aman · 🟡 dibatasi · 🔴 berisiko{meters.includes("garam") && " · 🧂 tinggi garam"}{meters.includes("karbo") && " · 🍚 tinggi karbo"} · 🙅 berhasil menolak</p>
      </div>

      {top.length > 0 && (
        <div className="card">
          <div className="title-row"><span className="emo-box">🏆</span><h2>Paling sering</h2></div>
          {top.map(([f, n], i) => (
            <div className="rank" key={f}>
              <span className="rank-no">{i + 1}</span>
              <span className="rank-emo">{emoji(f)}</span>
              <span className="rank-name">{f}</span>
              <span className="rank-bar"><i style={{ width: `${Math.round((n / maxTop) * 100)}%` }} /></span>
              <b>{n}×</b>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <h2>Semua catatan</h2>
        {!meals.length ? (
          <div className="empty-state"><span className="emo-big">🍽️</span><p><b>Belum ada catatan.</b><br />Cek makanan di tab Cek, lalu tekan salah satu tombol di bawah hasilnya.</p></div>
        ) : meals.map((m) => {
          const d = fmtDay(m.at);
          const head = d !== lastDay ? <div className="day-group">{d}</div> : null;
          lastDay = d;
          const [pe, pl, pc] = PORTION_TAG[m.portion] ?? ["🍽️", m.portion || "dicatat", ""];
          return (
            <div key={m.id}>
              {head}
              <div className={`meal-row ${m.status}`}>
                <span className="meal-emo">{emoji(m.food)}</span>
                <span className="what"><b>{m.food}</b>
                  <span className="meal-tags">
                    <span className={`mtag ${pc}`}>{pe} {pl}</span>
                    {m.garam === "tinggi" && <span className="mtag salt">🧂 garam tinggi</span>}
                    {m.purin === "tinggi" && <span className="mtag purin">⚠️ purin tinggi</span>}
                  </span>
                </span>
                <span className="when">{fmtTime(m.at)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
