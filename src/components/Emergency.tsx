"use client";
import { useState } from "react";
import { Profile } from "./types";
import { play } from "@/lib/sound";

// Tanda stroke menurut kampanye Kemenkes "SeGeRa Ke RS" (ayosehat.kemkes.go.id).
const SIGNS: [string, string, string][] = [
  ["Se", "Senyum tidak simetris", "senyum mencong ke satu sisi"],
  ["Ge", "Gerak separuh tubuh lemah", "tangan/kaki satu sisi tiba-tiba lemas"],
  ["Ra", "Bicara pelo", "bicara tidak jelas, sulit bicara atau memahami kata"],
  ["Ke", "Kebas separuh tubuh", "kesemutan/mati rasa satu sisi"],
  ["R", "Rabun tiba-tiba", "pandangan kabur satu atau dua mata"],
  ["S", "Sakit kepala hebat", "tiba-tiba, belum pernah sehebat ini"],
];

export function EmergencyButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button className="sos-btn" onClick={() => { play("merah"); onOpen(); }} aria-label="Darurat stroke">🚨</button>
  );
}

export function EmergencySheet({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  const [onset, setOnset] = useState<string | null>(null);
  const tel = profile.kontak_telepon?.replace(/[^0-9+]/g, "");
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label="Darurat stroke" onClick={(e) => e.stopPropagation()}>
        <h2>🚨 Curiga stroke?</h2>
        <p><b>Kalau ada SATU saja tanda ini secara tiba-tiba, SeGeRa Ke RS.</b> Jangan menunggu gejala hilang.</p>
        <div className="signs">
          {SIGNS.map(([k, t, d]) => (
            <div className="sign" key={k}><span className="sign-k">{k}</span><span><b>{t}</b><br /><small>{d}</small></span></div>
          ))}
        </div>
        <a className="btn big danger" href="tel:119">📞 Telepon 119 (ambulans gratis)</a>
        {tel && <a className="btn big" href={`tel:${tel}`} style={{ marginTop: 10 }}>📞 {profile.kontak_nama || "Kontak keluarga"}</a>}
        <button className="btn" style={{ marginTop: 10 }} onClick={() => setOnset(new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }))}>
          ⏱️ Catat jam gejala mulai
        </button>
        {onset && <div className="alert bahaya">Gejala mulai pukul <b>{onset}</b>. Sampaikan jam ini ke petugas medis: makin cepat ditangani, makin banyak bagian otak yang bisa diselamatkan.</div>}
        <ul className="plain small" style={{ marginTop: 12 }}>
          <li>Jangan beri makan/minum atau obat apa pun lewat mulut.</li>
          <li>Baringkan miring kalau muntah atau tidak sadar.</li>
          <li>Pergi ke RS yang punya layanan stroke/IGD terdekat.</li>
        </ul>
        <button className="btn" style={{ marginTop: 12 }} onClick={onClose}>Tutup</button>
      </div>
    </div>
  );
}
