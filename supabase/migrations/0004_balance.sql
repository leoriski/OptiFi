-- ============================================================
-- OptiFi — Saldo real ligado a tudo
-- O utilizador define o saldo atual UMA vez (âncora); a partir daí cada
-- movimento manual ajusta-o. Os extratos guardam o saldo final do banco
-- para sugerir a âncora. Correr em: Supabase Dashboard → SQL Editor.
-- ============================================================

alter table public.profiles
  add column if not exists balance_eur numeric(12,2),
  add column if not exists balance_set_at timestamptz;

alter table public.imports
  add column if not exists ending_balance numeric(12,2);
