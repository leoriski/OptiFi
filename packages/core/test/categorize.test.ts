import { describe, it, expect } from 'vitest';
import { categorizeMerchant } from '../src/index.js';

describe('Portuguese merchant categorization', () => {
  it.each([
    ['PINGO DOCE LISBOA', 'alimentacao'], // supermercado = comida essencial
    ['PADARIA CENTRAL', 'alimentacao'],
    ['CONTINENTE BOM DIA', 'alimentacao'],
    ['Salário ACME LDA', 'receita'],
    ['MB WAY RECEBIDO', 'receita'],
    ['UBER EATS PT', 'lazer'], // comer fora/delivery é lazer; ganha à regra 'uber'
    ['UBER *TRIP', 'transporte'],
    ['GALP FROTA', 'transporte'],
    ['EDP COMERCIAL', 'habitacao'],
    ['FARMÁCIA CENTRAL', 'saude'],
    ['NETFLIX.COM', 'subscricoes'],
    ['DECATHLON AMADORA', 'lazer'],
    ['XPTO CONSULTING LDA', 'outros'],
    ['', 'outros'],
  ])('%s → %s', (name, expected) => {
    expect(categorizeMerchant(name)).toBe(expected);
  });
});

describe('regras adicionadas com dados realistas (renda, cafés)', () => {
  it.each([
    ['Renda Casa Transferencia', 'habitacao'],
    ['CONDOMINIO EDIFICIO SOL', 'habitacao'],
    ['NOS COMUNICACOES', 'habitacao'],
    ['Cafe Central 3', 'lazer'],
    ['PASTELARIA VERSAILLES', 'lazer'],
    ['Restaurante O Manel', 'lazer'],
  ])('%s → %s', (name, expected) => {
    expect(categorizeMerchant(name)).toBe(expected);
  });
});

describe('descritivos REAIS dos extratos (maiúsculas, sem acentos, prefixos)', () => {
  it.each([
    // Casos exatos reportados pelo utilizador (extrato Santander/Millennium)
    ['COMPRA 2088 ISLA GAIA VILA NOVA DE GAIA', 'educacao'],
    ['COMPRA *5297 MC DONALDS MATOSINHOS', 'lazer'], // comer fora → lazer
    ['MCDONALDS PORTO', 'lazer'],
    ['CLINICA MIGUEL ROCHA', 'saude'], // sem acento, tem de casar com 'clínica'
    ['COMPRA ESTRANG*5297 PAYPAL *ITUNESAPPST AP', 'subscricoes'], // Apple
    ['APPLE.COM/BILL', 'subscricoes'],
    ['COMPRA ESTRANG*5297 UBER *ONE MEMBERSHIP', 'subscricoes'], // Uber One ≠ viagem
    ['COMPRA ESTRANG*5297 UBER *TRIP', 'transporte'],
    ['BOLT.EU/R/2606021426', 'transporte'],
    ['LIME*VIAGEM BYCE', 'transporte'],
    // Insensível a acentos (bancos escrevem sem acentos)
    ['FARMACIA SAUDE LDA', 'saude'],
    ['CAFE SNACK BAR O CANTINHO', 'lazer'],
    ['AGUAS DO PORTO', 'habitacao'],
    ['UNIVERSIDADE DO PORTO PROPINAS', 'educacao'],
    ['GINASIO FIT4U', 'subscricoes'], // ginásio = subscrição mensal
    ['HOLMES PLACE PORTO', 'subscricoes'],
    ['SOLINCA HEALTH CLUB', 'subscricoes'],
    ['MCFIT MATOSINHOS', 'subscricoes'],
    // Transferências para pessoas (saída) → transferencias; recebidas → receita
    ['TRF.IMED. P/ PAULO VICTOR SURIANO', 'transferencias'],
    ['TRF MB WAY P/ DELFIO LUIS OFESSE', 'transferencias'],
    ['TRF. P/O DELFIO LUIS OFESSE', 'transferencias'],
    ['TRF.IMED. DE DELFIO LUIS OFESSE', 'receita'],
  ])('%s → %s', (name, expected) => {
    expect(categorizeMerchant(name)).toBe(expected);
  });
});
