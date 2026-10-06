-- Jatah harian suara AI.
alter table ai_usage drop constraint ai_usage_kind_check;
alter table ai_usage add constraint ai_usage_kind_check check (kind in ('assess', 'photo', 'analyze', 'summary', 'tts'));
