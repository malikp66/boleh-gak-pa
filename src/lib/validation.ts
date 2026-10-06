/**
 * Aturan isian yang dipakai DUA KALI: di form (supaya pesan langsung muncul)
 * dan di server lewat zod (supaya tidak bisa dilewati dengan memanggil API langsung).
 * Setiap fungsi mengembalikan pesan galat dalam bahasa sehari-hari, atau null kalau aman.
 */

const LETTER = /\p{L}/u;

export function nameProblem(s: string | undefined | null, label = "Nama"): string | null {
  const v = (s ?? "").trim();
  if (!v) return `${label} wajib diisi.`;
  if (v.length < 2) return `${label} minimal 2 huruf.`;
  if (v.length > 40) return `${label} maksimal 40 huruf.`;
  if (!LETTER.test(v)) return `${label} harus berisi huruf.`;
  return null;
}

/** Nomor HP Indonesia → bentuk 08…; null kalau tidak valid. Menerima 08…, 628…, +62 8…, spasi & tanda strip. */
export function normalizePhone(s: string): string | null {
  const raw = s.trim();
  if (!/^\+?[0-9\s\-().]+$/.test(raw)) return null;
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("62")) d = "0" + d.slice(2);
  if (!/^0\d{8,13}$/.test(d)) return null; // 9–14 digit termasuk 0 di depan (HP & telepon rumah)
  return d;
}

export function phoneProblem(s: string | undefined | null): string | null {
  const v = (s ?? "").trim();
  if (!v) return null;
  return normalizePhone(v) ? null : "Nomor telepon tidak valid. Contoh: 0812 3456 7890.";
}

export interface ProfileRulesInput {
  nama?: string;
  panggilan?: string;
  kondisi?: string[];
  alergen?: string[];
  kondisi_lain?: string;
  alergen_lain?: string;
  kontak_nama?: string;
  kontak_telepon?: string;
  target_gula_puasa?: number | null;
  target_gula_2jam?: number | null;
  target_sistolik?: number | null;
  target_diastolik?: number | null;
}

/** Semua aturan profil, termasuk yang melibatkan lebih dari satu kolom. */
export function profileProblem(p: ProfileRulesInput): string | null {
  const name = nameProblem(p.nama);
  if (name) return name;
  if (p.panggilan !== undefined && !p.panggilan.trim()) return "Nama panggilan wajib diisi.";
  const k = p.kondisi ?? [];
  if (!k.length) return "Pilih minimal satu kondisi.";
  if (k.includes("sehat") && k.length > 1) return "\"Belum ada diagnosis\" tidak bisa digabung dengan kondisi lain.";
  if (k.includes("hipertensi") && k.includes("darah_rendah")) return "Darah tinggi dan darah rendah tidak bisa dipilih bersamaan.";
  if (k.includes("alergi") && !(p.alergen ?? []).length && !/alergi\s*\S/i.test(p.kondisi_lain ?? "") && !(p.alergen_lain ?? "").trim()) {
    return "Pilih alerginya terhadap apa (atau tulis di kotak isian lain).";
  }
  const phone = phoneProblem(p.kontak_telepon);
  if (phone) return phone;
  if ((p.kontak_telepon ?? "").trim() && nameProblem(p.kontak_nama, "Nama kontak darurat")) return nameProblem(p.kontak_nama, "Nama kontak darurat");
  const sys = p.target_sistolik ?? null, dia = p.target_diastolik ?? null;
  if ((sys == null) !== (dia == null)) return "Isi target tensi atas dan bawah sekaligus.";
  if (sys != null && dia != null && sys <= dia) return "Target tensi atas harus lebih besar dari tensi bawah.";
  const gp = p.target_gula_puasa ?? null, g2 = p.target_gula_2jam ?? null;
  if (gp != null && g2 != null && g2 < gp) return "Target gula 2 jam setelah makan biasanya lebih tinggi dari gula puasa. Periksa lagi angkanya.";
  return null;
}

/** Batas angka yang masuk akal untuk alat ukur rumahan (di luar ini hampir pasti salah ketik). */
export const RANGES = {
  gula: [20, 600],
  sistolik: [60, 260],
  diastolik: [30, 160],
} as const;

export function healthLogProblem(kind: "gula_darah" | "tensi", v1: number | null, v2: number | null): string | null {
  if (kind === "gula_darah") {
    if (v1 == null || !Number.isFinite(v1)) return "Isi angka gula darahnya dulu ya.";
    if (v1 < RANGES.gula[0] || v1 > RANGES.gula[1]) return `Gula darah ${v1} tidak masuk akal (antara ${RANGES.gula[0]}–${RANGES.gula[1]}). Cek lagi angkanya.`;
    return null;
  }
  if (v1 == null || v2 == null || !Number.isFinite(v1) || !Number.isFinite(v2)) return "Isi tensi atas dan bawah dulu ya.";
  if (v1 < RANGES.sistolik[0] || v1 > RANGES.sistolik[1]) return `Tensi atas ${v1} tidak masuk akal (antara ${RANGES.sistolik[0]}–${RANGES.sistolik[1]}).`;
  if (v2 < RANGES.diastolik[0] || v2 > RANGES.diastolik[1]) return `Tensi bawah ${v2} tidak masuk akal (antara ${RANGES.diastolik[0]}–${RANGES.diastolik[1]}).`;
  if (v1 <= v2) return "Tensi atas harus lebih besar dari tensi bawah. Mungkin angkanya tertukar?";
  return null;
}

/** Kode undangan keluarga: huruf & angka saja, huruf besar. */
export const normalizeInvite = (s: string) => s.toUpperCase().replace(/[^0-9A-Z]/g, "");
