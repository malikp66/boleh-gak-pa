import "server-only";
import webpush from "web-push";
import { q } from "./db";

export const pushConfigured = Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

if (pushConfigured) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "https://github.com/malikp66/boleh-gak-pa",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
}

export interface PushRow { id: string; endpoint: string; p256dh: string; auth: string }
export interface Notice { title: string; body: string; url?: string; tag?: string }

/** Kirim ke satu langganan. Langganan yang sudah kedaluwarsa (404/410) langsung dihapus. */
export async function sendPush(row: PushRow, notice: Notice): Promise<boolean> {
  try {
    await webpush.sendNotification(
      { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
      JSON.stringify(notice),
      { TTL: 6 * 3600, urgency: "normal" },
    );
    return true;
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) await q("delete from push_subscriptions where id = $1", [row.id]);
    else console.error("push gagal:", status, (e as Error).message);
    return false;
  }
}
