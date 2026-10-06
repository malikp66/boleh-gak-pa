import { z } from "zod";
import { one, q } from "@/lib/db";
import { getProfile, HttpError, requireUser, route } from "@/lib/server";

export const GET = route(async (req) => {
  const user = await requireUser();
  const profile = await getProfile(user.id, new URL(req.url).searchParams.get("profileId") ?? "");
  return q(
    `select f.*, coalesce((select json_agg(json_build_object('pain', l.pain, 'at', l.at) order by l.at)
       from pain_logs l where l.flare_id = f.id), '[]') as pains
     from flares f where f.profile_id = $1 order by f.started desc limit 50`,
    [profile.id],
  );
});

export const POST = route(async (req) => {
  const user = await requireUser();
  const b = z.object({
    profileId: z.string().uuid(),
    joint: z.string().max(40),
    pain: z.number().int().min(1).max(10),
    fever: z.boolean().default(false),
  }).parse(await req.json());
  const profile = await getProfile(user.id, b.profileId);
  try {
    const flare = await one<{ id: string }>(
      "insert into flares (profile_id, joint, pain, fever) values ($1, $2, $3, $4) returning id",
      [profile.id, b.joint, b.pain, b.fever],
    );
    await q("insert into pain_logs (flare_id, pain) values ($1, $2)", [flare!.id, b.pain]);
  } catch (e) {
    if ((e as { code?: string }).code === "23505") throw new HttpError(400, "Masih ada catatan kambuh yang aktif.");
    throw e;
  }
  return { ok: true };
});
