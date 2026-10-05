import { z } from "zod";
import { identify } from "@/lib/domain";
import { loadProfileContext, requireQuota, requireUser, route } from "@/lib/server";

export const POST = route(async (req) => {
  const { supabase } = await requireUser();
  const body = z.object({
    profileId: z.string().uuid(),
    // foto sudah diperkecil di HP (maks 768px); batasi ukuran supaya hemat & aman
    image: z.string().max(1_500_000),
  }).parse(await req.json());
  const { foods } = await loadProfileContext(supabase, body.profileId);
  await requireQuota(supabase, "photo");
  // Foto tidak disimpan di mana pun: dikirim ke model lalu dibuang.
  return identify(body.image.replace(/^data:image\/\w+;base64,/, ""), foods);
});
