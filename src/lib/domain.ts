import "server-only";
import { z } from "zod";
import { AIUnavailableError, generateJSON } from "./ai";
import { ConditionId, conditionInfo, evaluate, Evaluation, normalizeConditions } from "./conditions";
import { combine, findFoods, FOODS } from "./foods/match";
import { CombinedFood, Food, MatchedFood } from "./foods/types";
import { resolveVision, VisionGuess } from "./foods/vision";

export interface Profile {
  id: string;
  family_id: string;
  nama: string;
  panggilan: string;
  usia: number | null;
  untuk: string;
  kondisi: string[];
  alergen: string[];
  diabetes_tipe: string | null;
  insulin: boolean;
  catatan_dokter: string;
  obat?: string[];
  target_gula_puasa?: number | null;
  target_gula_2jam?: number | null;
  target_sistolik?: number | null;
  target_diastolik?: number | null;
  kontak_nama?: string;
  kontak_telepon?: string;
}

export interface FlareSummary {
  started: string;
  joint: string;
  pain: number;
}

export const conditionsOf = (p: Profile): ConditionId[] => normalizeConditions(p.kondisi);

export function evalFor(parts: MatchedFood[] | Food[], profile: Profile, flare: boolean): Evaluation {
  return evaluate(parts, { conditions: conditionsOf(profile), alergen: profile.alergen, flare, diabetesTipe: profile.diabetes_tipe, obat: profile.obat ?? [] });
}

// ---------------------------------------------------------------- cek makanan
const AssessSchema = z.object({
  headline: z.string(),
  portion: z.string(),
  tips: z.array(z.string()).max(6),
  refusals: z.array(z.string()).min(1).max(3),
  if_forced: z.string(),
  why: z.string(),
});
export type AssessAI = z.infer<typeof AssessSchema>;

export interface AssessContext {
  profile: Profile;
  flare: FlareSummary | null;
  /** jumlah makanan tinggi garam / tinggi karbo yang sudah dimakan hari ini */
  today: { garam: number; karbo: number };
  note: string;
}

const pick = (f: Food) => ({
  name: f.name, purin: f.purin, garam: f.garam, karbo: f.karbo, gula: f.gula, lemak: f.lemak, ig: f.ig,
  alergen: f.alergen, porsi_aman: f.porsi_aman, trik: f.trik, pemicu: f.pemicu,
});

const DIABETES_TIPE: Record<string, string> = {
  pradiabetes: "pradiabetes", tipe_2: "diabetes tipe 2", tipe_1: "diabetes tipe 1", gestasional: "diabetes kehamilan", tidak_tahu: "diabetes",
};

function personLine(p: Profile, conds: ConditionId[]) {
  const labels = conds.map((c) => (c === "diabetes" && p.diabetes_tipe ? DIABETES_TIPE[p.diabetes_tipe] : conditionInfo(c)!.short));
  const extra = [
    conds.includes("alergi") && p.alergen.length ? `alergi: ${p.alergen.join(", ")}` : "",
    conds.includes("diabetes") && p.insulin ? "memakai insulin" : "",
  ].filter(Boolean);
  return `Kondisi: ${labels.join(", ")}${extra.length ? ` (${extra.join("; ")})` : ""}. Catatan dokter: ${p.catatan_dokter || "-"}`;
}

