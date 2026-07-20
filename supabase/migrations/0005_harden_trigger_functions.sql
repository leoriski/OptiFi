-- ============================================================
-- OptiFi — Endurecimento das funções-gatilho (advisor de segurança)
-- Fixa o search_path e remove o EXECUTE público das funções que só devem
-- correr como trigger (não via RPC). Os triggers continuam a funcionar —
-- o grant não afeta a execução acionada por trigger.
-- ============================================================

alter function public.touch_updated_at() set search_path = public;
alter function public.handle_new_user() set search_path = public;

revoke execute on function public.handle_new_user() from anon, authenticated, public;
revoke execute on function public.touch_updated_at() from anon, authenticated, public;

do $$
begin
  if exists (
    select 1 from pg_proc
    where proname = 'rls_auto_enable' and pronamespace = 'public'::regnamespace
  ) then
    execute 'revoke execute on function public.rls_auto_enable() from anon, authenticated, public';
  end if;
end $$;
