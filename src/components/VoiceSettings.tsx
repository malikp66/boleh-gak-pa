"use client";
import { useState, useSyncExternalStore } from "react";
import { useToast } from "./ui";
import { useClientValue } from "@/lib/use-client-value";
import { AI_VOICES, getVoiceSettings, indonesianVoices, setVoiceSettings, speakText, subscribeVoices, VoiceSettings as VS } from "@/lib/voice";

const SAMPLE = "Boleh, Pa. Soto ayam aman untuk tensi, asal kuahnya jangan dihabiskan dan tidak pakai kerupuk.";
const RATES: [number, string][] = [[0.8, "Pelan"], [0.95, "Normal"], [1.1, "Cepat"]];
const noVoices: SpeechSynthesisVoice[] = [];

export default function VoiceSettings() {
  const toast = useToast();
  const initial = useClientValue(getVoiceSettings, null);
  const [override, setOverride] = useState<VS | null>(null);
  const st = override ?? initial;
  const voices = useSyncExternalStore(subscribeVoices, indonesianVoices, () => noVoices);
  if (!st) return null;

  const update = (patch: Partial<VS>) => setOverride(setVoiceSettings(patch));
  const test = (patch: Partial<VS> = {}) => speakText(SAMPLE, (r) => toast.warning(`${r}. Yang terdengar adalah suara HP.`, "Suara AI belum bisa"), { ...st, ...patch })
    .then((ok) => { if (!ok) toast.warning("HP ini belum bisa membacakan suara."); });

  return (
    <>
      <p className="eyebrow">🗣️ Suara bacaan</p>
      <div className="seg">
        <button className={st.mode === "perangkat" ? "on" : ""} onClick={() => update({ mode: "perangkat" })}>📱 Suara HP<small>gratis, tanpa internet</small></button>
        <button className={st.mode === "ai" ? "on" : ""} onClick={() => update({ mode: "ai" })}>✨ Suara AI<small>paling natural</small></button>
      </div>

      {st.mode === "perangkat" ? (
        voices.length ? (
          <label className="field">Pilih suara
            <select value={st.voiceURI || voices[0].voiceURI} onChange={(e) => { update({ voiceURI: e.target.value }); void test({ voiceURI: e.target.value }); }}>
              {voices.map((v, i) => <option key={v.voiceURI} value={v.voiceURI}>{v.name}{i === 0 ? " · paling halus" : ""}</option>)}
            </select>
          </label>
        ) : <p className="small muted">Belum ada suara Bahasa Indonesia di HP ini. Di Android: Setelan → Text-to-speech → Mesin Google → pasang Bahasa Indonesia. Di iPhone: Setelan → Aksesibilitas → Konten Lisan → Suara → Indonesia (pilih yang “Ditingkatkan”).</p>
      ) : (
        <>
          <label className="field">Pilih suara AI
            <select value={st.aiVoice} onChange={(e) => update({ aiVoice: e.target.value })}>
              {AI_VOICES.map((v) => <option key={v.id} value={v.id}>{v.id} · {v.label}</option>)}
            </select>
          </label>
          <p className="small muted" style={{ marginTop: 0 }}>Butuh internet dan memakai jatah AI (sangat kecil). Kalau sedang tidak tersedia, otomatis memakai suara HP.</p>
        </>
      )}

      <p className="small" style={{ margin: "8px 0 6px" }}><b>Kecepatan</b></p>
      <div className="chips">
        {RATES.map(([r, label]) => (
          <button key={r} className={`chip${Math.abs(st.rate - r) < 0.01 ? " on" : ""}`} onClick={() => update({ rate: r })}>{label}</button>
        ))}
      </div>
      <button className="btn sm" style={{ marginTop: 10 }} onClick={() => test()}>▶️ Coba suara</button>
    </>
  );
}
