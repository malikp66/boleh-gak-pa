import { z } from "zod";
import { one } from "@/lib/db";
import { ProfileInput } from "@/lib/schemas";
import { assertFamily, getProfile, requireUser, route } from "@/lib/server";

const COLS = [
  "nama", "panggilan", "usia", "untuk", "kondisi", "alergen", "diabetes_tipe", "insulin", "catatan_dokter", "obat",
  "target_gula_puasa", "target_gula_2jam", "target_sistolik", "target_diastolik", "kontak_nama", "kontak_telepon",
] as const;

export const POST = route(async (req) => {
  const user = await requireUser();
  const b = ProfileInput.extend({ family_id: z.string().uuid() }).parse(await req.json());
  await assertFamily(user.id, b.family_id);
  return one(
    `insert into profiles (family_id, ${COLS.join(", ")}) values ($1, ${COLS.map((_, i) => `$${i + 2}`).join(", ")}) returning *`,
    [b.family_id, ...COLS.map((c) => b[c])],
  );
});

export const PATCH = route(async (req) => {
  const user = await requireUser();
  const raw = await req.json();
  const b = ProfileInput.partial().extend({ id: z.string().uuid() }).parse(raw);
  await getProfile(user.id, b.id);
  // hanya kolom yang benar-benar dikirim (zod mengisi default untuk field yang tidak dikirim)
  const cols = COLS.filter((c) => c in raw && b[c] !== undefined);
  if (!cols.length) return getProfile(user.id, b.id);
  return one(
    `update profiles set ${cols.map((c, i) => `${c} = $${i + 2}`).join(", ")} where id = $1 returning *`,
    [b.id, ...cols.map((c) => b[c])],
  );
});
