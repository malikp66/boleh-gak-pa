import { z } from "zod";
import { q } from "@/lib/db";
import { assertFlare } from "@/lib/flare-access";
import { requireUser, route } from "@/lib/server";

export const POST = route<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const user = await requireUser();
  const id = (await params).id;
  await assertFlare(user.id, id);
  const { pain, fever } = z.object({ pain: z.number().int().min(0).max(10), fever: z.boolean().default(false) }).parse(await req.json());
  await q("insert into pain_logs (flare_id, pain) values ($1, $2)", [id, pain]);
  if (fever) await q("update flares set fever = true where id = $1", [id]);
  return { ok: true };
});
