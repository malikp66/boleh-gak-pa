import { z } from "zod";
import { one, tx } from "@/lib/db";
import { ProfileInput } from "@/lib/schemas";
import { normalizeInvite } from "@/lib/validation";
import { HttpError, requireUser, route } from "@/lib/server";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), familyName: z.string().trim().min(1).max(60), profile: ProfileInput }),
  z.object({ action: z.literal("join"), code: z.string().transform(normalizeInvite).pipe(z.string().min(4, "Kode keluarga terlalu pendek.").max(16, "Kode keluarga terlalu panjang.")) }),
]);

export const POST = route(async (req) => {
  const user = await requireUser();
  const body = Body.parse(await req.json());
  if (body.action === "join") {
    const family = await one<{ id: string; name: string }>("select id, name from families where invite_code = upper($1)", [body.code]);
    if (!family) throw new HttpError(404, "Kode keluarga tidak ditemukan. Periksa lagi hurufnya, atau minta kode baru ke keluargamu.");
    await one("insert into family_members (family_id, user_id) values ($1, $2) on conflict do nothing", [family.id, user.id]);
    return { family };
  }
  const p = body.profile;
  return tx(async (c) => {
    const family = (await c.query("insert into families (name, created_by) values ($1, $2) returning id, name, invite_code", [body.familyName, user.id])).rows[0];
    await c.query("insert into family_members (family_id, user_id, role) values ($1, $2, 'admin')", [family.id, user.id]);
    const profile = (await c.query(
      `insert into profiles (family_id, nama, panggilan, usia, untuk, kondisi, alergen, diabetes_tipe, insulin, catatan_dokter, obat,
         kontak_nama, kontak_telepon, kondisi_lain, obat_lain, alergen_lain)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) returning *`,
      [family.id, p.nama, p.panggilan, p.usia, p.untuk, p.kondisi, p.alergen, p.diabetes_tipe, p.insulin, p.catatan_dokter, p.obat,
        p.kontak_nama, p.kontak_telepon, p.kondisi_lain, p.obat_lain, p.alergen_lain],
    )).rows[0];
    // nomor WA yang sudah terhubung sebelum profil dibuat → milik profil pertama ini
    await c.query("update users set self_profile_id = $2 where id = $1 and phone is not null and self_profile_id is null", [user.id, profile.id]);
    return { family, profile };
  });
});
