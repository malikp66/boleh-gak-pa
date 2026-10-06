import { z } from "zod";
import { pendingChecks, resolveCheck } from "@/lib/checks";
import { requireUser, route } from "@/lib/server";

/** Pertanyaan "Boleh gak?" yang belum dijawab jadinya gimana (24 jam terakhir). */
export const GET = route(async (req) => {
  const user = await requireUser();
  return pendingChecks(user.id, z.string().uuid().parse(new URL(req.url).searchParams.get("profileId")));
});

/** Jawab: sesuai saran / porsi penuh / ditolak → masuk catatan makan; batal → cuma tanya. */
export const POST = route(async (req) => {
  const user = await requireUser();
  const b = z.object({ id: z.string().uuid(), resolution: z.enum(["sesuai saran", "porsi penuh", "ditolak", "batal"]) }).parse(await req.json());
  return resolveCheck(user.id, b.id, b.resolution);
});
