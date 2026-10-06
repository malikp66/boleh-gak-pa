import { z } from "zod";
import { AIUnavailableError, generateSpeech, TTS_VOICES, TTSVoice } from "@/lib/ai";
import { HttpError, quota, requireUser, route } from "@/lib/server";

/**
 * Suara AI natural (opsional). Gagal → 503, dan aplikasi kembali ke suara bawaan HP.
 * Biaya ±Rp25 per 10 detik; dibatasi kuota harian & anggaran bulanan.
 */
export const POST = route(async (req) => {
  const user = await requireUser();
  const b = z.object({
    text: z.string().trim().min(1).max(700),
    voice: z.enum(Object.keys(TTS_VOICES) as [TTSVoice, ...TTSVoice[]]).default("Sulafat"),
  }).parse(await req.json());
  if (!(await quota(user.id, "tts")())) throw new HttpError(429, "Jatah suara AI hari ini habis, memakai suara HP.");
  try {
    const audio = await generateSpeech(b.text, b.voice);
    return new Response(Buffer.from(audio), {
      headers: { "Content-Type": "audio/wav", "Cache-Control": "private, max-age=86400" },
    });
  } catch (e) {
    if (e instanceof AIUnavailableError) throw new HttpError(503, e.message);
    throw e;
  }
});
