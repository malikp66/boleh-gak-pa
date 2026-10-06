/**
 * Daftar kondisi kesehatan + aturan lampu masing-masing.
 * Sumber & ambang: docs/SUMBER-GIZI.md. Lampu SELALU dari aturan ini, bukan dari AI.
 */
import type { Food, Level, Status } from "./foods/types";

export type ConditionId = "asam_urat" | "hipertensi" | "diabetes" | "kolesterol" | "alergi" | "sehat";
export type MonitorKind = "kambuh" | "gula_darah" | "tensi";

export interface ConditionInfo {
  id: ConditionId;
  label: string;
  short: string;
  emoji: string;
  desc: string;
  status: "tersedia" | "beta";
  monitor?: MonitorKind;
  /** fokus yang disebut ke AI saat menulis saran */
  focus: string;
}

export const CONDITIONS: ConditionInfo[] = [
  { id: "diabetes", label: "Diabetes / gula darah tinggi", short: "diabetes", emoji: "🩸", status: "beta", monitor: "gula_darah",
    desc: "Karbohidrat, gula, dan porsi nasi", focus: "karbohidrat & gula (porsi nasi/mi/roti, minuman manis); utamakan sayur dan protein dulu" },
  { id: "hipertensi", label: "Darah tinggi (hipertensi)", short: "darah tinggi", emoji: "🧂", status: "tersedia", monitor: "tensi",
    desc: "Garam, kecap, kuah, makanan olahan", focus: "garam/natrium (kecap, kuah, kerupuk, makanan olahan)" },
  { id: "asam_urat", label: "Asam urat (gout)", short: "asam urat", emoji: "🦶", status: "tersedia", monitor: "kambuh",
    desc: "Purin: jeroan, seafood, daging merah, alkohol", focus: "purin (jeroan, seafood tertentu, daging merah, alkohol) & minuman manis berfruktosa" },
  { id: "kolesterol", label: "Kolesterol tinggi", short: "kolesterol", emoji: "🫀", status: "beta",
    desc: "Lemak jenuh: gorengan, santan, jeroan", focus: "lemak jenuh (santan kental, gorengan, kulit, jeroan, daging berlemak, mentega, keju)" },
  { id: "alergi", label: "Alergi makanan", short: "alergi", emoji: "⚠️", status: "beta",
    desc: "Kacang, seafood, susu, telur, gluten", focus: "alergen yang dimiliki orang ini — sebut jelas dan sarankan bertanya ke penjual" },
  { id: "sehat", label: "Belum ada diagnosis, mau makan lebih sehat", short: "makan sehat", emoji: "🥗", status: "tersedia",
    desc: "Batasi gula, garam, lemak (GGL Kemenkes)", focus: "gula, garam, lemak sesuai anjuran GGL Kemenkes dan Isi Piringku" },
];

export const ALERGEN_LIST = ["kacang tanah", "kacang pohon", "kedelai", "susu", "telur", "gluten", "ikan", "krustasea", "moluska"] as const;
export const ALERGEN_LABEL: Record<string, string> = {
  "kacang tanah": "Kacang tanah", "kacang pohon": "Kacang pohon (mete, almond)", kedelai: "Kedelai (tahu, tempe, kecap)",
  susu: "Susu", telur: "Telur", gluten: "Gluten (terigu)", ikan: "Ikan", krustasea: "Udang & kepiting (termasuk terasi, ebi)",
  moluska: "Cumi, kerang, gurita",
};

export const conditionInfo = (id: string) => CONDITIONS.find((c) => c.id === id);

// Kode lama (v1) → kode baru, supaya profil lama tetap terbaca.
const LEGACY: Record<string, ConditionId> = { "asam urat (gout)": "asam_urat", "darah tinggi (hipertensi)": "hipertensi" };
export const normalizeConditions = (ids: string[]): ConditionId[] =>
  [...new Set(ids.map((k) => LEGACY[k] ?? (k as ConditionId)).filter((k) => conditionInfo(k)))];

// ---------------------------------------------------------------- evaluasi
export interface NutrientFood {
  name: string;
  purin: Level; garam: Level;
  karbo?: Level; gula?: Level; lemak?: Level;
  alergen?: string[];
  pemicu: string[];
}

export interface EvalContext {
  conditions: ConditionId[];
  alergen?: string[];
  flare?: boolean; // asam urat sedang kambuh
}

export interface Reason { condition: ConditionId | "umum"; status: Status; text: string }
export interface Evaluation { status: Status; reasons: Reason[] }

