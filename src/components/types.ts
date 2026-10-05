export type Status = "hijau" | "kuning" | "merah";

export interface Profile {
  id: string;
  family_id: string;
  nama: string;
  panggilan: string;
  usia: number | null;
  kondisi: string[];
  catatan_dokter: string;
}

export interface Me {
  user: { id: string; email: string; name: string };
  families: { id: string; name: string; invite_code: string }[];
  profiles: Profile[];
  consented: boolean;
  ai: { provider: string; model: string; ready: boolean };
}

export interface FoodItem {
  id?: string;
  name: string;
  aliases: string[];
  kategori: string;
  purin: string;
  garam: string;
  porsi_aman: string;
  custom?: boolean;
  status: Status;
}

export interface AssessResult {
  headline: string;
  portion: string;
  tips: string[];
  refusals: { label: string; text: string }[];
  if_forced: string;
  why: string;
  status: Status;
  food: string;
  purin: string | null;
  garam: string | null;
  in_table: boolean;
  flare_active: boolean;
  components: { name: string; purin: string; garam: string; status: Status; matched: string }[];
  source: "cache" | "ai" | "tabel";
  model: string | null;
  elapsed?: number;
}

export interface Meal { id: string; at: string; food: string; portion: string; status: Status; purin: string | null; garam: string | null }

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
