import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Upstash Redis (HTTP, cocok untuk serverless Vercel). OPSIONAL:
 * tanpa UPSTASH_REDIS_REST_URL/TOKEN semua fungsi di bawah jatuh ke perilaku lama (Postgres / tanpa cache),
 * jadi aplikasi tetap jalan di lokal maupun saat Redis bermasalah.
 *
 * Dipakai untuk: cache /api/me, jatah AI harian, cache jawaban AI, daftar makanan hasil belajar,
 * anggaran AI bulanan, cache Open Food Facts, dan rate limit.
 */
const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;
export const redis = url && token ? new Redis({ url, token, automaticDeserialization: true }) : null;

const PREFIX = "bgy:"; // satu database bisa dipakai beberapa aplikasi
export const k = (...parts: (string | number)[]) => PREFIX + parts.join(":");

/** Jalankan perintah Redis; kalau Redis tidak ada atau gagal, kembalikan `fallback` (aplikasi tidak boleh ikut gagal). */
export async function safe<T>(fn: (r: Redis) => Promise<T>, fallback: T): Promise<T> {
  if (!redis) return fallback;
  try {
    return await fn(redis);
  } catch (e) {
    console.warn("redis:", (e as Error).message);
    return fallback;
  }
}

/** Cache-aside: ambil dari Redis, kalau tidak ada hitung dengan `load` lalu simpan selama `ttl` detik. */
export async function cached<T>(key: string, ttl: number, load: () => Promise<T>): Promise<T> {
  const hit = await safe((r) => r.get<T>(key), null);
  if (hit !== null && hit !== undefined) return hit;
  const value = await load();
  if (value !== undefined) void safe((r) => r.set(key, value, { ex: ttl }), null);
  return value;
}

export const forget = (...keys: string[]) => (keys.length ? safe((r) => r.del(...keys), 0) : Promise.resolve(0));

/** Tanggal hari ini menurut WIB (YYYY-MM-DD), dipakai untuk kunci harian. */
export const wibDay = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);

// ---------------------------------------------------------------- rate limit
const limiters = new Map<string, Ratelimit>();
function limiter(name: string, tokens: number, window: Parameters<typeof Ratelimit.slidingWindow>[1]) {
  if (!redis) return null;
  let l = limiters.get(name);
  if (!l) {
    l = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(tokens, window), prefix: k("rl", name), ephemeralCache: new Map(), timeout: 1500 });
    limiters.set(name, l);
  }
  return l;
}

/**
 * Batasi laju per kunci (pengguna/IP). Mengembalikan null kalau boleh lanjut,
 * atau jumlah detik sampai boleh mencoba lagi. Tanpa Redis selalu boleh (rem lain di Postgres tetap jalan).
 */
export async function throttle(name: keyof typeof RATES, id: string): Promise<number | null> {
  const [tokens, window] = RATES[name];
  const l = limiter(name, tokens, window);
  if (!l) return null;
  try {
    const r = await l.limit(id);
    return r.success ? null : Math.max(1, Math.ceil((r.reset - Date.now()) / 1000));
  } catch {
    return null;
  }
}

export const RATES = {
  /** tanya "Boleh gak?" beruntun (melindungi biaya AI dari skrip/klik berulang) */
  assess: [12, "1 m"],
  /** kenali foto beruntun */
  photo: [4, "1 m"],
  /** HP baru dari satu jaringan (mencegah akun massal untuk mengakali jatah AI) */
  device: [20, "1 d"],
  /** kode "Masuk dengan WhatsApp" */
  wa_link: [6, "1 h"],
  /** pulihkan dengan kode (mencegah tebak-tebakan kode) */
  restore: [10, "15 m"],
} as const satisfies Record<string, readonly [number, Parameters<typeof Ratelimit.slidingWindow>[1]]>;
