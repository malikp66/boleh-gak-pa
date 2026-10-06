export type Level = "rendah" | "sedang" | "tinggi";
export type Status = "hijau" | "kuning" | "merah";

export interface Food {
  id?: string;
  name: string;
  aliases: string[];
  kategori: string;
  purin: Level;
  garam: Level;
  karbo?: Level;
  gula?: Level;
  lemak?: Level;
  ig?: Level | null;
  alergen?: string[];
  porsi_aman: string;
  trik: string[];
  pemicu: string[];
  bahan?: string;
  alasan?: string;
  custom?: boolean;
  /** dinilai AI, belum dicek manusia */
  ai?: boolean;
  /** dasar perhitungan makanan hasil belajar (angka per porsi, rincian bahan, sumber) */
  basis?: FoodBasis | null;
}

export interface FoodBasis {
  sumber: "bahan" | "kemasan";
  sumber_ref: string;
  nutrisi: { porsi_g: number; karbo_g: number; gula_g: number; natrium_mg: number; lemak_jenuh_g: number; ig: number | null; cakupan: number };
  rincian: { label: string; gram: number; karbo: number; gula: number; natrium: number; lemak_jenuh: number; sumber: string }[];
}

/** Makanan hasil pencocokan teks, dengan kata yang membuatnya cocok. */
export interface MatchedFood extends Food {
  matched: string;
}

/** Gabungan beberapa makanan yang dimakan bersamaan. */
export interface CombinedFood extends Food {
  components?: MatchedFood[];
}

export const LEVEL: Record<Level, number> = { rendah: 0, sedang: 1, tinggi: 2 };
export const STATUS_ORDER: Status[] = ["hijau", "kuning", "merah"];
