import { aiInfo } from "@/lib/ai";
import { q, one } from "@/lib/db";
import { CONSENT_VERSION } from "@/lib/schemas";
import { meKey, requireUser, route } from "@/lib/server";
import { cached } from "@/lib/redis";
import { maskPhone, waConfigured } from "@/lib/whatsapp";

/** Data awal aplikasi. Di-cache 2 menit per pengguna di Redis; dihapus setiap data keluarga/profil berubah. */
export const GET = route(async () => {
  const user = await requireUser();
  return cached(meKey(user.id), 120, () => loadMe(user));
});

async function loadMe(user: { id: string }) {
  const [families, profiles, consent, wa] = await Promise.all([
    q("select f.id, f.name, f.invite_code from families f join family_members m on m.family_id = f.id where m.user_id = $1 order by f.created_at", [user.id]),
    q("select p.* from profiles p join family_members m on m.family_id = p.family_id where m.user_id = $1 order by p.created_at", [user.id]),
    one<{ version: string }>("select version from consents where user_id = $1", [user.id]),
    one<{ phone: string | null; self_profile_id: string | null }>("select phone, self_profile_id from users where id = $1", [user.id]),
  ]);
  const ai = aiInfo();
  return {
    user: { id: user.id },
    families,
    profiles,
    consented: consent?.version === CONSENT_VERSION,
    ai: { provider: ai.provider, model: ai.textModel, ready: ai.configured },
    wa: { available: waConfigured(), phone: wa?.phone ? maskPhone(wa.phone) : null, profileId: wa?.self_profile_id ?? null },
  };
}
