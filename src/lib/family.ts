import "server-only";
import { one, q } from "./db";
import { PushRow, sendPush } from "./push";
import { getProfile, HttpError, todayStartISO } from "./server";
import { notifyUser } from "./whatsapp";

/** Jeda minimum antar "bel" ke orang yang sama, supaya tidak terasa diteror. */
export const NUDGE_GAP_HOURS = 2;

export interface FamilyStatus {
  profile_id: string;
  nama: string;
  logged_today: boolean;
  last_log: string | null;
  /** jumlah HP lain (bukan HP ini) yang memasang notifikasi untuk orang ini */
  devices: number;
  last_nudge: string | null;
}

const LAST_LOG = `greatest(
  (select max(at) from meals m where m.profile_id = p.id),
  (select max(at) from health_logs h where h.profile_id = p.id))`;

/** Siapa saja di keluarga yang sudah/belum mencatat hari ini (WIB). */
export async function familyStatus(userId: string): Promise<FamilyStatus[]> {
  const rows = await q<Omit<FamilyStatus, "logged_today">>(
    `select p.id as profile_id, p.nama, ${LAST_LOG} as last_log,
       (select count(*)::int from push_subscriptions s where s.profile_id = p.id and s.user_id <> $1)
         + (select count(*)::int from users u where u.self_profile_id = p.id and u.phone is not null and u.id <> $1) as devices,
       (select max(created_at) from nudges n where n.profile_id = p.id) as last_nudge
     from profiles p join family_members fm on fm.family_id = p.family_id
     where fm.user_id = $1 order by p.created_at`,
    [userId],
  );
  const start = todayStartISO();
  return rows.map((r) => ({ ...r, logged_today: Boolean(r.last_log && new Date(r.last_log).toISOString() >= start) }));
}

/** Kirim bel ke HP orang tersebut. Mengembalikan jumlah HP yang menerima. */
export async function nudge(userId: string, profileId: string): Promise<{ sent: number; viaWa: boolean; nama: string }> {
  const profile = await getProfile(userId, profileId); // sekaligus memastikan satu keluarga
  const recent = await one<{ created_at: string }>(
    `select created_at from nudges where profile_id = $1 and created_at > now() - interval '${NUDGE_GAP_HOURS} hours'
     order by created_at desc limit 1`,
    [profileId],
  );
  if (recent) {
    const jam = new Date(recent.created_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });
    throw new HttpError(429, `${profile.nama} sudah diingatkan jam ${jam}. Coba lagi nanti ya.`);
  }
  const subs = await q<PushRow>(
    "select id, endpoint, p256dh, auth from push_subscriptions where profile_id = $1 and user_id <> $2",
    [profileId, userId],
  );
  const sapa = profile.panggilan && profile.panggilan !== "kamu" ? profile.panggilan : profile.nama;
  let sent = 0;
  for (const s of subs) {
    if (await sendPush(s, {
      title: "🔔 Dari keluarga",
      body: `${sapa}, jangan lupa catat makan hari ini ya. Keluarga ikut memantau 💛`,
      url: "/?tab=catatan", tag: "bel-keluarga",
    })) sent++;
  }
  // cadangan: WhatsApp ke nomor yang terhubung dengan profil ini
  let viaWa = 0;
  if (!sent) {
    const owners = await q<{ phone: string; wa_last_inbound: string | null }>(
      `select u.phone, u.wa_last_inbound from users u join family_members fm on fm.user_id = u.id and fm.family_id = $2
       where u.self_profile_id = $1 and u.phone is not null and u.id <> $3`,
      [profileId, profile.family_id, userId],
    );
    for (const o of owners) {
      if (await notifyUser(o, `🔔 ${sapa}, jangan lupa catat makan hari ini ya. Keluarga ikut memantau 💛\nBuka aplikasi Boleh Gak untuk mencatat.`,
        { name: process.env.WA_TEMPLATE_NUDGE, params: [sapa] })) viaWa++;
    }
  }
  if (!sent && !viaWa) {
    throw new HttpError(subs.length ? 502 : 409, subs.length
      ? "Notifikasi tidak terkirim. HP-nya mungkin sudah mencabut izin notifikasi."
      : `${profile.nama} belum menyalakan notifikasi atau menghubungkan WhatsApp. Coba telepon langsung ya.`);
  }
  await q("insert into nudges (profile_id, from_user) values ($1, $2)", [profileId, userId]);
  return { sent: sent + viaWa, viaWa: viaWa > 0, nama: profile.nama };
}

/**
 * Cron 21.00 WIB: untuk orang yang memakai HP sendiri (punya notifikasi) tapi belum mencatat hari ini,
 * kabari anggota keluarga lain yang mengizinkan, dengan tombol "Ingatkan".
 */
export async function familyAlerts(): Promise<number> {
  const start = todayStartISO();
  const quiet = await q<{ id: string; nama: string; family_id: string }>(
    `select p.id, p.nama, p.family_id from profiles p
     where exists (select 1 from push_subscriptions s where s.profile_id = p.id)
       and coalesce(${LAST_LOG}, 'epoch') < $1`,
    [start],
  );
  let sent = 0;
  for (const p of quiet) {
    const watchers = await q<PushRow>(
      `select s.id, s.endpoint, s.p256dh, s.auth from push_subscriptions s
       join family_members fm on fm.user_id = s.user_id and fm.family_id = $1
       where s.keluarga = true and s.profile_id is distinct from $2
         and s.user_id not in (select user_id from push_subscriptions where profile_id = $2)`,
      [p.family_id, p.id],
    );
    for (const w of watchers) {
      if (await sendPush(w, {
        title: `${p.nama} belum mencatat hari ini`,
        body: "Mau diingatkan? Ketuk untuk membuka, lalu tekan 🔔 Ingatkan.",
        url: "/?tab=catatan", tag: `keluarga-${p.id}`, nudge: p.id,
      })) sent++;
    }
  }
  return sent;
}