function assessPrompt(foodText: string, food: CombinedFood | null, ev: Evaluation, ctx: AssessContext): string {
  const p = ctx.profile;
  const conds = conditionsOf(p);
  const lines = [
    `Kamu adalah 'Teman Makan' untuk ${p.nama}${p.usia ? `, ${p.usia} tahun` : ""}.`,
    personLine(p, conds),
    `Bahasa: Indonesia santai dan hangat, kalimat pendek, mudah dibaca semua umur. Panggil dia '${p.panggilan}'.`,
    "Aturan keras: jangan menyarankan obat, dosis obat, atau dosis insulin; jangan menakut-nakuti; jujur soal risiko; selalu praktis.",
    `Fokus penilaian: ${conds.map((c) => conditionInfo(c)!.focus).join(" | ")}.`,
    conds.includes("diabetes") ? "Untuk diabetes: sarankan urutan makan sayur → protein → karbohidrat, porsi nasi ±¾ gelas, ganti nasi putih dengan nasi merah bila ada, dan ganti minuman manis dengan air putih/teh tawar (Isi Piringku). Perhatikan indeks glikemik (ig) di data tabel." : "",
    (ctx.profile.obat ?? []).length ? `Obat yang diminum: ${(ctx.profile.obat ?? []).join(", ")}. Kalau ada interaksi di alasan lampu, jelaskan singkat dan sarankan konfirmasi ke dokter.` : "",
    conds.includes("stroke_jantung") ? "Untuk pasca stroke/jantung: garam dan lemak jenuh sangat dibatasi; sarankan dikukus/direbus/dibakar dan tanpa kuah asin." : "",
    conds.includes("darah_rendah") ? "Untuk darah rendah: sarankan cukup minum air, porsi kecil, makan pelan-pelan, dan duduk sebentar setelah makan sebelum berdiri." : "",
    conds.includes("diabetes") && ctx.profile.insulin ? "Orang ini memakai insulin: ingatkan jangan melewatkan makan setelah suntik dan kenali tanda gula darah rendah (gemetar, keringat dingin); jangan pernah menyarankan dosis." : "",
    conds.includes("kolesterol") ? "Untuk kolesterol: sarankan cara masak dikukus/dibakar/direbus, ganti santan kental dengan santan encer, perbanyak serat (sayur, oat, kacang merah)." : "",
    conds.includes("alergi") ? "Untuk alergi: data alergen adalah perkiraan resep umum. JANGAN pernah menyatakan pasti aman; selalu sarankan menanyakan bahan & alat masak ke penjual, dan waspadai kontaminasi silang." : "",
    "",
    `Makanan yang ditawarkan: ${foodText}`,
  ].filter((l) => l !== "");
  if (ctx.note) lines.push(`Situasi: ${ctx.note}`);
  const parts = food?.components;
  if (parts?.length) {
    lines.push(
      `INI KOMBINASI ${parts.length} MAKANAN DIMAKAN BERSAMAAN: ${parts.map((f) => f.name).join(", ")}. Nilai sebagai SATU kali makan; sebut semua makanannya.`,
      "DATA TABEL tiap makanan (sumber utama, jangan bertentangan):",
      ...parts.map((f) => JSON.stringify(pick(f))),
    );
  } else if (food) {
    lines.push("DATA TABEL (sumber utama, jangan bertentangan):", JSON.stringify(pick(food)));
  } else {
    lines.push("Makanan ini TIDAK ada di tabel. Nilai hati-hati berdasarkan pengetahuan gizi umum untuk kondisi di atas.");
  }
  lines.push(`Lampu dari aturan: ${ev.status}. Alasan: ${ev.reasons.map((r) => r.text).join("; ") || "aman untuk kondisinya"}. Gunakan lampu ini, jangan diubah.`);
  if (ctx.flare) lines.push(`PENTING: asam urat ${p.panggilan} SEDANG KAMBUH sejak ${ctx.flare.started.slice(0, 10)} (nyeri ${ctx.flare.pain}/10 di ${ctx.flare.joint}). Lebih ketat.`);
  if (conds.includes("hipertensi") && ctx.today.garam >= 2) lines.push(`Hari ini ${p.panggilan} sudah makan ${ctx.today.garam} makanan tinggi garam.`);
  if (conds.includes("diabetes") && ctx.today.karbo >= 2) lines.push(`Hari ini ${p.panggilan} sudah makan ${ctx.today.karbo} makanan tinggi karbohidrat.`);
  lines.push(
    "",
    "Isi JSON:",
    "- headline: satu kalimat jawaban inti (maks 12 kata)",
    "- portion: porsi aman yang konkret",
    "- tips: 3-4 cara meminimalkan dampak saat itu juga, masing-masing maks 12 kata",
    `- refusals: 3 kalimat yang DIUCAPKAN ${p.nama.toUpperCase()} KEPADA ORANG YANG MENAWARKAN (orang pertama 'saya'), sopan dan berterima kasih. Urutan: (1) menolak halus, (2) cicip sedikit saja, (3) minta dibungkus.`,
    "- if_forced: kalau tetap makan satu porsi penuh, apa dampaknya untuk kondisinya dan apa yang dilakukan setelahnya. Maks 2 kalimat.",
    "- why: alasan singkat sesuai kondisinya, maks 2 kalimat.",
  );
  return lines.join("\n");
}

