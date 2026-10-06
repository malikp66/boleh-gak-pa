-- Isian bebas "Lainnya" + hasil pemahaman AI yang sudah dikonfirmasi pengguna.
alter table profiles
  add column kondisi_lain text not null default '' check (char_length(kondisi_lain) <= 300),
  add column obat_lain text not null default '' check (char_length(obat_lain) <= 300),
  add column alergen_lain text not null default '' check (char_length(alergen_lain) <= 200),
  -- { ringkasan, fokus, hindari[], batasi[], perlu_dokter, sumber, dibuat }
  add column personalisasi jsonb;

-- Cache audio suara AI (key = hash suara + teks); file audionya di Neon Object Storage.
create table tts_cache (
  key text primary key,
  object_key text not null,
  bytes int not null,
  created_at timestamptz not null default now()
);
