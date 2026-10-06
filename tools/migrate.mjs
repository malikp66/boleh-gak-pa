// Jalankan migrasi SQL di db/migrations yang belum pernah dijalankan.
//   node --env-file=.env tools/migrate.mjs
import pg from "pg";
const { Pool } = pg;
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL belum diisi (jalankan dengan --env-file=.env)");

const pool = new Pool({ connectionString: url.replace(/sslmode=(require|prefer|verify-ca)/, "sslmode=verify-full") });
const client = await pool.connect();
try {
  await client.query("create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())");
  const done = new Set((await client.query("select name from schema_migrations")).rows.map((r) => r.name));
  const dir = join(import.meta.dirname, "..", "db", "migrations");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    if (done.has(f)) continue;
    process.stdout.write(`menjalankan ${f} … `);
    await client.query("begin");
    try {
      await client.query(await readFile(join(dir, f), "utf8"));
      await client.query("insert into schema_migrations (name) values ($1)", [f]);
      await client.query("commit");
      console.log("selesai");
    } catch (e) {
      await client.query("rollback");
      throw e;
    }
  }
  console.log("database sudah terbaru");
} finally {
  client.release();
  await pool.end();
}
