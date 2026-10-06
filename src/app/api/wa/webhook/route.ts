import { NextResponse } from "next/server";
import { handleInbound, validSignature } from "@/lib/whatsapp";

/** Verifikasi webhook dari Meta (sekali saat didaftarkan di dashboard). */
export async function GET(req: Request) {
  const u = new URL(req.url).searchParams;
  if (u.get("hub.mode") === "subscribe" && process.env.WA_VERIFY_TOKEN && u.get("hub.verify_token") === process.env.WA_VERIFY_TOKEN) {
    return new Response(u.get("hub.challenge") ?? "", { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new Response("forbidden", { status: 403 });
}

interface WebhookBody {
  entry?: { changes?: { value?: { messages?: { from: string; type: string; text?: { body: string }; button?: { text: string } }[] } }[] }[];
}

/** Pesan masuk ke nomor WA aplikasi. Selalu dibalas 200 cepat supaya Meta tidak mengulang kiriman. */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!validSignature(raw, req.headers.get("x-hub-signature-256"))) return new Response("bad signature", { status: 401 });
  let body: WebhookBody;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ ok: true }); }
  const messages = body.entry?.flatMap((e) => e.changes?.flatMap((c) => c.value?.messages ?? []) ?? []) ?? [];
  for (const m of messages) {
    const text = m.text?.body ?? m.button?.text ?? "";
    try { await handleInbound(m.from, text); } catch (e) { console.error("WA inbound gagal:", (e as Error).message); }
  }
  return NextResponse.json({ ok: true });
}
