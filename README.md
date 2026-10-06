# Boleh Gak, Ya?

Teman makan untuk yang sedang menjaga kesehatan. Saat ini mendukung **asam urat & darah tinggi**, dan **diabetes** serta kondisi lain sedang dikerjakan. Ketik atau foto makanannya, lalu dapat lampu 🟢🟡🔴, porsi aman, tips di warung, dan kalimat untuk menolak dengan sopan. Ada juga catatan makan, log kambuh dengan estimasi sembuh, dan ringkasan mingguan.

> Awalnya bernama *Boleh Gak, Pa?*, dibuat untuk ayah saya. v1 (HTML + Python + Gemma lokal) adalah versi yang disubmit ke DEV Hacktoberfest Weekend Challenge, 5 Okt 2026.
> Kodenya ada di [`legacy-v1/`](legacy-v1) dan di tag `hf26-submission`. **Semua commit setelah deadline challenge ada di branch `v2`.**

## Arsitektur

```
HP (PWA) ──► Vercel: Next.js 16 (UI + API routes) ──┬──► Supabase: Postgres + Auth (Google) + RLS
                                                    └──► Gemma 3 lewat Google AI Studio (atau Ollama lokal)
```

- **Tabel dulu, AI belakangan.** Lampu, porsi, dan kombinasi (dobel garam = merah) ditentukan [tabel 271 makanan](src/lib/foods/foods.json) + aturan di [`match.ts`](src/lib/foods/match.ts). AI hanya menulis kalimatnya.
- **Hemat biaya AI.** Jawaban disimpan di `ai_cache` dan dipakai ulang semua keluarga (saran umum, tanpa data pribadi). Ada batas harian per pengguna (`consume_ai_quota`), dan kalau AI gagal atau kuota habis, jawaban otomatis jatuh ke tabel.
- **Privasi.** Row Level Security memastikan setiap keluarga hanya melihat datanya sendiri. Foto tidak disimpan. Ada layar persetujuan (UU PDP) dan [halaman privasi](src/app/privasi/page.tsx).

## Setup

### 1. Supabase
1. Buat project di [supabase.com](https://supabase.com), region **Southeast Asia (Singapore)**.
2. **SQL Editor** → tempel isi [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) → Run.
3. **Authentication → Sign In / Providers → Google**: aktifkan dan isi Client ID & Secret dari Google Cloud Console (OAuth client, tipe *Web application*). Redirect URI di Google: `https://<project>.supabase.co/auth/v1/callback`.
4. **Authentication → URL Configuration**: Site URL = domain Vercel-mu. Tambahkan `http://localhost:3000/**` dan `https://<domain>/**` ke Redirect URLs.

### 2. Google AI Studio
[aistudio.google.com](https://aistudio.google.com) → *Get API key*. Pasang **batas pengeluaran / kuota** di Google Cloud sejak awal.

### 3. Jalankan lokal
```bash
cp .env.example .env.local   # lalu isi nilainya
npm install
npm run dev
```

### 4. Deploy ke Vercel
Import repo di [vercel.com](https://vercel.com) → pilih branch `v2` → isi semua variabel dari `.env.example` di *Environment Variables* → Deploy.

## Perintah

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Server pengembangan |
| `npm test` | Tes logika pencocokan makanan, foto, dan estimasi sembuh |
| `RUN_AI=1 AI_PROVIDER=ollama npx vitest run test/ai.integration.test.ts` | Tes adapter AI dengan model sungguhan |
| `npm run build` | Build produksi |

## Mengubah data makanan
Sumbernya ada di [`legacy-v1/tools/build_foods.py`](legacy-v1/tools/build_foods.py), satu baris per makanan. Jalankan `python3 legacy-v1/tools/build_foods.py`, lalu salin `legacy-v1/data/foods.json` ke `src/lib/foods/foods.json` dan jalankan `npm test`.

> ⚕️ Bukan saran medis. Tabel makanan adalah ringkasan panduan umum diet rendah purin & rendah garam. Sebelum disebar luas, minta ahli gizi atau dokter meninjaunya.

Credits: Gemma 3 (Google DeepMind, open weights) · Ollama · Supabase · Next.js · Archivo Black & Space Grotesk (SIL OFL). License: MIT
