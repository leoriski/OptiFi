-- A análise dizia "categoriza-os na Atividade" e na Atividade não havia nada
-- para categorizar: a lista era só de leitura. Esta tabela é o sítio onde a
-- decisão do utilizador passa a viver.
--
-- Guarda-se uma REGRA por comerciante, não uma correção por linha, e a razão é
-- prática. O mesmo café aparece no extrato como "01 COMPRAS C.DEB SABORES
-- 1776944666" e "09 COMPRAS C.DEB SABORES 1781092435" — descritivos diferentes,
-- mesmo sítio. A chave é o nome que a app mostra (prettyMerchant), que colapsa
-- os dois em "Compras C Sabores". Assim uma decisão arruma todas as linhas
-- iguais deste mês E dos meses seguintes, em vez de obrigar a repetir o mesmo
-- trabalho a cada extrato.
--
-- O que isto resolve, e é o essencial: /api/reanalyze reescreve a coluna
-- `category` de todas as transações com o veredicto do categorizador
-- automático. Se a correção do utilizador vivesse só nessa coluna, o próximo
-- "Re-analisar" — ou a próxima importação, que cria linhas novas — apagava-a
-- em silêncio. Numa tabela à parte, é o automático que passa a ceder: a regra
-- do utilizador é consultada primeiro e o automático só decide o que sobra.
CREATE TABLE category_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  merchant text NOT NULL,
  category text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Uma regra por comerciante: recategorizar o mesmo sítio substitui a decisão
  -- anterior em vez de deixar duas regras a discutir entre si.
  UNIQUE (user_id, merchant)
);

ALTER TABLE category_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "category_rules: own all" ON category_rules
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
