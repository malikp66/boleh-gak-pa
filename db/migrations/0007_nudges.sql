-- "Bel" ke anggota keluarga yang lupa mencatat.
create table nudges (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  from_user uuid references users(id) on delete set null,
  auto boolean not null default false,     -- true = dikirim otomatis oleh cron
  created_at timestamptz not null default now()
);
create index nudges_profile on nudges (profile_id, created_at desc);

-- Perangkat ini mau dikabari kalau anggota keluarga lain belum mencatat (21.00 WIB).
alter table push_subscriptions add column keluarga boolean not null default true;
