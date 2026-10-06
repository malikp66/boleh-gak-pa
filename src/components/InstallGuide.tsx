"use client";
import { useState, useSyncExternalStore } from "react";
import { useToast } from "./ui";
import { getRecoveryCode } from "@/lib/device";
import { installState, platform, Platform, promptInstall, subscribeInstall } from "@/lib/install";
import { useClientValue } from "@/lib/use-client-value";

/**
 * Panduan memasang aplikasi ke layar HP, disesuaikan dengan HP & browser yang dipakai.
 * existing = pengguna yang sudah punya data di browser ini (di iPhone, perlu kode pemulihan untuk memindahkan data).
 */
export default function InstallGuide({ existing = false, onSkip }: { existing?: boolean; onSkip?: () => void }) {
  const toast = useToast();
  const p = useClientValue<Platform>(platform, "android");
  const state = useSyncExternalStore(subscribeInstall, installState, () => "manual" as const);
  const [code, setCode] = useState("");

  const copyLink = () => navigator.clipboard.writeText(location.origin)
    .then(() => toast.success("Tautan tersalin. Tempel di Chrome atau Safari."), () => toast.info(location.origin, "Salin tautan ini"));

  return (
    <div className="install">
      <span className="emo-big" aria-hidden="true">📲</span>
      <h2>Pasang dulu di HP ini</h2>
      <p className="small">Supaya muncul sebagai ikon di layar HP, bisa kirim pengingat, dan datanya tidak hilang. Cukup sekali, gratis, tanpa Play Store.</p>

      {state === "installed" ? (
        <div className="install-done">
          <p><b>✅ Sudah terpasang!</b></p>
          <p className="small">Tutup halaman ini, lalu buka <b>Boleh Gak?</b> dari ikon kuning di layar HP.</p>
        </div>
      ) : p === "inapp" ? (
        <>
          <ol className="install-steps">
            <li><span>1</span><div>Ketuk <b>⋮</b> atau <b>···</b> di pojok atas</div></li>
            <li><span>2</span><div>Pilih <b>Buka di Chrome</b> (Android) atau <b>Buka di Safari</b> (iPhone)</div></li>
          </ol>
          <button className="btn big" onClick={copyLink}>📋 Salin tautan</button>
        </>
      ) : p === "android" && state === "prompt" ? (
        <button className="btn big primary" onClick={() => promptInstall()}>📲 Pasang aplikasi</button>
      ) : p === "android" ? (
        <ol className="install-steps">
          <li><span>1</span><div>Ketuk <b>⋮</b> di pojok kanan atas Chrome</div></li>
          <li><span>2</span><div>Pilih <b>Instal aplikasi</b> atau <b>Tambahkan ke layar utama</b></div></li>
          <li><span>3</span><div>Buka <b>Boleh Gak?</b> dari ikon di layar HP</div></li>
        </ol>
      ) : p === "ios" || p === "ios-other" ? (
        <>
          {existing && (
            <div className="install-code">
              <p className="small"><b>Di iPhone, aplikasi yang dipasang mulai kosong.</b> Salin kode ini dulu, lalu di aplikasi pilih <b>Punya kode pemulihan</b>.</p>
              {code
                ? <code>{code}</code>
                : <button className="btn sm" onClick={() => getRecoveryCode().then((c) => { setCode(c); return navigator.clipboard.writeText(c); }).then(() => toast.success("Kode pemulihan tersalin."), () => {})}>Tampilkan & salin kode</button>}
            </div>
          )}
          <ol className="install-steps">
            <li><span>1</span><div>Ketuk tombol <b>Bagikan</b> <i className="ios-share" aria-label="ikon kotak dengan panah ke atas">⬆︎</i> {p === "ios" ? "di bawah layar" : "di samping alamat situs"}</div></li>
            <li><span>2</span><div>Geser ke bawah, pilih <b>Tambah ke Layar Utama</b></div></li>
            <li><span>3</span><div>Ketuk <b>Tambah</b>, lalu buka <b>Boleh Gak?</b> dari ikon di layar HP</div></li>
          </ol>
        </>
      ) : (
        <>
          <p className="small"><b>Paling enak dipakai di HP.</b> Buka alamat ini di HP:</p>
          <button className="btn big" onClick={copyLink}>📋 Salin tautan</button>
          {state === "prompt" && <button className="btn" style={{ marginTop: 10 }} onClick={() => promptInstall()}>Pasang di komputer ini</button>}
        </>
      )}

      {onSkip && <button className="linklike" onClick={onSkip}>Tidak bisa memasang? Lanjut di browser</button>}
    </div>
  );
}
