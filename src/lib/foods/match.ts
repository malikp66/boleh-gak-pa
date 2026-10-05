import table from "./foods.json";
import { closestMatch } from "./similarity";
import { CombinedFood, Food, LEVEL, Level, MatchedFood, STATUS_ORDER, Status } from "./types";

export const FOODS: Food[] = (table as { foods: Food[] }).foods;

// kata yang tidak boleh dicocokkan secara "mirip" (bukan nama makanan)
const STOPWORDS = new Set([
  "dari", "temen", "teman", "sama", "pakai", "pake", "dengan", "porsi", "sedikit", "banyak", "makan",
  "minum", "warung", "beli", "dikasih", "ditraktir", "kondangan", "rumah", "terus", "lagi", "habis",
  "satu", "dua", "tiga", "piring", "mangkuk", "gelas", "sendiri", "tambah", "campur", "plus", "atau",
  "goreng", "rebus", "bakar", "ayam", "sapi", "ikan", "daging", "kuah", "manis", "pedas", "asin",
  "panas", "dingin", "spesial", "biasa",
]);

// ejaan sehari-hari → ejaan di tabel
const SPELLING: Record<string, string> = {
  telor: "telur", sambel: "sambal", ijo: "hijau", sayor: "sayur", pedes: "pedas",
  mie: "mi", bakmie: "bakmi", nasgor: "nasi goreng", krupuk: "kerupuk",
  "es teh": "es teh manis", "teh es": "es teh manis",
};

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function normalize(text: string): string {
  let t = (text || "").toLowerCase();
  for (const [a, b] of Object.entries(SPELLING)) {
    t = t.replace(new RegExp(`(?<![a-z0-9])${escapeRe(a)}(?![a-z0-9])`, "g"), b);
  }
  return t;
}

const WARNING_WORDS = ["interaksi", "ginjal", "jengkolat", "berfruktosa tinggi"];

/** Peringatan di luar purin/garam (mis. jeruk bali × obat tensi, belimbing × ginjal). */
export function hasWarning(food: Food): boolean {
  return food.pemicu.some((p) => WARNING_WORDS.some((w) => p.toLowerCase().includes(w)));
}

const worst = (statuses: Status[]): Status =>
  statuses.reduce((a, b) => (STATUS_ORDER.indexOf(b) > STATUS_ORDER.indexOf(a) ? b : a), "hijau");

/** Lampu ditentukan tabel, bukan AI — supaya konsisten dan bisa dicek. */
export function ruleStatus(food: CombinedFood | null | undefined, activeFlare: boolean): Status | null {
  if (!food) return null;
  if (food.components?.length) {
    // dua makanan tinggi garam sekaligus = beban besar untuk tensi
    if (food.components.filter((f) => f.garam === "tinggi").length >= 2) return "merah";
    return worst(food.components.map((f) => ruleStatus(f, activeFlare)!));
  }
  const p = LEVEL[food.purin];
  const g = LEVEL[food.garam];
  if (p === 2 || (activeFlare && p >= 1 && g === 2)) return "merah";
  if (p === 1 || g >= 1 || hasWarning(food)) return "kuning";
  return "hijau";
}

/**
 * Temukan SEMUA makanan dalam teks bebas ('indomi ketoprak', 'soto + es teh').
 * 1) cocok persis (nama/alias terpanjang dulu, tidak saling tumpang tindih)
 * 2) sisa kata dicocokkan secara mirip untuk salah ketik ('indomi' → 'indomie')
 */
