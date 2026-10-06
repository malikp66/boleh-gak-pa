import { z } from "zod";
import { nameProblem } from "@/lib/validation";
import { q } from "@/lib/db";
import { evalFor } from "@/lib/domain";
import { getProfile, loadProfileContext, requireUser, route } from "@/lib/server";

const level = z.enum(["rendah", "sedang", "tinggi"]);

export const GET = route(async (req) => {
  const user = await requireUser();
  const profileId = new URL(req.url).searchParams.get("profileId") ?? "";
  const { profile, foods, flare } = await loadProfileContext(user.id, profileId);
  return foods.map((f) => {
    const ev = evalFor([f], profile, Boolean(flare));
    return { ...f, status: ev.status, reason: ev.reasons[0]?.text ?? null };
  });
});

export const POST = route(async (req) => {
  const user = await requireUser();
  const b = z.object({
    profileId: z.string().uuid(),
    name: z.string().trim().toLowerCase().max(60).superRefine((v, ctx) => { const m = nameProblem(v, "Nama makanan"); if (m) ctx.addIssue({ code: "custom", message: m }); }),
    aliases: z.array(z.string().trim().toLowerCase().max(60)).max(10).default([]),
    kategori: z.string().max(40).default("Buatan keluarga"),
    bahan: z.string().max(500).default(""),
    purin: level,
    garam: level,
    karbo: level.default("sedang"),
    gula: level.default("rendah"),
    lemak: level.default("rendah"),
    alergen: z.array(z.string().max(30)).max(9).default([]),
    porsi_aman: z.string().max(200).default(""),
    trik: z.array(z.string().max(120)).max(6).default([]),
    pemicu: z.array(z.string().max(120)).max(6).default([]),
    alasan: z.string().max(400).default(""),
  }).parse(await req.json());
  const profile = await getProfile(user.id, b.profileId);
  await q(
    `insert into custom_foods (family_id, name, aliases, kategori, bahan, purin, garam, karbo, gula, lemak, alergen, porsi_aman, trik, pemicu, alasan, created_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
     on conflict (family_id, name) do update set aliases = excluded.aliases, kategori = excluded.kategori, bahan = excluded.bahan,
       purin = excluded.purin, garam = excluded.garam, karbo = excluded.karbo, gula = excluded.gula, lemak = excluded.lemak,
       alergen = excluded.alergen, porsi_aman = excluded.porsi_aman, trik = excluded.trik, pemicu = excluded.pemicu, alasan = excluded.alasan`,
    [profile.family_id, b.name, b.aliases.filter(Boolean), b.kategori, b.bahan, b.purin, b.garam, b.karbo, b.gula, b.lemak,
      b.alergen, b.porsi_aman, b.trik.filter(Boolean), b.pemicu, b.alasan, user.id],
  );
  return { ok: true };
});
