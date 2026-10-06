import { z } from "zod";
import { requireUser, route } from "@/lib/server";

const Kind = z.enum(["gula_darah", "tensi"]);

export const GET = route(async (req) => {
  const { supabase } = await requireUser();
  const url = new URL(req.url);
  const profileId = z.string().uuid().parse(url.searchParams.get("profileId"));
  const kind = Kind.parse(url.searchParams.get("kind"));
  const { data, error } = await supabase
    .from("health_logs").select("*").eq("profile_id", profileId).eq("kind", kind)
    .order("at", { ascending: false }).limit(120);
  if (error) throw error;
  return data;
});

export const POST = route(async (req) => {
  const { supabase } = await requireUser();
  const body = z.object({
    profileId: z.string().uuid(),
    kind: Kind,
    value1: z.number().int().min(10).max(700),
    value2: z.number().int().min(20).max(200).nullable().default(null),
    context: z.string().max(40).default(""),
    note: z.string().max(200).default(""),
  }).refine((b) => b.kind === "gula_darah" || b.value2 !== null, { message: "Diastolik wajib diisi" })
    .parse(await req.json());
  const { error } = await supabase.from("health_logs").insert({
    profile_id: body.profileId, kind: body.kind, value1: body.value1, value2: body.value2, context: body.context, note: body.note,
  });
  if (error) throw error;
  return { ok: true };
});
