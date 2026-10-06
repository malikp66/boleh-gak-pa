import { findFoods, FOODS } from "./match";
import { Food } from "./types";

// Ciri visual untuk makanan yang sering tertukar. Dipakai untuk mengecek ulang tebakan model.
const CIRI: Record<string, string[]> = {
  ketoprak: ["lontong", "ketupat", "tahu", "bihun", "soun", "tauge", "toge", "bumbu kacang", "saus kacang", "kerupuk", "telur", "bawang goreng"],
  "gado-gado": ["sayur", "kentang", "kol", "kubis", "kacang panjang", "tauge", "bumbu kacang", "saus kacang", "kerupuk", "telur", "lontong", "timun", "tempe"],
  pecel: ["bayam", "kangkung", "tauge", "sayur", "sambal kacang", "bumbu kacang", "rempeyek", "peyek"],
  lotek: ["sayur", "bumbu kacang", "kol", "tauge"],
  siomay: ["siomay", "kol", "kentang", "pare", "tahu", "telur", "bumbu kacang", "saus kacang"],
  batagor: ["batagor", "tahu goreng", "bumbu kacang", "kecap"],
  "soto ayam": ["kuah", "kuah kuning", "ayam suwir", "suwiran ayam", "soun", "bihun", "koya", "telur", "seledri", "mangkuk"],
  "soto betawi": ["kuah santan", "kuah susu", "daging", "babat", "tomat", "emping", "mangkuk"],
  bakso: ["bakso", "bola daging", "kuah", "mie", "mangkuk", "tahu"],
  "mi ayam": ["mie", "mi", "ayam kecap", "sawi", "pangsit", "mangkuk"],
  "sate ayam": ["sate", "tusuk", "bumbu kacang", "lontong", "kecap", "bawang merah"],
  "nasi goreng": ["nasi goreng", "nasi", "telur ceplok", "telur mata sapi", "kerupuk", "acar", "timun"],
  "nasi padang rendang": ["nasi", "rendang", "daun singkong", "sambal hijau", "gulai", "kuah"],
  "lontong sayur": ["lontong", "kuah santan", "labu siam", "sayur", "telur"],
  "bubur ayam": ["bubur", "ayam suwir", "cakwe", "kerupuk", "kacang", "mangkuk"],
  rawon: ["kuah hitam", "kuah gelap", "daging", "tauge", "telur asin"],
};
const SOUPY = new Set(["soto ayam", "soto betawi", "bakso", "rawon", "lontong sayur", "sop buntut", "mi ayam"]);

export function recheck(guess: string, komponen: string[], berkuah: boolean) {
  const seen = komponen.join(" ").toLowerCase();
  const scores = Object.entries(CIRI).map(([name, ciri]) => {
    let score = ciri.filter((c) => seen.includes(c)).length;
    if (SOUPY.has(name) && !berkuah) score -= 3;
    if (!SOUPY.has(name) && berkuah && name !== "bubur ayam") score -= 1;
    return [name, score] as const;
  });
  const ranked = [...scores].sort((a, b) => b[1] - a[1]);
  const [best, bestScore] = ranked[0];
  const guessScore = scores.find(([n]) => n === guess)?.[1];
  let overridden = guessScore !== undefined && best !== guess && bestScore >= guessScore + 2;
  if (guessScore === undefined && bestScore >= 4 && guess === "lainnya") overridden = true;
  const final = overridden ? best : guess;
  const alternatives = ranked.filter(([n, s]) => n !== final && s > 0).slice(0, 3).map(([n]) => n);
  return { final, overridden, alternatives };
}

export interface VisionGuess {
  nama: string;
  komponen: string[];
  berkuah: boolean;
  food: string;
  confidence: "yakin" | "kurang yakin";
}

/** Gabungkan tebakan model dengan tabel: nama bebas → tabel, label yang tidak nyambung dibuang. */
export function resolveVision(r: VisionGuess, foods: Food[] = FOODS) {
  const { food: guess, nama, komponen } = r;
  const textHits = findFoods(nama, foods).map((f) => f.name);
  const hits = textHits.length ? textHits : findFoods(komponen.join(" "), foods).map((f) => f.name);

  let final: string, overridden: boolean, alternatives: string[];
  if (guess in CIRI) {
    ({ final, overridden, alternatives } = recheck(guess, komponen, r.berkuah));
  } else {
    const guessFood = foods.find((f) => f.name === guess);
    const words = new Set((nama + " " + komponen.join(" ")).toLowerCase().match(/[a-z]+/g) ?? []);
    const guessWords = new Set([guess, ...(guessFood?.aliases ?? [])].join(" ").toLowerCase().match(/[a-z]+/g) ?? []);
    const overlap = [...guessWords].some((w) => w !== "dan" && w !== "atau" && words.has(w));
    const related = guess !== "lainnya" && (hits.includes(guess) || overlap);
    if (related) [final, overridden] = [guess, false];
    else if (hits.length) [final, overridden] = [hits[0], guess !== hits[0]];
    else [final, overridden] = [nama.trim().toLowerCase() || guess, guess !== "lainnya"];
    alternatives = hits.filter((n) => n !== final).slice(0, 3);
  }
  const inTable = foods.some((f) => f.name === final);
  return {
    food: final,
    confidence: overridden || !inTable ? "kurang yakin" : r.confidence,
    nama, komponen, berkuah: r.berkuah, model_guess: guess,
    corrected: overridden, in_table: inTable, alternatives,
  };
}
