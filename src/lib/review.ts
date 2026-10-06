export interface Meal { food: string; portion: string; status: string; garam: string | null; at: string }
export interface Flare { id: string; started: string; ended: string | null; joint: string; pain: number; fever: boolean }
export interface PainLog { flare_id: string; at: string; pain: number }

const GENERAL_RANGE: [number, number] = [3, 10]; // hari; serangan asam urat umumnya reda dalam ~1-2 minggu
const days = (a: string, b: string) => (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000;
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function recoveryEstimate(flares: Flare[], pains: PainLog[], now = new Date().toISOString()) {
  const durations = flares.filter((f) => f.ended).map((f) => Math.max(1, Math.round(days(f.started, f.ended!))));
  const est = {
    history_count: durations.length,
    basis: durations.length ? "riwayat" : "kisaran umum",
    typical_days: durations.length ? median(durations) : null,
    range: durations.length ? [Math.min(...durations), Math.max(...durations)] : [...GENERAL_RANGE],
    red_flags: [] as string[],
    active: false,
    day: 0,
    trend: null as null | "membaik" | "memburuk" | "sama",
    current_pain: 0,
    remaining: [0, 0] as [number, number],
  };
  const flare = flares.find((f) => !f.ended);
  if (!flare) return est;

  const day = days(flare.started, now) + 1;
  const logs = pains.filter((p) => p.flare_id === flare.id).sort((a, b) => a.at.localeCompare(b.at));
  const current = logs.at(-1)?.pain ?? flare.pain;
  if (logs.length >= 2) {
    const first = logs[0].pain;
    est.trend = current < first ? "membaik" : current > first ? "memburuk" : "sama";
  }
  const hi = est.typical_days ?? GENERAL_RANGE[1];
  const lo = est.range[0];
  Object.assign(est, {
    active: true, day: Math.floor(day), current_pain: current,
    remaining: [Math.max(0, Math.floor(lo - day)), Math.max(1, Math.round(hi - day))],
  });
  if (day > 7) est.red_flags.push("Sudah lebih dari 7 hari — sebaiknya periksa ke dokter.");
  if (current >= 8) est.red_flags.push("Nyeri sangat berat (8+/10) — hubungi dokter.");
  if (flare.fever) est.red_flags.push("Ada demam — bisa tanda infeksi sendi, segera ke dokter.");
  if (est.trend === "memburuk") est.red_flags.push("Nyeri makin berat — konsultasikan ke dokter.");
  return est;
}

/** Makanan apa yang muncul dalam 48 jam sebelum tiap kambuh? */
export function triggerAnalysis(flares: Flare[], meals: Meal[]) {
  const count = new Map<string, number>();
  for (const f of flares) {
    const end = new Date(f.started).getTime();
    const start = end - 48 * 3600_000;
    for (const m of meals) {
      const t = new Date(m.at).getTime();
      if (t < start || t > end || m.portion === "ditolak") continue;
      for (const name of m.food.split(" + ")) count.set(name, (count.get(name) ?? 0) + 1);
    }
  }
  const suspects = [...count.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([food, c]) => ({ food, count: c }));
  return { flares: flares.length, suspects };
}

export function weekStats(meals: Meal[], now = new Date()) {
  const since = now.getTime() - 7 * 86_400_000;
  const week = meals.filter((m) => new Date(m.at).getTime() >= since);
  const status = { hijau: 0, kuning: 0, merah: 0 } as Record<string, number>;
  week.forEach((m) => (status[m.status] = (status[m.status] ?? 0) + 1));
  return { meals: week.length, status, garam_tinggi: week.filter((m) => m.garam === "tinggi" && m.portion !== "ditolak").length };
}
