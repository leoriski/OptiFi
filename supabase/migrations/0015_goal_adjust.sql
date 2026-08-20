-- Mexer no saldo de uma meta era um read-modify-write feito no browser: lia-se
-- current_eur do estado do React, subtraía-se em JavaScript e escrevia-se o
-- valor absoluto de volta. Entre a leitura e a escrita o valor podia já ter
-- mudado (dois cliques seguidos, um levantamento antes do reload terminar), e a
-- segunda escrita apagava a primeira. Numa meta de poupança isso é dinheiro que
-- desaparece ou aparece do nada no ecrã.
--
-- Aqui a soma passa a ser feita dentro da base de dados sobre o valor atual, com
-- a linha bloqueada (FOR UPDATE) enquanto isso acontece, por isso duas chamadas
-- ao mesmo tempo somam as duas em vez de uma tapar a outra.
--
-- SECURITY INVOKER (o default) é intencional: a função corre com as permissões
-- de quem chama, logo o RLS da tabela goals continua a valer e ninguém mexe numa
-- meta que não é sua.
--
-- Devolve o delta que foi mesmo aplicado, que pode ser menor do que o pedido
-- quando o saldo não chega — o levantamento precisa de saber quanto saiu de
-- facto para registar o valor certo no histórico.
CREATE OR REPLACE FUNCTION goal_adjust(p_goal_id uuid, p_delta numeric)
RETURNS numeric
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  before_eur numeric;
  after_eur  numeric;
BEGIN
  SELECT current_eur INTO before_eur FROM goals WHERE id = p_goal_id FOR UPDATE;
  IF before_eur IS NULL THEN
    RETURN 0;
  END IF;

  -- A coluna tem check (current_eur >= 0): travar aqui evita rebentar a
  -- transação quando se tenta tirar mais do que existe.
  after_eur := GREATEST(0, before_eur + p_delta);
  UPDATE goals SET current_eur = after_eur WHERE id = p_goal_id;
  RETURN after_eur - before_eur;
END;
$$;

GRANT EXECUTE ON FUNCTION goal_adjust(uuid, numeric) TO authenticated;
