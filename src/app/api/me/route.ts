import { aiInfo } from "@/lib/ai";
import { CONSENT_VERSION } from "@/lib/schemas";
import { requireUser, route } from "@/lib/server";

export const GET = route(async () => {
  const { supabase, user } = await requireUser();
  const [{ data: families }, { data: profiles }, { data: consent }] = await Promise.all([
    supabase.from("families").select("id, name, invite_code"),
    supabase.from("profiles").select("*").order("created_at"),
    supabase.from("consents").select("version").eq("user_id", user.id).maybeSingle(),
  ]);
  const ai = aiInfo();
  return {
    user: { id: user.id, email: user.email, name: user.user_metadata?.full_name ?? user.email },
    families: families ?? [],
    profiles: profiles ?? [],
    consented: consent?.version === CONSENT_VERSION,
    ai: { provider: ai.provider, model: ai.textModel, ready: ai.configured },
  };
});