export function findFoods(text: string, foods: Food[] = FOODS): MatchedFood[] {
  let t = " " + normalize(text).replace(/[^a-z0-9\s-]/g, " ") + " ";
  const original = t;
  const names = foods
    .flatMap((f) => [f.name, ...f.aliases].filter(Boolean).map((n) => [n.toLowerCase(), f] as const))
    .sort((a, b) => b[0].length - a[0].length);

  // Koreksi typo dua kata dulu ('sotto ayam' → 'soto ayam'), sebelum kata umum seperti
  // 'ayam' keburu cocok sendiri. Hanya kalau salah satu katanya bukan nama yang dikenal.
  const known = new Set(names.flatMap(([n]) => n.split(" ")));
  const multiWord = names.map(([n]) => n).filter((n) => n.includes(" "));
  const typoFixed: Record<string, string> = {};
  const toks = t.split(/\s+/).filter(Boolean);
  for (let i = 0; i < toks.length - 1; i++) {
    const pair = `${toks[i]} ${toks[i + 1]}`;
    if (known.has(toks[i]) && known.has(toks[i + 1])) continue;
    if (names.some(([n]) => n === pair)) continue;
    const close = closestMatch(pair, multiWord);
    if (close) {
      typoFixed[close] = pair;
      t = t.replace(pair, close);
      i++;
    }
  }

  const found: (MatchedFood & { _pos: number })[] = [];
  const seen = new Set<string>();
  const add = (food: Food, matched: string, pos: number) => {
    if (seen.has(food.name)) return;
    seen.add(food.name);
    found.push({ ...food, matched, _pos: pos });
  };

  for (const [name, food] of names) {
    const m = new RegExp(`(?<![a-z])${escapeRe(name)}(?![a-z])`).exec(t);
    if (m) {
      add(food, typoFixed[name] ? `${name} (dari '${typoFixed[name]}')` : name, m.index);
      t = t.slice(0, m.index) + " ".repeat(name.length) + t.slice(m.index + name.length);
    }
  }

  const lookup = new Map(names.map(([n, f]) => [n, f]));
  const words = t.split(/\s+/).filter((w) => w.length >= 4 && !STOPWORDS.has(w));
  const used = new Set<number>();
  const grams: [number, number][] = [
    ...words.slice(0, -1).map((_, i) => [i, i + 2] as [number, number]),
    ...words.map((_, i) => [i, i + 1] as [number, number]),
  ];
  for (const [a, b] of grams) {
    const idx = Array.from({ length: b - a }, (_, k) => a + k);
    if (idx.some((i) => used.has(i))) continue;
    const g = words.slice(a, b).join(" ");
    const close = closestMatch(g, lookup.keys());
    if (close) {
      idx.forEach((i) => used.add(i));
      add(lookup.get(close)!, `${close} (dari '${g}')`, original.indexOf(g));
    }
  }

  found.sort((x, y) => x._pos - y._pos);
  const clean: MatchedFood[] = found.map((f) => {
    const { _pos, ...rest } = f;
    void _pos;
    return rest;
  });

  // buang yang sebenarnya bahan dari makanan lain ('ketoprak tahu' → tahu sudah termasuk ketoprak),
  // tapi hanya kalau risikonya tidak lebih berat dari makanan induknya
  const order = (f: Food) => STATUS_ORDER.indexOf(ruleStatus(f, false)!);
  const isIngredient = (f: MatchedFood) =>
    clean.some((o) => o !== f && o.pemicu.join(" ").toLowerCase().includes(f.matched.split(" (")[0]) && order(f) <= order(o));
  const result = clean.filter((f) => !isIngredient(f));
  return result.length ? result : clean;
}

export function findFood(text: string, foods: Food[] = FOODS): MatchedFood | null {
  return findFoods(text, foods)[0] ?? null;
}

/** Gabungkan beberapa makanan jadi satu penilaian: ambil tingkat terberat. */
export function combine(foods: MatchedFood[]): CombinedFood | null {
  if (!foods.length) return null;
  if (foods.length === 1) return foods[0];
  const top = (key: "purin" | "garam"): Level =>
    foods.map((f) => f[key]).reduce((a, b) => (LEVEL[b] > LEVEL[a] ? b : a));
  return {
    name: foods.map((f) => f.name).join(" + "),
    aliases: [],
    kategori: "Kombinasi",
    purin: top("purin"),
    garam: top("garam"),
    porsi_aman: foods.map((f) => `${f.name}: ${f.porsi_aman}`).join("; "),
    trik: foods.flatMap((f) => f.trik.slice(0, 2)),
    pemicu: foods.flatMap((f) => f.pemicu.slice(0, 2)),
    components: foods,
  };
}
