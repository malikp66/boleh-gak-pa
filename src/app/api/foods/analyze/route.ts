import { z } from "zod";
import { nameProblem } from "@/lib/validation";
import { analyzeFood } from "@/lib/domain";
import { requireQuota, requireUser, route } from "@/lib/server";

export const POST = route(async (req) => {
  const user = await requireUser();
  const { name, bahan } = z.object({ name: z.string().trim().max(60).superRefine((v, ctx) => { const m = nameProblem(v, "Nama makanan"); if (m) ctx.addIssue({ code: "custom", message: m }); }), bahan: z.string().max(500).default("") }).parse(await req.json());
  await requireQuota(user.id, "analyze");
  return analyzeFood(name, bahan);
});
