/**
 * Isian bebas "Lainnya" → data terstruktur.
 * Lapis 1 (selalu jalan, tanpa AI): kamus kata kunci untuk kondisi, obat, dan alergen yang sudah dikenal.
 * Lapis 2 (AI, lihat domain.ts → personalize): kondisi di luar daftar (mis. maag, ginjal) diringkas
 * menjadi fokus diet + kata kunci makanan yang dihindari/dibatasi, lalu dikonfirmasi pengguna.
 */
import type { ConditionId } from "./conditions";
import type { MedId } from "./medications";

const CONDITION_WORDS: [ConditionId, RegExp][] = [
  ["diabetes", /diabet|kencing manis|gula darah|gula tinggi|\bdm\b|pradiabet|kadar gula/],
  ["hipertensi", /darah tinggi|hipertensi|tensi tinggi|tekanan darah tinggi/],
  ["darah_rendah", /darah rendah|hipotensi|tensi rendah|tekanan darah rendah/],
  ["asam_urat", /asam urat|\bgout\b|encok/],
  ["kolesterol", /kolesterol|dislipid|lemak darah|trigliserid/],
  ["stroke_jantung", /stroke|jantung|koroner|pasang ring|bypass|gagal jantung/],
];

const MED_WORDS: [MedId, RegExp][] = [
  ["statin", /statin|simvastatin|atorvastatin|rosuvastatin|pravastatin|lipitor|crestor/],
  ["amlodipin", /amlodipin|nifedipin|felodipin|norvask|adalat/],
  ["warfarin", /warfarin|simarc/],
  ["antiplatelet", /aspirin|aspilet|clopidogrel|plavix|cilostazol/],
  ["metformin", /metformin|glucophage|glumin/],
  ["sulfonilurea", /glibenklamid|glimepirid|gliklazid|amaryl|diamicron|gliquidon/],
  ["insulin", /insulin|lantus|novorapid|levemir|humalog|apidra/],
  ["allopurinol", /allopurinol|alopurinol|zyloric/],
];

const ALLERGEN_WORDS: [string, RegExp][] = [
  ["kacang pohon", /mete|almond|kenari|hazelnut|pistachio|walnut|kacang pohon/],
  ["kacang tanah", /kacang tanah|peanut|\bkacang\b(?! (mete|almond|kenari|pohon|kedelai|hijau|merah|panjang))/],
  ["kedelai", /kedelai|\bsoy|\btahu\b|tempe|kecap/],
  ["susu", /susu|laktosa|lactose|keju|dairy|mentega/],
  ["telur", /telur|\begg/],
  ["gluten", /gluten|gandum|terigu|\bwheat/],
  ["krustasea", /udang|kepiting|rajungan|lobster|terasi|\bebi\b|seafood/],
  ["moluska", /cumi|kerang|gurita|tiram|seafood/],
  ["ikan", /\bikan\b|\bfish/],
  ["wijen", /wijen|sesame/],
];

export interface LocalMapping { kondisi: ConditionId[]; obat: MedId[]; alergen: string[] }

export function mapLocally(kondisiLain: string, obatLain: string, alergenLain: string): LocalMapping {
  const k = kondisiLain.toLowerCase(), o = (obatLain + " " + kondisiLain).toLowerCase(), a = alergenLain.toLowerCase();
  return {
    kondisi: CONDITION_WORDS.filter(([, re]) => re.test(k)).map(([id]) => id),
    obat: MED_WORDS.filter(([, re]) => re.test(o)).map(([id]) => id),
    alergen: ALLERGEN_WORDS.filter(([, re]) => re.test(a)).map(([id]) => id),
  };
}

/** Catatan pribadi hasil AI yang sudah disetujui pengguna. */
export interface Personalisasi {
  ringkasan: string;
  fokus: string;
  hindari: string[];
  batasi: string[];
  perlu_dokter: boolean;
  sumber: string; // teks asli yang dianalisis
  dibuat: string;
}

const kw = (s: string) => s.toLowerCase().trim();

/** Kata kunci pribadi → alasan lampu (dipakai mesin aturan). */
export function personalReasons(food: { name: string; aliases?: string[]; pemicu: string[]; kategori?: string }, p: Personalisasi | null | undefined) {
  if (!p) return [];
  const hay = [food.name, ...(food.aliases ?? []), ...food.pemicu, food.kategori ?? ""].join(" | ").toLowerCase();
  const hit = (words: string[]) => words.map(kw).filter((w) => w.length >= 3 && new RegExp(`(^|[^a-z])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(hay));
  const out: { status: "merah" | "kuning"; text: string }[] = [];
  const h = hit(p.hindari);
  if (h.length) out.push({ status: "merah", text: `catatan khusus: hindari ${h.join(", ")}` });
  const b = hit(p.batasi).filter((w) => !h.includes(w));
  if (b.length) out.push({ status: "kuning", text: `catatan khusus: batasi ${b.join(", ")}` });
  return out;
}
