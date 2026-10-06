import "server-only";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { ZodError, z } from "zod";
import { AIUnavailableError, estimateUSD, onBudgetCheck, onSpend } from "./ai";
import { one, q } from "./db";
import { formatKey, generateKey, hashKey, isValidKey, normalizeKey } from "./device-key";
import { AssessAI, FlareSummary, Profile } from "./domain";
import { FOODS } from "./foods/match";
import { Food } from "./foods/types";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Bungkus route handler: galat → JSON yang rapi, tanpa membocorkan detail internal. */
const FIELD: Record<string, string> = {
  nama: "Nama", panggilan: "Nama panggilan", usia: "Usia", kondisi: "Kondisi", alergen: "Alergi", obat: "Obat",
  kontak_nama: "Nama kontak darurat", kontak_telepon: "Nomor telepon", catatan_dokter: "Catatan dokter",
  target_gula_puasa: "Target gula puasa", target_gula_2jam: "Target gula 2 jam", target_sistolik: "Target tensi atas",
  target_diastolik: "Target tensi bawah", food: "Nama makanan", name: "Nama makanan", value1: "Angka", value2: "Tensi bawah",
  joint: "Sendi", pain: "Tingkat nyeri", code: "Kode", text: "Teks",
};

/** Pesan zod → kalimat yang bisa dipahami pengguna. Pesan buatan kita (custom) dipakai apa adanya. */
function zodMessage(e: ZodError): string {
  const issue = e.issues[0];
  if (!issue) return "Isian belum lengkap.";
  // pesan yang kita tulis sendiri (custom, atau .min(…, "pesan")) dipakai apa adanya; pesan bawaan zod berbahasa Inggris diganti
  if (issue.code === "custom" || (issue.message && !/^(Too (small|big)|Invalid|Expected|Required)/i.test(issue.message))) return issue.message;
  const key = [...issue.path].reverse().find((p) => typeof p === "string") as string | undefined;
  const label = key ? FIELD[key] ?? key : "Isian";
  if (issue.code === "too_small") return issue.origin === "string" ? `${label} wajib diisi atau terlalu pendek.` : issue.origin === "array" ? `${label}: pilih minimal ${issue.minimum}.` : `${label} terlalu kecil (minimal ${issue.minimum}).`;
  if (issue.code === "too_big") return issue.origin === "string" ? `${label} terlalu panjang (maksimal ${issue.maximum} huruf).` : `${label} terlalu besar (maksimal ${issue.maximum}).`;
  if (issue.code === "invalid_type") return `${label} belum diisi dengan benar.`;
  if (issue.code === "invalid_value") return `${label}: pilihan tidak dikenal.`;
  return issue.message && !/^Invalid/i.test(issue.message) ? issue.message : `${label} tidak valid.`;
}

export function route<C>(fn: (req: Request, ctx: C) => Promise<unknown>) {
  return async (req: Request, ctx: C) => {
    try {
      const out = await fn(req, ctx);
      return out instanceof Response ? out : NextResponse.json(out);
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
      if (e instanceof ZodError) return NextResponse.json({ error: zodMessage(e) }, { status: 400 });
      if (e instanceof AIUnavailableError) return NextResponse.json({ error: e.message }, { status: 503 });
      console.error(e);
      return NextResponse.json({ error: "Terjadi kesalahan di server" }, { status: 500 });
    }
  };
}

// ---------------------------------------------------------------- identitas perangkat
const COOKIE = "bgy_key";
const COOKIE_MAX_AGE = 400 * 24 * 3600; // batas maksimum cookie di browser modern
const DEVICES_PER_IP_PER_DAY = Number(process.env.DEVICES_PER_IP_PER_DAY ?? 20);

export interface User { id: string }

async function setKeyCookie(key: string) {
  (await cookies()).set(COOKIE, key, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: COOKIE_MAX_AGE,
  });
}

