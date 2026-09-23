-- HypeFC x Stripe — liberacao automatica da licenca Pro.
--
-- Como funciona, em duas etapas:
--   1) o pedido pago entra pelo `pro_order_stripe` (service role): a sincronizacao
--      le as sessoes de checkout da Stripe e grava aqui, idempotente por sessao;
--   2) o comprador volta do Checkout com `?pro=ok&session_id=...` e o site chama
--      `pro_claim_session`: e isso que devolve o token e libera o Pro.
--
-- Por que o id da sessao e a chave: ele e secreto (vem da Stripe, 60+ caracteres
-- imprevisiveis), nao exige conta nem e-mail configurado, e morre depois do
-- primeiro resgate -- se o comprador recarregar a pagina, o token ja esta no
-- navegador dele e a UI mostra "Pro ativo".

alter table public.orders add column if not exists stripe_session_id text;
alter table public.orders add column if not exists claimed_at timestamptz;

-- unico por sessao: a mesma sessao nunca gera dois pedidos (nulls sao livres)
create unique index if not exists orders_stripe_session_uidx
  on public.orders (stripe_session_id);

comment on column public.orders.stripe_session_id is
  'id da sessao de checkout da Stripe; e a chave do resgate da licenca';
comment on column public.orders.claimed_at is
  'quando o comprador resgatou o token; resgate e de uso unico';

-- ---------------------------------------------------------------------------
-- 1) grava o pedido pago vindo da Stripe (somente service role)
-- ---------------------------------------------------------------------------
create or replace function public.pro_order_stripe(
  p_session text,
  p_email text,
  p_amount_cents integer,
  p_currency text default 'BRL',
  p_ref text default null,
  p_meses integer default 1
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text := public._norm_email(p_email);
  v_sess text := btrim(coalesce(p_session, ''));
  v_id uuid;
begin
  if length(v_sess) < 10 then
    return jsonb_build_object('ok', false, 'erro', 'sessao-invalida');
  end if;
  if v_email = '' then
    return jsonb_build_object('ok', false, 'erro', 'email-invalido');
  end if;

  insert into public.orders
    (email, provider, provider_ref, stripe_session_id, amount_cents, currency, months, status, paid_at)
  values
    (v_email, 'stripe', p_ref, v_sess, greatest(coalesce(p_amount_cents, 0), 0),
     coalesce(nullif(btrim(p_currency), ''), 'BRL'), greatest(coalesce(p_meses, 1), 1), 'paid', now())
  on conflict (stripe_session_id) do update
     set status = 'paid',
         paid_at = coalesce(public.orders.paid_at, now())
  returning id into v_id;

  return jsonb_build_object('ok', true, 'pedido', v_id, 'email', v_email);
end;
$$;

revoke all on function public.pro_order_stripe(text, text, integer, text, text, integer)
  from public, anon, authenticated;
grant execute on function public.pro_order_stripe(text, text, integer, text, text, integer)
  to service_role;

-- ---------------------------------------------------------------------------
-- 2) resgate: o comprador troca o id da sessao pelo token da licenca
-- ---------------------------------------------------------------------------
create or replace function public.pro_claim_session(p_session text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sess text := btrim(coalesce(p_session, ''));
  v_ord public.orders;
  v_sub public.subscribers;
  v_token text;
  v_ate timestamptz;
begin
  if length(v_sess) < 10 then
    return jsonb_build_object('ok', false, 'erro', 'sessao-invalida');
  end if;

  select * into v_ord from public.orders where stripe_session_id = v_sess limit 1;
  if v_ord.id is null then
    return jsonb_build_object('ok', false, 'erro', 'sessao-nao-encontrada');
  end if;
  if v_ord.status <> 'paid' then
    return jsonb_build_object('ok', false, 'erro', 'pagamento-nao-confirmado');
  end if;
  if v_ord.claimed_at is not null then
    return jsonb_build_object('ok', false, 'erro', 'ja-resgatado');
  end if;

  select * into v_sub from public.subscribers where email = v_ord.email limit 1;
  if v_sub.id is null then
    insert into public.subscribers (email, plan, status, source)
    values (v_ord.email, 'pro', 'active', 'stripe')
    on conflict (email) do nothing;
    select * into v_sub from public.subscribers where email = v_ord.email limit 1;
  end if;

  -- meses comprados somam ao que ja havia (quem renova nao perde o tempo restante)
  v_ate := greatest(coalesce(v_sub.paid_until, now()), now())
           + (v_ord.months || ' months')::interval;

  -- token de 64 hex (256 bits) de duas UUID v4: mesmo padrao do pro_setup
  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  update public.subscribers
     set plan = 'pro',
         status = 'active',
         paid_until = v_ate,
         token_hash = public._hash(v_token),
         updated_at = now()
   where id = v_sub.id;

  update public.orders
     set subscriber_id = v_sub.id, claimed_at = now()
   where id = v_ord.id;

  return jsonb_build_object(
    'ok', true,
    'token', v_token,
    'email', v_sub.email,
    'plano', 'pro',
    'paid_until', v_ate
  );
end;
$$;

grant execute on function public.pro_claim_session(text) to anon, authenticated;
