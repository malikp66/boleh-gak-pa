import { z } from "zod";
import { restoreWithCode, route } from "@/lib/server";

export const POST = route(async (req) => {
  const { code } = z.object({ code: z.string().min(10, "Kode pemulihan terlalu pendek. Isinya 24 huruf/angka.").max(40, "Kode pemulihan terlalu panjang.") }).parse(await req.json());
  await restoreWithCode(code);
  return { ok: true };
});
