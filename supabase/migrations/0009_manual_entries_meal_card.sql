-- Despesa paga com o cartão refeição: sai do pote do cartão, não da conta.
-- Aplicada via MCP em 17 jul 2026.
ALTER TABLE manual_entries ADD COLUMN meal_card boolean NOT NULL DEFAULT false;
