import "server-only";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { one, q, tx } from "./db";
import { normalizePhone } from "./validation";
import { forget, k as rk, redis, throttle } from "./redis";

/**
 * WhatsApp Business Platform (Cloud API resmi dari Meta).
 *
 * Masuk dengan WhatsApp ("reverse OTP"): aplikasi membuka WA dengan pesan berisi kode,
 * pengguna cukup menekan Kirim. Webhook menerima nomor pengirim (dijamin asli oleh WhatsApp)
 * lalu mengikat HP ini ke nomor tersebut. Tanpa mengetik OTP, dan pesan dari pengguna tidak berbayar.
 *
 * Env: WA_PHONE_NUMBER_ID, WA_ACCESS_TOKEN, WA_APP_SECRET, WA_VERIFY_TOKEN, WA_BUSINESS_NUMBER,
 *      WA_TEMPLATE_NUDGE (opsional, template "utility" untuk bel di luar jendela 24 jam).
 */

const GRAPH = `https://graph.facebook.com/${process.env.WA_GRAPH_VERSION ?? "v23.0"}`;
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // tanpa 0/O/1/I/L yang mudah tertukar
const CODE_TTL_MIN = 10;
const LINKS_PER_HOUR = 6;

export const waConfigured = () => Boolean(process.env.WA_PHONE_NUMBER_ID && process.env.WA_ACCESS_TOKEN && process.env.WA_BUSINESS_NUMBER);

/** 08xx → 628xx (format yang dipakai API WhatsApp). */
export const toWaId = (phone: string) => "62" + phone.replace(/^0/, "");
export const maskPhone = (p: string) => (p.length > 7 ? `${p.slice(0, 4)}••••${p.slice(-3)}` : p);

/** Pastikan webhook benar-benar dari Meta (header X-Hub-Signature-256 = HMAC-SHA256 body dengan App Secret). */
export function validSignature(body: string, header: string | null): boolean {
  const secret = process.env.WA_APP_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production"; // di produksi wajib ada
  if (!header?.startsWith("sha256=")) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(body).digest("hex"));
  const got = Buffer.from(header.slice(7));
  return expected.length === got.length && timingSafeEqual(expected, got);
}

