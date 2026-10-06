import { z } from "zod";
import { q } from "@/lib/db";
import { pushConfigured } from "@/lib/push";
import { getProfile, HttpError, requireUser, route } from "@/lib/server";

const Sub = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }),
});

/** Status pengingat untuk perangkat ini (berdasarkan endpoint yang dikirim browser). */
export const GET = route(async (req) => {
  const user = await requireUser();
  const endpoint = new URL(req.url).searchParams.get("endpoint") ?? "";
  const row = await q("select pagi, malam, keluarga, profile_id from push_subscriptions where user_id = $1 and endpoint = $2", [user.id, endpoint]);
  return { configured: pushConfigured, subscription: row[0] ?? null };
});

export const POST = route(async (req) => {
  const user = await requireUser();
  if (!pushConfigured) throw new HttpError(503, "Notifikasi belum dikonfigurasi di server");
  const b = z.object({ subscription: Sub, profileId: z.string().uuid(), pagi: z.boolean().default(true), malam: z.boolean().default(true), keluarga: z.boolean().default(true) }).parse(await req.json());
  await getProfile(user.id, b.profileId);
  await q(
    `insert into push_subscriptions (user_id, profile_id, endpoint, p256dh, auth, pagi, malam, keluarga)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     on conflict (endpoint) do update set user_id = excluded.user_id, profile_id = excluded.profile_id,
       p256dh = excluded.p256dh, auth = excluded.auth, pagi = excluded.pagi, malam = excluded.malam, keluarga = excluded.keluarga`,
    [user.id, b.profileId, b.subscription.endpoint, b.subscription.keys.p256dh, b.subscription.keys.auth, b.pagi, b.malam, b.keluarga],
  );
  return { ok: true };
});

export const DELETE = route(async (req) => {
  const user = await requireUser();
  const { endpoint } = z.object({ endpoint: z.string().max(1000) }).parse(await req.json());
  await q("delete from push_subscriptions where user_id = $1 and endpoint = $2", [user.id, endpoint]);
  return { ok: true };
});
