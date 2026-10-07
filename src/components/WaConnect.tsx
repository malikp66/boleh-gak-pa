"use client";
import { useEffect, useState } from "react";
import { api, useToast } from "./ui";
import { ensureDevice } from "@/lib/device";
import { play } from "@/lib/sound";
import { clearMeCache } from "@/lib/me-cache";

type Result = "linked" | "merged";

/**
 * Tombol "Masuk/Hubungkan dengan WhatsApp": membuka WA berisi kode, pengguna tekan Kirim,
 * lalu halaman ini menunggu konfirmasi dari server (dicek tiap 2,5 detik dan saat kembali ke aplikasi).
 */
export default function WaConnect({ label, profileId = null, onDone }: { label: string; profileId?: string | null; onDone: (r: Result, phone?: string) => void }) {
  const toast = useToast();
  const [link, setLink] = useState<{ code: string; url: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    try {
      await ensureDevice();
      const r = await api<{ code: string; url: string }>("/api/wa/link", { profileId });
      setLink(r);
      window.location.href = r.url; // membuka aplikasi WhatsApp
    } catch (e) {
      play("error");
      toast.error((e as Error).message, "WhatsApp belum bisa");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!link) return;
    let stopped = false;
    const check = async () => {
      if (stopped) return;
      try {
        const s = await api<{ status: string; phone?: string }>(`/api/wa/link?code=${link.code}`);
        if (s.status === "linked" || s.status === "merged") {
          stopped = true;
          play("saved");
          toast.success(s.status === "merged" ? "Data keluargamu sudah kembali di HP ini." : `HP ini terhubung dengan WhatsApp ${s.phone ?? ""}.`, "Berhasil");
          setLink(null);
          if (s.status === "merged") clearMeCache();
          onDone(s.status, s.phone);
        } else if (s.status === "conflict") {
          stopped = true;
          play("error");
          toast.error("Nomor ini sudah dipakai akun lain dan HP ini sudah punya data sendiri. Hubungkan dari HP lama, atau pakai kode pemulihan.", "Belum bisa digabung");
          setLink(null);
        } else if (s.status === "expired" || s.status === "unknown") {
          stopped = true;
          toast.warning("Kodenya sudah kedaluwarsa. Tekan tombolnya lagi ya.", "Waktu habis");
          setLink(null);
        }
      } catch { /* sinyal putus: coba lagi di putaran berikutnya */ }
    };
    const t = setInterval(check, 2500);
    const onVisible = () => { if (document.visibilityState === "visible") void check(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { stopped = true; clearInterval(t); document.removeEventListener("visibilitychange", onVisible); };
  }, [link, onDone, toast]);

  if (link) {
    return (
      <div className="wa-wait">
        <p><b>Tekan Kirim di WhatsApp</b>, lalu kembali ke sini.</p>
        <p className="small muted">Kode: <b>{link.code}</b> · berlaku 10 menit</p>
        <div className="row">
          <button className="btn sm" onClick={() => setLink(null)}>Batal</button>
          <a className="btn sm wa" href={link.url}>Buka WhatsApp lagi</a>
        </div>
      </div>
    );
  }
  return <button className="btn big wa" disabled={busy} onClick={start}>{busy ? "Menyiapkan…" : label}</button>;
}
