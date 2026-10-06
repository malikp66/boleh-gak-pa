import { q } from "@/lib/db";
import { weeklySummary } from "@/lib/domain";
import { Flare, Meal, PainLog, recoveryEstimate, triggerAnalysis, weekStats } from "@/lib/review";
import { getProfile, quota, requireUser, route } from "@/lib/server";

export const GET = route(async (req) => {
  const user = await requireUser();
  const url = new URL(req.url);
  const profile = await getProfile(user.id, url.searchParams.get("profileId") ?? "");
  const [meals, flares, pains] = await Promise.all([
    q<Meal>("select food, portion, status, garam, at from meals where profile_id = $1 order by at desc limit 500", [profile.id]),
    q<Flare>("select id, started, ended, joint, pain, fever from flares where profile_id = $1 order by started desc", [profile.id]),
    q<PainLog>("select l.flare_id, l.pain, l.at from pain_logs l join flares f on f.id = l.flare_id where f.profile_id = $1", [profile.id]),
  ]);
  // pg mengembalikan timestamptz sebagai Date; logika review memakai string ISO
  const iso = <T extends object>(rows: T[], keys: (keyof T)[]) =>
    rows.map((r) => ({ ...r, ...Object.fromEntries(keys.map((k) => [k, r[k] instanceof Date ? (r[k] as Date).toISOString() : r[k]])) }) as T);
  const M = iso(meals, ["at"]), F = iso(flares, ["started", "ended"]), P = iso(pains, ["at"]);
  const data = { week: weekStats(M), triggers: triggerAnalysis(F, M), recovery: recoveryEstimate(F, P) };
  let summary: string | null = null;
  if (url.searchParams.get("ai") === "1" && (await quota(user.id, "summary")())) {
    const recent = M.filter((m) => Date.now() - new Date(m.at).getTime() < 7 * 86_400_000).map((m) => m.food);
    summary = await weeklySummary(profile, { ...data, makanan: recent });
  }
  return { ...data, summary };
});
