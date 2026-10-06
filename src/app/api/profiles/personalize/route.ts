import { z } from "zod";
import { AIUnavailableError } from "@/lib/ai";
import { personalize, personalizeLocal } from "@/lib/domain";
import { quota, requireUser, route } from "@/lib/server";

/**
 * Pahami isian "Lainnya" → usulan (belum disimpan). Pengguna meninjau dulu, lalu menyimpan lewat PATCH /api/profiles.
 * Kalau AI tidak tersedia, tetap mengembalikan hasil pencocokan kata kunci lokal.
 */
export const POST = route(async (req) => {
  const user = await requireUser();
  const b = z.object({
    usia: z.number().int().nullable().default(null),
    kondisi: z.array(z.string().max(30)).max(10).default([]),
    kondisi_lain: z.string().trim().max(300).default(""),
    obat_lain: z.string().trim().max(300).default(""),
    alergen_lain: z.string().trim().max(200).default(""),
  }).parse(await req.json());
  if (!b.kondisi_lain && !b.obat_lain && !b.alergen_lain) return personalizeLocal(b);
  if (!(await quota(user.id, "analyze")())) return { ...personalizeLocal(b), aiError: "Jatah AI hari ini habis" };
  try {
    return await personalize(b);
  } catch (e) {
    return { ...personalizeLocal(b), aiError: e instanceof AIUnavailableError ? e.message : "AI belum bisa dipakai" };
  }
});
