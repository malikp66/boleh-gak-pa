import { z } from "zod";
import { healthLogProblem } from "@/lib/validation";
import { q } from "@/lib/db";
import { getProfile, requireUser, route } from "@/lib/server";

const Kind = z.enum(["gula_darah", "tensi"]);

export const GET = route(async (req) => {
  const user = await requireUser();
  const url = new URL(req.url);
  const profile = await getProfile(user.id, url.searchParams.get("profileId") ?? "");
  const kind = Kind.parse(url.searchParams.get("kind"));
  return q("select * from health_logs where profile_id = $1 and kind = $2 order by at desc limit 120", [profile.id, kind]);
});

export const POST = route(async (req) => {
  const user = await requireUser();
  const b = z.object({
    profileId: z.string().uuid(),
    kind: Kind,
    value1: z.number().int().min(10).max(700),
    value2: z.number().int().min(20).max(200).nullable().default(null),
    context: z.string().max(40).default(""),
    note: z.string().max(200).default(""),
  }).superRefine((x, ctx) => {
    const m = healthLogProblem(x.kind, x.value1, x.kind === "tensi" ? x.value2 : 0);
    if (m) ctx.addIssue({ code: "custom", message: m });
  }).parse(await req.json());
  const profile = await getProfile(user.id, b.profileId);
  await q(
    "insert into health_logs (profile_id, kind, value1, value2, context, note) values ($1, $2, $3, $4, $5, $6)",
    [profile.id, b.kind, b.value1, b.value2, b.context, b.note],
  );
  return { ok: true };
});
