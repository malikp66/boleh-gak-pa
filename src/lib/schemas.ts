import { z } from "zod";

/** Naikkan versi ini kalau isi persetujuan data berubah; pengguna akan diminta setuju lagi. */
export const CONSENT_VERSION = "2026-10-05";

export const KONDISI = ["asam urat (gout)", "darah tinggi (hipertensi)"] as const;

export const ProfileInput = z.object({
  nama: z.string().trim().min(1).max(40),
  panggilan: z.string().trim().min(1).max(20),
  usia: z.number().int().min(1).max(120).nullable(),
  kondisi: z.array(z.string().max(40)).max(6),
  catatan_dokter: z.string().max(500).default(""),
});
