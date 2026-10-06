import { z } from "zod";
import { createLink, linkStatus, unlink, waConfigured } from "@/lib/whatsapp";
import { getProfile, HttpError, requireUser, route } from "@/lib/server";

/** Status kode: pending → linked/merged/conflict, atau expired. */
export const GET = route(async (req) => {
  const user = await requireUser();
  const code = z.string().min(6).max(6).parse(new URL(req.url).searchParams.get("code"));
  return linkStatus(user.id, code);
});

/** Buat kode baru + tautan wa.me berisi pesan siap kirim. */
export const POST = route(async (req) => {
  const user = await requireUser();
  if (!waConfigured()) throw new HttpError(503, "Masuk dengan WhatsApp belum tersedia.");
  const { profileId } = z.object({ profileId: z.string().uuid().nullable().default(null) }).parse(await req.json().catch(() => ({})));
  if (profileId) await getProfile(user.id, profileId);
  try { return await createLink(user.id, profileId); } catch (e) { throw new HttpError(429, (e as Error).message); }
});

export const DELETE = route(async () => {
  await unlink((await requireUser()).id);
  return { ok: true };
});