function fallbackAssess(food: CombinedFood | null, ev: Evaluation): AssessAI {
  const why = ev.reasons.map((r) => r.text).join("; ");
  if (!food) {
    return {
      headline: "Belum ada data, makan sedikit dulu ya.", portion: "Setengah porsi",
      tips: ["Kuah/bumbu/saus sedikit", "Minum air putih"],
      refusals: ["Makasih banyak, saya lagi jaga makan dari dokter, saya cicip sedikit aja ya."],
      if_forced: "Belum ada data untuk makanan ini.", why: "Makanan tidak ada di daftar.",
    };
  }
  return {
    headline: `${food.name}: ${food.porsi_aman}.`,
    portion: food.porsi_aman,
    tips: food.trik,
    refusals: [
      "Makasih banyak ya, saya lagi jaga makan dari dokter.",
      "Saya cicip sedikit aja ya, biar tetap bisa nemenin makan.",
      "Boleh saya bungkus? Nanti saya makan pelan-pelan di rumah.",
    ],
    if_forced: why ? `Perhatikan: ${why}. Kalau habis satu porsi, kurangi porsi makan berikutnya dan minum air putih.` : "Relatif aman untuk kondisinya.",
    why: why || "Relatif aman untuk kondisinya.",
  };
}

/** Kunci cache: hanya hal yang benar-benar mengubah jawaban (tanpa data pribadi). */
export function assessCacheKey(foodText: string, foods: Food[], ctx: AssessContext): string {
  const found = findFoods(foodText, foods);
  const conds = [...conditionsOf(ctx.profile)].sort();
  return JSON.stringify({
    v: 2,
    foods: found.length ? found.map((f) => f.name) : [foodText.trim().toLowerCase()],
    conds,
    alergen: conds.includes("alergi") ? [...ctx.profile.alergen].sort() : [],
    dm: conds.includes("diabetes") ? [ctx.profile.diabetes_tipe, ctx.profile.insulin] : null,
    panggilan: ctx.profile.panggilan,
    flare: Boolean(ctx.flare),
    garam: Math.min(ctx.today.garam, 2),
    karbo: Math.min(ctx.today.karbo, 2),
    note: ctx.note,
  });
}

