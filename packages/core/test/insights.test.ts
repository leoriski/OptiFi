import { describe, it, expect } from 'vitest';
import { generateAnalysis, generateSmartInsights, inferKind, matchCatalog, type SmartContext, type Subscription, type TxLite } from '../src/index.js';

const TODAY = new Date(2026, 6, 1); // 1 jul 2026

function sub(name: string, price: number, userStatus: Subscription['userStatus'] = 'unknown'): Subscription {
  return { id: name, name, price, userStatus };
}

function tx(description: string, amount: number, date = '2026-06-10', category = 'outros'): TxLite {
  return { date, description, amount, type: 'expense', category };
}

function ctx(partial: Partial<SmartContext>): SmartContext {
  const base: SmartContext = {
    income: 2000,
    expenses: 1200,
    categorySpend: [],
    subs: [],
    transactions: [],
    goals: [],
    goalProjections: {},
    analysis: { planItems: [], baseLeak: 0, insights: [] },
    today: TODAY,
  };
  const merged = { ...base, ...partial };
  // Recalcula a análise base se vierem dados novos e não vier análise explícita
  if (!partial.analysis && (partial.categorySpend || partial.subs)) {
    merged.analysis = generateAnalysis({
      income: merged.income,
      expenses: merged.expenses,
      categorySpend: merged.categorySpend,
      subs: merged.subs,
    });
  }
  return merged;
}

describe('catálogo de subscrições', () => {
  it('reconhece serviços por substring', () => {
    expect(matchCatalog('Netflix.com')?.key).toBe('netflix');
    expect(matchCatalog('DD SPOTIFY P34XX')?.key).toBe('spotify');
    expect(matchCatalog('HBO Max')?.key).toBe('max');
    expect(matchCatalog('Ginásio do Bairro')).toBeNull();
  });
});

describe('subscrições sem falhas — toda a subscrição ativa recebe análise', () => {
  it('marcada "não vale" → cancela e recupera, com projeção de investimento', () => {
    const ins = generateSmartInsights(ctx({ subs: [sub('Ginásio Fit4U', 29.99, 'rejected')] }));
    const s = ins.find((i) => i.id.startsWith('sub_cut_'))!;
    expect(s.kind).toBe('savings');
    expect(s.saving).toBeCloseTo(29.99, 2);
    expect(s.params.annual).toBeCloseTo(359.88, 2);
    // futureValue(29.99, 10, 0.04) ≈ 4.415 — juro composto real, não decorativo
    expect(Number(s.params.fv10)).toBeGreaterThan(29.99 * 120);
    expect(s.params.rate).toBe(7);
  });

  it('desconhecida (fora do catálogo) → análise de custo anualizado', () => {
    const ins = generateSmartInsights(ctx({ subs: [sub('Revista Sábado Digital', 4.99)] }));
    const s = ins.find((i) => i.id.startsWith('sub_annual_'))!;
    expect(s.kind).toBe('alert');
    expect(s.params.annual).toBeCloseTo(59.88, 2);
  });

  it('propriedade: com um cabaz misto, NENHUMA subscrição ativa fica sem análise', () => {
    const mixed = [
      sub('Netflix', 12.99), // catálogo → sub_save
      sub('Notion Pro', 8), // catálogo só com grátis → sub_free
      sub('Ginásio Fit4U', 29.99, 'rejected'), // → sub_cut
      sub('Revista Obscura', 3.5, 'confirmed'), // desconhecida → sub_annual
      sub('HBO Max', 8.99, 'cancelled'), // cancelada → NADA (já resolvida)
    ];
    const ins = generateSmartInsights(ctx({ subs: mixed }));
    const subInsights = ins.filter((i) => /^sub_(save|free|cut|annual)_/.test(i.id));
    expect(subInsights).toHaveLength(4); // todas as ativas, nenhuma a mais
  });

  it('projeção de investimento presente em todas as poupanças de subscrições', () => {
    const ins = generateSmartInsights(
      ctx({ subs: [sub('Netflix', 12.99), sub('Spotify Premium', 9.99), sub('HBO Max', 8.99)] }),
    );
    for (const s of ins.filter((i) => i.kind === 'savings')) {
      expect(Number(s.params.fv10)).toBeGreaterThan(0);
      expect(s.params.rate).toBe(7);
      }
  });
});

