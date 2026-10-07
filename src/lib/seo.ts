/**
 * Data untuk halaman publik (SEO): satu halaman per makanan & per kondisi.
 * Penilaian memakai mesin aturan yang sama dengan aplikasi (lib/conditions.ts), jadi isinya konsisten.
 */
import { ALERGEN_LABEL, ConditionId, CONDITIONS, evaluate, Reason } from "./conditions";
import { FOODS } from "./foods/match";
import type { Food, Status } from "./foods/types";

export const SITE_NAME = "Boleh Gak, Ya?";
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL
  ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000")
).replace(/\/$/, "");
export const SITE_DESC =
  "Cek dulu sebelum makan: boleh, dibatasi, atau sebaiknya jangan, sesuai kondisi diabetes, darah tinggi, asam urat, kolesterol, stroke, darah rendah, dan alergi. Gratis, tanpa daftar, berdasarkan tabel gizi Kemenkes, USDA, dan pedoman resmi.";

export const slugify = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export const titleCase = (s: string) => s.replace(/(^|\s|\/|\()(\p{L})/gu, (_, a: string, b: string) => a + b.toUpperCase());

/** Kondisi yang punya halaman sendiri (alergi bergantung jenis alergen, "sehat" bukan kondisi). */
export const SEO_CONDITIONS: { id: ConditionId; slug: string; name: string; who: string; emoji: string; focus: string }[] = [
  { id: "diabetes", slug: "diabetes", name: "Diabetes", who: "penderita diabetes", emoji: "🩸", focus: "karbohidrat, gula, dan indeks glikemik" },
  { id: "hipertensi", slug: "darah-tinggi", name: "Darah tinggi", who: "penderita darah tinggi (hipertensi)", emoji: "🧂", focus: "garam/natrium" },
  { id: "asam_urat", slug: "asam-urat", name: "Asam urat", who: "penderita asam urat", emoji: "🦶", focus: "purin dan minuman manis berfruktosa" },
  { id: "kolesterol", slug: "kolesterol", name: "Kolesterol tinggi", who: "penderita kolesterol tinggi", emoji: "🫀", focus: "lemak jenuh" },
  { id: "stroke_jantung", slug: "stroke-jantung", name: "Stroke & jantung", who: "orang yang pernah stroke atau sakit jantung", emoji: "🧠", focus: "garam dan lemak jenuh yang lebih ketat" },
  { id: "darah_rendah", slug: "darah-rendah", name: "Darah rendah", who: "penderita darah rendah (hipotensi)", emoji: "🩶", focus: "porsi karbohidrat besar dan alkohol" },
];

export const STATUS_TEXT: Record<Status, { label: string; long: string; dot: string }> = {
  hijau: { label: "Aman", long: "boleh", dot: "🟢" },
  kuning: { label: "Batasi", long: "boleh, tapi dibatasi", dot: "🟡" },
  merah: { label: "Hindari", long: "sebaiknya jangan", dot: "🔴" },
};

const BY_SLUG = new Map(FOODS.map((f) => [slugify(f.name), f]));
export const foodBySlug = (slug: string) => BY_SLUG.get(slug) ?? null;
export const foodSlugs = () => [...BY_SLUG.keys()];
export const conditionBySlug = (slug: string) => SEO_CONDITIONS.find((c) => c.slug === slug) ?? null;

export interface Verdict { condition: (typeof SEO_CONDITIONS)[number]; status: Status; reasons: Reason[] }

/** Penilaian satu makanan untuk satu kondisi (tanpa data pribadi). */
export function verdict(food: Food, condition: ConditionId) {
  return evaluate([food], { conditions: [condition] });
}

export function verdicts(food: Food): Verdict[] {
  return SEO_CONDITIONS.map((c) => {
    const ev = verdict(food, c.id);
    return { condition: c, status: ev.status, reasons: ev.reasons.filter((r) => r.condition === c.id || r.condition === "umum") };
  });
}

export const allergenNames = (food: Food) => (food.alergen ?? []).map((a) => ALERGEN_LABEL[a] ?? a);

/** Ringkasan satu baris untuk meta description (≤ 160 huruf). */
export function foodDescription(food: Food) {
  const v = verdicts(food).filter((x) => ["diabetes", "hipertensi", "asam_urat", "kolesterol"].includes(x.condition.id));
  const parts = v.map((x) => `${x.condition.name.toLowerCase()} ${STATUS_TEXT[x.status].label.toLowerCase()}`).join(", ");
  const s = `${titleCase(food.name)}: ${parts}. Porsi aman: ${food.porsi_aman}.`;
  return s.length > 158 ? s.slice(0, 155).replace(/\s\S*$/, "") + "…" : s;
}

export function similarFoods(food: Food, n = 8) {
  return FOODS.filter((f) => f.kategori === food.kategori && f.name !== food.name).slice(0, n);
}

export const CATEGORIES = [...new Set(FOODS.map((f) => f.kategori))];
export { CONDITIONS, FOODS };
