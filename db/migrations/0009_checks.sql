-- Setiap "Boleh gak?" disimpan sebagai pertanyaan yang belum dijawab,
-- supaya bisa ditanyakan lagi ("Tadi soto ayam jadinya dimakan?") kalau pengguna lupa menekan tombol catat.
create table checks (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  food text not null check (char_length(food) <= 200),
  status text not null check (status in ('hijau', 'kuning', 'merah')),
  garam text, karbo text, purin text, gula text,
  note text not null default '',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolution text check (resolution in ('sesuai saran', 'porsi penuh', 'ditolak', 'batal'))
);
create index checks_pending on checks (profile_id, created_at desc) where resolved_at is null;
