import { describe, it, expect } from 'vitest';
import { generateAnalysis } from '../src/analyze.js';
import { prettyMerchant } from '../src/catalog.js';
import type { Subscription } from '../src/index.js';

const subs = (list: Partial<Subscription>[]): Subscription[] =>
  list.map((s, i) => ({ id: `s${i}`, name: s.name ?? `Sub ${i}`, price: s.price ?? 10, userStatus: s.userStatus ?? 'unknown' }));

describe('generateAnalysis — fugas derivadas dos dados, não inventadas', () => {
  it('gasto acima do teto da categoria gera item de fuga com a poupança certa', () => {
    const a = generateAnalysis({
      income: 2000,
      expenses: 1500,
      // teto lazer = 6% de 2000 = 120; gasto 300 → poupança 180
      categorySpend: [{ categoryId: 'lazer', amount: 300 }],
      subs: [],
    });
    expect(a.planItems).toHaveLength(1);
    expect(a.planItems[0]).toMatchObject({ id: 'cap_lazer', monthlySaving: 180, capEur: 120 });
    expect(a.baseLeak).toBe(180);
    expect(a.insights.find((i) => i.planItemId === 'cap_lazer')).toBeTruthy();
  });

  it('gasto dentro do teto não gera nada; poupanças <€5 são ignoradas', () => {
    const a = generateAnalysis({
      income: 2000,
      expenses: 1000,
      categorySpend: [
        { categoryId: 'lazer', amount: 100 }, // sob o teto (120)
        { categoryId: 'transporte', amount: 243 }, // teto 240 → poupança 3 < 5
      ],
      subs: [],
    });
    expect(a.planItems).toHaveLength(0);
    expect(a.baseLeak).toBe(0);
  });

  it('habitação, saúde e subscrições nunca geram fugas por teto', () => {
    const a = generateAnalysis({
      income: 1000,
      expenses: 900,
      categorySpend: [
        { categoryId: 'habitacao', amount: 800 },
        { categoryId: 'saude', amount: 300 },
        { categoryId: 'subscricoes', amount: 200 },
      ],
      subs: [],
    });
    expect(a.planItems).toHaveLength(0);
  });

  it('itens ordenados por poupança; baseLeak é a soma', () => {
    const a = generateAnalysis({
      income: 2000,
      expenses: 1900,
      categorySpend: [
        { categoryId: 'transporte', amount: 340 }, // teto 240 → 100
        { categoryId: 'lazer', amount: 420 }, // teto 120 → 300
      ],
      subs: [],
    });
    expect(a.planItems.map((p) => p.id)).toEqual(['cap_lazer', 'cap_transporte']);
    expect(a.baseLeak).toBe(400);
  });

  it('FREQUÊNCIA: muitos pagamentos repetidos na mesma categoria viram fuga, mesmo sob o teto', () => {
    const a = generateAnalysis({
      income: 2000,
      expenses: 1500,
      // transporte €69 está MUITO abaixo do teto (240), mas 11 boleias no mês
      // → fuga por frequência = 30% de 69 = 20.70 (o caso real do utilizador).
      categorySpend: [{ categoryId: 'transporte', amount: 69, count: 11 }],
      subs: [],
    });
    const item = a.planItems.find((p) => p.id === 'cap_transporte')!;
    expect(item.reason).toBe('frequency');
    expect(item.count).toBe(11);
    expect(item.monthlySaving).toBeCloseTo(20.7, 2);
    const ins = a.insights.find((i) => i.planItemId === 'cap_transporte')!;
    expect(ins.params.reason).toBe('frequency');
    expect(ins.params.n).toBe(11);
  });

  it('FREQUÊNCIA não dispara com poucas compras; o teto continua a mandar quando é maior', () => {
    const a = generateAnalysis({
      income: 2000,
      expenses: 1500,
      categorySpend: [
        { categoryId: 'lazer', amount: 100, count: 2 }, // sob o teto, só 2 compras → nada
        { categoryId: 'transporte', amount: 340, count: 12 }, // teto 240 → over 100 > freq 102? 30%*340=102 → freq ganha
      ],
      subs: [],
    });
    expect(a.planItems.find((p) => p.id === 'cap_lazer')).toBeUndefined();
    const tr = a.planItems.find((p) => p.id === 'cap_transporte')!;
    // max(over=100, freq=102) = 102 → frequência
    expect(tr.monthlySaving).toBeCloseTo(102, 2);
    expect(tr.reason).toBe('frequency');
  });

  it('subscrições por rever e rácio alto geram alertas (sem inventar uso)', () => {
    const a = generateAnalysis({
      income: 1000,
      expenses: 800,
      categorySpend: [],
      subs: subs([
        { name: 'Netflix', price: 40, userStatus: 'unknown' },
        { name: 'Spotify', price: 30, userStatus: 'confirmed' },
      ]),
    });
    const review = a.insights.find((i) => i.id === 'ins_subs_review');
    expect(review?.params.count).toBe(1);
    // 70/1000 = 7% > 6%
    expect(a.insights.find((i) => i.id === 'ins_subs_ratio')).toBeTruthy();
  });

  it('subscrições canceladas não contam para o rácio', () => {
    const a = generateAnalysis({
      income: 1000,
      expenses: 800,
      categorySpend: [],
      subs: subs([{ name: 'Netflix', price: 100, userStatus: 'cancelled' }]),
    });
    expect(a.insights.find((i) => i.id === 'ins_subs_ratio')).toBeUndefined();
    expect(a.insights.find((i) => i.id === 'ins_subs_review')).toBeUndefined();
  });

  it('taxa de poupança ≥20% é uma conquista', () => {
    const good = generateAnalysis({ income: 2000, expenses: 1500, categorySpend: [], subs: [] });
    expect(good.insights.find((i) => i.kind === 'achievement')?.params.pct).toBe(25);
    const bad = generateAnalysis({ income: 2000, expenses: 1900, categorySpend: [], subs: [] });
    expect(bad.insights.find((i) => i.kind === 'achievement')).toBeUndefined();
  });

  it('sem rendimento não há tetos nem conquistas (divisão por zero)', () => {
    const a = generateAnalysis({
      income: 0,
      expenses: 500,
      categorySpend: [{ categoryId: 'lazer', amount: 500 }],
      subs: [],
    });
    expect(a.planItems).toHaveLength(0);
    expect(a.insights.filter((i) => i.kind === 'achievement')).toHaveLength(0);
  });
});

