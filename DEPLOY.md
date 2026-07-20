# Deploy da OptiFi

App Next.js 15 (monorepo npm workspaces) + Supabase. Guia para o primeiro deploy
em **Vercel + GitHub** (recomendado). Segue os passos por ordem.

## Pré-requisitos
- Conta **GitHub** e conta **Vercel**.
- Projeto **Supabase** já criado (região UE). As 12 migrações em
  `supabase/migrations/` têm de estar aplicadas nesse projeto.

---

## 1. Pôr o código no GitHub
O repositório já tem o commit-base. Falta ligá-lo a um remote e fazer push:

```bash
cd optifi-app
git remote add origin https://github.com/<o-teu-user>/optifi.git
git push -u origin main
```
> Os segredos NÃO vão no git (`.env.local` está no `.gitignore`). Só o
> `.env.example` (template) é versionado.

## 2. Importar no Vercel
1. Vercel → **Add New… → Project** → importa o repo `optifi`.
2. **Root Directory: `apps/web`** (é um monorepo; o Vercel instala os workspaces
   a partir da raiz automaticamente).
3. Framework: **Next.js** (detetado). Build/Output: deixa o automático.
4. **Ainda não faças deploy** — define primeiro as variáveis (passo 3).

## 3. Variáveis de ambiente (Vercel → Settings → Environment Variables)

### Mínimo para arrancar
| Variável | Âmbito | Origem |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Público (cliente) | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Público (cliente) | Supabase → API → anon/publishable |

### Para notificações web push (opcional, já preparado no código)
| Variável | Âmbito | Origem |
|---|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Público (cliente) | O teu par de chaves VAPID |
| `VAPID_PRIVATE_KEY` | **Servidor** | Par VAPID — **nunca no cliente** |
| `VAPID_SUBJECT` | Servidor | `mailto:tu@dominio.pt` |
| `CRON_SECRET` | Servidor | Aleatório (ver passo 6) |

### Para lembretes por email (opcional)
| Variável | Âmbito | Origem |
|---|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | **Servidor — SEGREDO** | Supabase → API → service_role. **Nunca `NEXT_PUBLIC`, nunca no cliente.** |
| `RESEND_API_KEY` | Servidor | Resend + domínio verificado |

> Marca cada variável para **Production** (e Preview, se quiseres). As
> `NEXT_PUBLIC_*` são expostas ao browser — só entram aí as que são realmente
> públicas. Todas as outras são só de servidor.

## 4. Supabase — antes do primeiro login
1. **Migrações:** confirma que as 12 de `supabase/migrations/` estão aplicadas no
   projeto de produção.
2. **URLs de auth:** Supabase → Authentication → URL Configuration:
   - **Site URL:** `https://<o-teu-dominio-vercel>`
   - **Redirect URLs:** adiciona `https://<dominio>/auth/callback` e
     `https://<dominio>/auth/confirm`
   Sem isto, o registo/confirmação de email e o OAuth falham.
3. **Emails de confirmação:** configura o SMTP/remetente em Supabase → Auth.

## 5. Deploy + teste de conta nova
1. Carrega **Deploy** no Vercel.
2. Quando ficar online, faz o **teste crítico**: cria uma **conta nova** e
   confirma que aterras **direto no wizard de importação** (não num Início
   vazio). Importa um extrato real (CSV ou PDF) e verifica a análise.

## 6. Lembretes diários (só quando ligares notificações)
A rota `POST /api/cron/reminders` exige o header **`x-cron-secret`** = `CRON_SECRET`.
- **Nota:** o Vercel Cron envia `Authorization: Bearer <CRON_SECRET>`, **não**
  `x-cron-secret`. Portanto, para lembretes tens duas opções:
  1. Usar um cron externo (ex.: cron-job.org, GitHub Actions) que envie o header
     `x-cron-secret`, ou
  2. Ajustar a rota para também aceitar `Authorization: Bearer` (1 linha) e usar
     Vercel Cron.
- Isto só é preciso quando ativares email/push; a app funciona sem.

---

## Notas
- **Build:** `npm run -w apps/web build` passa localmente (todas as rotas são
  dinâmicas — área com login).
- **Segurança:** a `service_role` nunca sai do servidor; ficheiros de extrato são
  processados e descartados (RGPD); `.env.*` fora do git.
- **Warning conhecido:** o Supabase usa `process.version` no Edge Runtime
  (middleware) — é um aviso, não bloqueia. Testar o middleware no domínio real.
