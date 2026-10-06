-- Catatan pemakaian token AI per hari per model, untuk rem anggaran bulanan (AI_MONTHLY_BUDGET_USD).
create table ai_spend (
  day date not null default (now() at time zone 'Asia/Jakarta')::date,
  model text not null,
  calls int not null default 0,
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  est_usd numeric(12, 6) not null default 0,
  primary key (day, model)
);
