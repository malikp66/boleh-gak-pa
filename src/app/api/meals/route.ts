import { z } from "zod";
import { q } from "@/lib/db";
import { combine, findFoods } from "@/lib/foods/match";
import { getProfile, loadProfileContext, requireUser, route } from "@/lib/server";

export const GET = route(async (req) => {
  const user = await requireUser();
  const profile = await getProfile(user.id, new URL(req.url).searchParams.get("profileId") ?? "");
  return q("select * from meals where profile_id = $1 order by at desc limit 200", [profile.id]);
});

export const POST = route(async (req) => {
  const user = await requireUser();
  const b = z.object({
    profileId: z.string().uuid(),
    food: z.string().trim().min(1).max(200),
    portion: z.enum(["sesuai saran", "porsi penuh", "ditolak"]),
    status: z.enum(["hijau", "kuning", "merah"]),
    note: z.string().max(40).default(""),
  }).parse(await req.json());
  const { profile, foods } = await loadProfileContext(user.id, b.profileId);
  const food = combine(findFoods(b.food, foods));
  await q(
    `insert into meals (profile_id, food, portion, status, purin, garam, karbo, gula, lemak, note, created_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [profile.id, food?.name ?? b.food, b.portion, b.status, food?.purin ?? null, food?.garam ?? null,
      food?.karbo ?? null, food?.gula ?? null, food?.lemak ?? null, b.note, user.id],
  );
  return { ok: true };
});
