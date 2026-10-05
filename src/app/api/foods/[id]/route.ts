import { z } from "zod";
import { requireUser, route } from "@/lib/server";

export const DELETE = route<{ params: Promise<{ id: string }> }>(async (_req, { params }) => {
  const { supabase } = await requireUser();
  const id = z.string().uuid().parse((await params).id);
  const { error } = await supabase.from("custom_foods").delete().eq("id", id);
  if (error) throw error;
  return { ok: true };
});