export async function assess(
  foodText: string,
  foods: Food[],
  ctx: AssessContext,
  cache: { get: (k: string) => Promise<AssessAI | null>; set: (k: string, v: AssessAI, model: string) => Promise<void> },
  allowAI: () => Promise<boolean>,
) {
  const found = findFoods(foodText, foods);
  const food = combine(found);
  const conds = conditionsOf(ctx.profile);
  const ev = found.length ? evalFor(found, ctx.profile, Boolean(ctx.flare)) : {
    status: "kuning" as const,
    reasons: conds.includes("alergi")
      ? [{ condition: "alergi" as const, status: "kuning" as const, text: "tidak ada di daftar — tanyakan bahannya ke penjual sebelum makan" }]
      : [],
  };
  const key = assessCacheKey(foodText, foods, ctx);

  let text: AssessAI;
  let source: "cache" | "ai" | "tabel" = "tabel";
  let model: string | null = null;
  const cached = await cache.get(key);
  if (cached) {
    text = cached;
    source = "cache";
  } else if (await allowAI()) {
    try {
      const r = await generateJSON(
        [
          { role: "system", content: assessPrompt(foodText, food, ev, ctx) },
          { role: "user", content: `${ctx.profile.panggilan} ditawari ${foodText}. Boleh gak?` },
        ],
        AssessSchema,
      );
      text = r.data;
      source = "ai";
      model = r.model;
      await cache.set(key, text, r.model);
    } catch (e) {
      console.warn("assess fallback:", e instanceof Error ? e.message : e);
      text = fallbackAssess(food, ev);
    }
  } else {
    text = fallbackAssess(food, ev);
  }

  const labels = ["Halus", "Cicip sedikit", "Bungkus"];
  const flare = Boolean(ctx.flare);
  return {
    ...text,
    refusals: text.refusals.map((t, i) => ({ label: labels[i] ?? "Lain", text: t })),
    status: ev.status,
    reasons: ev.reasons,
    food: food?.name ?? foodText,
    nutrients: food ? {
      purin: food.purin, garam: food.garam, karbo: food.karbo ?? null, gula: food.gula ?? null, lemak: food.lemak ?? null,
      ig: food.components ? found.map((f) => f.ig).filter(Boolean).sort((a, b) => ["rendah", "sedang", "tinggi"].indexOf(b!) - ["rendah", "sedang", "tinggi"].indexOf(a!))[0] ?? null : food.ig ?? null,
    } : null,
    alergen: food ? [...new Set(found.flatMap((f) => f.alergen ?? []))] : [],
    in_table: Boolean(food),
    flare_active: flare,
    components: found.map((f) => ({
      name: f.name, garam: f.garam, karbo: f.karbo ?? null, matched: f.matched,
      status: evalFor([f], ctx.profile, flare).status,
    })),
    source,
    model,
  };
}

// ---------------------------------------------------------------- foto
export async function identify(imageB64: string, foods: Food[]) {
  const names = [...new Set(foods.map((f) => f.name))].sort();
  const Schema = z.object({
    nama: z.string(),
    jenis: z.enum(["makanan jadi", "jajanan kemasan", "buah", "sayur", "minuman", "lainnya"]),
    komponen: z.array(z.string()),
    berkuah: z.boolean(),
    food: z.enum(["lainnya", ...names] as [string, ...string[]]),
    confidence: z.enum(["yakin", "kurang yakin"]),
  });
  const r = await generateJSON(
    [
      {
        role: "system",
        content: [
          "Kamu mengenali makanan Indonesia dari foto. Kerjakan berurutan:",
          "0) nama: tulis apa yang kamu lihat dengan bahasa sendiri, termasuk merek kalau produk kemasan. jenis: kategori umumnya.",
          "1) komponen: sebutkan SEMUA isi yang benar-benar terlihat.",
          "2) berkuah: true HANYA jika terendam kuah cair di mangkuk. Bumbu kacang kental di piring = false.",
          "3) food: pilih SATU nama dari daftar ini HANYA jika benar-benar makanan yang sama, selain itu tulis 'lainnya' — JANGAN memilih asal:",
          names.join(", "),
          "Petunjuk: ketoprak = lontong/ketupat + tahu goreng + bihun + tauge + bumbu kacang + kerupuk, di piring, TANPA kuah. gado-gado = sayur rebus + bumbu kacang. soto = kuah di mangkuk.",
        ].join("\n"),
      },
      { role: "user", content: "Makanan apa ini?", images: [imageB64] },
    ],
    Schema,
    { vision: true, temperature: 0.1 },
  );
  const guess: VisionGuess = { ...r.data, food: names.includes(r.data.food) ? r.data.food : "lainnya" };
  return { ...resolveVision(guess, foods), model: r.model };
}

