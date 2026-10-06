-- Boleh Gak, Ya? — skema awal (Neon Postgres)
-- Prinsip: setiap baris milik satu keluarga. Hak akses diperiksa di server (src/lib/server.ts):
-- setiap query menyertakan syarat "pengguna adalah anggota keluarga ini".
-- Tabel makanan bawaan (271 item) TIDAK disimpan di sini: ikut di kode (src/lib/foods/foods.json).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- pengguna & perangkat
-- Tanpa daftar: setiap perangkat punya kunci acak (cookie httpOnly). Yang disimpan hanya hash-nya.
-- Kunci yang sama ditampilkan ke pengguna sebagai "kode pemulihan".
create table users (
  id uuid primary key default gen_random_uuid(),
  device_key_hash text unique,
  auth_user_id text unique, -- untuk login Google lewat Neon Auth (opsional, nanti)
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now()
);

-- Rem pembuatan perangkat baru per IP (mencegah akun massal untuk mengakali kuota AI).
create table device_creations (
  ip_hash text not null,
  day date not null default current_date,
  count int not null default 0,
  primary key (ip_hash, day)
);

-- ---------------------------------------------------------------- keluarga
create table families (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  invite_code text not null unique default upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8)),
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table family_members (
  family_id uuid not null references families(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (family_id, user_id)
);
create index family_members_user on family_members (user_id);

-- Persetujuan pemrosesan data kesehatan (UU PDP).
create table consents (
  user_id uuid primary key references users(id) on delete cascade,
  version text not null,
  consented_at timestamptz not null default now()
);

-- Orang yang dijaga: diri sendiri atau anggota keluarga.
create table profiles (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  nama text not null check (char_length(nama) between 1 and 40),
  panggilan text not null default 'kamu' check (char_length(panggilan) between 1 and 20),
  usia int check (usia between 1 and 120),
  untuk text not null default 'diri' check (untuk in ('diri', 'orang_tua', 'pasangan', 'anak', 'lainnya')),
  -- kode kondisi: diabetes | hipertensi | asam_urat | kolesterol | alergi | sehat (lihat src/lib/conditions.ts)
  kondisi text[] not null default '{}',
  alergen text[] not null default '{}',
  diabetes_tipe text check (diabetes_tipe in ('pradiabetes', 'tipe_2', 'tipe_1', 'gestasional', 'tidak_tahu')),
  insulin boolean not null default false,
  catatan_dokter text not null default '' check (char_length(catatan_dokter) <= 500),
  created_at timestamptz not null default now()
);
create index profiles_family on profiles (family_id);

-- ---------------------------------------------------------------- data harian
create table custom_foods (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  aliases text[] not null default '{}',
  kategori text not null default 'Buatan keluarga',
  bahan text not null default '',
  purin text not null check (purin in ('rendah', 'sedang', 'tinggi')),
  garam text not null check (garam in ('rendah', 'sedang', 'tinggi')),
  karbo text not null default 'sedang' check (karbo in ('rendah', 'sedang', 'tinggi')),
  gula text not null default 'rendah' check (gula in ('rendah', 'sedang', 'tinggi')),
  lemak text not null default 'rendah' check (lemak in ('rendah', 'sedang', 'tinggi')),
  alergen text[] not null default '{}',
  porsi_aman text not null default '',
  trik text[] not null default '{}',
  pemicu text[] not null default '{}',
  alasan text not null default '',
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (family_id, name)
);

create table meals (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  at timestamptz not null default now(),
  food text not null check (char_length(food) <= 200),
  portion text not null default '',
  status text not null check (status in ('hijau', 'kuning', 'merah')),
  purin text,
  garam text,
  karbo text,
  gula text,
  lemak text,
  note text not null default '',
  created_by uuid references users(id) on delete set null
);
create index meals_profile_at on meals (profile_id, at desc);

create table flares (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  started timestamptz not null default now(),
  ended timestamptz,
  joint text not null default 'jempol kaki',
  pain int not null check (pain between 0 and 10),
  fever boolean not null default false,
  note text not null default ''
);
create index flares_profile on flares (profile_id, started desc);
-- paling banyak satu kambuh aktif per orang
create unique index flares_one_active on flares (profile_id) where ended is null;

create table pain_logs (
  id uuid primary key default gen_random_uuid(),
  flare_id uuid not null references flares(id) on delete cascade,
  at timestamptz not null default now(),
  pain int not null check (pain between 0 and 10)
);

-- Catatan pemantauan: gula darah (mg/dL) atau tensi (sistolik/diastolik mmHg).
create table health_logs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  kind text not null check (kind in ('gula_darah', 'tensi')),
  at timestamptz not null default now(),
  value1 int not null check (value1 between 10 and 700),
  value2 int check (value2 between 20 and 200),
  context text not null default '' check (char_length(context) <= 40),
  note text not null default '' check (char_length(note) <= 200)
);
create index health_logs_profile on health_logs (profile_id, kind, at desc);

-- ---------------------------------------------------------------- AI: cache & kuota
-- Isi cache adalah teks saran umum, tanpa data pribadi; dipakai ulang semua pengguna.
create table ai_cache (
  key text primary key,
  response jsonb not null,
  model text not null,
  created_at timestamptz not null default now()
);

create table ai_usage (
  user_id uuid not null references users(id) on delete cascade,
  day date not null default current_date,
  kind text not null check (kind in ('assess', 'photo', 'analyze', 'summary')),
  count int not null default 0,
  primary key (user_id, day, kind)
);
