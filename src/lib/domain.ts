import "server-only";
import { z } from "zod";
import { AIUnavailableError, generateJSON } from "./ai";
import { combine, findFoods, FOODS, ruleStatus } from "./foods/match";
import { CombinedFood, Food, Status } from "./foods/types";
import { resolveVision, VisionGuess } from "./foods/vision";

export interface Profile {
  id: string;
  family_id: string;
  nama: string;
  panggilan: string;
  usia: number | null;
  kondisi: string[];
  catatan_dokter: string;
}

export interface FlareSummary {
  started: string;
  joint: string;
  pain: number;
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
  saltyMealsToday: number;
  note: string;
}

const pick = (f: Food) => ({ name: f.name, purin: f.purin, garam: f.garam, porsi_aman: f.porsi_aman, trik: f.trik, pemicu: f.pemicu });

function assessPrompt(foodText: string, food: CombinedFood | null, status: Status | null, ctx: AssessContext): string {
  const p = ctx.profile;
  const lines = [
    `Kamu adalah 'Teman Makan' untuk ${p.nama}${p.usia ? `, ${p.usia} tahun` : ""}.`,
    `Kondisi: ${p.kondisi.join(", ")}. Catatan dokter: ${p.catatan_dokter || "-"}`,
    `Bahasa: Indonesia santai dan hangat, kalimat pendek, mudah dibaca semua umur. Panggil dia '${p.panggilan}'.`,
    "Aturan keras: jangan menyarankan obat atau dosis obat; jangan menakut-nakuti; jujur soal risiko; selalu praktis.",
    "Perhatikan DUA hal: purin (asam urat) DAN garam (darah tinggi). Sering kali garam yang lebih penting.",
    "",
    `Makanan yang ditawarkan: ${foodText}`,
  ];
  if (ctx.note) lines.push(`Situasi: ${ctx.note}`);
  const parts = food?.components;
  if (parts?.length) {
    const salty = parts.filter((f) => f.garam === "tinggi").map((f) => f.name);
    lines.push(
      `INI KOMBINASI ${parts.length} MAKANAN DIMAKAN BERSAMAAN: ${parts.map((f) => f.name).join(", ")}.`,
      "Nilai sebagai SATU kali makan: risiko purin dan garam BERTAMBAH. Sebut semua makanannya.",
      "DATA TABEL tiap makanan (sumber utama, jangan bertentangan):",
      ...parts.map((f) => JSON.stringify(pick(f))),
      `Status lampu gabungan: ${status}.`,
    );
    if (salty.length >= 2) {
      lines.push(`PERINGATAN: ${salty.join(" dan ")} sama-sama tinggi garam — dobel garam berbahaya untuk darah tinggi. Sarankan pilih SALAH SATU saja, atau setengah porsi masing-masing.`);
    }
  } else if (food) {
    lines.push("DATA TABEL (sumber utama, jangan bertentangan):", JSON.stringify(pick(food)), `Status lampu dari tabel: ${status}.`);
  } else {
    lines.push("Makanan ini TIDAK ada di tabel. Nilai hati-hati berdasarkan pengetahuan umum diet rendah purin & rendah garam.");
  }
  if (ctx.flare) lines.push(`PENTING: asam urat ${p.panggilan} SEDANG KAMBUH sejak ${ctx.flare.started.slice(0, 10)} (nyeri ${ctx.flare.pain}/10 di ${ctx.flare.joint}). Lebih ketat.`);
  if (ctx.saltyMealsToday >= 2) lines.push(`Hari ini ${p.panggilan} sudah makan ${ctx.saltyMealsToday} makanan tinggi garam.`);
  lines.push(
    "",
    "Isi JSON:",
    "- headline: satu kalimat jawaban inti (maks 12 kata)",
    "- portion: porsi aman yang konkret",
    "- tips: 3-4 cara meminimalkan dampak saat itu juga, masing-masing maks 12 kata",
    `- refusals: 3 kalimat yang DIUCAPKAN ${p.nama.toUpperCase()} KEPADA TEMANNYA (orang pertama 'saya'), sopan dan berterima kasih. Urutan: (1) menolak halus, (2) cicip sedikit saja, (3) minta dibungkus.`,
    "- if_forced: kalau tetap makan satu porsi penuh, apa dampaknya pada asam urat dan tensi, dan apa yang dilakukan setelahnya. Maks 2 kalimat.",
    "- why: alasan singkat (sebut purin dan/atau garam), maks 2 kalimat.",
  );
  return lines.join("\n");
}

