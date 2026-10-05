import { z } from "zod";
import { ProfileInput } from "@/lib/schemas";
import { requireUser, route } from "@/lib/server";

export const POST = route(async (req) => {
  const { supabase } = await requireUser();
  const body = ProfileInput.extend({ family_id: z.string().uuid() }).parse(await req.json());
  const { data, error } = await supabase.from("profiles").insert(body).select().single();
  if (error) throw error;
  return data;
});

export const PATCH = route(async (req) => {
  const { supabase } = await requireUser();
  const body = ProfileInput.partial().extend({ id: z.string().uuid() }).parse(await req.json());
  const { id, ...rest } = body;
  const { data, error } = await supabase.from("profiles").update(rest).eq("id", id).select().single();
  if (error) throw error;
  return data;
});
