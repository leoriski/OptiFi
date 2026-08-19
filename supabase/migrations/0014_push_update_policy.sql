-- /api/push/subscribe faz upsert com onConflict 'endpoint' para o mesmo browser
-- não criar linhas duplicadas. Um upsert é INSERT ... ON CONFLICT DO UPDATE, e
-- a tabela só tinha políticas de select/insert/delete: o UPDATE era recusado
-- pelo RLS e a rota devolvia 500 sempre que a subscrição já existia. Resultado
-- prático: as chaves nunca eram renovadas — o utilizador via os lembretes
-- ligados e as notificações deixavam de chegar quando o browser rodava a chave.
CREATE POLICY "own push update" ON push_subscriptions
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
