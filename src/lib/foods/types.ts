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
  alergen?: string[];
  porsi_aman: string;
  trik: string[];
  pemicu: string[];
  bahan?: string;
  alasan?: string;
  custom?: boolean;
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
