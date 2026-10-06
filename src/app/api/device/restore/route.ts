import { z } from "zod";
import { restoreWithCode, route } from "@/lib/server";

export const POST = route(async (req) => {
  const { code } = z.object({ code: z.string().min(10).max(40) }).parse(await req.json());
  await restoreWithCode(code);
  return { ok: true };
});
