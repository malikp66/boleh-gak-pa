import "server-only";
import { one, q } from "./db";
import { analyzeFood } from "./domain";
import { normalize } from "./foods/match";
import { closestMatch } from "./foods/similarity";
import { Food, FoodBasis } from "./foods/types";

/**
 * Makanan yang dipelajari AI: dinilai sekali, lalu disimpan untuk semua pengguna.
 * Lampu tetap diputuskan tabel aturan dari nilai gizinya, bukan oleh AI.
 * Tabel resmi & daftar keluarga tetap diutamakan; ini dipakai kalau keduanya tidak punya.
 */

const TTL = 5 * 60_000;
let cache: { at: number; foods: Food[] } | null = null;

type Row = Omit<Food, "custom" | "basis"> & { verified: boolean; nutrisi: FoodBasis["nutrisi"] | null; rincian: FoodBasis["rincian"] | null; sumber: FoodBasis["sumber"] | null; sumber_ref: string | null };

const toFood = (r: Row): Food => {
  const { verified, nutrisi, rincian, sumber, sumber_ref, ...food } = r;
  return { ...food, ai: !verified, basis: nutrisi && sumber ? { nutrisi, rincian: rincian ?? [], sumber, sumber_ref: sumber_ref ?? "" } : null };
};

export async function loadAiFoods(): Promise<Food[]> {
  if (cache && Date.now() - cache.at < TTL) return cache.foods;
  const rows = await q<Row>(
    `select name, aliases, kategori, purin, garam, karbo, gula, lemak, ig, alergen, porsi_aman, trik, pemicu, alasan, verified,
       nutrisi, rincian, sumber, sumber_ref
     from ai_foods order by hits desc limit 5000`,
  );
  cache = { at: Date.now(), foods: rows.map(toFood) };
  return cache.foods;
}

/** Teks dari pengguna → bentuk yang layak disimpan sebagai nama makanan (atau null). */
export function cleanFoodName(text: string): string | null {
  const t = normalize(text).replace(/[^\p{L}\p{N}\s'-]/gu, " ").replace(/\s+/g, " ").trim();
  if (t.length < 2 || t.length > 60 || !/\p{L}{2}/u.test(t)) return null;
  return t;
}

/**
 * Nilai makanan baru dengan AI lalu simpan. null kalau AI tidak mengenalinya sebagai makanan nyata.
 * Kalau sudah pernah dipelajari (oleh siapa pun), langsung dipakai tanpa memanggil AI.
 */
export async function learnFood(text: string, userId: string): Promise<Food | null> {
  const asked = cleanFoodName(text);
  if (!asked) return null;
  // ejaan lain dari makanan yang sudah dipelajari ('croffle coklat' ≈ 'croffle cokelat') → pakai yang ada
  const similar = closestMatch(asked, (await loadAiFoods()).flatMap((f) => [f.name, ...f.aliases]), 0.88);
  const known = await one<Row>("select * from ai_foods where name = $1 or $1 = any(aliases)", [similar ?? asked]);
  if (known) {
    await q(
      "update ai_foods set hits = hits + 1, aliases = case when $2 = name or $2 = any(aliases) then aliases else aliases || $2 end where name = $1",
      [known.name, asked],
    );
    cache = null;
    return toFood(known);
  }

  const r = await analyzeFood(asked, "");
  if (!r.dikenal) return null;
  const name = cleanFoodName(r.nama) ?? asked;
  const aliases = [...new Set([asked].filter((a) => a !== name))];
  const row = await one<Row>(
    `insert into ai_foods (name, aliases, kategori, purin, garam, karbo, gula, lemak, ig, alergen, porsi_aman, trik, pemicu, alasan, model, created_by,
       nutrisi, rincian, sumber, sumber_ref)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
     on conflict (name) do update set
       aliases = (select array(select distinct unnest(ai_foods.aliases || excluded.aliases))),
       hits = ai_foods.hits + 1
     returning *`,
    [name, aliases, r.kategori, r.purin, r.garam, r.karbo, r.gula, r.lemak, r.ig, r.alergen,
      r.porsi_aman.slice(0, 200), r.trik.slice(0, 5).map((x) => x.slice(0, 120)), r.pemicu.slice(0, 5).map((x) => x.slice(0, 120)),
      r.alasan.slice(0, 400), r.model, userId, JSON.stringify(r.nutrisi), JSON.stringify(r.rincian), r.sumber, r.sumber_ref.slice(0, 300)],
  );
  cache = null; // supaya pengguna lain langsung bisa memakai
  return row ? toFood(row) : null;
}
