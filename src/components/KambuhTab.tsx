"use client";
import { SkeletonCard } from "./Loading";
import { useCallback, useEffect, useState } from "react";
import { api, CAT_EMOJI, Chips, dayKey, fmtShort, painFace, useToast } from "./ui";
import { play } from "@/lib/sound";
import { Flare, FoodItem, Profile, Recovery, Review } from "./types";

const JOINTS = ["jempol kaki", "pergelangan kaki", "lutut", "tangan / jari", "siku"] as const;
const CARE: [string, string][] = [
  ["💧", "Minum air putih 8+ gelas"], ["🧊", "Kompres dingin 15–20 menit"], ["🛌", "Istirahatkan & tinggikan sendi"],
  ["🚫", "Hindari jeroan, emping, seafood, alkohol"], ["💊", "Obat sesuai resep dokter saja"],
];

function rangeText(rec: Recovery) {
  if (!rec.active) return "";
  const [lo, hi] = rec.remaining;
  if (hi <= 0) return "Biasanya sudah mulai reda di titik ini.";
  return lo === 0 || lo === hi ? `Kira-kira ${hi} hari lagi` : `Kira-kira ${lo}–${hi} hari lagi`;
}

/** Selisih hari kalender (tengah malam ke tengah malam di HP), tidak pernah negatif. */
const calendarDaysBetween = (from: Date, to: Date) => {
  const a = new Date(from); a.setHours(0, 0, 0, 0);
  const b = new Date(to); b.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86_400_000));
};
const flareDays = (f: Flare) => Math.max(1, Math.round((new Date(f.ended!).getTime() - new Date(f.started).getTime()) / 86_400_000));

// checklist "sambil menunggu" diingat per hari di HP ini saja
const careKey = () => "care-" + new Date().toDateString();
const careGet = (): number[] => { try { return JSON.parse(localStorage.getItem(careKey()) || "[]"); } catch { return []; } };
const careSet = (v: number[]) => { try { localStorage.setItem(careKey(), JSON.stringify(v)); } catch {} };

function PainPicker({ value, onChange, min = 1 }: { value: number; onChange: (n: number) => void; min?: number }) {
  const [emo, word] = painFace(value);
  return (
    <>
      <div className="pain-face"><span>{emo}</span><b>{value}</b><small>/10</small><em>{word}</em></div>
      <input type="range" min={min} max={10} value={value} onChange={(e) => onChange(+e.target.value)} />
    </>
  );
}

