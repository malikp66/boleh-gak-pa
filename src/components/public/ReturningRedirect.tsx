"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isStandalone } from "@/lib/install";

/**
 * Halaman beranda publik dilihat tamu baru & mesin pencari. Pengguna yang sudah pernah memakai
 * (aplikasi terpasang, atau masih punya cadangan kunci di HP) langsung diteruskan ke aplikasi.
 */
export default function ReturningRedirect() {
  const router = useRouter();
  useEffect(() => {
    let returning = false;
    try { returning = Boolean(localStorage.getItem("bgy-backup")); } catch {}
    if (returning || isStandalone()) router.replace("/mulai");
  }, [router]);
  return null;
}
