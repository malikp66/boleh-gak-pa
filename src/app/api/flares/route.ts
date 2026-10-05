import { z } from "zod";
import { HttpError, requireUser, route } from "@/lib/server";

export const GET = route(async (req) => {
  const { supabase } = await requireUser();
  const profileId = z.string().uuid().parse(new URL(req.url).searchParams.get("profileId"));
  const { data, error } = await supabase
    .from("flares").select("*, pains:pain_logs(pain, at)").eq("profile_id", profileId)
    .order("started", { ascending: false }).limit(50);
  if (error) throw error;
  return (data ?? []).map((f) => ({ ...f, pains: [...(f.pains ?? [])].sort((a, b) => a.at.localeCompare(b.at)) }));
});

export const POST = route(async (req) => {
  const { supabase } = await requireUser();
  const body = z.object({
    profileId: z.string().uuid(),
    joint: z.string().max(40),
    pain: z.number().int().min(1).max(10),
    fever: z.boolean().default(false),
  }).parse(await req.json());
  const { data, error } = await supabase
    .from("flares").insert({ profile_id: body.profileId, joint: body.joint, pain: body.pain, fever: body.fever }).select().single();
  if (error?.code === "23505") throw new HttpError(400, "Masih ada catatan kambuh yang aktif.");
  if (error) throw error;
  await supabase.from("pain_logs").insert({ flare_id: data.id, pain: body.pain });
  return { ok: true };
});
