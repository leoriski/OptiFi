# Deploy da OptiFi

App Next.js 15 (monorepo npm workspaces) + Supabase. Guia para o primeiro deploy
em **Vercel + GitHub** (recomendado). Segue os passos por ordem.

## Pré-requisitos
- Conta **GitHub** e conta **Vercel**.
- Projeto **Supabase** já criado (região UE). As 17 migrações em
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
1. **Migrações:** confirma que as 17 de `supabase/migrations/` estão aplicadas no
   projeto de produção.
2. **URLs de auth:** Supabase → Authentication → URL Configuration:
   - **Site URL:** `https://<o-teu-dominio-vercel>`
   - **Redirect URLs:** adiciona
     - `https://<dominio>/auth/callback` e `https://<dominio>/auth/confirm` (web)
     - `optifi://auth/confirm` (app móvel — os links de email abrem a própria app)
     - em testes com Expo Go, também o `exp://` do teu dev server
       (ex.: `exp://192.168.1.10:8081`)
   Sem isto, o registo/confirmação de email e o OAuth falham.
3. **Emails de confirmação:** configura o SMTP/remetente em Supabase → Auth.
4. **App móvel:** a app espera os links no esquema `optifi://` (definido em
   `apps/mobile/app.json` → `scheme`). Em produção o `optifi://auth/confirm`
   abre `app/auth/confirm.tsx`, que valida o token e segue para o destino
   (`/update-password` na recuperação). Para o Expo Go, define
   `EXPO_PUBLIC_AUTH_REDIRECT` no `apps/mobile/.env`.

## 5. Deploy + teste de conta nova
1. Carrega **Deploy** no Vercel.
2. Quando ficar online, faz o **teste crítico**: cria uma **conta nova** e
   confirma que aterras **direto no wizard de importação** (não num Início
   vazio). Importa um extrato real (CSV ou PDF) e verifica a análise.

## 6. Edge Function — importação de PDF no telemóvel

A app móvel importa extratos PDF através de uma Edge Function do Supabase
(`import-pdf`) que extrai as **linhas** de texto do ficheiro usando a build
serverless do PDF.js. O CSV continua a correr só no aparelho; nada muda lá.

### Deploy da função
Precisa do Supabase CLI em qualquer máquina (macOS/Linux; corre localmente e
envia o bundle para o projeto). É a **única** forma de publicar a função — o
dashboard não aceita carregar Edge Functions com dependências remotas.

```bash
# instala uma vez: https://supabase.com/docs/guides/cli
# macOS:  brew install supabase/tap/supabase   |   linux: (script no site)
supabase --version        # >= 1.100 (qualquer versão recente serve)
supabase login            # abre o browser e liga-te à conta do projeto
supabase link --project-ref <o-teu-projeto>   # ex.: xxxxabc
supabase projects list    # confirma a que ficas ligado

# publica a função no projeto
supabase functions deploy import-pdf --no-verify-jwt
```

> `--no-verify-jwt` é de propósito: a validação do JWT é feita **dentro** da
> função com `auth.getUser()`, para conhecer o utilizador e limitar a taxa de
> pedidos. Nada disto afeta a app web (que não usa Edge Functions).

### Como funciona
- O telemóvel envia o PDF em **multipart** (`FormData` → `file`) com o header
  `Authorization: Bearer <access_token>`.
- A função valida o token, extrai as linhas com coordenadas, recompõe-as em
  linhas visuais e devolve `{ "lines": [ ... ] }`.
- O ficheiro **não é guardado** (vive só na memória da instância) e é descartado
  no fim — a mesma postura de minimização RGPD da pipeline web.

### Testar localmente
```bash
supabase functions serve import-pdf   # serve na porta 54321
```
```bash
# com o CLI a correr e um extrato `extrato.pdf`:
curl -X POST http://127.0.0.1:54321/functions/v1/import-pdf \
  -H "Authorization: Bearer <jwt-do-utilizador>" \
  -F "file=@extrato.pdf"
```
Respostas: `401` sem token válido (ou token expirado), `405` noutro método,
`400` sem `file`, `413` acima de 8 MB, `422` para PDFs ilegíveis
(protegidos/digitalizados) e `200` com `{ "lines": [...] }` quando corre bem.

### Verificar em produção
```bash
curl -X POST https://<o-teu-projeto>.supabase.co/functions/v1/import-pdf \
  -H "Authorization: Bearer <jwt-do-utilizador>" \
  -F "file=@extrato.pdf"
```
> O JWT é o da sessão do utilizador (`session.access_token`), o mesmo que a
> app usa para falar com o Supabase. Para um teste rápido, gera um na consola
> do browser: `supabase.auth.getSession()`.

## 7. Lembretes diários (só quando ligares notificações)
As rotas `POST /api/cron/reminders` e `POST /api/cron/daily-tip` exigem o
`CRON_SECRET`. Aceitam o header **`x-cron-secret`** (crons externos) e o
**`Authorization: Bearer <CRON_SECRET>`** (o formato que o Vercel Cron envia),
por isso podes usar Vercel Cron diretamente:

```jsonc
// vercel.json (na raiz do monorepo)
{
  "crons": [
    { "path": "/api/cron/reminders", "schedule": "0 6 * * *" },
    { "path": "/api/cron/daily-tip", "schedule": "0 8 * * *" }
  ]
}
```
> O Vercel Cron injeta automaticamente o header `Authorization: Bearer` com o
> `CRON_SECRET` que definires nas Environment Variables. Isto só é preciso quando
> ativares email/push; a app funciona sem.

---

## Notas
- **Build:** `npm run -w apps/web build` passa localmente (todas as rotas são
  dinâmicas — área com login).
- **Segurança:** a `service_role` nunca sai do servidor; ficheiros de extrato são
  processados e descartados (RGPD); `.env.*` fora do git.
- **Warning conhecido:** o Supabase usa `process.version` no Edge Runtime
  (middleware) — é um aviso, não bloqueia. Testar o middleware no domínio real.
