import "server-only";
import { z } from "zod";

/**
 * Satu pintu untuk semua model. Provider dipilih lewat env:
 *   AI_PROVIDER=google  → Gemma lewat Google AI Studio (Gemini API), default
 *   AI_PROVIDER=ollama  → Gemma lokal lewat Ollama (data 100% di rumah)
 *
 * Model sengaja dibatasi ke keluarga Gemma 3 (murah). Ganti lewat AI_TEXT_MODEL / AI_VISION_MODEL.
 */

export interface ChatMessage {
  role: "system" | "user";
  content: string;
  images?: string[]; // base64 JPEG tanpa prefix data:
}

export interface GenerateOptions {
  vision?: boolean;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface AIResult<T> {
  data: T;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
}

export class AIUnavailableError extends Error {}

const provider = (process.env.AI_PROVIDER ?? "google") as "google" | "ollama";
const TEXT_MODEL = process.env.AI_TEXT_MODEL ?? (provider === "google" ? "gemma-3-12b-it" : "gemma3:4b");
const VISION_MODEL = process.env.AI_VISION_MODEL ?? TEXT_MODEL;

export function aiInfo() {
  const configured = provider === "ollama" || Boolean(process.env.GOOGLE_AI_API_KEY);
  return { provider, textModel: TEXT_MODEL, visionModel: VISION_MODEL, configured };
}

/** Minta JSON yang lolos validasi zod. Satu kali coba ulang dengan pesan galatnya. */
export async function generateJSON<T>(
  messages: ChatMessage[],
  schema: z.ZodType<T>,
  opts: GenerateOptions = {},
): Promise<AIResult<T>> {
  const model = opts.vision ? VISION_MODEL : TEXT_MODEL;
  const jsonSchema = z.toJSONSchema(schema);
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const msgs = lastError
      ? [...messages, { role: "user" as const, content: `Jawaban sebelumnya tidak valid (${lastError}). Ulangi, HANYA JSON yang valid.` }]
      : messages;
    const raw = provider === "ollama"
      ? await callOllama(model, msgs, jsonSchema, opts)
      : await callGoogle(model, msgs, jsonSchema, opts);
    const parsed = schema.safeParse(extractJSON(raw.text));
    if (parsed.success) {
      return { data: parsed.data, model, inputTokens: raw.inputTokens, outputTokens: raw.outputTokens };
    }
    lastError = parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
  }
  throw new Error(`AI mengembalikan JSON tidak valid: ${lastError}`);
}

function extractJSON(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?/gi, "").trim();
  const start = cleaned.search(/[{[]/);
  const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
  if (start < 0 || end < start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

interface RawResult { text: string; inputTokens?: number; outputTokens?: number }

async function callGoogle(model: string, messages: ChatMessage[], jsonSchema: object, opts: GenerateOptions): Promise<RawResult> {
  const key = process.env.GOOGLE_AI_API_KEY;
  if (!key) throw new AIUnavailableError("GOOGLE_AI_API_KEY belum diisi");

  // Gemma lewat API tidak mendukung system instruction & mode JSON bawaan:
  // instruksi sistem dan format JSON dilipat ke giliran user pertama.
  const isGemma = model.startsWith("gemma");
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const formatHint = `\n\nJawab HANYA dengan satu objek JSON (tanpa teks lain) yang sesuai JSON Schema ini:\n${JSON.stringify(jsonSchema)}`;
  const users = messages.filter((m) => m.role === "user");
  const contents = users.map((m, i) => ({
    role: "user",
    parts: [
      { text: (i === 0 && isGemma && system ? system + "\n\n" : "") + m.content + (i === users.length - 1 ? formatHint : "") },
      ...(m.images ?? []).map((data) => ({ inline_data: { mime_type: "image/jpeg", data } })),
    ],
  }));

  const body: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature: opts.temperature ?? 0.3,
      maxOutputTokens: opts.maxOutputTokens ?? 800,
      ...(isGemma ? {} : { responseMimeType: "application/json" }),
    },
  };
  if (!isGemma && system) body.systemInstruction = { parts: [{ text: system }] };

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(45_000),
  });
  if (res.status === 429) throw new AIUnavailableError("Kuota AI sedang habis, coba lagi sebentar");
  if (!res.ok) throw new Error(`Google AI ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  const text = (json.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
  return {
    text,
    inputTokens: json.usageMetadata?.promptTokenCount,
    outputTokens: json.usageMetadata?.candidatesTokenCount,
  };
}

async function callOllama(model: string, messages: ChatMessage[], jsonSchema: object, opts: GenerateOptions): Promise<RawResult> {
  const host = process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434";
  let res: Response;
  try {
    res = await fetch(`${host}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        format: jsonSchema,
        keep_alive: "30m",
        options: { temperature: opts.temperature ?? 0.3 },
        messages: messages.map((m) => ({ role: m.role, content: m.content, images: m.images })),
      }),
      signal: AbortSignal.timeout(240_000),
    });
  } catch {
    throw new AIUnavailableError("Ollama tidak bisa dihubungi");
  }
  if (!res.ok) throw new Error(`Ollama ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  return { text: json.message?.content ?? "", inputTokens: json.prompt_eval_count, outputTokens: json.eval_count };
}
