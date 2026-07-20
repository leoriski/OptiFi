# OptiFi

Aplicação de finanças pessoais para o mercado português: controlo de despesas,
gestão de subscrições e otimização financeira. Reconstrução de produção do
protótipo `OPTIFI2.0/index.html`, que serve de especificação funcional e visual.

## Estrutura

```
packages/
  core/       Motor financeiro puro (TypeScript, sem DOM, sem I/O).
              computeFinancialState() é o recalcAll() do protótipo como função
              pura: fonte única de verdade para score, fugas, ritmo, objetivos,
              limites e movimentos manuais.
apps/
  web/        (Fase 1) Next.js + Supabase — a aplicação.
```

## Setup (uma vez)

1. Cria um projeto em [supabase.com](https://supabase.com) — **região Frankfurt (eu-central-1)**.
2. No dashboard: SQL Editor → cola e corre `supabase/migrations/0001_init.sql`.
3. Em Authentication → URL Configuration: define Site URL (`http://localhost:3000` em dev)
   e adiciona `http://localhost:3000/auth/confirm` aos Redirect URLs.
4. Copia `apps/web/.env.example` para `apps/web/.env.local` e preenche com
   Project Settings → API (URL + anon key).
5. `npm install && npm run dev --workspace=@optifi/web` → http://localhost:3000

## Comandos

```
npm install        # instala tudo (workspaces)
npm test           # suite do @optifi/core
npm run typecheck  # TypeScript estrito
```

## Paridade com o protótipo

A suite de testes usa os dados de demonstração do protótipo como fixture
(`packages/core/test/fixtures/baseline.ts`). Baseline que tem de se manter:
**score 57** (34/18/5), **net €760**, **ritmo semanal €258,43**. Qualquer
alteração ao motor que quebre estes números quebra a especificação.

## Fases (beta fechado: novembro 2026)

| Fase | Entrega | Estado |
|---|---|---|
| 0 | Motor de domínio + testes de paridade | ✅ |
| 1 | Next.js + Supabase (UE), auth real, schema RLS, i18n PT/EN, temas | ✅ código; falta ligar projeto Supabase |
| 2 | Ingestão CSV: Revolut, CGD, Millennium + mapeador universal | ✅ código; falta validar com extratos reais |
| 3 | Análise: score, fugas, cashflow, subscrições, plano de poupança | ✅ validado e2e (correr migração 0002) |
| 4 | Objetivos, limites por categoria, movimentos do mês corrente | ✅ validado e2e |
| 5 | 2FA TOTP, RGPD (export/apagamento, política, termos), Sentry | ✅ validado e2e (Sentry pendente; correr migração 0003) |
| 5b | Parsing de PDF dos 3 bancos | — |
| 5c | Insights inteligentes determinísticos (substitui o agente IA na v1) | ✅ validado e2e |
| 6 | Beta fechado por convite | — |

Decisões de produto: sem paywall na v1; app nativa depois do beta (2027);
sem open banking nesta fase (a camada de ingestão é feita de adaptadores
para o acomodar mais tarde).
