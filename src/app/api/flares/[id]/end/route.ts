import { z } from "zod";
import { requireUser, route } from "@/lib/server";

export const POST = route<{ params: Promise<{ id: string }> }>(async (_req, { params }) => {
  const { supabase } = await requireUser();
  const id = z.string().uuid().parse((await params).id);
  const { error } = await supabase.from("flares").update({ ended: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
  return { ok: true };
});
