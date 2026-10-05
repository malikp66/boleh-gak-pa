import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { SUPABASE_PUBLIC_KEY, SUPABASE_URL } from "./env";

/** Klien atas nama pengguna yang login. Semua query lewat RLS. */
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(toSet) {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // dipanggil dari Server Component: sesi disegarkan oleh proxy.ts
        }
      },
    },
  });
}

/** Klien server dengan kunci rahasia: HANYA untuk ai_cache. Jangan pernah dipakai untuk data keluarga. */
export function createAdminClient() {
  const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) return null;
  return createPlainClient(SUPABASE_URL, secret, { auth: { persistSession: false } });
}
