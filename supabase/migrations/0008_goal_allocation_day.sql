-- Dia do mês (1–28) em que a meta reserva a alocação mensal. Antes desse dia,
-- o valor ainda NÃO é subtraído do "livre para gastar". Default 1 (início do mês).
-- Aplicada via MCP em 16 jul 2026.
ALTER TABLE goals ADD COLUMN allocation_day integer NOT NULL DEFAULT 1
  CHECK (allocation_day >= 1 AND allocation_day <= 28);
