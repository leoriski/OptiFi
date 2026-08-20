-- Os movimentos manuais são, na prática, um PLANO: a pessoa recebe o salário no
-- dia 28 e regista tudo o que tem a pagar para saber com quanto fica. Até aqui a
-- app tratava-os todos como já saídos da conta, e o "saldo atual" era a âncora
-- menos tudo o que estava registado depois dela. Duas coisas erradas saíam daí:
--
--   1. Uma despesa registada com antecedência baixava logo o saldo, mesmo com o
--      dinheiro ainda na conta.
--   2. Ao reajustar o saldo, tudo o que estava registado ANTES da nova âncora
--      deixava de contar (a âncora nova é mais recente do que os movimentos).
--      Numa conta real isso devolveu €712 de despesas ao dinheiro disponível —
--      a app dizia que dava para gastar dinheiro que já tinha dono.
--
-- Com esta coluna as duas contas passam a ser coisas separadas e ambas honestas:
--
--   saldo atual = âncora + receitas posteriores − despesas pagas DEPOIS da âncora
--   livre       = saldo atual − reservado para metas − despesas POR PAGAR
--
-- Guarda-se o INSTANTE do pagamento, não um sim/não. A diferença importa: uma
-- despesa registada a 19, com a âncora do saldo definida a 20, e paga a 25 saiu
-- da conta DEPOIS da âncora — tem de a baixar. Com um booleano não havia como
-- saber isso, e marcar "paga" deixava o saldo quieto. Comparar paid_at com a
-- data da âncora responde à pergunta certa: este dinheiro já está refletido no
-- saldo que a pessoa copiou do banco, ou saiu depois disso?
--
-- NULL = por pagar, e é esse o default porque é esse o gesto: regista-se
-- primeiro o que há a pagar. Vale também para as linhas que já existem — são
-- despesas do mês em curso que devem continuar a pesar no que ainda se pode
-- gastar. A âncora (note = '__opening_balance__') é uma receita, não é afetada.
ALTER TABLE manual_entries DROP COLUMN IF EXISTS paid;
ALTER TABLE manual_entries ADD COLUMN paid_at timestamptz;

-- paid_at e created_at são comparados um com o outro, por isso têm de vir do
-- MESMO relógio. created_at usa now() do Postgres; se paid_at viesse do
-- telemóvel, um relógio adiantado dois minutos punha um pagamento feito antes
-- da âncora a parecer posterior a ela — e a despesa era descontada duas vezes,
-- em silêncio. O cliente diz apenas se está paga ou não; a hora é sempre daqui.
CREATE OR REPLACE FUNCTION manual_entries_stamp_paid_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.paid_at IS NOT NULL THEN NEW.paid_at := now(); END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER manual_entries_stamp_paid_at
BEFORE INSERT OR UPDATE OF paid_at ON manual_entries
FOR EACH ROW EXECUTE FUNCTION manual_entries_stamp_paid_at();
