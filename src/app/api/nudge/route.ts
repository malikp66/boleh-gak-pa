import { z } from "zod";
import { nudge } from "@/lib/family";
import { requireUser, route } from "@/lib/server";

/** "Bel": ingatkan anggota keluarga lewat notifikasi di HP-nya. Juga dipanggil dari tombol di notifikasi. */
export const POST = route(async (req) => {
  const user = await requireUser();
  const { profileId } = z.object({ profileId: z.string().uuid() }).parse(await req.json());
  return nudge(user.id, profileId);
});
