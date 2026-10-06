# Boleh Gak, Ya?

Teman makan untuk yang sedang menjaga kesehatan: **diabetes**, **darah tinggi**, **asam urat**, **kolesterol tinggi**, **pasca stroke/jantung**, **darah rendah**, **alergi makanan**, atau sekadar ingin makan lebih sehat. Bisa ditanya pakai suara 🎤, memperingatkan interaksi makanan dengan obat, punya tombol darurat stroke (SeGeRa Ke RS, 119), dan pengingat harian. Ketik atau foto makanannya, lalu dapat lampu 🟢🟡🔴, porsi aman, tips di warung, dan kalimat untuk menolak dengan sopan. Ada juga catatan makan, pemantauan (gula darah, tensi, kambuh asam urat) dengan tanda bahaya, dan ringkasan mingguan. Bisa langsung dipakai tanpa daftar.

> Awalnya bernama *Boleh Gak, Pa?*, dibuat untuk ayah saya. v1 (HTML + Python + Gemma lokal) adalah versi yang disubmit ke DEV Hacktoberfest Weekend Challenge, 5 Okt 2026.
> Kodenya ada di [`legacy-v1/`](legacy-v1) dan di tag `hf26-submission`. **Semua commit setelah deadline challenge ada di branch `v2`.**

## Arsitektur

```
HP (PWA) ──► Vercel: Next.js 16 (UI + API routes) ──┬──► Neon Postgres (Singapura)
                                                    └──► Gemini lewat Google AI Studio (atau Gemma lokal via Ollama)
```

- **Tabel dulu, AI belakangan.** Lampu ditentukan [tabel 342 makanan](src/lib/foods/foods.json) (purin, garam, karbo, gula, lemak jenuh, indeks glikemik, alergen) + aturan per kondisi di [`conditions.ts`](src/lib/conditions.ts), termasuk aturan kombinasi (dobel garam, dobel karbohidrat). AI hanya menulis kalimatnya. Semua sumber & ambang: [docs/SUMBER-GIZI.md](docs/SUMBER-GIZI.md).
- **Tanpa daftar.** Saat pertama dibuka, server membuat kunci acak 120-bit untuk perangkat itu (cookie httpOnly + cadangan di browser). Database hanya menyimpan hash-nya. Kunci yang sama ditampilkan sebagai **kode pemulihan** (`XXXX-XXXX-…`) untuk membuka data lagi setelah data browser dihapus atau ganti HP. Lihat [`server.ts`](src/lib/server.ts) dan [`device-key.ts`](src/lib/device-key.ts).
- **Hemat biaya AI.** Teks memakai `gemini-3.1-flash-lite` (thinking minimal), foto memakai `gemini-3.8-flash` (dibatasi 8/hari/orang). Setiap panggilan dicatat di `ai_spend`, dan kalau perkiraan biaya bulan ini melewati `AI_MONTHLY_BUDGET_USD` (default $5), aplikasi otomatis kembali ke mode tabel. Jawaban disimpan di `ai_cache` dan dipakai ulang semua keluarga (saran umum, tanpa data pribadi). Ada batas harian per pengguna (tabel `ai_usage`) dan batas perangkat baru per IP, dan kalau AI gagal atau kuota habis, jawaban otomatis jatuh ke tabel.
- **Privasi.** Setiap query data keluarga di server menyertakan syarat keanggotaan keluarga. Foto tidak disimpan. Ada layar persetujuan (UU PDP) dan [halaman privasi](src/app/privasi/page.tsx).

## Setup

### 1. Neon
Project sudah dibuat dan ditautkan (`neon link`, lihat [`neon.ts`](neon.ts)). Di mesin baru:
```bash
npx neon@latest login
npx neon@latest link --project-id holy-hall-49215672 --branch production -y   # mengisi .env
npm run migrate                                                                   # menjalankan db/migrations/*.sql
```
Uji migrasi baru di branch Neon terpisah dulu sebelum menjalankannya di `production`.

### 2. Google AI Studio
[aistudio.google.com](https://aistudio.google.com) → *Get API key*. Pasang **batas pengeluaran / kuota** di Google Cloud sejak awal.

### 3. Jalankan lokal
```bash
npm install                  # .env sudah diisi `neon link`; tambahkan GOOGLE_AI_API_KEY sendiri
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

Credits: Gemma 3 (Google DeepMind, open weights) · Ollama · Neon · Next.js · Archivo Black & Space Grotesk (SIL OFL). License: MIT