describe('subscrições "não vale" entram no money leak', () => {
  it('uma subscrição rejected vira item de fuga (poupança = preço) com o nome', () => {
    const a = generateAnalysis({
      income: 2000,
      expenses: 1000,
      categorySpend: [],
      subs: subs([{ name: 'Ginásio Fit4U', price: 29.99, userStatus: 'rejected' }]),
    });
    const item = a.planItems.find((p) => p.kind === 'subscription')!;
    expect(item.name).toBe('Ginásio Fit4U');
    expect(item.monthlySaving).toBeCloseTo(29.99, 2);
    expect(a.baseLeak).toBeCloseTo(29.99, 2);
    const ins = a.insights.find((i) => i.planItemId === item.id)!;
    expect(ins.kind).toBe('leak');
    expect(ins.params.annual).toBeCloseTo(359.88, 2);
  });

  it('subscrições confirmadas/unknown/canceladas NÃO entram na fuga', () => {
    const a = generateAnalysis({
      income: 2000,
      expenses: 1000,
      categorySpend: [],
      subs: subs([
        { name: 'Netflix', price: 12.99, userStatus: 'confirmed' },
        { name: 'Spotify', price: 9.99, userStatus: 'unknown' },
        { name: 'HBO', price: 8.99, userStatus: 'cancelled' },
      ]),
    });
    expect(a.planItems.filter((p) => p.kind === 'subscription')).toHaveLength(0);
    expect(a.baseLeak).toBe(0);
  });

  it('leak combina fugas de categoria + subscrições rejeitadas', () => {
    const a = generateAnalysis({
      income: 2000,
      expenses: 1500,
      categorySpend: [{ categoryId: 'lazer', amount: 300 }], // teto 120 → 180
      subs: subs([{ name: 'HBO Max', price: 8.99, userStatus: 'rejected' }]),
    });
    expect(a.baseLeak).toBeCloseTo(180 + 8.99, 2);
  });
});

// (O antigo "cartão refeição eleva o teto" foi removido: o cartão é agora um
//  POTE próprio no estado — recebes X, gastas Y com o cartão, restam Z — e as
//  despesas do cartão nem sequer entram no dinheiro da conta. Ver balance.test.)

describe('projeção de investimento nas fugas', () => {
  it('cada item de fuga traz fv10 (juro composto a 4%/10 anos)', () => {
    const a = generateAnalysis({
      income: 2000,
      expenses: 1500,
      categorySpend: [{ categoryId: 'lazer', amount: 300 }],
      subs: [],
    });
    const item = a.planItems[0]!;
    expect(item.fv10).toBeGreaterThan(item.monthlySaving * 120);
    const ins = a.insights.find((i) => i.planItemId === item.id)!;
    expect(ins.params.fv10).toBe(item.fv10);
    expect(ins.params.rate).toBe(7);
  });
});

describe('prettyMerchant: descritivos crus dos bancos ficam legíveis', () => {
  it.each([
    // Domínio colado ao nome → só a marca, sem repetir
    ['COMPRA 2088 UBER TRIP HELP.UBER.COMNL', 'Uber Trip'],
    ['COMPRA ESTRANG*5297 BOLT.EU/O/2606272120', 'Bolt'],
    // Marcadores do banco e identificadores longos desaparecem
    ['DÉBITO DIRETO-AEGON SANTANDER -102138947', 'Aegon Santander'],
    ['PAGSERV VODAFONE PORTUGAL COMU 10297/458919388', 'Vodafone Portugal Comu'],
    ['COMPRA 2088 CONTINENTE PORTO 0000-000 PORTO', 'Continente Porto'],
    ['TRF MB WAY P/ DELFIO LUIS OFESSE', 'Delfio Luis Ofesse'],
    // Sem lixo → fica exatamente como veio
    ['Pingo Doce Lisboa', 'Pingo Doce Lisboa'],
    // Limpar tudo deixaria o nome sem sentido → volta ao descritivo
    ['LEVANTAMENTO DE NUMERARIO-5297', 'Levantamento De Numerario'],
    ['', 'Movimento'],
  ])('%s → %s', (rawDesc, expected) => {
    expect(prettyMerchant(rawDesc)).toBe(expected);
  });
});
