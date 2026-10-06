import { z } from "zod";

/** Naikkan versi ini kalau isi persetujuan data berubah; pengguna akan diminta setuju lagi. */
export const CONSENT_VERSION = "2026-10-05";

export const ProfileInput = z.object({
  nama: z.string().trim().min(1).max(40),
  panggilan: z.string().trim().min(1).max(20),
  usia: z.number().int().min(1).max(120).nullable(),
  untuk: z.enum(["diri", "orang_tua", "pasangan", "anak", "lainnya"]).default("diri"),
  kondisi: z.array(z.enum(["diabetes", "hipertensi", "asam_urat", "kolesterol", "alergi", "sehat"])).min(1).max(6),
  alergen: z.array(z.enum(["kacang tanah", "kacang pohon", "kedelai", "susu", "telur", "gluten", "ikan", "krustasea", "moluska"])).max(9).default([]),
  diabetes_tipe: z.enum(["pradiabetes", "tipe_2", "tipe_1", "gestasional", "tidak_tahu"]).nullable().default(null),
  insulin: z.boolean().default(false),
  catatan_dokter: z.string().max(500).default(""),
});
