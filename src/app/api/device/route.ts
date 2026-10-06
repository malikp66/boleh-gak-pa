import { z } from "zod";
import { ensureDevice, route } from "@/lib/server";

/** Pastikan perangkat ini punya akun (tanpa daftar). */
export const POST = route(async (req) => {
  const { backup } = z.object({ backup: z.string().max(40).optional() }).parse(await req.json().catch(() => ({})));
  return ensureDevice(backup);
});
