import { z } from "zod";
import { q } from "@/lib/db";
import { requireUser, route } from "@/lib/server";

export const DELETE = route<{ params: Promise<{ id: string }> }>(async (_req, { params }) => {
  const user = await requireUser();
  const id = z.string().uuid().parse((await params).id);
  await q(
    `delete from custom_foods c using family_members m where c.id = $1 and m.family_id = c.family_id and m.user_id = $2`,
    [id, user.id],
  );
  return { ok: true };
});
