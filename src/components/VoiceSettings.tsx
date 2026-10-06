"use client";
import { useState, useSyncExternalStore } from "react";
import { useToast } from "./ui";
import { useClientValue } from "@/lib/use-client-value";
import { AI_VOICES, getVoiceSettings, indonesianVoices, setVoiceSettings, speakText, subscribeVoices, VoiceSettings as VS } from "@/lib/voice";

const SAMPLE = "Boleh, Pa. Soto ayam aman untuk tensi, asal kuahnya jangan dihabiskan dan tidak pakai kerupuk.";
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

  const slow = st.rate < 0.9;
  return (
    <>
      <label className="care-item">
        <input type="checkbox" checked={st.mode === "ai"} onChange={(e) => { update({ mode: e.target.checked ? "ai" : "perangkat" }); }} />
        <span className="ce">✨</span><span>Suara lebih natural<br /><small className="muted">butuh internet; kalau tidak bisa, pakai suara HP</small></span>
      </label>
      <label className="care-item">
        <input type="checkbox" checked={slow} onChange={(e) => update({ rate: e.target.checked ? 0.8 : 0.95 })} />
        <span className="ce">🐢</span>Bacakan lebih pelan
      </label>
      <button className="btn sm" onClick={() => test()}>▶️ Coba suara</button>

      <details className="more">
        <summary>Pilih suara lain</summary>
        {st.mode === "ai" ? (
          <label className="field">Suara natural
            <select value={st.aiVoice} onChange={(e) => { update({ aiVoice: e.target.value }); void test({ aiVoice: e.target.value }); }}>
              {AI_VOICES.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
            </select>
          </label>
        ) : voices.length ? (
          <label className="field">Suara HP
            <select value={st.voiceURI || voices[0].voiceURI} onChange={(e) => { update({ voiceURI: e.target.value }); void test({ voiceURI: e.target.value }); }}>
              {voices.map((v, i) => <option key={v.voiceURI} value={v.voiceURI}>{v.name}{i === 0 ? " · paling halus" : ""}</option>)}
            </select>
          </label>
        ) : <p className="small muted">Belum ada suara Bahasa Indonesia di HP ini. Android: Setelan → Text-to-speech → Mesin Google → pasang Bahasa Indonesia. iPhone: Setelan → Aksesibilitas → Konten Lisan → Suara → Indonesia (pilih yang “Ditingkatkan”).</p>}
      </details>
    </>
  );
}
