import { z } from "zod";
import { assess } from "@/lib/domain";
import { aiCache, loadProfileContext, quota, requireUser, route, todayStartISO } from "@/lib/server";

export const POST = route(async (req) => {
  const { supabase } = await requireUser();
  const body = z.object({
    profileId: z.string().uuid(),
    food: z.string().trim().min(1).max(200),
    note: z.string().max(40).default(""),
  }).parse(await req.json());
  const { profile, foods, flare } = await loadProfileContext(supabase, body.profileId);
  const { data: todays } = await supabase
    .from("meals").select("garam, karbo").eq("profile_id", profile.id).neq("portion", "ditolak").gte("at", todayStartISO());
  const today = {
    garam: (todays ?? []).filter((m) => m.garam === "tinggi").length,
    karbo: (todays ?? []).filter((m) => m.karbo === "tinggi").length,
  };
  return assess(body.food, foods, { profile, flare, today, note: body.note }, aiCache(), quota(supabase, "assess"));
});
