import "server-only";
import { z } from "zod";

/**
 * Satu pintu untuk semua model. Provider dipilih lewat env:
 *   AI_PROVIDER=google  → Gemini lewat Google AI Studio (default)
 *   AI_PROVIDER=ollama  → Gemma lokal lewat Ollama (data 100% di rumah)
 *
 * Default sengaja dua tingkat supaya akurat tapi murah:
 *   teks  → gemini-3.1-flash-lite (termurah di keluarga Gemini 3)
 *   foto  → gemini-3.8-flash      (lebih kuat untuk mengenali makanan; dibatasi kuota foto harian)
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
const TEXT_MODEL = process.env.AI_TEXT_MODEL ?? (provider === "google" ? "gemini-3.1-flash-lite" : "gemma3:4b");
const VISION_MODEL = process.env.AI_VISION_MODEL ?? (provider === "google" ? "gemini-3.8-flash" : TEXT_MODEL);
// Token "thinking" dihitung sebagai output (berbayar): pakai tingkat terendah yang masih cukup.
const THINKING_TEXT = process.env.AI_THINKING_TEXT ?? "minimal";
const THINKING_VISION = process.env.AI_THINKING_VISION ?? "low";

/**
 * Harga per 1 juta token (USD, input/output) dari ai.google.dev/gemini-api/docs/pricing, dicek 6 Okt 2026.
 * Dipakai untuk perkiraan biaya & rem anggaran. Perbarui kalau harga berubah.
 */
export const PRICES: Record<string, [number, number]> = {
  "gemini-3.1-flash-lite": [0.25, 1.5],
  "gemini-3.5-flash-lite": [0.3, 2.5],
  "gemini-2.5-flash-lite": [0.1, 0.4],
  "gemini-2.5-flash": [0.3, 2.5],
  "gemini-3.8-flash": [0.75, 3.75], // naik jadi 1.50/7.50 mulai 1 Jan 2027
  "gemini-3.7-flash": [0.75, 3.75],
};

export function estimateUSD(model: string, input = 0, output = 0): number {
  const [pi, po] = PRICES[model] ?? [0, 0];
  return (input * pi + output * po) / 1_000_000;
}

export function aiInfo() {
  const configured = provider === "ollama" || Boolean(process.env.GOOGLE_AI_API_KEY);
  return { provider, textModel: TEXT_MODEL, visionModel: VISION_MODEL, configured };
}

/** Dipanggil setelah setiap panggilan berhasil (diisi oleh server.ts untuk mencatat biaya). */
let spendHook: ((model: string, input: number, output: number) => Promise<void>) | null = null;
export const onSpend = (fn: typeof spendHook) => { spendHook = fn; };
/** Dipanggil sebelum setiap panggilan; lempar AIUnavailableError kalau anggaran bulan ini habis. */
let budgetGuard: (() => Promise<void>) | null = null;
export const onBudgetCheck = (fn: typeof budgetGuard) => { budgetGuard = fn; };

/** Minta JSON yang lolos validasi zod. Satu kali coba ulang dengan pesan galatnya. */
export async function generateJSON<T>(
  messages: ChatMessage[],
  schema: z.ZodType<T>,
  opts: GenerateOptions = {},
): Promise<AIResult<T>> {
  await budgetGuard?.();
  const model = opts.vision ? VISION_MODEL : TEXT_MODEL;
  const jsonSchema = cleanSchema(z.toJSONSchema(schema));
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const msgs = lastError
      ? [...messages, { role: "user" as const, content: `Jawaban sebelumnya tidak valid (${lastError}). Ulangi, HANYA JSON yang valid.` }]
      : messages;
    const raw = provider === "ollama"
      ? await callOllama(model, msgs, jsonSchema, opts)
      : await callGoogle(model, msgs, jsonSchema, opts);
    await spendHook?.(model, raw.inputTokens ?? 0, raw.outputTokens ?? 0).catch(() => {});
    const parsed = schema.safeParse(extractJSON(raw.text));
    if (parsed.success) {
      return { data: parsed.data, model, inputTokens: raw.inputTokens, outputTokens: raw.outputTokens };
    }
    lastError = parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
  }
  throw new Error(`AI mengembalikan JSON tidak valid: ${lastError}`);
}

