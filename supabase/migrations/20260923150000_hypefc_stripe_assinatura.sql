-- HypeFC x Stripe — assinatura recorrente (renovacao e cancelamento).
--
-- Por que existe, separado do resgate: a primeira compra vem por uma sessao de
-- checkout (tem `session_id`), mas a RENOVACAO mensal nao gera sessao nova —
-- ela aparece como assinatura ativa na Stripe. Sem esta parte o assinante
-- perderia o Pro no segundo mes, mesmo pagando.
--
-- Quem chama: a sincronizacao (service_role). O site nunca chama isso.

create or replace function public.pro_assinatura_stripe(
  p_email text,
  p_ate timestamptz,
  p_status text,
  p_ref text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text := public._norm_email(p_email);
  v_status text := lower(btrim(coalesce(p_status, '')));
  v_sub public.subscribers;
  v_plano text;
  v_situacao text;
  v_ate timestamptz;
begin
  if v_email = '' then
    return jsonb_build_object('ok', false, 'erro', 'email-invalido');
  end if;

  -- active/trialing = acesso liberado; past_due/canceled = acesso ate vencer
  if v_status in ('active', 'trialing') then
    v_plano := 'pro';
    v_situacao := 'active';
    v_ate := greatest(coalesce(p_ate, now()), now());
  elsif v_status = 'past_due' then
    v_plano := 'pro';
    v_situacao := 'past_due';
    v_ate := coalesce(p_ate, now());
  else
    v_plano := 'pro';
    v_situacao := 'canceled';
    v_ate := coalesce(p_ate, now());
  end if;

  select * into v_sub from public.subscribers where email = v_email limit 1;
  if v_sub.id is null then
    insert into public.subscribers (email, plan, status, source, paid_until)
    values (v_email, v_plano, v_situacao, 'stripe', v_ate)
    on conflict (email) do nothing;
    select * into v_sub from public.subscribers where email = v_email limit 1;
  else
    -- nunca encurtar o que o comprador ja pagou: o vencimento so avanca
    update public.subscribers
       set plan = v_plano,
           status = v_situacao,
           paid_until = greatest(coalesce(paid_until, v_ate), v_ate),
           updated_at = now()
     where id = v_sub.id
     returning * into v_sub;
  end if;

  return jsonb_build_object(
    'ok', true,
    'email', v_sub.email,
    'plano', v_sub.plan,
    'status', v_sub.status,
    'paid_until', v_sub.paid_until,
    'ref', p_ref
  );
end;
$$;

revoke all on function public.pro_assinatura_stripe(text, timestamptz, text, text)
  from public, anon, authenticated;
grant execute on function public.pro_assinatura_stripe(text, timestamptz, text, text)
  to service_role;