// ---------------------------------------------------------------- analisis makanan baru
const PURIN_RULES =
  "Pedoman purin: TINGGI = jeroan, emping/melinjo, teri, sarden, kerang, daging kambing, kaldu tulang pekat, alkohol. " +
  "SEDANG = daging sapi/ayam/bebek, ikan, udang, cumi, tahu, tempe, kacang, jamur. RENDAH = nasi, telur, susu, sayur, buah, umbi. " +
  "Pedoman garam: TINGGI = ikan asin, kecap, terasi, bumbu kacang, kerupuk, kuah kaldu, makanan olahan/kalengan, mi instan. " +
  "Purin nabati risikonya lebih kecil dari purin hewani.";

export async function analyzeFood(name: string, bahan: string) {
  const words = new Set((name + " " + bahan).toLowerCase().match(/[a-z]+/g) ?? []);
  const refs = FOODS
    .map((f) => [f, [...words].filter((w) => w.length > 3 && [f.name, ...f.aliases, ...f.pemicu].join(" ").toLowerCase().includes(w)).length] as const)
    .filter(([, s]) => s > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([f]) => f);
  const kategori = [...new Set(FOODS.map((f) => f.kategori))] as [string, ...string[]];
  const Schema = z.object({
    kategori: z.enum(kategori),
    purin: z.enum(["rendah", "sedang", "tinggi"]),
    garam: z.enum(["rendah", "sedang", "tinggi"]),
    karbo: z.enum(["rendah", "sedang", "tinggi"]),
    gula: z.enum(["rendah", "sedang", "tinggi"]),
    lemak: z.enum(["rendah", "sedang", "tinggi"]),
    alergen: z.array(z.enum(["kacang tanah", "kacang pohon", "kedelai", "susu", "telur", "gluten", "ikan", "krustasea", "moluska", "wijen"])),
    porsi_aman: z.string(),
    trik: z.array(z.string()).max(5),
    pemicu: z.array(z.string()).max(5),
    alasan: z.string(),
  });
  const r = await generateJSON(
    [
      {
        role: "system",
        content: [
          "Kamu ahli gizi rumahan Indonesia. Nilai satu porsi khas makanan ini.",
          PURIN_RULES,
          "Karbohidrat per porsi: rendah < 15 g, sedang 15-40 g, tinggi > 40 g. Gula tambahan: rendah < 5 g, sedang 5-12,5 g, tinggi > 12,5 g. " +
          "Lemak jenuh: rendah < 3 g, sedang 3-6 g, tinggi > 6 g (santan kental, gorengan, kulit, mentega, keju = tinggi). " +
          "Alergen: sebut yang mungkin ada (termasuk terasi/ebi/petis = krustasea, kecap/tahu/tempe = kedelai, terigu = gluten).",
          "Nilai berdasarkan bahan yang paling berisiko. Kalau ragu, pilih tingkat yang lebih tinggi.",
          "trik: 2-4 cara praktis, maks 10 kata. pemicu: bahan penyebab risiko. alasan: 1-2 kalimat.",
          "Contoh penilaian dari tabel (kalibrasi):",
          ...refs.map((f) => JSON.stringify(pick(f))),
        ].join("\n"),
      },
      { role: "user", content: `Makanan: ${name}\nBahan / cara masak: ${bahan || "(tidak disebutkan)"}` },
    ],
    Schema,
  );
  return { ...r.data, refs: refs.map((f) => f.name), model: r.model };
}

// ---------------------------------------------------------------- ringkasan mingguan
export async function weeklySummary(profile: Profile, data: unknown): Promise<string | null> {
  try {
    const r = await generateJSON(
      [
        {
          role: "system",
          content: `Kamu teman makan ${profile.panggilan} (${conditionsOf(profile).map((c) => conditionInfo(c)!.short).join(", ")}). Tulis ringkasan mingguan maksimal 4 kalimat, hangat, Bahasa Indonesia, berdasarkan data. Puji yang baik, satu saran paling penting untuk minggu depan. Jangan menyarankan obat.`,
        },
        { role: "user", content: JSON.stringify(data) },
      ],
      z.object({ ringkasan: z.string() }),
    );
    return r.data.ringkasan;
  } catch (e) {
    if (!(e instanceof AIUnavailableError)) console.warn("summary failed:", e);
    return null;
  }
}
