-- push_save passa a exigir plano Pro — a mesma regra do remetente.
--
-- Por que: `scripts/send-alerts.ts` so entrega para plan=pro ativo com
-- paid_until no futuro. Antes desta correcao, um token gratuito conseguia
-- gravar inscricao em push_subs (o QA de 24/09 mediu `ok:true` com token free):
-- a pessoa via "alertas ativados" e nunca recebia nada, porque o remetente
-- filtrava so na entrega. Fail closed: recusa na gravacao.
--
-- Aplicada no projeto HypeFC (sebyzlcgadsiinikxfgu) em 27/09/2026 e provada por
-- REST com chave anonima: free -> sem-pro, pro ativo -> ok, pro vencido ->
-- sem-pro, token inventado -> sem-acesso.
create or replace function public.push_save(p_token text, p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sub public.subscribers;
begin
  v_sub := public._sub_por_token(p_token);
  if v_sub.id is null then
    return jsonb_build_object('ok', false, 'erro', 'sem-acesso');
  end if;
  -- Mesma regra de `_limite_do` e do remetente: pro + active + paid_until ok.
  if not (v_sub.plan = 'pro'
          and v_sub.status = 'active'
          and (v_sub.paid_until is null or v_sub.paid_until > now())) then
    return jsonb_build_object('ok', false, 'erro', 'sem-pro');
  end if;
  if length(coalesce(p_endpoint, '')) < 20 or length(coalesce(p_p256dh, '')) < 20 or length(coalesce(p_auth, '')) < 8 then
    return jsonb_build_object('ok', false, 'erro', 'inscricao-invalida');
  end if;

  insert into public.push_subs (subscriber_id, endpoint, p256dh, auth, user_agent)
  values (v_sub.id, left(p_endpoint, 500), left(p_p256dh, 200), left(p_auth, 100), left(coalesce(p_user_agent, ''), 200))
  on conflict (endpoint) do update
    set subscriber_id = excluded.subscriber_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        user_agent = excluded.user_agent,
        fails = 0;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.push_save(text, text, text, text, text) from public;
grant execute on function public.push_save(text, text, text, text, text) to anon, authenticated;