async function send(payload: Record<string, unknown>): Promise<boolean> {
  if (!waConfigured()) return false;
  const res = await fetch(`${GRAPH}/${process.env.WA_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WA_ACCESS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
    signal: AbortSignal.timeout(15_000),
  }).catch((e: Error) => { console.error("WA gagal:", e.message); return null; });
  if (!res) return false;
  if (!res.ok) console.error("WA gagal:", res.status, (await res.text()).slice(0, 300));
  return res.ok;
}

/** Pesan teks bebas: hanya boleh dalam 24 jam sejak pengguna terakhir mengirim pesan. */
export const sendText = (phone: string, body: string) => send({ to: toWaId(phone), type: "text", text: { body, preview_url: false } });

/** Pesan template (berbayar per pesan, harus disetujui Meta) untuk di luar jendela 24 jam. */
export const sendTemplate = (phone: string, name: string, params: string[]) => send({
  to: toWaId(phone), type: "template",
  template: { name, language: { code: "id" }, components: params.length ? [{ type: "body", parameters: params.map((text) => ({ type: "text", text })) }] : [] },
});

/** Kirim ke pengguna: teks bebas kalau masih dalam jendela 24 jam, kalau tidak pakai template (kalau ada). */
export async function notifyUser(u: { phone: string; wa_last_inbound: string | null }, text: string, template?: { name?: string; params: string[] }) {
  const open = u.wa_last_inbound && Date.now() - new Date(u.wa_last_inbound).getTime() < 23.5 * 3600_000;
  if (open) return sendText(u.phone, text);
  if (template?.name) return sendTemplate(u.phone, template.name, template.params);
  return false;
}

// ---------------------------------------------------------------- menghubungkan HP ↔ nomor WA

export async function createLink(userId: string, profileId: string | null) {
  if (!waConfigured()) throw new Error("WhatsApp belum dikonfigurasi");
  const busy = "Terlalu sering mencoba. Tunggu sebentar lalu coba lagi.";
  if (redis) {
    if (await throttle("wa_link", userId)) throw new Error(busy);
  } else {
    const recent = await one<{ n: number }>("select count(*)::int n from wa_links where user_id = $1 and created_at > now() - interval '1 hour'", [userId]);
    if ((recent?.n ?? 0) >= LINKS_PER_HOUR) throw new Error(busy);
  }
  const code = Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
  await q("insert into wa_links (code, user_id, profile_id, expires_at) values ($1, $2, $3, now() + interval '" + CODE_TTL_MIN + " minutes')", [code, userId, profileId]);
  const text = `Kode masuk Boleh Gak: ${code}\n(tekan Kirim, jangan diubah)`;
  return { code, url: `https://wa.me/${process.env.WA_BUSINESS_NUMBER!.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`, expiresInMin: CODE_TTL_MIN };
}

export async function linkStatus(userId: string, code: string) {
  const row = await one<{ status: string; phone: string | null; expired: boolean }>(
    "select status, phone, expires_at < now() as expired from wa_links where code = $1 and user_id = $2",
    [code.toUpperCase(), userId],
  );
  if (!row) return { status: "unknown" as const };
  if (row.status === "pending" && row.expired) return { status: "expired" as const };
  return { status: row.status as "pending" | "linked" | "merged" | "conflict", phone: row.phone ? maskPhone(row.phone) : undefined };
}

/**
 * Pesan masuk dari webhook. Kalau berisi kode yang valid:
 *  - nomor belum dipakai      → nomor diikat ke akun HP ini ("linked")
 *  - nomor milik akun lain    → HP ini ikut masuk ke akun itu ("merged"), asal HP ini belum punya data sendiri
 *  - HP ini sudah punya data  → ditolak supaya tidak ada data yang tertimpa ("conflict")
 */
export async function handleInbound(fromWaId: string, text: string): Promise<void> {
  const phone = normalizePhone("+" + fromWaId);
  if (!phone) return;
  await q("update users set wa_last_inbound = now() where phone = $1", [phone]);
  const code = /\b([A-Z2-9]{6})\b/.exec(text.toUpperCase())?.[1];
  const link = code
    ? await one<{ code: string; user_id: string; profile_id: string | null }>(
        "select code, user_id, profile_id from wa_links where code = $1 and status = 'pending' and expires_at > now()", [code])
    : null;
  if (!link) {
    if (code || /kode|masuk|login/i.test(text)) await sendText(phone, "Kodenya tidak dikenali atau sudah kedaluwarsa. Buka aplikasi Boleh Gak lalu tekan \"Masuk dengan WhatsApp\" lagi ya.");
    return;
  }

  const result = await tx(async (c) => {
    const owner = (await c.query<{ id: string }>("select id from users where phone = $1", [phone])).rows[0];
    if (!owner || owner.id === link.user_id) {
      await c.query("update users set phone = $2, wa_linked_at = now(), wa_last_inbound = now(), self_profile_id = coalesce($3, self_profile_id) where id = $1",
        [link.user_id, phone, link.profile_id]);
      return "linked" as const;
    }
    // nomor sudah milik akun lain: pindahkan HP ini ke akun tersebut kalau HP ini belum punya data
    const hasData = (await c.query("select 1 from family_members where user_id = $1 limit 1", [link.user_id])).rowCount;
    if (hasData) return "conflict" as const;
    const dev = (await c.query<{ device_key_hash: string }>("select device_key_hash from users where id = $1", [link.user_id])).rows[0];
    await c.query("update wa_links set user_id = $2 where user_id = $1", [link.user_id, owner.id]); // supaya status tetap bisa dibaca
    await c.query("delete from users where id = $1", [link.user_id]);
    if (dev?.device_key_hash) void forget(rk("dev", dev.device_key_hash)); // pemetaan HP → akun lama sudah tidak berlaku
    if (dev?.device_key_hash) await c.query("insert into user_devices (key_hash, user_id) values ($1, $2) on conflict (key_hash) do update set user_id = excluded.user_id", [dev.device_key_hash, owner.id]);
    await c.query("update users set wa_last_inbound = now() where id = $1", [owner.id]);
    return "merged" as const;
  });

  await q("update wa_links set status = $2, phone = $3 where code = $1", [link.code, result, phone]);
  await forget(rk("me", link.user_id)); // data /api/me (nomor WA) berubah
  if (result === "merged") {
    const owner = await one<{ id: string }>("select id from users where phone = $1", [phone]);
    if (owner) await forget(rk("me", owner.id));
  }
  await sendText(phone, result === "conflict"
    ? "Nomor ini sudah terhubung ke akun lain, dan HP yang kamu pakai juga sudah punya data sendiri. Supaya tidak ada data yang tertimpa, hubungkan dari HP yang lama, atau pakai kode pemulihan."
    : result === "merged"
      ? "✅ Berhasil masuk. Data keluargamu sudah kembali di HP ini. Silakan kembali ke aplikasi Boleh Gak."
      : "✅ HP kamu sudah terhubung dengan nomor WhatsApp ini. Kalau nanti ganti HP, cukup \"Masuk dengan WhatsApp\" lagi. Silakan kembali ke aplikasi Boleh Gak.");
}

export async function unlink(userId: string) {
  await q("update users set phone = null, wa_linked_at = null, wa_last_inbound = null where id = $1", [userId]);
  await forget(rk("me", userId));
}
