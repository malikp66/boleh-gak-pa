import "server-only";
import { one, q } from "./db";
import { combine, findFoods } from "./foods/match";
import { getProfile, HttpError, loadProfileContext } from "./server";

/** Pertanyaan yang lebih tua dari ini tidak ditanyakan lagi (sudah lewat, kemungkinan lupa). */
const PENDING_HOURS = 24;
/** Membandingkan beberapa makanan berturut-turut: yang lama diganti, supaya tidak ditanya berkali-kali. */
const REPLACE_MINUTES = 10;

export type Resolution = "sesuai saran" | "porsi penuh" | "ditolak" | "batal";
export interface PendingCheck { id: string; food: string; status: "hijau" | "kuning" | "merah"; note: string; created_at: string }

export async function recordCheck(profileId: string, food: string, status: string, note: string): Promise<string> {
  await q(
    `update checks set resolved_at = now(), resolution = 'batal'
     where profile_id = $1 and resolved_at is null and created_at > now() - interval '${REPLACE_MINUTES} minutes'`,
    [profileId],
  );
  const row = await one<{ id: string }>(
    "insert into checks (profile_id, food, status, note) values ($1, $2, $3, $4) returning id",
    [profileId, food.slice(0, 200), status, note.slice(0, 40)],
  );
  return row!.id;
}

export async function pendingChecks(userId: string, profileId: string): Promise<PendingCheck[]> {
  const profile = await getProfile(userId, profileId);
  return q<PendingCheck>(
    `select id, food, status, note, created_at from checks
     where profile_id = $1 and resolved_at is null and created_at > now() - interval '${PENDING_HOURS} hours'
     order by created_at desc limit 3`,
    [profile.id],
  );
}

/** Jawab pertanyaan: dicatat sebagai makan pada jam bertanya (kecuali "batal" = cuma tanya-tanya). */
export async function resolveCheck(userId: string, id: string, resolution: Resolution) {
  const check = await one<PendingCheck & { profile_id: string; resolved_at: string | null }>("select * from checks where id = $1", [id]);
  if (!check) throw new HttpError(404, "Pertanyaan ini sudah tidak ada.");
  const { profile, foods } = await loadProfileContext(userId, check.profile_id); // sekaligus cek satu keluarga
  if (check.resolved_at) throw new HttpError(409, `"${check.food}" sudah dijawab sebelumnya.`);
  const claimed = await one("update checks set resolved_at = now(), resolution = $2 where id = $1 and resolved_at is null returning id", [id, resolution]);
  if (!claimed) throw new HttpError(409, `"${check.food}" sudah dijawab sebelumnya.`);
  if (resolution === "batal") return { ok: true, logged: false };
  const food = combine(findFoods(check.food, foods));
  await q(
    `insert into meals (profile_id, at, food, portion, status, purin, garam, karbo, gula, lemak, note, created_by)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [profile.id, check.created_at, food?.name ?? check.food, resolution, resolution === "ditolak" ? "hijau" : check.status,
      food?.purin ?? null, food?.garam ?? null, food?.karbo ?? null, food?.gula ?? null, food?.lemak ?? null, check.note, userId],
  );
  return { ok: true, logged: true };
}
