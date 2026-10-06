import { z } from "zod";
import { combine, findFoods } from "@/lib/foods/match";
import { loadProfileContext, requireUser, route } from "@/lib/server";

export const GET = route(async (req) => {
  const { supabase } = await requireUser();
  const profileId = z.string().uuid().parse(new URL(req.url).searchParams.get("profileId"));
  const { data, error } = await supabase.from("meals").select("*").eq("profile_id", profileId).order("at", { ascending: false }).limit(200);
  if (error) throw error;
  return data;
});

export const POST = route(async (req) => {
  const { supabase } = await requireUser();
  const body = z.object({
    profileId: z.string().uuid(),
    food: z.string().trim().min(1).max(200),
    portion: z.enum(["sesuai saran", "porsi penuh", "ditolak"]),
    status: z.enum(["hijau", "kuning", "merah"]),
    note: z.string().max(40).default(""),
  }).parse(await req.json());
  const { foods } = await loadProfileContext(supabase, body.profileId);
  const food = combine(findFoods(body.food, foods));
  const { error } = await supabase.from("meals").insert({
    profile_id: body.profileId,
    food: food?.name ?? body.food,
    portion: body.portion,
    status: body.status,
    purin: food?.purin ?? null,
    garam: food?.garam ?? null,
    karbo: food?.karbo ?? null,
    gula: food?.gula ?? null,
    lemak: food?.lemak ?? null,
    note: body.note,
  });
  if (error) throw error;
  return { ok: true };
});
