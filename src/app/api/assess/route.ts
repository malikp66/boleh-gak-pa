import { z } from "zod";
import { q } from "@/lib/db";
import { recordCheck } from "@/lib/checks";
import { assess } from "@/lib/domain";
import { aiCache, loadProfileContext, quota, requireUser, route, todayStartISO } from "@/lib/server";

export const POST = route(async (req) => {
  const user = await requireUser();
  const body = z.object({
    profileId: z.string().uuid(),
    food: z.string().trim().min(1).max(200),
    note: z.string().max(40).default(""),
  }).parse(await req.json());
  const { profile, foods, flare } = await loadProfileContext(user.id, body.profileId);
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
  return { ...result, checkId };
});
