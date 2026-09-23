-- Ajuste: o plano gratuito tambem precisa de acesso.
--
-- Na primeira versao, so quem pagava recebia codigo — logo o gratuito nao tinha
-- token e nao conseguia seguir ninguem, apesar de a oferta prometer 3 times.
-- Agora entrar na lista ja devolve um token (limite 3, sem alertas): o gratuito
-- funciona com um e-mail, sem pagamento, e o Pro continua sendo o unico que
-- recebe alerta, porque a entrega filtra plan='pro' AND status='active'.
--
-- O token so e devolvido UMA vez (na primeira vez do e-mail). Nao guardamos o
-- token em claro; quem perder o token pede um codigo novo, que e o caminho de
-- recuperacao — nada de "reenviar minha chave" por e-mail.

create or replace function public.join_waitlist(p_email text, p_nome text default null, p_source text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text := public._norm_email(p_email);
  v_sub public.subscribers;
  v_token text;
begin
  if v_email = '' or length(v_email) > 254 or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    return jsonb_build_object('ok', false, 'erro', 'email-invalido');
  end if;

  insert into public.subscribers (email, nome, source)
  values (v_email, nullif(left(btrim(coalesce(p_nome, '')), 80), ''), left(coalesce(p_source, 'site'), 60))
  on conflict (email) do update
    set nome = coalesce(excluded.nome, public.subscribers.nome),
        updated_at = now();

  select * into v_sub from public.subscribers where email = v_email;

  if v_sub.status = 'canceled' then
    return jsonb_build_object('ok', false, 'erro', 'acesso-cancelado');
  end if;

  if v_sub.token_hash is null then
    v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
    update public.subscribers
       set token_hash = public._hash(v_token),
           updated_at = now()
     where id = v_sub.id;
  else
    -- Ja tem acesso em algum navegador: nao devolvemos o token de novo (nao
    -- guardamos em claro). O caminho e pedir um codigo novo.
    v_token := null;
  end if;

  return jsonb_build_object(
    'ok', true,
    'token', v_token,
    'plan', v_sub.plan,
    'status', v_sub.status,
    'limite', public._limite_do(v_sub),
    'ja_tinha_acesso', v_token is null
  );
end
$$;

revoke all on function public.join_waitlist(text, text, text) from public;
grant execute on function public.join_waitlist(text, text, text) to anon, authenticated;
