-- Registo de que a alocação mensal de uma meta JÁ foi feita num dado mês
-- (o dinheiro já saiu da conta para a meta). Uma linha por meta e por mês.
-- Aplicada via MCP em 17 jul 2026.
CREATE TABLE goal_monthly_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id uuid NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  month text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (goal_id, month)
);

ALTER TABLE goal_monthly_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own allocations select" ON goal_monthly_allocations
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own allocations insert" ON goal_monthly_allocations
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own allocations delete" ON goal_monthly_allocations
  FOR DELETE USING (auth.uid() = user_id);
