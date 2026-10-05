import { z } from "zod";
import { weeklySummary } from "@/lib/domain";
import { recoveryEstimate, triggerAnalysis, weekStats } from "@/lib/review";
import { loadProfileContext, quota, requireUser, route } from "@/lib/server";

export const GET = route(async (req) => {
  const { supabase } = await requireUser();
  const url = new URL(req.url);
  const profileId = z.string().uuid().parse(url.searchParams.get("profileId"));
  const { profile } = await loadProfileContext(supabase, profileId);
  const [{ data: meals }, { data: flares }] = await Promise.all([
    supabase.from("meals").select("food, portion, status, garam, at").eq("profile_id", profileId).order("at", { ascending: false }).limit(500),
    supabase.from("flares").select("*, pains:pain_logs(flare_id, pain, at)").eq("profile_id", profileId).order("started", { ascending: false }),
  ]);
  const pains = (flares ?? []).flatMap((f) => f.pains ?? []);
  const data = {
    week: weekStats(meals ?? []),
    triggers: triggerAnalysis(flares ?? [], meals ?? []),
    recovery: recoveryEstimate(flares ?? [], pains),
  };
  let summary: string | null = null;
  if (url.searchParams.get("ai") === "1" && (await quota(supabase, "summary")())) {
    const recent = (meals ?? []).filter((m) => Date.now() - new Date(m.at).getTime() < 7 * 86_400_000).map((m) => m.food);
    summary = await weeklySummary(profile, { ...data, makanan: recent });
  }
  return { ...data, summary };
});
