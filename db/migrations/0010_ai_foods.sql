-- Makanan yang belum ada di tabel, dinilai AI sekali lalu disimpan untuk SEMUA pengguna
-- (hanya data gizi nama makanan, tanpa data pribadi). Berikutnya langsung dijawab tanpa AI.
create table ai_foods (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 2 and 60),
  aliases text[] not null default '{}',
  kategori text not null,
  purin text not null check (purin in ('rendah', 'sedang', 'tinggi')),
  garam text not null check (garam in ('rendah', 'sedang', 'tinggi')),
  karbo text not null check (karbo in ('rendah', 'sedang', 'tinggi')),
  gula text not null check (gula in ('rendah', 'sedang', 'tinggi')),
  lemak text not null check (lemak in ('rendah', 'sedang', 'tinggi')),
  ig text check (ig in ('rendah', 'sedang', 'tinggi')),
  alergen text[] not null default '{}',
  porsi_aman text not null default '',
  trik text[] not null default '{}',
  pemicu text[] not null default '{}',
  alasan text not null default '',
  model text,
  hits int not null default 1,
  verified boolean not null default false,       -- sudah dicek manusia (nanti dipindah ke tabel utama)
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);
