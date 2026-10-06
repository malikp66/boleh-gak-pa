-- Obat, target dokter, kontak darurat per profil + langganan notifikasi pengingat.
alter table profiles
  add column obat text[] not null default '{}',
  add column target_gula_puasa int check (target_gula_puasa between 60 and 250),
  add column target_gula_2jam int check (target_gula_2jam between 80 and 300),
  add column target_sistolik int check (target_sistolik between 80 and 200),
  add column target_diastolik int check (target_diastolik between 50 and 130),
  add column kontak_nama text not null default '' check (char_length(kontak_nama) <= 40),
  add column kontak_telepon text not null default '' check (char_length(kontak_telepon) <= 20);

create table push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  profile_id uuid references profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  pagi boolean not null default true,   -- 07.00 WIB: cek gula darah/tensi pagi
  malam boolean not null default true,  -- 19.00 WIB: catat makan hari ini
  created_at timestamptz not null default now()
);
create index push_subscriptions_user on push_subscriptions (user_id);
