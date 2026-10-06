/**
 * Hitung gizi satu porsi dari RINCIAN BAHAN (gram) memakai tabel bahan dasar (ingredients.json).
 * AI hanya menguraikan resep; angka karbo/gula/natrium/lemak jenuh berasal dari data
 * (USDA FoodData Central & Open Food Facts), lalu diubah ke tingkat rendah/sedang/tinggi
 * dengan ambang yang sama seperti tabel makanan utama (docs/SUMBER-GIZI.md).
 */
import raw from "./ingredients.json";
import type { Level } from "./types";

export interface Ingredient {
  id: string; label: string; kategori: string;
  karbo: number; gula: number; natrium: number; lemak_jenuh: number; // per 100 g
  purin: Level; ig: number | null; alergen: string[]; sumber: string; ref: string;
}
export const INGREDIENTS = raw as Ingredient[];
const BY_ID = new Map(INGREDIENTS.map((i) => [i.id, i]));

export interface Part { bahan: string; gram: number; nama?: string }

export interface Nutrition {
  porsi_g: number;
  karbo_g: number;
  gula_g: number;
  natrium_mg: number;
  lemak_jenuh_g: number;
  ig: number | null;
  /** porsi berat yang bisa dihitung dari tabel bahan (0–1) */
  cakupan: number;
}

export interface Breakdown {
  nutrisi: Nutrition;
  rincian: { label: string; gram: number; karbo: number; gula: number; natrium: number; lemak_jenuh: number; sumber: string }[];
  tidak_dikenal: string[];
  purin: Level;
  alergen: string[];
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export function compute(parts: Part[]): Breakdown {
  const rincian: Breakdown["rincian"] = [];
  const unknown: string[] = [];
  let total = 0, known = 0, karbo = 0, gula = 0, natrium = 0, jenuh = 0;
  let igWeighted = 0, igCarb = 0, purinTinggi = 0, purinSedang = 0;
  const alergen = new Set<string>();

  for (const p of parts) {
    const gram = Math.max(0, Math.min(p.gram, 2000));
    if (!gram) continue;
    total += gram;
    const ing = BY_ID.get(p.bahan);
    if (!ing) { unknown.push(p.nama || p.bahan); continue; }
    known += gram;
    const f = gram / 100;
    const c = { karbo: ing.karbo * f, gula: ing.gula * f, natrium: ing.natrium * f, lemak_jenuh: ing.lemak_jenuh * f };
    karbo += c.karbo; gula += c.gula; natrium += c.natrium; jenuh += c.lemak_jenuh;
    if (ing.ig != null && c.karbo > 0) { igWeighted += ing.ig * c.karbo; igCarb += c.karbo; }
    if (ing.purin === "tinggi") purinTinggi += gram;
    if (ing.purin === "sedang") purinSedang += gram;
    ing.alergen.forEach((a) => alergen.add(a));
    rincian.push({ label: ing.label, gram: Math.round(gram), karbo: r1(c.karbo), gula: r1(c.gula), natrium: Math.round(c.natrium), lemak_jenuh: r1(c.lemak_jenuh), sumber: ing.sumber });
  }

  // purin dari kelompok bahan (ACR 2020 / Choi 2004): banyaknya bahan tinggi purin dalam satu porsi
  const purin: Level = purinTinggi >= 30 ? "tinggi" : purinTinggi >= 10 || purinSedang >= 50 ? "sedang" : "rendah";

  return {
    nutrisi: {
      porsi_g: Math.round(total), karbo_g: r1(karbo), gula_g: r1(gula), natrium_mg: Math.round(natrium), lemak_jenuh_g: r1(jenuh),
      ig: igCarb ? Math.round(igWeighted / igCarb) : null, cakupan: total ? Math.round((known / total) * 100) / 100 : 0,
    },
    rincian, tidak_dikenal: unknown, purin, alergen: [...alergen],
  };
}

/** Ambang per porsi (docs/SUMBER-GIZI.md → "Ambang per porsi aman"). */
export function levels(n: Pick<Nutrition, "karbo_g" | "gula_g" | "natrium_mg" | "lemak_jenuh_g" | "ig">) {
  const lv = (v: number, lo: number, hi: number): Level => (v > hi ? "tinggi" : v >= lo ? "sedang" : "rendah");
  const karbo = lv(n.karbo_g, 15, 40);
  return {
    karbo,
    gula: lv(n.gula_g, 5, 12.5),
    garam: lv(n.natrium_mg, 400, 800),
    lemak: lv(n.lemak_jenuh_g, 3, 6),
    // IG hanya berarti untuk makanan yang karbohidratnya sedang/tinggi
    ig: n.ig == null || karbo === "rendah" ? null : (n.ig >= 70 ? "tinggi" : n.ig >= 56 ? "sedang" : "rendah") as Level,
  };
}
