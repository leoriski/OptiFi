import {
  computeFinancialState,
  generateAnalysis,
  monthKey,
  type CategorySpend,
  type FinancialState,
  type Goal,
  type ManualEntry,
  type Subscription,
} from '@optifi/core';
import { supabase } from './supabase';

/**
 * ⚠️ DÍVIDA CONHECIDA — isto espelha `apps/web/src/lib/useFinance.ts`.
 *
 * As regras aqui (a âncora do saldo, uma despesa contar pelo `paid_at` e não
 * pelo `created_at`, a alocação a uma meta ser uma transferência que baixa o
 * saldo) foram todas escritas a corrigir bugs em que a app mostrava dinheiro
 * a mais. Existirem em dois sítios significa que mais cedo ou mais tarde vão
 * divergir, e a divergência aparece ao utilizador como um saldo errado.
 *
 * Antes de construir o segundo ecrã, isto tem de subir para um pacote
 * partilhado (`packages/data`) que receba um SupabaseClient e devolva o
 * `FinancialInput` — as duas apps passam a chamar o mesmo código. Enquanto
 * for só o Início, o custo de manter isto sincronizado é aceitável; a partir
 * daí deixa de ser.
 */

const OPENING_NOTE = '__saldo__';

export interface MobileFinance {
  state: FinancialState | null;
  planMonth: string;
  balanceSet: boolean;
  name: string;
}

export async function loadFinance(): Promise<MobileFinance> {
  const planMonth = monthKey(new Date());
  const empty: MobileFinance = { state: null, planMonth, balanceSet: false, name: '' };

  const { data: latest } = await supabase
    .from('imports')
    .select('id,income,expenses,housing_fixed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const [goalRes, manualRes, allocRes, wdRes, profRes] = await Promise.all([
    supabase
      .from('goals')
      .select('id,name,target_eur,current_eur,target_month,target_year,monthly_allocation,allocation_day')
      .order('created_at'),
    supabase
      .from('manual_entries')
      .select('id,month,entry_type,amount,category,note,meal_card,paid_at,created_at')
      .eq('month', planMonth),
    supabase.from('goal_monthly_allocations').select('goal_id,amount,created_at').eq('month', planMonth),
    supabase.from('goal_withdrawals').select('amount,created_at').eq('month', planMonth),
    supabase.from('profiles').select('name,meal_card_eur').limit(1).maybeSingle(),
  ]);

  const name = (profRes.data?.name as string) ?? '';
  if (!latest) return { ...empty, name };

  const [txRes, subRes] = await Promise.all([
    supabase.from('transactions').select('category,amount,tx_type').eq('import_id', latest.id),
    supabase
      .from('subscriptions')
      .select('id,name,price,user_status')
      .or(`import_id.eq.${latest.id},import_id.is.null`)
      .order('price', { ascending: false }),
  ]);

  const byCat = new Map<string, { amount: number; count: number }>();
  for (const t of txRes.data ?? []) {
    if (t.tx_type !== 'expense') continue;
    const cur = byCat.get(t.category) ?? { amount: 0, count: 0 };
    cur.amount += Number(t.amount);
    cur.count += 1;
    byCat.set(t.category, cur);
  }
  const categorySpend: CategorySpend[] = [...byCat.entries()].map(([categoryId, v]) => ({
    categoryId,
    amount: Math.round(v.amount * 100) / 100,
    count: v.count,
  }));

  const subs: Subscription[] = (subRes.data ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    price: Number(s.price),
    userStatus: s.user_status,
  }));

  const goals: Goal[] = (goalRes.data ?? []).map((g) => {
    const goal: Goal = {
      id: g.id,
      name: g.name,
      targetEur: Number(g.target_eur),
      currentEur: Number(g.current_eur),
      monthlyAllocation: Number(g.monthly_allocation),
      allocationDay: Number(g.allocation_day ?? 1),
    };
    if (g.target_month) goal.targetMonth = g.target_month;
    if (g.target_year) goal.targetYear = g.target_year;
    return goal;
  });

  // A âncora é o movimento de abertura mais recente; tudo o resto são fluxos.
  const manualAll = manualRes.data ?? [];
  const opening =
    manualAll
      .filter((m) => m.note === OPENING_NOTE)
      .sort((a, b) => ((a.created_at ?? '') < (b.created_at ?? '') ? 1 : -1))[0] ?? null;
  const flowRows = manualAll.filter((m) => m.note !== OPENING_NOTE);

  const allocRows = allocRes.data ?? [];
  const wdRows = wdRes.data ?? [];

  let balance: { anchor: number; adjustedNet: number } | null = null;
  if (opening) {
    const anchorAt = opening.created_at ?? '';
    let adjustedNet = 0;
    for (const m of flowRows) {
      if (m.meal_card) continue; // sai do cartão, não da conta
      // Uma receita conta pela data em que foi registada; uma despesa pela data
      // em que foi PAGA. Por pagar não baixa o saldo — baixa o disponível, e
      // disso trata o core.
      const movedAt = m.entry_type === 'expense' ? m.paid_at : m.created_at;
      if (!movedAt) continue;
      if (anchorAt && movedAt < anchorAt) continue; // a âncora já reflete isto
      adjustedNet += (m.entry_type === 'income' ? 1 : -1) * Number(m.amount);
    }
    for (const a of allocRows) {
      if (anchorAt && a.created_at && a.created_at < anchorAt) continue;
      adjustedNet -= Number(a.amount); // alocar é transferir: sai da conta
    }
    for (const w of wdRows) {
      if (anchorAt && w.created_at && w.created_at < anchorAt) continue;
      adjustedNet += Number(w.amount); // levantar é o contrário
    }
    balance = { anchor: Number(opening.amount), adjustedNet: Math.round(adjustedNet * 100) / 100 };
  }

  const manualEntries: ManualEntry[] = flowRows.map((m) => ({
    id: m.id,
    month: m.month,
    type: m.entry_type,
    amount: Number(m.amount),
    category: m.category,
    note: m.note ?? undefined,
    viaMealCard: m.meal_card === true,
    paid: m.paid_at != null,
  }));
  // O saldo definido pelo utilizador é dinheiro que entrou na conta → receita.
  if (opening) {
    manualEntries.push({
      id: opening.id,
      month: opening.month,
      type: 'income',
      amount: Number(opening.amount),
      category: 'receita',
    });
  }

  const analysis = generateAnalysis({
    income: Number(latest.income),
    expenses: Number(latest.expenses),
    categorySpend,
    subs,
  });

  const state = computeFinancialState({
    imported: true,
    income: Number(latest.income),
    expenses: Number(latest.expenses),
    housingFixed: Number(latest.housing_fixed),
    baseLeak: analysis.baseLeak,
    subs,
    planItems: analysis.planItems,
    planState: {},
    goals,
    categoryLimits: {},
    categorySpend,
    manualEntries,
    mealCardMonthly: profRes.data?.meal_card_eur != null ? Number(profRes.data.meal_card_eur) : 0,
    allocatedGoalIds: allocRows.map((a) => a.goal_id),
    withdrawnThisMonth: wdRows.reduce((a, b) => a + Number(b.amount), 0),
    planMonth,
    today: new Date(),
    balance,
  });

  return { state, planMonth, balanceSet: opening !== null, name };
}