describe('poupança em subscrições — a melhor opção honesta', () => {
  it('Netflix a 12,99 → plano com anúncios poupa 7,50 (melhor que partilhar)', () => {
    const ins = generateSmartInsights(ctx({ subs: [sub('Netflix', 12.99)] }));
    const s = ins.find((i) => i.id === 'sub_save_netflix')!;
    expect(s.kind).toBe('savings');
    expect(s.params.option).toBe('cheaper');
    expect(s.saving).toBeCloseTo(7.5, 2);
  });

  it('Spotify sem plano mais barato → partilha família (3,00/pessoa)', () => {
    const ins = generateSmartInsights(ctx({ subs: [sub('Spotify Premium', 9.99)] }));
    const s = ins.find((i) => i.id === 'sub_save_spotify')!;
    expect(s.params.option).toBe('share');
    expect(s.saving).toBeCloseTo(6.99, 2);
  });

  it('Notion só tem escalão gratuito → alternativa grátis do mesmo serviço', () => {
    const ins = generateSmartInsights(ctx({ subs: [sub('Notion Pro', 8)] }));
    const s = ins.find((i) => i.id === 'sub_free_notion')!;
    expect(s.params.sameService).toBe(1);
    expect(s.saving).toBe(8);
  });

  it('subscrições canceladas não geram sugestões', () => {
    const ins = generateSmartInsights(ctx({ subs: [sub('Netflix', 12.99, 'cancelled')] }));
    expect(ins.find((i) => i.id.startsWith('sub_'))).toBeUndefined();
  });
});

describe('duplicados do mesmo tipo de serviço — fuga no money leak (manter o mais barato)', () => {
  const analysis = (subs: Subscription[]) =>
    generateAnalysis({ income: 2000, expenses: 1200, categorySpend: [], subs });

  it('3 streamings → item de fuga: mantém o mais barato (Disney+), corta o resto', () => {
    const a = analysis([sub('Netflix', 12.99), sub('HBO Max', 8.99), sub('Disney+', 7.99)]);
    const item = a.planItems.find((i) => i.id === 'subdup_streaming')!;
    expect(item.kind).toBe('sub_duplicate');
    expect(item.count).toBe(3);
    expect(item.keepName).toBe('Disney+');
    expect(item.keepPrice).toBe(7.99);
    expect(item.name).toBe('Netflix + HBO Max');
    expect(item.monthlySaving).toBeCloseTo(12.99 + 8.99, 2);
    // A fuga total conta os duplicados — tudo ligado ao dashboard/score.
    expect(a.baseLeak).toBeCloseTo(12.99 + 8.99, 2);
    expect(a.insights.find((i) => i.id === 'ins_subdup_streaming')!.planItemId).toBe('subdup_streaming');
  });

  it('serviços FORA do catálogo agrupam por palavras-chave (Skydance + Prime Video)', () => {
    const a = analysis([sub('Skydance', 7.99), sub('Prime Video', 4.99), sub('Netflix', 12.99)]);
    const item = a.planItems.find((i) => i.id === 'subdup_streaming')!;
    expect(item.count).toBe(3);
    expect(item.keepName).toBe('Prime Video');
    expect(item.monthlySaving).toBeCloseTo(7.99 + 12.99, 2);
  });

  it('tipos diferentes não se misturam (streaming + música ≠ duplicado)', () => {
    const a = analysis([sub('Netflix', 12.99), sub('Spotify Premium', 9.99)]);
    expect(a.planItems.find((i) => i.id.startsWith('subdup_'))).toBeUndefined();
  });

  it('um único streaming não gera nada; cancelados não contam', () => {
    const a = analysis([sub('Netflix', 12.99), sub('HBO Max', 8.99, 'cancelled')]);
    expect(a.planItems.find((i) => i.id.startsWith('subdup_'))).toBeUndefined();
  });

  it('o MESMO ginásio cobrado 2× (códigos de terminal diferentes) NÃO é duplicado', () => {
    // Caso real Millennium: "02 FITNESS UP GROUP SGPS" + "18 FITNESS UP GROUP SGPS"
    const a = analysis([sub('02 FITNESS UP GROUP SGPS', 39.2), sub('18 FITNESS UP GROUP SGPS', 22.6)]);
    expect(a.planItems.find((i) => i.id === 'subdup_fitness')).toBeUndefined();
  });

  it('dois ginásios DIFERENTES são um duplicado de fitness (mantém o mais barato)', () => {
    const a = analysis([sub('Holmes Place', 59.9), sub('Fitness Hut', 29.99)]);
    const dup = a.planItems.find((i) => i.id === 'subdup_fitness')!;
    expect(dup.keepName).toBe('Fitness Hut');
    expect(dup.monthlySaving).toBeCloseTo(59.9, 2);
  });

  it('rejected não entra no grupo (já conta individualmente — sem dupla contagem)', () => {
    const a = analysis([sub('Netflix', 12.99, 'rejected'), sub('Skydance', 7.99), sub('Disney+', 5.99)]);
    // Netflix rejeitada → item próprio subleak_; grupo fica Skydance+Disney+.
    expect(a.planItems.find((i) => i.id === 'subleak_Netflix')).toBeDefined();
    const dup = a.planItems.find((i) => i.id === 'subdup_streaming')!;
    expect(dup.count).toBe(2);
    expect(dup.keepName).toBe('Disney+');
    expect(dup.monthlySaving).toBeCloseTo(7.99, 2);
    expect(a.baseLeak).toBeCloseTo(12.99 + 7.99, 2);
  });

  it('smart insights já não duplicam a sugestão (fonte única = análise)', () => {
    const ins = generateSmartInsights(ctx({ subs: [sub('Netflix', 12.99), sub('HBO Max', 8.99)] }));
    expect(ins.find((i) => i.id.startsWith('sub_dup_'))).toBeUndefined();
  });
});

