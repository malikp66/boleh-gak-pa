import { z } from "zod";
import { analyzeFood } from "@/lib/domain";
import { requireQuota, requireUser, route } from "@/lib/server";

export const POST = route(async (req) => {
  const user = await requireUser();
  const { name, bahan } = z.object({ name: z.string().trim().min(1).max(60), bahan: z.string().max(500).default("") }).parse(await req.json());
  await requireQuota(user.id, "analyze");
  return analyzeFood(name, bahan);
});
