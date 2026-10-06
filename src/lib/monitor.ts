/**
 * Penilaian catatan pemantauan. Ambang dari ADA Standards of Care 2026 (gula darah)
 * dan AHA (tensi) — lihat docs/SUMBER-GIZI.md. Tidak pernah menyarankan obat/dosis.
 */
export type Level = "aman" | "perhatian" | "bahaya";
export interface Reading { level: Level; label: string; advice: string }

export const GLUCOSE_CONTEXTS = ["puasa", "sebelum makan", "2 jam setelah makan", "sebelum tidur", "acak"] as const;

export interface Targets {
  gulaPuasa?: number | null;
  gula2jam?: number | null;
  sistolik?: number | null;
  diastolik?: number | null;
}

export function glucose(mgdl: number, context: string, tipe?: string | null, t: Targets = {}): Reading {
  if (mgdl < 54) return { level: "bahaya", label: "Hipoglikemia berat", advice: "Segera makan/minum gula cepat dan minta bantuan orang terdekat. Hubungi dokter atau ke IGD." };
  if (mgdl < 70) return { level: "bahaya", label: "Gula darah rendah", advice: "Makan/minum 15 g gula cepat (mis. ½ gelas jus atau teh manis), cek ulang 15 menit lagi. Kalau masih < 70, ulangi dan hubungi dokter." };
  if (mgdl > 250) return { level: "bahaya", label: "Sangat tinggi", advice: "Minum air putih dan hubungi dokter, terutama jika sedang sakit, mual, atau muntah." };
  const fasting = context === "puasa" || context === "sebelum makan";
  const after = context === "2 jam setelah makan";
  // target dari dokter selalu didahulukan
  if ((fasting && t.gulaPuasa) || (after && t.gula2jam)) {
    const max = fasting ? t.gulaPuasa! : t.gula2jam!;
    return mgdl > max
      ? { level: "perhatian", label: `Di atas target dokter (≤ ${max})`, advice: "Perhatikan porsi karbohidrat makan berikutnya. Kalau sering di atas target, kabari dokter." }
      : { level: "aman", label: `Sesuai target dokter (≤ ${max})`, advice: "Bagus, pertahankan." };
  }
  if (tipe === "gestasional") {
    // target ADA untuk diabetes kehamilan: puasa < 95, 2 jam setelah makan < 120
    if ((fasting && mgdl >= 95) || (after && mgdl >= 120) || (!fasting && !after && mgdl >= 140)) {
      return { level: "perhatian", label: "Di atas target kehamilan", advice: "Target saat hamil lebih ketat. Catat terus dan bicarakan dengan dokter kandungan/ahli gizi." };
    }
    return { level: "aman", label: "Dalam target kehamilan", advice: "Bagus, pertahankan." };
  }
  // target umum ADA: sebelum makan 80–130, 1–2 jam setelah makan < 180 (target pribadi bisa berbeda, ikuti dokter)
  if ((fasting && mgdl > 130) || (after && mgdl >= 180) || (!fasting && !after && mgdl >= 200)) {
    return { level: "perhatian", label: "Di atas target umum", advice: "Perhatikan porsi karbohidrat makan berikutnya. Ikuti target dari dokter kalau berbeda." };
  }
  return { level: "aman", label: "Dalam target umum", advice: "Bagus, pertahankan." };
}

export function bloodPressure(sys: number, dia: number, t: Targets = {}, lowBP = false): Reading {
  if (sys >= 180 || dia >= 120) {
    return { level: "bahaya", label: "Sangat tinggi", advice: "Duduk tenang 5 menit lalu ukur ulang. Kalau tetap setinggi ini, atau ada nyeri dada, sesak, lemah/kesemutan, bicara pelo, atau pandangan kabur: segera ke IGD (telepon 119)." };
  }
  if (sys < 90 || dia < 60) {
    return {
      level: lowBP && sys >= 80 ? "perhatian" : sys < 80 ? "bahaya" : "perhatian",
      label: sys < 80 ? "Sangat rendah" : "Rendah",
      advice: sys < 80
        ? "Berbaring dengan kaki ditinggikan dan minum air. Kalau pingsan, bingung, atau nyeri dada: hubungi 119."
        : "Kalau pusing atau lemas: duduk/berbaring, minum air, dan bangun pelan-pelan. Hubungi dokter kalau sering terjadi.",
    };
  }
  if (t.sistolik && t.diastolik) {
    return sys > t.sistolik || dia > t.diastolik
      ? { level: "perhatian", label: `Di atas target dokter (≤ ${t.sistolik}/${t.diastolik})`, advice: "Kurangi garam hari ini dan catat terus. Kabari dokter kalau sering di atas target." }
      : { level: "aman", label: `Sesuai target dokter (≤ ${t.sistolik}/${t.diastolik})`, advice: "Bagus, pertahankan." };
  }
  if (sys >= 140 || dia >= 90) return { level: "perhatian", label: "Hipertensi derajat 2", advice: "Kurangi garam hari ini dan catat terus. Bicarakan dengan dokter kalau sering setinggi ini." };
  if (sys >= 130 || dia >= 80) return { level: "perhatian", label: "Hipertensi derajat 1", advice: "Jaga garam dan aktivitas fisik. Pantau rutin." };
  if (sys >= 120) return { level: "aman", label: "Sedikit di atas normal", advice: "Pertahankan pola makan rendah garam." };
  return { level: "aman", label: "Normal", advice: "Bagus, pertahankan." };
}
