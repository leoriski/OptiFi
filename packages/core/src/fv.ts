/**
 * Future value of a recurring monthly contribution at a yearly rate
 * (compounded monthly). rate 0 degenerates to simple accumulation.
 */
export function futureValue(monthly: number, years: number, yearlyRate: number): number {
  if (yearlyRate === 0) return monthly * 12 * years;
  const r = yearlyRate / 12;
  return (monthly * (Math.pow(1 + r, years * 12) - 1)) / r;
}

/** Taxa conservadora usada nas projeções de investimento por toda a app. */
export const INVEST_RATE = 0.07;

export interface Projection {
  rate: number; // em % inteiros (4)
  fv10: number;
  fv15: number;
  fv20: number;
}

/**
 * O que rende investir `monthly`€/mês a INVEST_RATE, aos 10/15/20 anos.
 * Fonte única para insights e fugas mostrarem os mesmos números.
 */
export function projection(monthly: number, yearlyRate: number = INVEST_RATE): Projection {
  return {
    rate: Math.round(yearlyRate * 100),
    fv10: Math.round(futureValue(monthly, 10, yearlyRate)),
    fv15: Math.round(futureValue(monthly, 15, yearlyRate)),
    fv20: Math.round(futureValue(monthly, 20, yearlyRate)),
  };
}
