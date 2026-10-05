import { z } from "zod";
import { HttpError, requireUser, route } from "@/lib/server";
import { ProfileInput } from "@/lib/schemas";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), familyName: z.string().trim().min(1).max(60), profile: ProfileInput }),
  z.object({ action: z.literal("join"), code: z.string().trim().min(4).max(16) }),
]);

export const POST = route(async (req) => {
  const { supabase } = await requireUser();
  const body = Body.parse(await req.json());
  if (body.action === "join") {
    const { data, error } = await supabase.rpc("join_family", { p_code: body.code });
    if (error) throw new HttpError(400, "Kode undangan tidak ditemukan");
    return { family: data };
  }
  const { data: family, error } = await supabase.rpc("create_family", { p_name: body.familyName });
  if (error || !family) throw error ?? new Error("create_family failed");
  const { data: profile, error: pErr } = await supabase
    .from("profiles").insert({ ...body.profile, family_id: family.id }).select().single();
  if (pErr) throw pErr;
  return { family, profile };
});