async function userByKey(key: string | undefined): Promise<User | null> {
  if (!key) return null;
  const k = normalizeKey(key);
  if (!isValidKey(k)) return null;
  const h = hashKey(k);
  // HP utama akun, atau HP tambahan yang masuk lewat WhatsApp (user_devices)
  return one<User>(
    `update users set last_seen = now()
     where id = coalesce((select id from users where device_key_hash = $1), (select user_id from user_devices where key_hash = $1))
     returning id`,
    [h],
  );
}

export async function currentUser(): Promise<User | null> {
  return userByKey((await cookies()).get(COOKIE)?.value);
}

export async function requireUser(): Promise<User> {
  const user = await currentUser();
  if (!user) throw new HttpError(401, "Perangkat belum terdaftar");
  return user;
}

/** Kode pemulihan untuk perangkat ini (dibaca dari cookie, tidak pernah disimpan polos di database). */
export async function recoveryCode(): Promise<string> {
  const key = (await cookies()).get(COOKIE)?.value;
  if (!key || !(await userByKey(key))) throw new HttpError(401, "Perangkat belum terdaftar");
  return formatKey(normalizeKey(key));
}

/**
 * Pastikan perangkat punya akun: cookie yang valid → pakai; cadangan dari browser yang valid → pulihkan;
 * selain itu buat akun baru. Kunci baru dikembalikan supaya browser bisa menyimpan cadangan.
 */
export async function ensureDevice(backup?: string): Promise<{ status: "ok" | "restored" | "created"; key?: string }> {
  if (await currentUser()) return { status: "ok" };
  if (backup && (await userByKey(backup))) {
    await setKeyCookie(normalizeKey(backup));
    return { status: "restored" };
  }
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  const ipHash = createHash("sha256").update(`ip:${ip}`).digest("hex");
  const row = await one<{ count: number }>(
    `insert into device_creations (ip_hash, day, count) values ($1, current_date, 1)
     on conflict (ip_hash, day) do update set count = device_creations.count + 1 returning count`,
    [ipHash],
  );
  if ((row?.count ?? 0) > DEVICES_PER_IP_PER_DAY) throw new HttpError(429, "Terlalu banyak perangkat baru dari jaringan ini hari ini. Coba lagi besok.");
  const key = generateKey();
  await q("insert into users (device_key_hash) values ($1)", [hashKey(key)]);
  await setKeyCookie(key);
  return { status: "created", key };
}

/** Pindah ke akun lain memakai kode pemulihan. */
export async function restoreWithCode(code: string) {
  const k = normalizeKey(code);
  if (!isValidKey(k) || !(await userByKey(k))) throw new HttpError(404, "Kode pemulihan tidak ditemukan. Periksa lagi ketikannya.");
  await setKeyCookie(k);
}

// ---------------------------------------------------------------- hak akses keluarga
export async function assertFamily(userId: string, familyId: string) {
  z.string().uuid().parse(familyId);
  const ok = await one("select 1 from family_members where family_id = $1 and user_id = $2", [familyId, userId]);
  if (!ok) throw new HttpError(404, "Keluarga tidak ditemukan");
}

/** Profil yang boleh diakses pengguna ini (anggota keluarganya), atau 404. */
export async function getProfile(userId: string, profileId: string): Promise<Profile> {
  z.string().uuid().parse(profileId);
  const p = await one<Profile>(
    `select p.* from profiles p join family_members m on m.family_id = p.family_id and m.user_id = $2 where p.id = $1`,
    [profileId, userId],
  );
  if (!p) throw new HttpError(404, "Profil tidak ditemukan");
  return p;
}

/** Profil + makanan (tabel + buatan keluarga) + kambuh aktif. */
export async function loadProfileContext(userId: string, profileId: string) {
  const profile = await getProfile(userId, profileId);
  const [custom, flare] = await Promise.all([
    q<Food>("select * from custom_foods where family_id = $1 order by created_at desc", [profile.family_id]),
    one<FlareSummary & { id: string; fever: boolean }>("select * from flares where profile_id = $1 and ended is null", [profile.id]),
  ]);
  const foods: Food[] = [...custom.map((c) => ({ ...c, custom: true })), ...FOODS];
  return { profile, foods, flare };
}

