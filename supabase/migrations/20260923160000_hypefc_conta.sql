-- HypeFC — conta (Supabase Auth / Google) atrelada à licença Pro.
--
-- Por que existe: o token no navegador resolve o acesso, mas prende a licença
-- àquele aparelho. Com conta, o e-mail vira o dono: entra em qualquer celular,
-- troca de navegador, limpa os dados — e o Pro volta.
--
-- A entrada faz tres coisas, nesta ordem:
--   1. acha o assinante pelo e-mail da conta;
--   2. se ainda nao existe, procura compra paga e nao resgatada com esse e-mail
--      (comprou antes de existir conta, ou em outro navegador) e resgata;
--   3. se a assinatura esta valendo, rotaciona o token e devolve.
--
-- A rotacao troca o token do subscrevedor: o aparelho mais recente fica com o
-- acesso. E deliberado — e simples, e reentrar com a conta e um clique.

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

  -- 2) ainda sem assinante: tenta resgatar uma compra paga desse e-mail
  if v_sub.id is null then
    select * into v_pedido
      from public.orders
     where email = v_email and status = 'paid' and claimed_at is null
     order by created_at desc
     limit 1;

    if v_pedido.id is null then
      return jsonb_build_object('ok', false, 'erro', 'sem-assinatura', 'email', v_email);
    end if;

    insert into public.subscribers (email, plan, status, source, paid_until)
    values (v_email, 'pro', 'active', 'stripe',
            now() + (greatest(coalesce(v_pedido.months, 1), 1) || ' months')::interval)
    on conflict (email) do nothing;

    select * into v_sub from public.subscribers where email = v_email limit 1;
    update public.orders
       set subscriber_id = v_sub.id, claimed_at = now()
     where id = v_pedido.id;
  end if;

  -- 3) assinatura fora de validade nao libera (mesma regra do resto do site)
  if v_sub.status <> 'active'
     or (v_sub.paid_until is not null and v_sub.paid_until <= now()) then
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
    'paid_until', v_sub.paid_until,
    'conta', true
  );
end;
$$;

revoke all on function public.pro_conta_entrar() from public, anon;
grant execute on function public.pro_conta_entrar() to authenticated;

-- Estado da conta sem entregar token: a UI usa para dizer em que pe esta.
create or replace function public.pro_conta_estado()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text := public._norm_email(coalesce(auth.jwt() ->> 'email', ''));
  v_sub public.subscribers;
begin
  if v_email = '' then
    return jsonb_build_object('logado', false);
  end if;

  select * into v_sub from public.subscribers where email = v_email limit 1;
  if v_sub.id is null then
    return jsonb_build_object('logado', true, 'email', v_email, 'plano', 'free', 'assinatura', false);
  end if;

  return jsonb_build_object(
    'logado', true,
    'email', v_sub.email,
    'plano', v_sub.plan,
    'status', v_sub.status,
    'paid_until', v_sub.paid_until,
    'assinatura', v_sub.status = 'active'
                  and (v_sub.paid_until is null or v_sub.paid_until > now())
  );
end;
$$;

revoke all on function public.pro_conta_estado() from public, anon;
grant execute on function public.pro_conta_estado() to authenticated;
