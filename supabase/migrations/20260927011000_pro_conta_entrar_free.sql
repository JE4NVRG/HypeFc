-- pro_conta_entrar: a conta sempre devolve licenca (free ou pro).
--
-- Por que: o QA de 24/09 mediu que entrar com Google sem assinatura deixava a
-- pessoa com MENOS acesso do que quem preencheu "Entrar na lista" (que recebe
-- token do plano gratuito): `pro_conta_entrar` respondia `sem-assinatura` e o
-- navegador ficava sem token nenhum, entao seguir time (recurso do gratuito,
-- "ate 3 times") nao funcionava nem logado. A correcao foi aplicada direto no
-- projeto e vive aqui para o repo reproduzir o banco.
--
-- Comportamento agora, nesta ordem:
--   1. acha o assinante pelo e-mail da conta;
--   2. se nao existe: resgata compra paga nao resgatada (vira pro ativo) OU
--      provisiona o gratuito (`free`/`conta`);
--   3. se for `pro` com assinatura fora de validade, recusa (mesma regra do
--      resto do site);
--   4. rotaciona o token e devolve, com `limite` calculado por `_limite_do`
--      (free 3 / pro 20).
--
-- Aplicada no projeto HypeFC (sebyzlcgadsiinikxfgu) em 26/09/2026.
create or replace function public.pro_conta_entrar()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text := public._norm_email(coalesce(auth.jwt() ->> 'email', ''));
  v_sub public.subscribers;
  v_pedido public.orders;
  v_token text;
begin
  if v_email = '' then
    return jsonb_build_object('ok', false, 'erro', 'sem-email-na-conta');
  end if;

  select * into v_sub from public.subscribers where email = v_email limit 1;

  if v_sub.id is null then
    select * into v_pedido
      from public.orders
     where email = v_email and status = 'paid' and claimed_at is null
     order by created_at desc
     limit 1;

    if v_pedido.id is not null then
      insert into public.subscribers (email, plan, status, source, paid_until)
      values (v_email, 'pro', 'active', 'stripe',
              now() + (greatest(coalesce(v_pedido.months, 1), 1) || ' months')::interval)
      on conflict (email) do nothing;

      update public.orders
         set subscriber_id = (select id from public.subscribers where email = v_email limit 1),
             claimed_at = now()
       where id = v_pedido.id;
    else
      insert into public.subscribers (email, plan, status, source)
      values (v_email, 'free', 'conta', 'conta')
      on conflict (email) do nothing;
    end if;

    select * into v_sub from public.subscribers where email = v_email limit 1;
  end if;

  if v_sub.plan = 'pro'
     and (v_sub.status <> 'active' or (v_sub.paid_until is not null and v_sub.paid_until <= now())) then
    return jsonb_build_object(
      'ok', false, 'erro', 'sem-assinatura', 'email', v_email,
      'status', v_sub.status, 'paid_until', v_sub.paid_until
    );
  end if;

  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  update public.subscribers
     set token_hash = public._hash(v_token),
         updated_at = now()
   where id = v_sub.id;

  return jsonb_build_object(
    'ok', true,
    'token', v_token,
    'email', v_sub.email,
    'plano', v_sub.plan,
    'status', v_sub.status,
    'limite', public._limite_do(v_sub),
    'paid_until', v_sub.paid_until,
    'conta', true
  );
end;
$$;

revoke all on function public.pro_conta_entrar() from public, anon;
grant execute on function public.pro_conta_entrar() to authenticated;
