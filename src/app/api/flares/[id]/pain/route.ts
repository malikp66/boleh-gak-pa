import { z } from "zod";
import { requireUser, route } from "@/lib/server";

export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { supabase } = await requireUser();
  const id = z.string().uuid().parse((await params).id);
  const { pain, fever } = z.object({ pain: z.number().int().min(0).max(10), fever: z.boolean().default(false) }).parse(await req.json());
  const { error } = await supabase.from("pain_logs").insert({ flare_id: id, pain });
  if (error) throw error;
  if (fever) await supabase.from("flares").update({ fever: true }).eq("id", id);
  return { ok: true };
});