function fallbackAssess(food: CombinedFood | null): AssessAI {
  if (!food) {
    return {
      headline: "Belum ada data, makan sedikit dulu ya.", portion: "Setengah porsi",
      tips: ["Kuah/bumbu sedikit", "Minum 2 gelas air putih"],
      refusals: ["Makasih banyak, saya lagi jaga makan dari dokter, saya cicip sedikit aja ya."],
      if_forced: "Belum ada data untuk makanan ini.", why: "Makanan tidak ada di daftar.",
    };
  }
  return {
    headline: `${food.name}: ${food.porsi_aman}.`,
    portion: food.porsi_aman,
    tips: food.trik,
    refusals: [
      "Makasih banyak ya, saya lagi dijaga dokter soal asam urat sama tensi.",
      "Saya cicip sedikit aja ya, biar tetap bisa nemenin makan.",
      "Boleh saya bungkus? Nanti saya makan pelan-pelan di rumah.",
    ],
    if_forced: `Purin ${food.purin}, garam ${food.garam}. Kalau habis satu porsi, minum banyak air dan pantau sendi serta tensi besok.`,
    why: food.pemicu.join("; ") || "Relatif aman.",
  };
}

/** Kunci cache: hanya hal yang benar-benar mengubah jawaban. */
export function assessCacheKey(foodText: string, foods: Food[], ctx: AssessContext): string {
  const found = findFoods(foodText, foods);
  return JSON.stringify({
    v: 1,
    foods: found.length ? found.map((f) => f.name) : [foodText.trim().toLowerCase()],
    kondisi: [...ctx.profile.kondisi].sort(),
    panggilan: ctx.profile.panggilan,
    flare: Boolean(ctx.flare),
    salty: Math.min(ctx.saltyMealsToday, 2),
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
  const status = ruleStatus(food, Boolean(ctx.flare));
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
          { role: "system", content: assessPrompt(foodText, food, status, ctx) },
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
      text = fallbackAssess(food);
    }
  } else {
    text = fallbackAssess(food);
  }

  const labels = ["Halus", "Cicip sedikit", "Bungkus"];
  return {
    ...text,
    refusals: text.refusals.map((t, i) => ({ label: labels[i] ?? "Lain", text: t })),
    status: status ?? "kuning",
    food: food?.name ?? foodText,
    purin: food?.purin ?? null,
    garam: food?.garam ?? null,
    in_table: Boolean(food),
    flare_active: Boolean(ctx.flare),
    components: found.map((f) => ({ name: f.name, purin: f.purin, garam: f.garam, status: ruleStatus(f, Boolean(ctx.flare)), matched: f.matched })),
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
    food: z.string(),
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
          "Kamu ahli gizi rumahan Indonesia. Nilai makanan untuk penderita asam urat DAN darah tinggi.",
          PURIN_RULES,
          "Nilai berdasarkan bahan yang paling berisiko. Kalau ragu, pilih tingkat yang lebih tinggi.",
          "trik: 2-4 cara praktis, maks 10 kata. pemicu: bahan penyebab risiko. alasan: 1-2 kalimat.",
          "Contoh penilaian dari tabel (kalibrasi):",
          ...refs.map((f) => JSON.stringify({ name: f.name, purin: f.purin, garam: f.garam, porsi_aman: f.porsi_aman, pemicu: f.pemicu })),
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
          content: `Kamu teman makan ${profile.panggilan} (${profile.kondisi.join(", ")}). Tulis ringkasan mingguan maksimal 4 kalimat, hangat, Bahasa Indonesia, berdasarkan data. Puji yang baik, satu saran paling penting untuk minggu depan. Jangan menyarankan obat.`,
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
