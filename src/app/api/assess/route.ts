import { z } from "zod";
import { q } from "@/lib/db";
import { recordCheck } from "@/lib/checks";
import { learnFood } from "@/lib/ai-foods";
import { assess } from "@/lib/domain";
import { findFoods, leftoverWords } from "@/lib/foods/match";
import { aiCache, loadProfileContext, quota, requireUser, route, todayStartISO } from "@/lib/server";

export const POST = route(async (req) => {
  const user = await requireUser();
  const body = z.object({
    profileId: z.string().uuid(),
    food: z.string().trim().min(1).max(200),
    note: z.string().max(40).default(""),
  }).parse(await req.json());
  const ctx = await loadProfileContext(user.id, body.profileId);
  const { profile, flare } = ctx;
  let foods = ctx.foods;
  // belum ada di daftar mana pun → nilai dengan AI sekali, simpan untuk semua, lalu jawab memakai tabel aturan
  let learned = false;
  // per bagian ('croffle + es teh' → 'croffle' dan 'es teh'): bagian yang belum dikenal dipelajari AI
  const parts = body.food.split(/\s*(?:\+|,|&|\bdan\b|\bsama\b|\bplus\b)\s*/i).map((p) => p.trim()).filter(Boolean).slice(0, 3);
  const unknown = parts.filter((p) => { const f = findFoods(p, foods); return !f.length || leftoverWords(p, f).length > 0; });
  if (unknown.length && (await quota(user.id, "analyze")())) {
    for (const part of unknown) {
      const food = await learnFood(part, user.id).catch((e: Error) => { console.warn("learnFood:", e.message); return null; });
      if (food) { foods = [...foods, food]; learned = true; }
    }
  }
  const todays = await q<{ garam: string | null; karbo: string | null }>(
    "select garam, karbo from meals where profile_id = $1 and portion <> 'ditolak' and at >= $2",
    [profile.id, todayStartISO()],
  );
  const today = {
    garam: todays.filter((m) => m.garam === "tinggi").length,
    karbo: todays.filter((m) => m.karbo === "tinggi").length,
  };
  const result = await assess(body.food, foods, { profile, flare, today, note: body.note }, aiCache(), quota(user.id, "assess"));
  // disimpan sebagai "belum dijawab"; kalau pengguna lupa menekan tombol catat, ditanyakan lagi nanti
  const checkId = await recordCheck(profile.id, result.food, result.status, body.note);
  return { ...result, checkId, learned };
});