export default function KambuhTab({ profile, onChanged }: { profile: Profile; onChanged: () => void }) {
  const toast = useToast();
  const [flares, setFlares] = useState<Flare[] | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [foods, setFoods] = useState<FoodItem[]>([]);
  const [joint, setJoint] = useState<(typeof JOINTS)[number]>("jempol kaki");
  const [pain, setPain] = useState(5);
  const [fever, setFever] = useState(false);
  const [upd, setUpd] = useState<number | null>(null);
  const [updFever, setUpdFever] = useState(false);
  const [care, setCare] = useState<number[]>(careGet);
  // waktu acuan diperbarui setiap data dimuat ulang (dulu dibekukan saat halaman dibuka,
  // sehingga setelah "Sudah sembuh" hasilnya bisa negatif)
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(() =>
    Promise.all([
      api<Flare[]>(`/api/flares?profileId=${profile.id}`),
      api<Review>(`/api/review?profileId=${profile.id}`),
    ]).then(([f, r]) => {
      setFlares(f);
      setReview(r);
      setNow(Date.now());
      setUpd(null);
    }).catch((e: Error) => toast.error(e.message)),
  [profile.id, toast]);

  useEffect(() => {
    void load();
    api<FoodItem[]>(`/api/foods?profileId=${profile.id}`).then(setFoods).catch(() => {});
  }, [load, profile.id]);

  if (!flares || !review) return <><SkeletonCard rows={3} /><SkeletonCard rows={5} /></>;

  const rec = review.recovery;
  const active = flares.find((f) => !f.ended);
  const done = flares.filter((f) => f.ended);
  const last = flares[0];
  const sinceLast = last ? calendarDaysBetween(new Date(last.ended ?? last.started), new Date(now)) : null;
  const avg = done.length ? (done.reduce((a, f) => a + flareDays(f), 0) / done.length).toFixed(1).replace(".0", "") : "–";
  const emoji = (name: string) => CAT_EMOJI[foods.find((f) => f.name === name)?.kategori ?? ""] ?? "🍽️";

  /** Jalankan aksi, lalu tampilkan alert berhasil/gagal. */
  async function act(fn: () => Promise<unknown>, ok: string, title?: string) {
    try {
      await fn();
      play("saved");
      toast.success(ok, title);
      load();
      return true;
    } catch (e) {
      play("error");
      toast.error((e as Error).message, "Gagal menyimpan");
      return false;
    }
  }

  async function save() {
    if (!joint) { play("error"); return toast.warning("Pilih sendi yang sakit dulu.", "Belum lengkap"); }
    try {
      await api("/api/flares", { profileId: profile.id, joint, pain, fever });
      play("saved");
      toast.success("Semoga cepat reda.", "Kambuh tercatat");
      load();
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const toggleCare = (i: number) => {
    const v = care.includes(i) ? care.filter((x) => x !== i) : [...care, i];
    setCare(v);
    careSet(v);
  };

  const current = upd ?? rec.current_pain;
  const [emo, word] = painFace(rec.current_pain);

  return (
    <>
      <div className="sticker-row">
        <div className={`sticker ${active ? "pink" : "yellow"}`}><span className="emo">{active ? "🤕" : "🗓️"}</span><b>{active ? rec.day : sinceLast ?? "–"}</b><small>{active ? "hari kambuh" : sinceLast === 0 ? "sembuh hari ini 🎉" : "hari sejak sembuh"}</small></div>
        <div className="sticker blue"><span className="emo">🔁</span><b>{flares.length}</b><small>total kambuh</small></div>
        <div className="sticker pink"><span className="emo">⏱️</span><b>{avg}</b><small>rata-rata hari sembuh</small></div>
      </div>

      {active ? (
        <>
          <div className="verdict merah">
            <span className="stamp">Hari ke-{rec.day}</span>
            <div className="food-name">
              {active.joint} · {emo} {rec.current_pain}/10 {word}
              {rec.trend && ` · ${rec.trend === "membaik" ? "📉 membaik" : rec.trend === "memburuk" ? "📈 memburuk" : "➖ sama"}`}
            </div>
            <div className="big-num">{rangeText(rec)}</div>
            <p className="small"><b>Estimasi dari {rec.basis === "riwayat"
              ? `${rec.history_count} kali kambuh sebelumnya (biasanya ${rec.typical_days} hari)`
              : `kisaran umum serangan asam urat (3–10 hari). Makin banyak catatan, makin pas perkiraannya`}.</b></p>
          </div>
          {rec.red_flags.map((f) => <div className="flag" key={f}>🚨 {f}</div>)}

          <div className="card">
            <div className="title-row"><span className="emo-box">📉</span><h2>Grafik nyeri</h2></div>
            <PainWeek started={active.started} pains={active.pains} day={rec.day} remaining={rec.remaining} />
            <p className="eyebrow">Nyeri hari ini</p>
            <PainPicker value={current} onChange={setUpd} min={0} />
            <label className="check"><input type="checkbox" checked={updFever} onChange={(e) => setUpdFever(e.target.checked)} /> 🌡️ Ada demam</label>
            <div className="row">
              <button className="btn" onClick={() => act(() => api(`/api/flares/${active.id}/pain`, { pain: current, fever: updFever }), "Nyeri hari ini tercatat.")}>Simpan nyeri</button>
              <button className="btn good" onClick={() => act(() => api(`/api/flares/${active.id}/end`, {}), "Alhamdulillah, sudah sembuh! 🎉", "Sembuh").then((ok) => { if (ok) onChanged(); })}>Sudah sembuh 🎉</button>
            </div>
          </div>

          <div className="card">
            <div className="title-row"><span className="emo-box">✅</span><h2>Sambil menunggu</h2></div>
            <div className="care">
              {CARE.map(([e, t], i) => (
                <label key={t} className={`care-item${care.includes(i) ? " on" : ""}`}>
                  <input type="checkbox" checked={care.includes(i)} onChange={() => toggleCare(i)} /><span className="ce">{e}</span>{t}
                </label>
              ))}
            </div>
          </div>

          {review.triggers.suspects.length > 0 && (
            <div className="card">
              <div className="title-row"><span className="emo-box">🔎</span><h2>Mungkin pemicunya</h2></div>
              <p className="small muted">Dimakan dalam 48 jam sebelum kambuh:</p>
              <div className="chips">{review.triggers.suspects.slice(0, 3).map((x) => <span key={x.food} className="chip">{emoji(x.food)} {x.food} · {x.count}×</span>)}</div>
            </div>
          )}
        </>
      ) : (
        <div className="card">
          <div className="title-row"><span className="emo-box red">🦶</span><h2>Asam urat kambuh?</h2></div>
          <p className="eyebrow">1 · Sendi yang sakit</p>
          <div className="chips"><Chips items={JOINTS} value={joint} onPick={setJoint} /></div>
          <p className="eyebrow">2 · Seberapa sakit?</p>
          <PainPicker value={pain} onChange={setPain} />
          <div className="scale"><span>sedikit</span><span>tak tertahankan</span></div>
          <p className="eyebrow">3 · Ada tanda bahaya?</p>
          <label className="check"><input type="checkbox" checked={fever} onChange={(e) => setFever(e.target.checked)} /> 🌡️ Demam / sendi merah panas sekali</label>
          <button className="btn big danger" onClick={save}>Catat kambuh</button>
        </div>
      )}

      <div className="card">
        <div className="title-row"><span className="emo-box">📜</span><h2>Riwayat kambuh</h2></div>
        {done.length ? done.map((f) => (
          <div className="meal-row merah" key={f.id}>
            <span className="meal-emo">{painFace(f.pain)[0]}</span>
            <span className="what"><b>{f.joint}</b>
              <span className="meal-tags">
                <span className="mtag merah">nyeri {f.pain}/10</span>
                <span className="mtag biru">⏱️ {flareDays(f)} hari</span>
                {f.fever && <span className="mtag purin">🌡️ demam</span>}
              </span>
            </span>
            <span className="when">{fmtShort(f.started)}</span>
          </div>
        )) : <div className="empty-state"><span className="emo-big">🙏</span><p><b>Belum ada riwayat kambuh.</b><br />Semoga tetap begitu.</p></div>}
      </div>

      <div className="card doctor">
        <div className="title-row"><span className="emo-box red">🏥</span><h2>Kapan ke dokter?</h2></div>
        <ul className="plain">
          <li>Nyeri lebih dari <b>7 hari</b> atau makin parah</li>
          <li>Ada <b>demam</b>, menggigil, atau sendi sangat merah dan panas</li>
          <li>Lebih dari satu sendi sakit sekaligus</li>
          <li>Nyeri <b>8/10 ke atas</b> sampai tidak bisa jalan</li>
        </ul>
      </div>
    </>
  );
}

const HARI = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const level = (p: number) => (p >= 7 ? "hi" : p >= 4 ? "mid" : "lo");

/**
 * Grafik nyeri SELALU 7 hari: hari ke-1–7 kambuh (atau 7 hari terakhir kalau sudah lebih lama).
 * Hari yang belum datang tampil sebagai kerangka, hari yang terlewat ditandai "belum dicatat",
 * dan perkiraan hari reda diberi tanda 🌱.
 */
function PainWeek({ started, pains, day, remaining }: {
  started: string; pains: { pain: number; at: string }[]; day: number; remaining: [number, number];
}) {
  const start = new Date(started);
  start.setHours(0, 0, 0, 0);
  const first = Math.max(1, day - 6); // hari ke-berapa yang jadi kolom pertama
  const byDay = new Map<string, number>();
  for (const p of [...pains].sort((a, b) => a.at.localeCompare(b.at))) byDay.set(dayKey(new Date(p.at)), p.pain); // nilai terakhir di hari itu
  const [lo, hi] = remaining;
  const cols = Array.from({ length: 7 }, (_, i) => {
    const n = first + i;
    const date = new Date(start);
    date.setDate(start.getDate() + n - 1);
    const pain = byDay.get(dayKey(date));
    const state = n > day ? "future" : pain == null ? "missing" : "done";
    const reda = n > day && hi > 0 && n >= day + Math.max(lo, 1) && n <= day + hi;
    return { n, date, pain, state, today: n === day, reda };
  });

  return (
    <div className="pain-week" role="img" aria-label={`Grafik nyeri 7 hari, hari ini hari ke-${day}`}>
      <div className="pw-plot">
        <div className="pw-grid" aria-hidden="true">
          {[10, 5, 0].map((v) => <span key={v} style={{ bottom: `${v * 10}%` }}><b>{v}</b></span>)}
        </div>
        {cols.map((c) => (
          <div key={c.n} className={`pw-col ${c.state}${c.today ? " today" : ""}`}>
            {c.state === "done" ? (
              <>
                <span className="pw-val" style={{ bottom: `calc(${Math.max(c.pain!, 0.4) * 10}% + 4px)` }}>{c.pain}</span>
                <i className={level(c.pain!)} style={{ height: `${Math.max(c.pain!, 0.4) * 10}%` }} />
              </>
            ) : c.state === "missing" ? (
              <i className="pw-missing" title="Belum dicatat">?</i>
            ) : (
              <i className="pw-skeleton" />
            )}
            {c.reda && <span className="pw-reda" title="Perkiraan mulai reda">🌱</span>}
          </div>
        ))}
      </div>
      <div className="pw-axis">
        {cols.map((c) => (
          <div key={c.n} className={c.today ? "today" : ""}>
            <b>{HARI[c.date.getDay()]}</b>
            <small>{c.today ? "hari ini" : `ke-${c.n}`}</small>
          </div>
        ))}
      </div>
      <div className="pw-legend">
        <span><i className="lo" />Ringan 0–3</span><span><i className="mid" />Sedang 4–6</span><span><i className="hi" />Berat 7–10</span>
        {cols.some((c) => c.reda) && <span>🌱 Perkiraan reda</span>}
      </div>
    </div>
  );
}