describe('inferKind — tipo de serviço por catálogo e palavras-chave', () => {
  it('catálogo: streaming=true conta como televisão (Prime Video ≠ compras)', () => {
    expect(inferKind('Prime Video')).toBe('streaming');
    expect(inferKind('Netflix.com')).toBe('streaming');
    expect(inferKind('Spotify Premium')).toBe('music');
  });
  it('fora do catálogo: palavras-chave', () => {
    expect(inferKind('Skydance')).toBe('streaming');
    expect(inferKind('SkyShowtime')).toBe('streaming');
    expect(inferKind('Tidal HiFi')).toBe('music');
    expect(inferKind('Xbox Game Pass')).toBe('gaming');
    expect(inferKind('Ginásio Fit4U')).toBe('fitness');
  });
  it('sem correspondência → null (não inventa grupos)', () => {
    expect(inferKind('Café Central')).toBeNull();
    expect(inferKind('Renda Casa')).toBeNull();
  });
});

describe('padrões nos movimentos', () => {
  it('muitas compras pequenas somam e viram alerta', () => {
    const txs = Array.from({ length: 9 }, (_, i) => tx(`Café ${i}`, 2.5));
    const ins = generateSmartInsights(ctx({ transactions: txs }));
    const s = ins.find((i) => i.id === 'small_purchases')!;
    expect(s.params.count).toBe(9);
    expect(s.params.total).toBeCloseTo(22.5, 2);
  });

  it('comerciante dominante (≥4 visitas) é detetado', () => {
    const txs = [tx('UBER EATS', 12), tx('uber eats', 15), tx('Uber Eats ', 9), tx('UBER EATS', 11)];
    const ins = generateSmartInsights(ctx({ transactions: txs }));
    const s = ins.find((i) => i.id === 'top_merchant')!;
    expect(s.params.count).toBe(4);
    expect(s.params.total).toBeCloseTo(47, 2);
  });

  it('a maior despesa só é insight se pesar ≥15% e não for habitação', () => {
    const big = generateSmartInsights(ctx({ expenses: 1000, transactions: [tx('Portátil novo', 400)] }));
    expect(big.find((i) => i.id === 'biggest_expense')?.params.pct).toBe(40);
    const rent = generateSmartInsights(ctx({ expenses: 1000, transactions: [tx('Renda', 400, '2026-06-01', 'habitacao')] }));
    expect(rent.find((i) => i.id === 'biggest_expense')).toBeUndefined();
  });
});

describe('alertas estruturais', () => {
  it('habitação acima de 35% do rendimento', () => {
    const ins = generateSmartInsights(ctx({ categorySpend: [{ categoryId: 'habitacao', amount: 800 }] }));
    expect(ins.find((i) => i.id === 'housing_share')?.params.pct).toBe(40);
  });

  it('taxa de poupança abaixo de 20% mostra o gap em euros', () => {
    const ins = generateSmartInsights(ctx({ income: 2000, expenses: 1900 }));
    const s = ins.find((i) => i.id === 'rate_gap')!;
    expect(s.params.gap).toBe(300); // 400 alvo − 100 reais
  });
});

describe('coaching de metas e score', () => {
  it('meta atrasada → reforço mensal exato para cumprir o prazo', () => {
    const ins = generateSmartInsights(
      ctx({
        goals: [{ id: 'g1', name: 'Japão', targetEur: 2000, currentEur: 1000, monthlyAllocation: 100 }],
        goalProjections: {
          g1: { alloc: 100, remaining: 1000, state: 'allocated', onTrack: false, monthsLate: 5, deadline: new Date(2026, 11, 1), months: 10, estDate: new Date(2027, 4, 1) },
        },
      }),
    );
    const s = ins.find((i) => i.id === 'goal_boost_g1')!;
    // 5 meses até dez/2026 → precisa de 200/mês → reforço de 100
    expect(s.params.needed).toBe(100);
  });

  it('já não há coaching de "score" (a app não expõe score financeiro)', () => {
    const ins = generateSmartInsights(ctx({ subs: [sub('Netflix', 12.99), sub('Spotify', 9.99)] }));
    expect(ins.find((i) => i.id.startsWith('score_action_'))).toBeUndefined();
  });
});

