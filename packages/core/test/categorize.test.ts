import { describe, it, expect } from 'vitest';
import { categorizeMerchant } from '../src/index.js';

describe('Portuguese merchant categorization', () => {
  it.each([
    ['PINGO DOCE LISBOA', 'alimentacao'], // supermercado = comida essencial
    ['PADARIA CENTRAL', 'alimentacao'],
    ['CONTINENTE BOM DIA', 'alimentacao'],
    ['Salário ACME LDA', 'receita'],
    ['MB WAY RECEBIDO', 'transferencias'], // MB WAY é pessoa-a-pessoa, nunca ordenado
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
    // Transferências entre pessoas — dinheiro que circula, nos DOIS sentidos
    ['TRF.IMED. P/ PAULO VICTOR SURIANO', 'transferencias'],
    ['TRF MB WAY P/ DELFIO LUIS OFESSE', 'transferencias'],
    ['TRF. P/O DELFIO LUIS OFESSE', 'transferencias'],
    ['TRF P/ DIOGO ALMEIDA BARROS', 'transferencias'], // "TRF P/ NOME" simples (sem MB WAY, sem ponto)
    ['TRF.IMED. DE DELFIO LUIS OFESSE-R84994566', 'transferencias'], // entrada P2P ≠ rendimento
    ['29 Trf Mbway 933XXX415', 'transferencias'],
    // …mas um ordenado pago por transferência continua a ser rendimento
    ['TRF CRED SEPA+ ORDENADO DE ASSOCIACAO DA-294667584', 'receita'],
    ['TRF CRED SEPA+ DE REEMBOLSOS IRS-294301662', 'receita'],
  ])('%s → %s', (name, expected) => {
    expect(categorizeMerchant(name)).toBe(expected);
  });
});

// O extrato corta o nome do comerciante a um número fixo de caracteres. Sem
// tolerar a truncagem, os comerciantes mais frequentes de um extrato português
// caíam todos em 'outros' e a categoria "não sei o que isto é" ficava a maior.
describe('descritivos TRUNCADOS pelo banco', () => {
  it.each([
    ['Compras C Pingo D', 'alimentacao'],
    ['Compras C Contin', 'alimentacao'],
    ['Compras C Mercadon', 'alimentacao'],
    ['Compras C Tiffosi', 'lazer'],
    ['Compras C Restaur', 'lazer'],
    // Carregar a carteira de outro banco é dinheiro do próprio a mudar de sítio
    ['Car Wal Crt Deb Revol', 'transferencias'],
    // …e o que continua desconhecido continua honestamente em 'outros'
    ['Compras C Tiago F', 'outros'],
    ['Oney Bank Sucursal Em', 'outros'],
  ])('%s → %s', (name, expected) => {
    expect(categorizeMerchant(name)).toBe(expected);
  });

  it('não deixa uma palavra inteira passar por truncagem', () => {
    // "transferencia" é o início de "transferencia recebida", mas está inteira
    expect(categorizeMerchant('Renda Casa Transferencia')).toBe('habitacao');
  });
});
