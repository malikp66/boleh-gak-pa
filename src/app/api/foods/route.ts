import { z } from "zod";
import { evalFor } from "@/lib/domain";
import { loadProfileContext, requireUser, route } from "@/lib/server";

const level = z.enum(["rendah", "sedang", "tinggi"]);

export const GET = route(async (req) => {
  const { supabase } = await requireUser();
  const profileId = new URL(req.url).searchParams.get("profileId") ?? "";
  const { profile, foods, flare } = await loadProfileContext(supabase, profileId);
  return foods.map((f) => {
    const ev = evalFor([f], profile, Boolean(flare));
    return { ...f, status: ev.status, reason: ev.reasons[0]?.text ?? null };
  });
});

export const POST = route(async (req) => {
  const { supabase } = await requireUser();
  const body = z.object({
    profileId: z.string().uuid(),
    name: z.string().trim().toLowerCase().min(1).max(60),
    aliases: z.array(z.string().trim().toLowerCase().max(60)).max(10).default([]),
    kategori: z.string().max(40).default("Buatan keluarga"),
    bahan: z.string().max(500).default(""),
    purin: level,
    garam: level,
    karbo: level.default("sedang"),
    gula: level.default("rendah"),
    lemak: level.default("rendah"),
    alergen: z.array(z.string().max(30)).max(9).default([]),
    porsi_aman: z.string().max(200).default(""),
    trik: z.array(z.string().max(120)).max(6).default([]),
    pemicu: z.array(z.string().max(120)).max(6).default([]),
    alasan: z.string().max(400).default(""),
  }).parse(await req.json());
  const { profile } = await loadProfileContext(supabase, body.profileId);
  const { profileId, ...food } = body;
  void profileId;
  const { error } = await supabase
    .from("custom_foods")
    .upsert({ ...food, aliases: food.aliases.filter(Boolean), family_id: profile.family_id }, { onConflict: "family_id,name" });
  if (error) throw error;
  return { ok: true };
});
