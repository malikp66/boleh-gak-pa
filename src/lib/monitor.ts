/**
 * Penilaian catatan pemantauan. Ambang dari ADA Standards of Care 2026 (gula darah)
 * dan AHA (tensi) — lihat docs/SUMBER-GIZI.md. Tidak pernah menyarankan obat/dosis.
 */
export type Level = "aman" | "perhatian" | "bahaya";
export interface Reading { level: Level; label: string; advice: string }

export const GLUCOSE_CONTEXTS = ["puasa", "sebelum makan", "2 jam setelah makan", "sebelum tidur", "acak"] as const;

export function glucose(mgdl: number, context: string, tipe?: string | null): Reading {
  if (mgdl < 54) return { level: "bahaya", label: "Hipoglikemia berat", advice: "Segera makan/minum gula cepat dan minta bantuan orang terdekat. Hubungi dokter atau ke IGD." };
  if (mgdl < 70) return { level: "bahaya", label: "Gula darah rendah", advice: "Makan/minum 15 g gula cepat (mis. ½ gelas jus atau teh manis), cek ulang 15 menit lagi. Kalau masih < 70, ulangi dan hubungi dokter." };
  if (mgdl > 250) return { level: "bahaya", label: "Sangat tinggi", advice: "Minum air putih dan hubungi dokter, terutama jika sedang sakit, mual, atau muntah." };
  const fasting = context === "puasa" || context === "sebelum makan";
  const after = context === "2 jam setelah makan";
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

export function bloodPressure(sys: number, dia: number): Reading {
  if (sys >= 180 || dia >= 120) {
    return { level: "bahaya", label: "Sangat tinggi", advice: "Duduk tenang 5 menit lalu ukur ulang. Kalau tetap setinggi ini, atau ada nyeri dada, sesak, lemah/kesemutan, bicara pelo, atau pandangan kabur: segera ke IGD." };
  }
  if (sys >= 140 || dia >= 90) return { level: "perhatian", label: "Hipertensi derajat 2", advice: "Kurangi garam hari ini dan catat terus. Bicarakan dengan dokter kalau sering setinggi ini." };
  if (sys >= 130 || dia >= 80) return { level: "perhatian", label: "Hipertensi derajat 1", advice: "Jaga garam dan aktivitas fisik. Pantau rutin." };
  if (sys >= 120) return { level: "aman", label: "Sedikit di atas normal", advice: "Pertahankan pola makan rendah garam." };
  if (sys < 90 || dia < 60) return { level: "perhatian", label: "Rendah", advice: "Kalau pusing atau lemas, duduk/berbaring dan minum air. Hubungi dokter kalau sering terjadi." };
  return { level: "aman", label: "Normal", advice: "Bagus, pertahankan." };
}
