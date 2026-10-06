-- Masuk & pengingat lewat WhatsApp.
-- Nomor WA mengikat akun: ganti HP / aplikasi terhapus → kirim kode lagi lewat WA, data kembali.
alter table users
  add column phone text unique,                       -- format 08… (sudah dinormalisasi)
  add column wa_linked_at timestamptz,
  add column wa_last_inbound timestamptz,             -- pesan terakhir dari pengguna (jendela 24 jam WA)
  add column self_profile_id uuid references profiles(id) on delete set null; -- nomor ini milik profil siapa

-- Satu akun bisa dipakai beberapa HP (HP lama + HP baru yang masuk lewat WA).
create table user_devices (
  key_hash text primary key,
  user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index user_devices_user on user_devices (user_id);

-- Kode sekali pakai yang dikirim pengguna ke nomor WA aplikasi.
create table wa_links (
  code text primary key,
  user_id uuid not null references users(id) on delete cascade,
  profile_id uuid references profiles(id) on delete set null,
  expires_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'linked', 'merged', 'conflict')),
  phone text,
  created_at timestamptz not null default now()
);
create index wa_links_user on wa_links (user_id, created_at desc);
