import "server-only";
import { NextResponse } from "next/server";
import { ZodError, z } from "zod";
import { AIUnavailableError } from "./ai";
import { AssessAI, FlareSummary, Profile } from "./domain";
import { FOODS } from "./foods/match";
import { Food } from "./foods/types";
import { createAdminClient, createClient } from "./supabase/server";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Bungkus route handler: galat → JSON yang rapi, tanpa membocorkan detail internal. */
export function route<C>(fn: (req: Request, ctx: C) => Promise<unknown>) {
  return async (req: Request, ctx: C) => {
    try {
      return NextResponse.json(await fn(req, ctx));
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
      if (e instanceof ZodError) return NextResponse.json({ error: "Input tidak valid" }, { status: 400 });
      if (e instanceof AIUnavailableError) return NextResponse.json({ error: e.message }, { status: 503 });
      console.error(e);
      return NextResponse.json({ error: "Terjadi kesalahan di server" }, { status: 500 });
    }
  };
}

export async function requireUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new HttpError(401, "Silakan login dulu");
  return { supabase, user: data.user };
}

type Supa = Awaited<ReturnType<typeof createClient>>;

/** Profil + makanan (tabel + buatan keluarga) + kambuh aktif. RLS menolak profil keluarga lain. */
export async function loadProfileContext(supabase: Supa, profileId: string) {
  z.string().uuid().parse(profileId);
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", profileId).maybeSingle();
  if (!profile) throw new HttpError(404, "Profil tidak ditemukan");

  const [{ data: custom }, { data: flare }] = await Promise.all([
    supabase.from("custom_foods").select("*").eq("family_id", profile.family_id).order("created_at", { ascending: false }),
    supabase.from("flares").select("*").eq("profile_id", profileId).is("ended", null).maybeSingle(),
  ]);
  const foods: Food[] = [...(custom ?? []).map((c) => ({ ...c, custom: true }) as Food), ...FOODS];
  return { profile: profile as Profile, foods, flare: flare as (FlareSummary & { id: string; fever: boolean }) | null };
}

const LIMITS: Record<string, number> = {
  assess: Number(process.env.AI_LIMIT_ASSESS ?? 30),
  photo: Number(process.env.AI_LIMIT_PHOTO ?? 8),
  analyze: Number(process.env.AI_LIMIT_ANALYZE ?? 10),
  summary: Number(process.env.AI_LIMIT_SUMMARY ?? 3),
};

/** Kuota AI harian per pengguna. Dipanggil hanya saat benar-benar akan memanggil model. */
export function quota(supabase: Supa, kind: keyof typeof LIMITS) {
  return async () => {
    const { data, error } = await supabase.rpc("consume_ai_quota", { p_kind: kind, p_limit: LIMITS[kind] });
    if (error) {
      console.error("quota:", error.message);
      return false;
    }
    return Boolean(data);
  };
}

export async function requireQuota(supabase: Supa, kind: keyof typeof LIMITS) {
  if (!(await quota(supabase, kind)())) {
    throw new HttpError(429, "Jatah AI hari ini sudah habis. Coba lagi besok, atau ketik nama makanannya.");
  }
}

/** Cache jawaban AI (teks saran umum, tanpa data pribadi) — ditulis lewat service role. */
export function aiCache() {
  const admin = createAdminClient();
  return {
    async get(key: string): Promise<AssessAI | null> {
      if (!admin) return null;
      const { data } = await admin.from("ai_cache").select("response").eq("key", key).maybeSingle();
      return (data?.response as AssessAI) ?? null;
    },
    async set(key: string, response: AssessAI, model: string) {
      if (!admin) return;
      await admin.from("ai_cache").upsert({ key, response, model });
    },
  };
}

export const todayStartISO = () => {
  // awal hari menurut WIB, supaya "hari ini" sesuai jam keluarga di Indonesia
  const now = new Date();
  const wib = new Date(now.getTime() + 7 * 3600_000);
  wib.setUTCHours(0, 0, 0, 0);
  return new Date(wib.getTime() - 7 * 3600_000).toISOString();
};
