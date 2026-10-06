"use client";
import { useState } from "react";
import { getRecoveryCode } from "@/lib/device";

/** Tampilkan kode pemulihan supaya data bisa dibuka lagi setelah data browser dihapus atau ganti HP. */
export default function RecoveryCard() {
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const show = () => getRecoveryCode().then(setCode).catch((e: Error) => setMsg(e.message));
  return (
    <div className="secure">
      <p>🔑 Simpan kode pemulihanmu</p>
      <p className="small" style={{ fontWeight: 500 }}>
        Kalau data browser dihapus atau ganti HP, masukkan kode ini di halaman awal supaya semua catatanmu kembali. Siapa pun yang punya kode ini bisa membuka datamu, jadi simpan baik-baik.
      </p>
      {code ? (
        <>
          <div className="invite" style={{ margin: "8px 0" }}><code style={{ fontSize: 17, wordBreak: "break-all" }}>{code}</code></div>
          <div className="row">
            <button className="btn sm" onClick={() => navigator.clipboard.writeText(code).then(() => setMsg("Tersalin"), () => setMsg("Tidak bisa menyalin"))}>Salin</button>
            <button className="btn sm" onClick={() => {
              const text = `Kode pemulihan Boleh Gak, Ya? (jangan dibagikan): ${code}`;
              (navigator.share ? navigator.share({ text }) : navigator.clipboard.writeText(text)).catch(() => {});
            }}>Kirim ke diri sendiri</button>
          </div>
        </>
      ) : <button className="btn" onClick={show}>Lihat kode pemulihan</button>}
      {msg && <p className="small" style={{ marginTop: 8 }}>{msg}</p>}
    </div>
  );
}
