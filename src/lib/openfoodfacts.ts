import "server-only";

/**
 * Open Food Facts: database label gizi kemasan yang terbuka (ODbL).
 * Dipakai untuk produk bermerek (mis. "Chitato sapi panggang") supaya angkanya dari label, bukan tebakan.
 * Aturan pemakaian API: sertakan User-Agent berisi nama aplikasi & kontak, maks ±10 pencarian/menit.
 */
const UA = "BolehGakYa/0.1 (https://github.com/malikp66/boleh-gak-pa)";

export interface OffProduct {
  code: string;
  name: string;
  brands: string;
  serving_g: number | null;
  per100: { karbo: number; gula: number; natrium: number; lemak_jenuh: number };
}

const tokens = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w.length > 1);

/**
 * Cari produk yang paling cocok; null kalau tidak ada yang cukup mirip atau datanya tidak lengkap.
 * Merek WAJIB cocok (supaya 'Chitato sapi panggang' tidak tertukar dengan merek lain rasa sama).
 */
export async function findProduct(merek: string, produk: string): Promise<OffProduct | null> {
  const query = `${merek} ${produk}`;
  const url = "https://search.openfoodfacts.org/search?" + new URLSearchParams({
    q: query, page_size: "20", fields: "code,product_name,brands,serving_quantity,nutriments",
  });
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(8000) }).catch(() => null);
  if (!res?.ok) return null;
  const data = (await res.json().catch(() => null)) as { hits?: Record<string, unknown>[] } | null;
  const brand = tokens(merek);
  const want = new Set(tokens(produk).filter((w) => !brand.includes(w)));
  let best: { score: number; p: OffProduct } | null = null;
  for (const h of data?.hits ?? []) {
    const n = (h.nutriments ?? {}) as Record<string, unknown>;
    const num = (k: string) => (typeof n[k] === "number" ? (n[k] as number) : null);
    const karbo = num("carbohydrates_100g"), gula = num("sugars_100g"), jenuh = num("saturated-fat_100g");
    const natrium = num("sodium_100g") ?? (num("salt_100g") != null ? num("salt_100g")! / 2.5 : null);
    if (karbo == null || gula == null || jenuh == null || natrium == null) continue;
    const brands = Array.isArray(h.brands) ? (h.brands as string[]).join(", ") : String(h.brands ?? "");
    const name = String(h.product_name ?? "");
    const have = new Set(tokens(`${brands} ${name}`));
    if (!brand.length || !brand.every((w) => have.has(w))) continue;
    const score = want.size ? [...want].filter((w) => have.has(w)).length / want.size : 1;
    if (score >= 0.5 && (!best || score > best.score)) {
      const serving = typeof h.serving_quantity === "number" && h.serving_quantity > 0 && h.serving_quantity < 1000 ? h.serving_quantity : null;
      best = { score, p: { code: String(h.code), name, brands, serving_g: serving, per100: { karbo, gula, natrium: natrium * 1000, lemak_jenuh: jenuh } } };
    }
  }
  return best?.p ?? null;
}
