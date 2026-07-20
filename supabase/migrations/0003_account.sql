-- ============================================================
-- OptiFi — Fase 5: apagamento de conta (RGPD, art. 17.º)
-- Função SECURITY DEFINER que permite ao próprio utilizador apagar a sua
-- conta auth.users; todas as tabelas da app têm ON DELETE CASCADE, por isso
-- isto elimina TODOS os dados do utilizador de uma vez.
-- Correr em: Supabase Dashboard → SQL Editor.
-- ============================================================

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke execute on function public.delete_own_account() from public;
revoke execute on function public.delete_own_account() from anon;
grant execute on function public.delete_own_account() to authenticated;
