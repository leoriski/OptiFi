-- Adiciona a categoria 'educacao' (escola/propinas/universidade) às CHECK
-- constraints de category. Aplicada via MCP em 16 jul 2026.
ALTER TABLE transactions DROP CONSTRAINT transactions_category_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_category_check
  CHECK (category = ANY (ARRAY['habitacao','alimentacao','transporte','lazer','subscricoes','saude','educacao','receita','outros']));

ALTER TABLE manual_entries DROP CONSTRAINT manual_entries_category_check;
ALTER TABLE manual_entries ADD CONSTRAINT manual_entries_category_check
  CHECK (category = ANY (ARRAY['habitacao','alimentacao','transporte','lazer','subscricoes','saude','educacao','receita','outros']));
