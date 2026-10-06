import { z } from "zod";
import { q } from "@/lib/db";
import { PushRow, sendPush } from "@/lib/push";
import { HttpError, requireUser, route } from "@/lib/server";

/** Kirim notifikasi uji ke perangkat ini. */
export const POST = route(async (req) => {
  const user = await requireUser();
  const { endpoint } = z.object({ endpoint: z.string().max(1000) }).parse(await req.json());
  const rows = await q<PushRow>("select id, endpoint, p256dh, auth from push_subscriptions where user_id = $1 and endpoint = $2", [user.id, endpoint]);
  if (!rows.length) throw new HttpError(404, "Pengingat belum aktif di perangkat ini");
  const ok = await sendPush(rows[0], { title: "Boleh Gak, Ya? 🔔", body: "Notifikasi berhasil! Pengingat akan datang jam 07.00 dan 19.00.", url: "/", tag: "uji" });
  return { ok };
});
