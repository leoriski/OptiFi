-- Subscrições Web Push do utilizador + preferência de lembretes de metas.
-- Aplicada via MCP em 17 jul 2026.
CREATE TABLE push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own push select" ON push_subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own push insert" ON push_subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own push delete" ON push_subscriptions FOR DELETE USING (auth.uid() = user_id);
ALTER TABLE profiles ADD COLUMN goal_reminders boolean NOT NULL DEFAULT true;
