-- ============================================================
-- OptiFi — Estado dos itens do plano de poupança
-- Os itens são DERIVADOS dos movimentos (função pura, nunca guardados);
-- só a decisão do utilizador (feito/ignorado) persiste, chaveada por
-- item_key estável (ex.: 'cap_lazer') dentro de cada import.
-- Correr em: Supabase Dashboard → SQL Editor.
-- ============================================================

alter table public.plan_items add column if not exists item_key text;

create unique index if not exists plan_items_user_import_key
  on public.plan_items (user_id, import_id, item_key)
  where item_key is not null;
