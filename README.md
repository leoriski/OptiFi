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
  ingest/     Leitura de extratos (CSV e PDF) dos bancos e corretoras PT.
  data/       Único caminho de leitura financeira (loadFinanceSnapshot).
              Web e nativa chamam-no; as escritas ficam em cada app.
apps/
  mobile/     Expo (SDK 54) + expo-router — a app das lojas. É o produto.
  web/        Next.js + Supabase — site público, links de email e RGPD.
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

## Decisões de produto

- A app nativa (`apps/mobile`) é o produto: App Store e Google Play.
- Sem paywall na v1.
- Insights determinísticos, calculados no motor — sem agente de IA.
- Sem open banking: a ingestão é feita por adaptadores de extrato, desenhados
  para acomodar open banking mais tarde sem reescrever a análise.
- Beta fechado por convite: novembro de 2026.
