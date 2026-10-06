export type Status = "hijau" | "kuning" | "merah";

export interface Profile {
  id: string;
  family_id: string;
  nama: string;
  panggilan: string;
  usia: number | null;
  untuk: string;
  kondisi: string[];
  alergen: string[];
  diabetes_tipe: string | null;
  insulin: boolean;
  catatan_dokter: string;
  obat: string[];
  target_gula_puasa: number | null;
  target_gula_2jam: number | null;
  target_sistolik: number | null;
  target_diastolik: number | null;
  kontak_nama: string;
  kontak_telepon: string;
  kondisi_lain: string;
  obat_lain: string;
  alergen_lain: string;
  personalisasi: Personalisasi | null;
}

export interface Personalisasi {
  ringkasan: string; fokus: string; hindari: string[]; batasi: string[]; perlu_dokter: boolean; sumber: string; dibuat: string;
}

export interface Me {
  user: { id: string };
  families: { id: string; name: string; invite_code: string }[];
  profiles: Profile[];
  consented: boolean;
  ai: { provider: string; model: string; ready: boolean };
  wa: { available: boolean; phone: string | null; profileId: string | null };
}

export interface FoodItem {
  ai?: boolean;
  id?: string;
  name: string;
  aliases: string[];
  kategori: string;
  purin: string;
  garam: string;
  karbo?: string;
  gula?: string;
  lemak?: string;
  ig?: string | null;
  alergen?: string[];
  porsi_aman: string;
  custom?: boolean;
  status: Status;
  reason: string | null;
}

export interface AssessResult {
  checkId?: string;
  /** makanan baru yang barusan dinilai AI & disimpan */
  learned?: boolean;
  /** nilai gizi dari perkiraan AI (belum dicek manusia) */
  estimated?: boolean;
  headline: string;
  portion: string;
  tips: string[];
  refusals: { label: string; text: string }[];
  if_forced: string;
  why: string;
  status: Status;
  reasons: { condition: string; status: Status; text: string }[];
  food: string;
  nutrients: { purin: string; garam: string; karbo: string | null; gula: string | null; lemak: string | null; ig: string | null } | null;
  alergen: string[];
  in_table: boolean;
  flare_active: boolean;
  components: { name: string; garam: string; karbo: string | null; status: Status; matched: string }[];
  source: "cache" | "ai" | "tabel";
  model: string | null;
  elapsed?: number;
}

export interface Meal { id: string; at: string; food: string; portion: string; status: Status; purin: string | null; garam: string | null; karbo: string | null; gula: string | null }

export interface HealthLog { id: string; at: string; kind: "gula_darah" | "tensi"; value1: number; value2: number | null; context: string; note: string }

export interface Flare {
  id: string; started: string; ended: string | null; joint: string; pain: number; fever: boolean;
  pains: { pain: number; at: string }[];
}

export interface Recovery {
  history_count: number; basis: string; typical_days: number | null; range: number[];
  red_flags: string[]; active: boolean; day: number; trend: null | "membaik" | "memburuk" | "sama";
  current_pain: number; remaining: [number, number];
}

export interface Review {
  week: { meals: number; status: Record<Status, number>; garam_tinggi: number };
  triggers: { flares: number; suspects: { food: string; count: number }[] };
  recovery: Recovery;
  summary: string | null;
}

export interface PendingCheck { id: string; food: string; status: Status; note: string; created_at: string }
