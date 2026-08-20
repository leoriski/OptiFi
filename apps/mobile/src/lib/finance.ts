import { loadFinanceSnapshot, type FinanceSnapshot } from '@optifi/data';
import { supabase } from './supabase';

export type { FinanceSnapshot };

/**
 * As regras do dinheiro (a âncora do saldo, uma despesa contar pelo `paid_at`,
 * alocar a uma meta ser uma transferência) vivem todas no `@optifi/data`. A app
 * nativa e a web chamam a mesma função, por isso não há forma de mostrarem
 * saldos diferentes.
 */
export function loadFinance(): Promise<FinanceSnapshot> {
  return loadFinanceSnapshot(supabase);
}
