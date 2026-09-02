-- ============================================================
-- OptiFi — Schema inicial
-- Modelo fiel ao protótipo atual: mês fechado importado + análise,
-- subscrições com veredicto, objetivos com alocação/reserva,
-- limites por categoria, movimentos manuais do mês corrente.
-- Segurança: RLS em TODAS as tabelas — nenhuma linha sem dono.
-- Correr em: Supabase Dashboard → SQL Editor (ou supabase db push).
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- PROFILES — estende auth.users (criado automaticamente no signup)
-- ─────────────────────────────────────────────────────────────
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  name          text,
  language      text not null default 'pt' check (language in ('pt','en')),
  theme_mode    text not null default 'dark' check (theme_mode in ('dark','light')),
  theme_accent  text not null default 'brand' check (theme_accent in ('brand','amber','violet','emerald')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles: own read"   on public.profiles for select using (auth.uid() = id);
create policy "profiles: own insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles: own update" on public.profiles for update using (auth.uid() = id);

-- Cria o perfil no signup (name vem do metadata do registo)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name)
  values (new.id, new.raw_user_meta_data ->> 'name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at automático (reutilizado por todas as tabelas)
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- IMPORTS — um extrato de mês fechado importado (a base da análise).
-- Os agregados (income/expenses/housing_fixed/base_leak) são derivados
-- no servidor ao importar; o ficheiro original é descartado (minimização).
-- ─────────────────────────────────────────────────────────────
create table public.imports (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  bank            text not null,          -- 'revolut' | 'cgd' | 'bcp' | 'outro' | ...
  statement_month text not null,          -- 'YYYY-MM' (mês fechado analisado)
  status          text not null default 'processing' check (status in ('processing','ready','failed')),
  income          numeric(12,2) not null default 0,
  expenses        numeric(12,2) not null default 0,
  housing_fixed   numeric(12,2) not null default 0,
  base_leak       numeric(12,2) not null default 0,
  created_at      timestamptz not null default now(),
  unique (user_id, statement_month)
);

alter table public.imports enable row level security;
create policy "imports: own all" on public.imports for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- TRANSACTIONS — movimentos normalizados do mês importado
-- ─────────────────────────────────────────────────────────────
create table public.transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  import_id   uuid not null references public.imports(id) on delete cascade,
  tx_date     date not null,
  description text not null,
  amount      numeric(12,2) not null,     -- positivo; o sentido vem de tx_type
  tx_type     text not null check (tx_type in ('income','expense')),
  category    text not null default 'outros'
    check (category in ('habitacao','alimentacao','transporte','lazer','subscricoes','saude','receita','outros')),
  -- impressão digital para deduplicação em reimportações (data+valor+descritivo)
  fingerprint text not null,
  created_at  timestamptz not null default now(),
  unique (user_id, fingerprint)
);

create index transactions_user_import on public.transactions (user_id, import_id);

alter table public.transactions enable row level security;
create policy "transactions: own all" on public.transactions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- SUBSCRIPTIONS — detetadas no extrato, com veredicto do utilizador
-- ─────────────────────────────────────────────────────────────
create table public.subscriptions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  import_id      uuid references public.imports(id) on delete set null,
  name           text not null,
  price          numeric(12,2) not null,
  days_since_use integer,
  suspect        boolean not null default false,
  user_status    text not null default 'unknown'
    check (user_status in ('unknown','confirmed','rejected','cancelled')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.subscriptions enable row level security;
create policy "subscriptions: own all" on public.subscriptions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger subscriptions_touch before update on public.subscriptions
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- GOALS — objetivos com alocação mensal (modelo de dinheiro reservado)
-- ─────────────────────────────────────────────────────────────
create table public.goals (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  name               text not null,
  icon_key           text not null default 'target',
  target_eur         numeric(12,2) not null check (target_eur > 0),
  current_eur        numeric(12,2) not null default 0 check (current_eur >= 0),
  target_month       integer check (target_month between 1 and 12),
  target_year        integer,
  monthly_allocation numeric(12,2) not null default 0 check (monthly_allocation >= 0),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter table public.goals enable row level security;
create policy "goals: own all" on public.goals for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger goals_touch before update on public.goals
  for each row execute function public.touch_updated_at();

-- Levantamentos de objetivos — voltam ao dinheiro livre do mês
create table public.goal_withdrawals (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  goal_id    uuid not null references public.goals(id) on delete cascade,
  amount     numeric(12,2) not null check (amount > 0),
  month      text not null,               -- 'YYYY-MM' em que o levantamento conta
  created_at timestamptz not null default now()
);

alter table public.goal_withdrawals enable row level security;
create policy "goal_withdrawals: own all" on public.goal_withdrawals for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- CATEGORY LIMITS — tetos mensais opcionais (micro-orçamento)
-- ─────────────────────────────────────────────────────────────
create table public.category_limits (
  user_id    uuid not null references auth.users(id) on delete cascade,
  category   text not null,
  limit_eur  numeric(12,2) not null check (limit_eur >= 0),
  created_at timestamptz not null default now(),
  primary key (user_id, category)
);

alter table public.category_limits enable row level security;
create policy "category_limits: own all" on public.category_limits for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- MANUAL ENTRIES — movimentos do mês corrente registados à mão.
-- ESTRITAMENTE separados do mês importado: afetam só o presente.
-- ─────────────────────────────────────────────────────────────
create table public.manual_entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  month      text not null,               -- 'YYYY-MM' (mês a que pertence)
  entry_type text not null check (entry_type in ('income','expense')),
  amount     numeric(12,2) not null check (amount > 0),
  category   text not null default 'outros'
    check (category in ('habitacao','alimentacao','transporte','lazer','subscricoes','saude','receita','outros')),
  note       text,
  created_at timestamptz not null default now()
);

create index manual_entries_user_month on public.manual_entries (user_id, month);

alter table public.manual_entries enable row level security;
create policy "manual_entries: own all" on public.manual_entries for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- PLAN ITEMS — itens do plano de poupança (gerados + personalizados)
-- done/ignored resolvem a fuga correspondente
-- ─────────────────────────────────────────────────────────────
create table public.plan_items (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  import_id      uuid references public.imports(id) on delete cascade,
  title          text not null,
  monthly_saving numeric(12,2) not null check (monthly_saving >= 0),
  state          text not null default 'active' check (state in ('active','done','ignored')),
  is_custom      boolean not null default false,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table public.plan_items enable row level security;
create policy "plan_items: own all" on public.plan_items for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create trigger plan_items_touch before update on public.plan_items
  for each row execute function public.touch_updated_at();