const N: Record<Level, number> = { rendah: 0, sedang: 1, tinggi: 2 };
const ORDER: Status[] = ["hijau", "kuning", "merah"];
const worst = (xs: Status[]) => xs.reduce<Status>((a, b) => (ORDER.indexOf(b) > ORDER.indexOf(a) ? b : a), "hijau");
const has = (f: NutrientFood, word: string) => f.pemicu.some((p) => p.toLowerCase().includes(word));

/** Nilai satu makanan (bukan kombinasi) untuk satu kondisi. */
function single(f: NutrientFood, c: ConditionId, ctx: EvalContext): Reason | null {
  const p = N[f.purin], g = N[f.garam], k = N[f.karbo ?? "sedang"], s = N[f.gula ?? "rendah"], l = N[f.lemak ?? "rendah"];
  switch (c) {
    case "asam_urat":
      if (p === 2) return { condition: c, status: "merah", text: "purin tinggi" };
      if (ctx.flare && p >= 1 && g === 2) return { condition: c, status: "merah", text: "lagi kambuh: purin sedang + garam tinggi" };
      if (has(f, "berfruktosa tinggi")) return { condition: c, status: "kuning", text: "minuman manis berfruktosa menaikkan asam urat" };
      if (p === 1) return { condition: c, status: "kuning", text: "purin sedang" };
      return null;
    case "hipertensi":
      if (has(f, "interaksi")) return { condition: c, status: "kuning", text: "bisa berinteraksi dengan obat tensi" };
      if (g >= 1) return { condition: c, status: "kuning", text: g === 2 ? "garam tinggi" : "garam sedang" };
      return null;
    case "diabetes":
      if (s === 2) return { condition: c, status: "merah", text: "gula tinggi" };
      if (k === 2 && s >= 1) return { condition: c, status: "merah", text: "karbohidrat tinggi + bergula" };
      if (k === 2) return { condition: c, status: "kuning", text: "karbohidrat tinggi — jaga porsi" };
      if (s === 1) return { condition: c, status: "kuning", text: "ada gula tambahan" };
      return null;
    case "kolesterol":
      if (l === 2) return { condition: c, status: "merah", text: "lemak jenuh tinggi" };
      if (l === 1) return { condition: c, status: "kuning", text: "lemak jenuh sedang" };
      return null;
    case "alergi": {
      const hit = (f.alergen ?? []).filter((a) => ctx.alergen?.includes(a));
      return hit.length ? { condition: c, status: "merah", text: `mungkin mengandung ${hit.join(", ")}` } : null;
    }
    case "sehat": {
      const high = [s === 2 && "gula", g === 2 && "garam", l === 2 && "lemak jenuh"].filter(Boolean);
      return high.length ? { condition: c, status: "kuning", text: `${high.join(" & ")} tinggi` } : null;
    }
  }
}

/** Nilai makanan (atau kombinasi) untuk semua kondisi seseorang. Lampu akhir = yang terberat. */
export function evaluate(parts: NutrientFood[], ctx: EvalContext): Evaluation {
  const reasons: Reason[] = [];
  const conds = ctx.conditions.length ? ctx.conditions : (["sehat"] as ConditionId[]);

  // peringatan umum di luar kondisi yang dipilih
  for (const f of parts) {
    if (has(f, "ginjal") || has(f, "jengkolat")) reasons.push({ condition: "umum", status: "kuning", text: `${f.name}: hati-hati untuk ginjal` });
  }

  for (const c of conds) {
    const perPart = parts.map((f) => [f, single(f, c, ctx)] as const).filter(([, r]) => r) as [NutrientFood, Reason][];
    const multi = parts.length > 1;
    for (const [f, r] of perPart) reasons.push({ ...r, text: multi ? `${f.name}: ${r.text}` : r.text });

    // aturan kombinasi
    if (multi && c === "hipertensi") {
      const salty = parts.filter((f) => f.garam === "tinggi");
      if (salty.length >= 2) reasons.push({ condition: c, status: "merah", text: `dobel garam: ${salty.map((f) => f.name).join(" + ")}` });
    }
    if (multi && c === "diabetes") {
      const carby = parts.filter((f) => N[f.karbo ?? "sedang"] >= 1);
      if (carby.length >= 2 && carby.some((f) => f.karbo === "tinggi")) {
        reasons.push({ condition: c, status: "merah", text: `dobel karbohidrat: ${carby.map((f) => f.name).join(" + ")}` });
      }
    }
  }
  return { status: worst(reasons.map((r) => r.status)), reasons: reasons.sort((a, b) => ORDER.indexOf(b.status) - ORDER.indexOf(a.status)) };
}

export const asNutrient = (f: Food): NutrientFood => f;
