import { requireUser, route } from "@/lib/server";
import { CONSENT_VERSION } from "@/lib/schemas";

export const POST = route(async () => {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("consents").upsert({ user_id: user.id, version: CONSENT_VERSION, consented_at: new Date().toISOString() });
  if (error) throw error;
  return { ok: true };
});
