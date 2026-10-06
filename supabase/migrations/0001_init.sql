-- Boleh Gak, Ya? — skema awal
-- Prinsip: setiap baris milik satu keluarga; RLS memastikan pengguna hanya melihat keluarganya sendiri.
-- Tabel makanan bawaan (271 item) TIDAK disimpan di sini: ikut di kode (src/lib/foods/foods.json).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- keluarga
create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 60),
  invite_code text not null unique default upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8)),
  created_by uuid not null default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.family_members (
  family_id uuid not null references public.families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (family_id, user_id)
);

-- Persetujuan pemrosesan data kesehatan (UU PDP).
create table public.consents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  version text not null,
  consented_at timestamptz not null default now()
);

-- Orang yang dijaga: diri sendiri atau anggota keluarga. Tidak harus punya akun sendiri.
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  nama text not null check (char_length(nama) between 1 and 40),
  panggilan text not null default 'kamu' check (char_length(panggilan) between 1 and 20),
  usia int check (usia between 1 and 120),
  kondisi text[] not null default '{}',
  catatan_dokter text not null default '' check (char_length(catatan_dokter) <= 500),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- data harian
create table public.custom_foods (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  aliases text[] not null default '{}',
  kategori text not null default 'Buatan keluarga',
  bahan text not null default '',
  purin text not null check (purin in ('rendah', 'sedang', 'tinggi')),
  garam text not null check (garam in ('rendah', 'sedang', 'tinggi')),
  porsi_aman text not null default '',
  trik text[] not null default '{}',
  pemicu text[] not null default '{}',
  alasan text not null default '',
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (family_id, name)
);

create table public.meals (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  at timestamptz not null default now(),
  food text not null check (char_length(food) <= 200),
  portion text not null default '',
  status text not null check (status in ('hijau', 'kuning', 'merah')),
  purin text,
  garam text,
  note text not null default '',
  created_by uuid default auth.uid() references auth.users(id) on delete set null
);
create index meals_profile_at on public.meals (profile_id, at desc);

create table public.flares (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  started timestamptz not null default now(),
  ended timestamptz,
  joint text not null default 'jempol kaki',
  pain int not null check (pain between 0 and 10),
  fever boolean not null default false,
  note text not null default ''
);
create index flares_profile on public.flares (profile_id, started desc);
-- paling banyak satu kambuh aktif per orang
create unique index flares_one_active on public.flares (profile_id) where ended is null;

create table public.pain_logs (
  id uuid primary key default gen_random_uuid(),
  flare_id uuid not null references public.flares(id) on delete cascade,
  at timestamptz not null default now(),
  pain int not null check (pain between 0 and 10)
);

-- ---------------------------------------------------------------- AI: cache & kuota
-- Ditulis hanya oleh server (service role). Isinya teks saran umum, tanpa data pribadi.
create table public.ai_cache (
  key text primary key,
  response jsonb not null,
  model text not null,
  created_at timestamptz not null default now()
);

create table public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default current_date,
  kind text not null check (kind in ('assess', 'photo', 'analyze', 'summary')),
  count int not null default 0,
  primary key (user_id, day, kind)
);

-- ---------------------------------------------------------------- helper
create or replace function public.is_family_member(fid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from family_members where family_id = fid and user_id = auth.uid());
$$;

create or replace function public.profile_family(pid uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select family_id from profiles where id = pid;
$$;

-- Buat keluarga baru, pembuatnya otomatis admin.
create or replace function public.create_family(p_name text)
returns public.families language plpgsql security definer set search_path = public as $$
declare f families;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  insert into families (name, created_by) values (p_name, auth.uid()) returning * into f;
  insert into family_members (family_id, user_id, role) values (f.id, auth.uid(), 'admin');
  return f;
end $$;

-- Gabung keluarga lewat kode undangan.
create or replace function public.join_family(p_code text)
returns public.families language plpgsql security definer set search_path = public as $$
declare f families;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into f from families where invite_code = upper(trim(p_code));
  if not found then raise exception 'kode undangan tidak ditemukan'; end if;
  insert into family_members (family_id, user_id) values (f.id, auth.uid()) on conflict do nothing;
  return f;
end $$;

-- Pakai satu jatah AI; false kalau sudah melewati batas harian.
create or replace function public.consume_ai_quota(p_kind text, p_limit int)
returns boolean language plpgsql security definer set search_path = public as $$
declare c int;
begin
  if auth.uid() is null then return false; end if;
  insert into ai_usage (user_id, day, kind, count) values (auth.uid(), current_date, p_kind, 1)
  on conflict (user_id, day, kind) do update set count = ai_usage.count + 1
  returning count into c;
  return c <= p_limit;
end $$;

-- ---------------------------------------------------------------- RLS
alter table public.families enable row level security;
alter table public.family_members enable row level security;
alter table public.consents enable row level security;
alter table public.profiles enable row level security;
alter table public.custom_foods enable row level security;
alter table public.meals enable row level security;
alter table public.flares enable row level security;
alter table public.pain_logs enable row level security;
alter table public.ai_cache enable row level security;
alter table public.ai_usage enable row level security;

create policy "anggota melihat keluarganya" on public.families
  for select using (is_family_member(id));
create policy "admin mengubah nama keluarga" on public.families
  for update using (exists (select 1 from family_members m where m.family_id = id and m.user_id = auth.uid() and m.role = 'admin'));

create policy "anggota melihat sesama anggota" on public.family_members
  for select using (is_family_member(family_id));
create policy "keluar dari keluarga" on public.family_members
  for delete using (user_id = auth.uid());

create policy "persetujuan sendiri" on public.consents
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "profil keluarga" on public.profiles
  for all using (is_family_member(family_id)) with check (is_family_member(family_id));

create policy "makanan keluarga" on public.custom_foods
  for all using (is_family_member(family_id)) with check (is_family_member(family_id));

create policy "catatan makan keluarga" on public.meals
  for all using (is_family_member(profile_family(profile_id))) with check (is_family_member(profile_family(profile_id)));

create policy "kambuh keluarga" on public.flares
  for all using (is_family_member(profile_family(profile_id))) with check (is_family_member(profile_family(profile_id)));

create policy "nyeri keluarga" on public.pain_logs
  for all using (exists (select 1 from flares fl where fl.id = flare_id and is_family_member(profile_family(fl.profile_id))))
  with check (exists (select 1 from flares fl where fl.id = flare_id and is_family_member(profile_family(fl.profile_id))));

-- ai_cache: tidak ada policy → hanya service role (server) yang bisa baca/tulis.
create policy "lihat kuota sendiri" on public.ai_usage
  for select using (user_id = auth.uid());

grant execute on function public.create_family(text) to authenticated;
grant execute on function public.join_family(text) to authenticated;
grant execute on function public.consume_ai_quota(text, int) to authenticated;
