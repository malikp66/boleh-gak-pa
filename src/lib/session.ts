"use client";
import { createClient } from "./supabase/client";

/**
 * Pastikan perangkat ini punya akun: kalau belum, buat akun anonim (user ID unik, data di cloud).
 * Juga minta browser menyimpan data secara permanen supaya sesi tidak dibuang otomatis.
 */
export async function ensureSession() {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    const { error } = await supabase.auth.signInAnonymously();
    if (error) throw new Error("Gagal menyiapkan akun. Periksa koneksi lalu coba lagi.");
  }
  try {
    await navigator.storage?.persist?.();
  } catch {}
}

/** Tingkatkan akun anonim ke akun Google. User ID tetap sama, jadi semua data ikut tanpa merge. */
export async function secureWithGoogle() {
  const { error } = await createClient().auth.linkIdentity({
    provider: "google",
    options: { redirectTo: `${location.origin}/auth/callback?next=/` },
  });
  if (error) throw error;
}
