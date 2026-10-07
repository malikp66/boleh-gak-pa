import { z } from "zod";
import { identify } from "@/lib/domain";
import { HttpError, loadProfileContext, requireQuota, requireUser, route } from "@/lib/server";
import { throttle } from "@/lib/redis";

export const POST = route(async (req) => {
  const user = await requireUser();
  const body = z.object({
    profileId: z.string().uuid(),
    // foto sudah diperkecil di HP (maks 768px); batasi ukuran supaya hemat & aman
    image: z.string().max(1_500_000),
  }).parse(await req.json());
  const { foods } = await loadProfileContext(user.id, body.profileId);
  const wait = await throttle("photo", user.id);
  if (wait) throw new HttpError(429, `Fotonya pelan-pelan ya 🙂 Coba lagi ${wait} detik lagi.`);
  await requireQuota(user.id, "photo");
  // Foto tidak disimpan di mana pun: dikirim ke model lalu dibuang.
  return identify(body.image.replace(/^data:image\/\w+;base64,/, ""), foods);
});
