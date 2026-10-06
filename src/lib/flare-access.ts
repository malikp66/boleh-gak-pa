import "server-only";
import { z } from "zod";
import { one } from "./db";
import { HttpError } from "./server";

/** Pastikan kambuh ini milik profil di keluarga pengguna. */
export async function assertFlare(userId: string, flareId: string) {
  z.string().uuid().parse(flareId);
  const ok = await one(
    `select 1 from flares f join profiles p on p.id = f.profile_id
     join family_members m on m.family_id = p.family_id and m.user_id = $2 where f.id = $1`,
    [flareId, userId],
  );
  if (!ok) throw new HttpError(404, "Catatan kambuh tidak ditemukan");
}
