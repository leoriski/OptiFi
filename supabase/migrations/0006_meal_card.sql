-- ============================================================
-- OptiFi — Cartão/ticket refeição (Portugal)
-- Subsídio mensal de alimentação que muitas empresas dão. Eleva o teto de
-- alimentação na análise (dinheiro dedicado a comida). Guardado no perfil.
-- ============================================================

alter table public.profiles
  add column if not exists meal_card_eur numeric(12,2);
