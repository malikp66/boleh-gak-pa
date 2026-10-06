"use client";
import { useEffect, useState } from "react";
import { api, CAT_EMOJI, dayKey, fmtDay, fmtTime, useToast } from "./ui";
import { FoodItem, Meal, Profile } from "./types";

const PORTION_TAG: Record<string, [string, string, string]> = {
  "sesuai saran": ["✅", "sesuai saran", "hijau"],
  "porsi penuh": ["🍛", "porsi penuh", "merah"],
  ditolak: ["🙅", "berhasil menolak", "biru"],
};
const SALT_LIMIT = 2; // patokan sederhana: lebih dari 2 makanan tinggi garam sehari = terlalu banyak

export default function CatatanTab({ profile }: { profile: Profile }) {
  const toast = useToast();
  const [meals, setMeals] = useState<Meal[] | null>(null);
  const [foods, setFoods] = useState<FoodItem[]>([]);

  useEffect(() => {
    api<Meal[]>(`/api/meals?profileId=${profile.id}`).then(setMeals).catch((e) => toast(e.message));
    api<FoodItem[]>(`/api/foods?profileId=${profile.id}`).then(setFoods).catch(() => {});
  }, [profile.id, toast]);

  if (!meals) return <div className="card"><p className="muted">Memuat…</p></div>;

  const emoji = (name: string) => CAT_EMOJI[foods.find((f) => f.name === name.split(" + ")[0])?.kategori ?? ""] ?? "🍽️";
  const today = dayKey(new Date());
  const eaten = (arr: Meal[]) => arr.filter((m) => m.portion !== "ditolak");
  const todays = eaten(meals.filter((m) => dayKey(new Date(m.at)) === today));
  const count = (arr: Meal[], s: string) => arr.filter((m) => m.status === s).length;
  const saltToday = todays.filter((m) => m.garam === "tinggi").length;
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
      g: de.filter((m) => m.garam === "tinggi").length, t: dm.length - de.length,
    };
  });

  const freq = new Map<string, number>();
  meals.forEach((m) => m.food.split(" + ").forEach((f) => freq.set(f, (freq.get(f) ?? 0) + 1)));
  const top = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxTop = top[0]?.[1] ?? 1;

  const saltMsg = saltToday === 0 ? `Belum ada makanan asin hari ini. Mantap! 👍`
    : saltToday < SALT_LIMIT ? "Masih aman. Makan berikutnya pilih yang tidak asin ya."
    : saltToday === SALT_LIMIT ? "Sudah cukup garamnya hari ini. Sisanya pilih yang hijau. 🥬"
    : "Garam sudah lewat batas. Minum air putih yang banyak dan cek tensi. 💧";

  let lastDay = "";
  return (
    <>
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
        <div className="salt">
          <div className="salt-head"><span>🧂 Garam tinggi hari ini</span><b>{saltToday}/{SALT_LIMIT}</b></div>
          <div className="salt-bar">
            {Array.from({ length: Math.max(SALT_LIMIT + 1, saltToday) }, (_, i) => (
              <i key={i} className={i < saltToday ? (i >= SALT_LIMIT ? "over" : "f") : ""} />
            ))}
          </div>
          <p className="small">{saltMsg}</p>
        </div>
      </div>

      <div className="card">
        <div className="title-row"><span className="emo-box">🗓️</span><h2>7 hari terakhir</h2></div>
        <div className="table-wrap">
          <table className="neo-table">
            <thead><tr><th>Hari</th><th>🟢</th><th>🟡</th><th>🔴</th><th>🧂</th><th>🙅</th></tr></thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.key} className={`${d.today ? "today" : ""}${d.m ? " bad" : ""}`}>
                  <td><b>{d.label}</b> {d.date}</td>
                  <td>{d.h || "·"}</td><td>{d.k || "·"}</td><td>{d.m || "·"}</td>
                  <td className={d.g > SALT_LIMIT ? "warn" : ""}>{d.g || "·"}</td><td>{d.t || "·"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="small muted">🟢 aman · 🟡 dibatasi · 🔴 berisiko · 🧂 tinggi garam · 🙅 berhasil menolak</p>
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