// ---------------------------------------------------------------- kuota & cache AI
const LIMITS = {
  assess: Number(process.env.AI_LIMIT_ASSESS ?? 30),
  photo: Number(process.env.AI_LIMIT_PHOTO ?? 8),
  analyze: Number(process.env.AI_LIMIT_ANALYZE ?? 10),
  summary: Number(process.env.AI_LIMIT_SUMMARY ?? 3),
  tts: Number(process.env.AI_LIMIT_TTS ?? 40),
};
type QuotaKind = keyof typeof LIMITS;

/** Pakai satu jatah AI harian (hari menurut WIB). Dipanggil hanya saat benar-benar memanggil model. */
export function quota(userId: string, kind: QuotaKind) {
  return async () => {
    const row = await one<{ count: number }>(
      `insert into ai_usage (user_id, day, kind, count) values ($1, (now() at time zone 'Asia/Jakarta')::date, $2, 1)
       on conflict (user_id, day, kind) do update set count = ai_usage.count + 1 returning count`,
      [userId, kind],
    );
    return (row?.count ?? Infinity) <= LIMITS[kind];
  };
}

export async function requireQuota(userId: string, kind: QuotaKind) {
  if (!(await quota(userId, kind)())) {
    throw new HttpError(429, "Jatah AI hari ini sudah habis. Coba lagi besok, atau ketik nama makanannya.");
  }
}

/** Cache jawaban AI (teks saran umum, tanpa data pribadi). */
export function aiCache() {
  return {
    async get(key: string): Promise<AssessAI | null> {
      return (await one<{ response: AssessAI }>("select response from ai_cache where key = $1", [key]))?.response ?? null;
    },
    async set(key: string, response: AssessAI, model: string) {
      await q("insert into ai_cache (key, response, model) values ($1, $2, $3) on conflict (key) do nothing", [key, response, model]);
    },
  };
}

// ---------------------------------------------------------------- rem anggaran AI bulanan
const MONTHLY_BUDGET = Number(process.env.AI_MONTHLY_BUDGET_USD ?? 5);
let budgetCache: { at: number; spent: number } | null = null;

onSpend(async (model, input, output) => {
  const usd = estimateUSD(model, input, output);
  await q(
    `insert into ai_spend (day, model, calls, input_tokens, output_tokens, est_usd)
     values ((now() at time zone 'Asia/Jakarta')::date, $1, 1, $2, $3, $4)
     on conflict (day, model) do update set calls = ai_spend.calls + 1, input_tokens = ai_spend.input_tokens + $2,
       output_tokens = ai_spend.output_tokens + $3, est_usd = ai_spend.est_usd + $4`,
    [model, input, output, usd],
  );
  if (budgetCache) budgetCache.spent += usd;
});

onBudgetCheck(async () => {
  if (!budgetCache || Date.now() - budgetCache.at > 60_000) {
    const row = await one<{ spent: string }>(
      `select coalesce(sum(est_usd), 0) as spent from ai_spend
       where day >= date_trunc('month', now() at time zone 'Asia/Jakarta')::date`,
    );
    budgetCache = { at: Date.now(), spent: Number(row?.spent ?? 0) };
  }
  if (budgetCache.spent >= MONTHLY_BUDGET) {
    throw new AIUnavailableError("Anggaran AI bulan ini sudah tercapai; sementara memakai tabel saja.");
  }
});

export const todayStartISO = () => {
  // awal hari menurut WIB, supaya "hari ini" sesuai jam pengguna di Indonesia
  const wib = new Date(Date.now() + 7 * 3600_000);
  wib.setUTCHours(0, 0, 0, 0);
  return new Date(wib.getTime() - 7 * 3600_000).toISOString();
};