describe('enquadramento de longo prazo', () => {
  it('fuga ≥€20/mês mostra o valor a 10 anos', () => {
    const ins = generateSmartInsights(
      ctx({ income: 2000, expenses: 1900, categorySpend: [{ categoryId: 'lazer', amount: 400 }] }),
    );
    const s = ins.find((i) => i.id === 'leak_fv')!;
    expect(Number(s.params.monthly)).toBe(280); // 400 − teto 120
    expect(Number(s.params.fv10)).toBeGreaterThan(280 * 120); // juro composto > soma simples
  });
});

describe('ordenação', () => {
  it('poupanças primeiro, maiores no topo', () => {
    const ins = generateSmartInsights(
      ctx({ subs: [sub('Spotify Premium', 9.99), sub('Netflix', 12.99), sub('HBO Max', 8.99)] }),
    );
    expect(ins[0]!.kind).toBe('savings');
    const savings = ins.filter((i) => i.kind === 'savings').map((i) => i.saving);
    expect([...savings].sort((a, b) => b - a)).toEqual(savings);
  });
});

describe('novas análises — capacidade, renegociar, acelerar meta', () => {
  it('capacidade de investimento = rendimento − despesas − alocações', () => {
    const ins = generateSmartInsights(
      ctx({ income: 2000, expenses: 1200, goals: [{ id: 'g1', name: 'Casa', targetEur: 5000, currentEur: 0, monthlyAllocation: 300 }] }),
    );
    const cap = ins.find((i) => i.id === 'invest_capacity')!;
    expect(Number(cap.params.amount)).toBe(500); // 2000 − 1200 − 300
    expect(Number(cap.params.fv10)).toBeGreaterThan(0); // tem projeção anexada
  });

  it('renegociar os dois serviços com mais margem, valor anual', () => {
    const ins = generateSmartInsights(
      ctx({ subs: [sub('Netflix', 12.99), sub('HBO Max', 8.99), sub('Spotify Premium', 9.99)] }),
    );
    const r = ins.find((i) => i.id === 'renegotiate_two')!;
    expect(r).toBeTruthy();
    expect(Number(r.params.annual)).toBeGreaterThan(0);
  });

  it('acelerar meta usa a folga; só dispara com ganho ≥ 2 meses', () => {
    const goals = [{ id: 'g1', name: 'Fundo', targetEur: 6000, currentEur: 0, monthlyAllocation: 100 }];
    const goalProjections = { g1: { alloc: 100, remaining: 6000, state: 'allocated' as const, months: 60 } };
    const ins = generateSmartInsights(ctx({ income: 2000, expenses: 1200, goals, goalProjections }));
    const acc = ins.find((i) => i.id === 'goal_accelerate')!;
    expect(acc).toBeTruthy();
    expect(Number(acc.params.extra)).toBe(700); // folga = 2000 − 1200 − 100 (alocação da meta)
    expect(Number(acc.params.months)).toBeGreaterThanOrEqual(2);
  });
});

describe('observações do mês — variedade, sem tratar transferências como gasto', () => {
  const days = Array.from({ length: 8 }, (_, i) => tx(`Loja ${i}`, 20, `2026-06-${String(i + 3).padStart(2, '0')}`, 'lazer'));

  it('média diária ignora transferências para pessoas', () => {
    const transfers = [tx('MB WAY P/ Amigo', 500, '2026-06-05', 'transferencias')];
    const ins = generateSmartInsights(
      ctx({ expenses: 660, transactions: [...days, ...transfers], categorySpend: [{ categoryId: 'lazer', amount: 160 }, { categoryId: 'transferencias', amount: 500 }] }),
    );
    const d = ins.find((i) => i.id === 'daily_avg')!;
    expect(d).toBeTruthy();
    expect(Number(d.params.amount)).toBe(round(160 / 30)); // só o consumo, não os 500
  });

  it('categoria dominante nunca é transferências', () => {
    const transfers = [tx('MB WAY P/ Amigo', 500, '2026-06-05', 'transferencias')];
    const ins = generateSmartInsights(
      ctx({ expenses: 660, transactions: [...days, ...transfers], categorySpend: [{ categoryId: 'lazer', amount: 160 }, { categoryId: 'transferencias', amount: 500 }] }),
    );
    const c = ins.find((i) => i.id === 'cat_concentration');
    if (c) expect(c.params.cat).not.toBe('transferencias');
  });
});

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