/** Buang kata kunci JSON Schema yang tidak didukung Gemini ($schema, pattern, dll.). */
function cleanSchema(s: unknown): unknown {
  if (Array.isArray(s)) return s.map(cleanSchema);
  if (!s || typeof s !== "object") return s;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(s)) {
    if (["$schema", "pattern", "format", "default", "additionalProperties"].includes(k)) continue;
    out[k] = cleanSchema(v);
  }
  return out;
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

async function callGoogle(model: string, messages: ChatMessage[], jsonSchema: unknown, opts: GenerateOptions): Promise<RawResult> {
  const key = process.env.GOOGLE_AI_API_KEY;
  if (!key) throw new AIUnavailableError("GOOGLE_AI_API_KEY belum diisi");

  // Gemma lewat API tidak mendukung system instruction & JSON bawaan: dilipat ke giliran user.
  const isGemma = model.startsWith("gemma");
  const system = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const users = messages.filter((m) => m.role === "user");
  const gemmaHint = `\n\nJawab HANYA dengan satu objek JSON (tanpa teks lain) yang sesuai JSON Schema ini:\n${JSON.stringify(jsonSchema)}`;
  const contents = users.map((m, i) => ({
    role: "user",
    parts: [
      { text: (i === 0 && isGemma && system ? system + "\n\n" : "") + m.content + (isGemma && i === users.length - 1 ? gemmaHint : "") },
      ...(m.images ?? []).map((data) => ({ inline_data: { mime_type: "image/jpeg", data } })),
    ],
  }));

  const generationConfig: Record<string, unknown> = {
    temperature: opts.temperature ?? 0.3,
    maxOutputTokens: opts.maxOutputTokens ?? 1024,
  };
  if (!isGemma) {
    generationConfig.responseMimeType = "application/json";
    generationConfig.responseJsonSchema = jsonSchema;
    if (model.startsWith("gemini-3")) generationConfig.thinkingConfig = { thinkingLevel: opts.vision ? THINKING_VISION : THINKING_TEXT };
  }
  const body: Record<string, unknown> = { contents, generationConfig };
  if (!isGemma && system) body.systemInstruction = { parts: [{ text: system }] };

  const send = (b: unknown) => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify(b),
    signal: AbortSignal.timeout(45_000),
  });
  let res = await send(body);
  // model tertentu menolak tingkat thinking yang diminta → ulangi tanpa thinkingConfig
  if (res.status === 400 && generationConfig.thinkingConfig) {
    const msg = await res.clone().text();
    if (/thinking/i.test(msg)) {
      delete generationConfig.thinkingConfig;
      res = await send(body);
    }
  }
  if (res.status === 429) throw new AIUnavailableError("Kuota AI sedang habis, coba lagi sebentar");
  if (res.status === 403 || res.status === 402) throw new AIUnavailableError("AI tidak tersedia (cek saldo/billing Google AI Studio)");
  if (!res.ok) {
    const text = (await res.text()).slice(0, 300);
    if (/credits are depleted|billing/i.test(text)) throw new AIUnavailableError("Saldo Google AI Studio habis");
    throw new Error(`Google AI ${res.status}: ${text}`);
  }
  const json = await res.json();
  const parts = (json.candidates?.[0]?.content?.parts ?? []) as { text?: string; thought?: boolean }[];
  const text = parts.filter((p) => !p.thought).map((p) => p.text ?? "").join("");
  const u = json.usageMetadata ?? {};
  return {
    text,
    inputTokens: u.promptTokenCount,
    // thinking ditagih sebagai output
    outputTokens: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0),
  };
}

async function callOllama(model: string, messages: ChatMessage[], jsonSchema: unknown, opts: GenerateOptions): Promise<RawResult> {
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
