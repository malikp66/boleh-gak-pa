import { q } from "@/lib/db";
import { assertFlare } from "@/lib/flare-access";
import { requireUser, route } from "@/lib/server";

export const POST = route<{ params: Promise<{ id: string }> }>(async (_req, { params }) => {
  const user = await requireUser();
  const id = (await params).id;
  await assertFlare(user.id, id);
  await q("update flares set ended = now() where id = $1 and ended is null", [id]);
  return { ok: true };
});
