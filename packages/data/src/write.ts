import {
  applyCategoryRules,
  merchantKey,
  monthKey,
  toRuleMap,
  type CategoryKey,
  type PlanItemStatus,
  type SubscriptionStatus,
} from '@optifi/core';
import { categorizeStatement, groupSubscriptions, summariseTotals } from '@optifi/ingest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { OPENING_NOTE } from './balance.js';
import type { GoalRow } from './types.js';

export interface GoalDraft {
  id?: string;
  name: string;
  icon_key: string;
  target_eur: number;
  current_eur: number;
  target_month: number;
  target_year: number;
  monthly_allocation: number;
  allocation_day: number;
}

export interface ManualDraft {
  type: 'income' | 'expense';
  amount: number;
  category: CategoryKey;
  note: string;
  mealCard?: boolean;
  paid?: boolean;
}

/**
 * Todas as escritas de dinheiro, num sítio só. Estavam duplicadas na web e por
 * escrever na nativa; duas cópias das mesmas regras (a âncora do saldo, o que
 * conta como pago, a alocação de uma meta ser uma transferência) acabam sempre
 * por divergir, e é aí que a app começa a mostrar dois saldos diferentes.
 *
 * Não devolve dados: quem chama recarrega com `loadFinanceSnapshot`, que é o
 * único caminho de leitura.
 */
