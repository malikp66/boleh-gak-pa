import { z } from "zod";

/** Naikkan versi ini kalau isi persetujuan data berubah; pengguna akan diminta setuju lagi. */
export const CONSENT_VERSION = "2026-10-05";

export const ProfileInput = z.object({
  nama: z.string().trim().min(1).max(40),
  panggilan: z.string().trim().min(1).max(20),
  usia: z.number().int().min(1).max(120).nullable(),
  untuk: z.enum(["diri", "orang_tua", "pasangan", "anak", "lainnya"]).default("diri"),
  kondisi: z.array(z.enum(["diabetes", "hipertensi", "asam_urat", "kolesterol", "stroke_jantung", "darah_rendah", "alergi", "sehat"])).min(1).max(8)
    .refine((k) => !(k.includes("hipertensi") && k.includes("darah_rendah")), "Darah tinggi dan darah rendah tidak bisa dipilih bersamaan"),
  alergen: z.array(z.enum(["kacang tanah", "kacang pohon", "kedelai", "susu", "telur", "gluten", "ikan", "krustasea", "moluska", "wijen"])).max(10).default([]),
  diabetes_tipe: z.enum(["pradiabetes", "tipe_2", "tipe_1", "gestasional", "tidak_tahu"]).nullable().default(null),
  insulin: z.boolean().default(false),
  catatan_dokter: z.string().max(500).default(""),
  obat: z.array(z.enum(["statin", "amlodipin", "warfarin", "antiplatelet", "metformin", "sulfonilurea", "insulin", "allopurinol"])).max(8).default([]),
  target_gula_puasa: z.number().int().min(60).max(250).nullable().default(null),
  target_gula_2jam: z.number().int().min(80).max(300).nullable().default(null),
  target_sistolik: z.number().int().min(80).max(200).nullable().default(null),
  target_diastolik: z.number().int().min(50).max(130).nullable().default(null),
  kontak_nama: z.string().trim().max(40).default(""),
  kondisi_lain: z.string().trim().max(300).default(""),
  obat_lain: z.string().trim().max(300).default(""),
  alergen_lain: z.string().trim().max(200).default(""),
  personalisasi: z.object({
    ringkasan: z.string().max(300), fokus: z.string().max(400),
    hindari: z.array(z.string().max(40)).max(15), batasi: z.array(z.string().max(40)).max(15),
    perlu_dokter: z.boolean(), sumber: z.string().max(800), dibuat: z.string().max(40),
  }).nullable().default(null),
  kontak_telepon: z.string().trim().max(20).regex(/^[0-9+\-\s]*$/, "Nomor telepon hanya angka").default(""),
});
