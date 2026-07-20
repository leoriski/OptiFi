// Fixtures sintéticas fiéis aos formatos de exportação reais de cada banco.
// Quando importarmos extratos verdadeiros na validação, qualquer divergência
// entra aqui como novo caso de teste.

export const REVOLUT_CSV = `Type,Product,Started Date,Completed Date,Description,Amount,Fee,Currency,State,Balance
CARD_PAYMENT,Current,2026-05-02 09:14:33,2026-05-03 10:02:11,Pingo Doce Lisboa,-42.17,0.00,EUR,COMPLETED,1204.51
CARD_PAYMENT,Current,2026-05-04 20:31:02,2026-05-05 08:00:00,Netflix.com,-12.99,0.00,EUR,COMPLETED,1191.52
TRANSFER,Current,2026-05-06 11:00:00,2026-05-06 11:00:01,"Transferência recebida, obrigado",850.00,0.00,EUR,COMPLETED,2041.52
CARD_PAYMENT,Current,2026-05-08 13:22:47,2026-05-09 06:12:00,Uber *Trip,-7.35,0.15,EUR,COMPLETED,2034.02
CARD_PAYMENT,Current,2026-05-10 19:44:00,,Bolt PT,-5.10,0.00,EUR,REVERTED,2034.02
EXCHANGE,Current,2026-04-29 10:00:00,2026-04-29 10:00:02,Exchanged to USD,-100.00,0.00,EUR,COMPLETED,1934.02
CARD_PAYMENT,Current,2026-05-15 12:00:00,2026-05-15 12:00:05,Spotify Premium,-9.99,0.00,EUR,COMPLETED,1924.03
`;

// CGD: preâmbulo + cabeçalho ; Windows-1252 na vida real (os testes usam
// string JS; a descodificação é testada à parte em text.test.ts)
export const CGD_CSV = `Consulta de movimentos à ordem;;;;;;
Conta ;0000012345678;EUR;;;;
Data de início ;01-05-2026;;Data de fim;31-05-2026;;
Data mov. ;Data valor ;Descrição ;Débito ;Crédito ;Saldo contabilístico ;Saldo disponível
02-05-2026;02-05-2026;COMPRA CONTINENTE MATOSINHOS ;58,20;;1.941,80;1.941,80
05-05-2026;05-05-2026;PAG SERV EDP COMERCIAL ;46,33;;1.895,47;1.895,47
07-05-2026;07-05-2026;TRF SALARIO EMPRESA XYZ ;;1.750,00;3.645,47;3.645,47
12-05-2026;12-05-2026;LEV MULTIBANCO ;60,00;;3.585,47;3.585,47
18-05-2026;18-05-2026;DD NOS COMUNICACOES ;39,99;;3.545,48;3.545,48
;;;;;;
Saldo final;;;;;3.545,48;
`;

export const BCP_CSV = `Millennium bcp - Movimentos de conta;;;;;
Conta: 12345678901;;;;;
Data lançamento;Data valor;Descrição;Montante;Moeda;Saldo
03-05-2026;03-05-2026;COMPRA LIDL AMADORA;-31,47;EUR;2.468,53
06-05-2026;06-05-2026;DD SPOTIFY;-9,99;EUR;2.458,54
09-05-2026;09-05-2026;ORDENADO MAIO;1.980,00;EUR;4.438,54
14-05-2026;14-05-2026;PAGAMENTO FARMÁCIA WELLS;-12,80;EUR;4.425,74
22-05-2026;22-05-2026;RENDA CASA TRANSFERENCIA;-450,00;EUR;3.975,74
`;

// Formato desconhecido — obriga ao mapeador universal
export const UNKNOWN_CSV = `Fecha;Concepto;Importe
02/05/2026;SUPERMERCADO DIA;-23,50
04/05/2026;NOMINA;1.200,00
`;