export function financeWrites(supabase: SupabaseClient, today: Date = new Date()) {
  const planMonth = monthKey(today);

  const userId = async (): Promise<string | null> => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  };

  return {
    planMonth,

    /**
     * Fixa o saldo "agora". Substitui qualquer âncora anterior deste mês: o que
     * o utilizador copia do banco passa a ser o novo ponto de partida, e os
     * movimentos registados depois contam a partir daí.
     */
    async setBalance(eur: number): Promise<void> {
      const uid = await userId();
      // `amount` tem CHECK > 0 no schema; o saldo é "quanto tens", por isso
      // aceita-se ≥ 0 e guarda-se ≥ 0.01 para respeitar a constraint.
      if (!uid || Number.isNaN(eur) || eur < 0) return;
      await supabase.from('manual_entries').delete().eq('user_id', uid).eq('month', planMonth).eq('note', OPENING_NOTE);
      await supabase.from('manual_entries').insert({
        user_id: uid,
        month: planMonth,
        entry_type: 'income',
        amount: Math.max(0.01, eur),
        category: 'outros',
        note: OPENING_NOTE,
      });
    },

    async clearBalance(): Promise<void> {
      const uid = await userId();
      if (!uid) return;
      await supabase.from('manual_entries').delete().eq('user_id', uid).eq('month', planMonth).eq('note', OPENING_NOTE);
    },

    async setMealCardValue(eur: number): Promise<void> {
      const uid = await userId();
      if (!uid || Number.isNaN(eur) || eur < 0) return;
      await supabase.from('profiles').update({ meal_card_eur: eur }).eq('id', uid);
    },

    async setSubVerdict(id: string, status: SubscriptionStatus): Promise<void> {
      await supabase.from('subscriptions').update({ user_status: status }).eq('id', id);
    },

    async addSubscription(name: string, price: number): Promise<void> {
      const uid = await userId();
      if (!uid || !name.trim() || !(price > 0)) return;
      // import_id null = manual; sobrevive a reimportações. Começa 'unknown'
      // para a app perguntar "usas?" como nas detetadas.
      await supabase.from('subscriptions').insert({ user_id: uid, import_id: null, name: name.trim(), price });
    },

    async removeSubscription(id: string): Promise<void> {
      await supabase.from('subscriptions').delete().eq('id', id);
    },

    async setPlanItemState(
      importId: string,
      itemKey: string,
      state: PlanItemStatus,
      title: string,
      saving: number,
    ): Promise<void> {
      const uid = await userId();
      if (!uid) return;
      const { data: updated } = await supabase
        .from('plan_items')
        .update({ state, monthly_saving: saving })
        .eq('import_id', importId)
        .eq('item_key', itemKey)
        .select('id');
      if (!updated || updated.length === 0) {
        await supabase
          .from('plan_items')
          .insert({ user_id: uid, import_id: importId, item_key: itemKey, title, monthly_saving: saving, state });
      }
    },

    async saveGoal(draft: GoalDraft): Promise<void> {
      const uid = await userId();
      if (!uid) return;
      const row = {
        name: draft.name,
        icon_key: draft.icon_key,
        target_eur: draft.target_eur,
        current_eur: draft.current_eur,
        target_month: draft.target_month,
        target_year: draft.target_year,
        monthly_allocation: draft.monthly_allocation,
        allocation_day: draft.allocation_day,
      };
      if (draft.id) await supabase.from('goals').update(row).eq('id', draft.id);
      else await supabase.from('goals').insert({ ...row, user_id: uid });
    },

    async deleteGoal(id: string): Promise<void> {
      await supabase.from('goals').delete().eq('id', id);
    },

    async setAllocation(id: string, value: number): Promise<void> {
      await supabase.from('goals').update({ monthly_allocation: Math.max(0, value) }).eq('id', id);
    },

    /**
     * Tira dinheiro da reserva de uma meta e devolve-o ao disponível do mês. A
     * conta é feita na base de dados (`goal_adjust`), que trava no zero e
     * devolve quanto saiu mesmo — é esse valor que fica no histórico, não o
     * que foi pedido.
     */
    async withdrawFromGoal(id: string, amount: number): Promise<void> {
      const uid = await userId();
      if (!uid || amount <= 0) return;
      const { data: applied } = await supabase.rpc('goal_adjust', { p_goal_id: id, p_delta: -amount });
      const taken = -Number(applied ?? 0);
      if (taken <= 0) return;
      await supabase.from('goal_withdrawals').insert({ user_id: uid, goal_id: id, amount: taken, month: planMonth });
    },

    /** Marca a alocação mensal como feita: o dinheiro saiu, deixa de descontar. */
    async markGoalAllocated(goal: GoalRow): Promise<void> {
      const uid = await userId();
      if (!uid) return;
      const amount = Number(goal.monthly_allocation) || 0;
      if (amount <= 0) return;
      const { error } = await supabase
        .from('goal_monthly_allocations')
        .insert({ user_id: uid, goal_id: goal.id, month: planMonth, amount });
      if (error) return; // já estava marcado (violação de UNIQUE)
      await supabase.rpc('goal_adjust', { p_goal_id: goal.id, p_delta: amount });
    },

    async unmarkGoalAllocated(id: string): Promise<void> {
      // Apagar e ler o valor apagado na mesma instrução: de dois toques
      // seguidos só um recebe a linha de volta, logo só um desfaz a alocação.
      const { data: removed } = await supabase
        .from('goal_monthly_allocations')
        .delete()
        .eq('goal_id', id)
        .eq('month', planMonth)
        .select('amount');
      const amount = Number(removed?.[0]?.amount ?? 0);
      if (amount <= 0) return;
      await supabase.rpc('goal_adjust', { p_goal_id: id, p_delta: -amount });
    },

    async setLimit(category: string, eur: number): Promise<void> {
      const uid = await userId();
      if (!uid || eur < 0) return;
      await supabase
        .from('category_limits')
        .upsert({ user_id: uid, category, limit_eur: eur }, { onConflict: 'user_id,category' });
    },

    async clearLimit(category: string): Promise<void> {
      const uid = await userId();
      if (!uid) return;
      await supabase.from('category_limits').delete().eq('user_id', uid).eq('category', category);
    },

    async addManual(entry: ManualDraft): Promise<void> {
      const uid = await userId();
      if (!uid || entry.amount <= 0) return;
      await supabase.from('manual_entries').insert({
        user_id: uid,
        month: planMonth,
        entry_type: entry.type,
        amount: entry.amount,
        category: entry.category,
        note: entry.note || null,
        meal_card: entry.type === 'expense' && entry.mealCard === true,
        // Só uma despesa da conta tem estado por pagar. Uma receita já entrou e
        // uma despesa do cartão refeição sai do cartão, não da conta — ambas
        // nascem resolvidas, com o instante a ser o do próprio registo.
        paid_at:
          entry.type !== 'expense' || entry.mealCard === true || entry.paid === true
            ? new Date().toISOString()
            : null,
      });
    },

    async setManualPaid(id: string, paid: boolean): Promise<void> {
      await supabase
        .from('manual_entries')
        .update({ paid_at: paid ? new Date().toISOString() : null })
        .eq('id', id);
    },

    async removeManual(id: string): Promise<void> {
      await supabase.from('manual_entries').delete().eq('id', id);
    },

    /**
     * O utilizador diz a que categoria pertence um comerciante.
     *
     * Três coisas têm de acontecer juntas ou nenhuma: fica a REGRA (para a
     * próxima importação e o re-analisar não a apagarem), mudam as LINHAS já
     * importadas com esse nome, e mudam os TOTAIS do mês. O último é o que
     * passa despercebido: marcar um movimento como transferência tira-o das
     * despesas, e a análise inteira — défice, taxa de poupança, 50/30/20 —
     * assenta nesses totais.
     *
     * Devolve quantas linhas mudaram.
     */
    async setTxCategory(merchant: string, category: CategoryKey): Promise<number> {
      const uid = await userId();
      const name = merchant.trim();
      if (!uid || name === '' || name.length > 64) return 0;

      const { error: ruleErr } = await supabase
        .from('category_rules')
        .upsert({ user_id: uid, merchant: name, category }, { onConflict: 'user_id,merchant' });
      if (ruleErr) throw new Error('db_error');

      // Todas as transações do utilizador, de todos os meses: uma regra criada
      // hoje vale para o extrato de janeiro tanto como para o de agosto.
      const { data: rows, error: txErr } = await supabase
        .from('transactions')
        .select('id,import_id,description,category,amount,tx_type')
        .eq('user_id', uid);
      if (txErr) throw new Error('db_error');

      const all = (rows ?? []).map((r) => ({
        id: r.id as string,
        importId: r.import_id as string,
        category: r.category as CategoryKey,
        amount: Number(r.amount),
        type: r.tx_type as 'income' | 'expense',
        matches: merchantKey(r.description as string) === name,
      }));

      const changed = all.filter((r) => r.matches && r.category !== category);
      if (changed.length > 0) {
        const { error } = await supabase
          .from('transactions')
          .update({ category })
          .in(
            'id',
            changed.map((r) => r.id),
          );
        if (error) throw new Error('db_error');
        for (const r of changed) r.category = category;
      }

      // Só os meses que mudaram mesmo — poupa escritas e evita mexer em
      // importações que esta decisão não tocou.
      for (const importId of new Set(changed.map((r) => r.importId))) {
        const totals = summariseTotals(all.filter((r) => r.importId === importId));
        const { error } = await supabase
          .from('imports')
          .update({ income: totals.income, expenses: totals.expenses, housing_fixed: totals.housingFixed })
          .eq('id', importId);
        if (error) throw new Error('db_error');
      }

      return changed.length;
    },

    /**
     * Volta a categorizar os extratos JÁ importados com as regras atuais e
     * recalcula os totais.
     *
     * A categoria é decidida na importação e fica gravada; sem isto, melhorias
     * no motor (ex.: passar a reconhecer transferências entre pessoas) só
     * apanhariam importações novas. Corre sobre o descritivo guardado — não
     * precisa do ficheiro original, que nunca chegámos a guardar.
     */
    async reanalyze(): Promise<{ imports: number; changed: number }> {
      const uid = await userId();
      if (!uid) return { imports: 0, changed: 0 };

      const { data: imports, error: impErr } = await supabase
        .from('imports')
        .select('id,statement_month')
        .eq('user_id', uid);
      if (impErr) throw new Error('db_error');
      if (!imports || imports.length === 0) return { imports: 0, changed: 0 };

      // As correções do utilizador entram DEPOIS do categorizador automático e
      // ganham-lhe. Sem isto, uma função cujo trabalho é reescrever a coluna
      // `category` apagava em silêncio toda a arrumação que ele já tinha feito.
      const { data: ruleRows } = await supabase.from('category_rules').select('merchant,category').eq('user_id', uid);
      const rules = toRuleMap(ruleRows);

      let changed = 0;

      for (const imp of imports) {
        const { data: rows, error: txErr } = await supabase
          .from('transactions')
          .select('id,tx_date,description,amount,tx_type,category')
          .eq('user_id', uid)
          .eq('import_id', imp.id);
        if (txErr) throw new Error('db_error');
        if (!rows || rows.length === 0) continue;

        const recategorized = applyCategoryRules(
          categorizeStatement(
            rows.map((r) => ({
              id: r.id,
              date: r.tx_date,
              description: r.description,
              amount: Number(r.amount),
              type: r.tx_type,
              was: r.category,
            })),
          ),
          rules,
        );

        for (const tx of recategorized) {
          if (tx.category === tx.was) continue;
          const { error } = await supabase.from('transactions').update({ category: tx.category }).eq('id', tx.id);
          if (error) throw new Error('db_error');
          changed++;
        }

        // Os totais do mês derivam das categorias: transferências ficam de fora.
        const totals = summariseTotals(recategorized);
        const { error: updErr } = await supabase
          .from('imports')
          .update({ income: totals.income, expenses: totals.expenses, housing_fixed: totals.housingFixed })
          .eq('id', imp.id);
        if (updErr) throw new Error('db_error');

        // Subscrições detetadas: recria a lista deste import preservando o
        // veredicto ("uso"/"não uso") que o utilizador já tinha dado.
        const { data: oldSubs } = await supabase.from('subscriptions').select('name,user_status').eq('user_id', uid);
        const verdictByName = new Map((oldSubs ?? []).map((s) => [s.name.toLowerCase(), s.user_status]));

        // Mesmo agrupamento da importação: um serviço = uma linha.
        const grouped = groupSubscriptions(recategorized);
        await supabase.from('subscriptions').delete().eq('user_id', uid).eq('import_id', imp.id);
        if (grouped.length > 0) {
          const { error: subErr } = await supabase.from('subscriptions').insert(
            grouped.map((s) => ({
              user_id: uid,
              import_id: imp.id,
              name: s.name,
              price: s.price,
              user_status: verdictByName.get(s.name.toLowerCase()) ?? 'unknown',
            })),
          );
          if (subErr) throw new Error('db_error');
        }
      }

      return { imports: imports.length, changed };
    },
  };
}

export type FinanceWrites = ReturnType<typeof financeWrites>;
