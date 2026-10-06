import "server-only";
import { attachDatabasePool } from "@vercel/functions";
import { Pool, type PoolClient, type QueryResultRow } from "pg";

// Koneksi pooled (DATABASE_URL, host -pooler) untuk lalu lintas aplikasi — saran resmi Neon untuk Vercel.
// Migrasi memakai DATABASE_URL_UNPOOLED (tools/migrate.mjs).
const globalForPool = globalThis as unknown as { pgPool?: Pool };

function pool(): Pool {
  if (!globalForPool.pgPool) {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL belum diisi");
    // sslmode eksplisit verify-full (perilaku saat ini) supaya tidak berubah diam-diam di pg v9
    const url = process.env.DATABASE_URL.replace(/sslmode=(require|prefer|verify-ca)/, "sslmode=verify-full");
    globalForPool.pgPool = new Pool({ connectionString: url, max: 5 });
    attachDatabasePool(globalForPool.pgPool);
  }
  return globalForPool.pgPool;
}

export const dbConfigured = Boolean(process.env.DATABASE_URL);

/** Query berparameter ($1, $2, …). Jangan pernah menyambung string input pengguna ke SQL. */
export async function q<T extends QueryResultRow = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  return (await pool().query<T>(text, params)).rows;
}

export async function one<T extends QueryResultRow = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T | null> {
  return (await q<T>(text, params))[0] ?? null;
}

/** Jalankan beberapa query dalam satu transaksi. */
export async function tx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool().connect();
  try {
    await client.query("begin");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}
