import { q } from "@/lib/db";
import { CONSENT_VERSION } from "@/lib/schemas";
import { invalidateUser, requireUser, route } from "@/lib/server";

export const POST = route(async () => {
  const user = await requireUser();
  await q(
    `insert into consents (user_id, version) values ($1, $2)
     on conflict (user_id) do update set version = excluded.version, consented_at = now()`,
    [user.id, CONSENT_VERSION],
  );
  await invalidateUser(user.id);
  return { ok: true };
});
