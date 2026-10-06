-- Dasar perhitungan makanan hasil belajar: angka per porsi + rincian bahan + sumbernya.
alter table ai_foods
  add column nutrisi jsonb,          -- { porsi_g, karbo_g, gula_g, natrium_mg, lemak_jenuh_g, ig, cakupan }
  add column rincian jsonb,          -- [{ label, gram, karbo, gula, natrium, lemak_jenuh, sumber }]
  add column sumber text check (sumber in ('bahan', 'kemasan')),
  add column sumber_ref text;
-- yang dibuat sebelum ada dasar perhitungan dinilai ulang saat ditanya lagi
delete from ai_foods where nutrisi is null;
