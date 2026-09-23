-- HypeFC Pro — loja do plano pago.
--
-- Contexto: o site e ESTATICO (GitHub Pages), sem backend proprio. Em vez de
-- inventar um servidor, o acesso pago e provado por um CODIGO de uso unico
-- (entregue depois do pagamento) que troca por um TOKEN aleatorio de 256 bits
-- guardado no navegador. E o mesmo modelo de uma API key: sem senha, sem email
-- transacional, sem webhook obrigatorio.
--
-- Regra de seguranca que sustenta tudo: as tabelas tem RLS habilitada e NENHUMA
-- policy — nem leitura nem escrita para a chave anon. O unico caminho e pelas
-- funcoes SECURITY DEFINER abaixo, que validam o token e so devolvem os dados
-- do proprio dono. Nunca guardamos o codigo nem o token em texto puro: so o
-- hash SHA-256.
--
-- Limite conhecido (aceito no v1): join_waitlist e publico, entao alguem com a
-- chave anon pode inserir emails na lista de espera. Nao ha dado sensivel do
-- usuario exposto por isso; se virar abuso, entra captcha ou rate-limit por IP.

-- Nao usamos pgcrypto: sha256() e gen_random_uuid() sao nativos no Postgres 13+,
-- evitam depender do schema `extensions` (no Supabase o pgcrypto mora la, fora do
-- search_path destas funcoes) e nao exigem confiar em extensao instalada.

-- ---------------------------------------------------------------- tabelas

create table if not exists public.subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  nome text,
  plan text not null default 'free',
  status text not null default 'waitlist',
  access_hash text,
  access_created_at timestamptz,
  access_used_at timestamptz,
  token_hash text,
  paid_until timestamptz,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscribers_email_key unique (email),
  constraint subscribers_email_lower check (email = lower(email)),
  constraint subscribers_email_formato check (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  constraint subscribers_plan_ck check (plan in ('free', 'pro')),
  constraint subscribers_status_ck check (status in ('waitlist', 'active', 'past_due', 'canceled'))
);

create table if not exists public.follows (
  id uuid primary key default gen_random_uuid(),
  subscriber_id uuid not null references public.subscribers(id) on delete cascade,
  league_id text not null,
  team_id text not null,
  team_name text not null,
  created_at timestamptz not null default now(),
  constraint follows_unico unique (subscriber_id, team_id)
);

create table if not exists public.push_subs (
  id uuid primary key default gen_random_uuid(),
  subscriber_id uuid not null references public.subscribers(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_ok_at timestamptz,
  fails integer not null default 0,
  constraint push_endpoint_key unique (endpoint)
);

create table if not exists public.alert_log (
  id bigserial primary key,
  subscriber_id uuid not null references public.subscribers(id) on delete cascade,
  event_key text not null,
  sent_at timestamptz not null default now(),
  ok boolean not null default true,
  erro text,
  constraint alert_idem unique (subscriber_id, event_key)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  subscriber_id uuid references public.subscribers(id) on delete set null,
  email text not null,
  provider text not null default 'manual',
  provider_ref text,
  amount_cents integer not null default 0,
  currency text not null default 'BRL',
  months integer not null default 1,
  status text not null default 'pending',
  paid_at timestamptz,
  raw jsonb,
  created_at timestamptz not null default now(),
  constraint orders_status_ck check (status in ('pending', 'paid', 'refunded', 'failed'))
);

create index if not exists follows_subscriber_idx on public.follows (subscriber_id);
create index if not exists push_subs_subscriber_idx on public.push_subs (subscriber_id);
create index if not exists orders_email_idx on public.orders (email);
create index if not exists alert_log_subscriber_idx on public.alert_log (subscriber_id);

-- RLS ligada e SEM policy: fecha o acesso direto pela chave anon. O service_role
-- (usado pelo cron de entrega no Mac) ignora RLS por design.
alter table public.subscribers enable row level security;
alter table public.follows enable row level security;
alter table public.push_subs enable row level security;
alter table public.alert_log enable row level security;
alter table public.orders enable row level security;

revoke all on table public.subscribers from anon, authenticated;
revoke all on table public.follows from anon, authenticated;
revoke all on table public.push_subs from anon, authenticated;
revoke all on table public.alert_log from anon, authenticated;
revoke all on table public.orders from anon, authenticated;

-- ---------------------------------------------------------------- helpers

create or replace function public._norm_email(p_email text)
returns text
language sql
immutable
as $$
  select lower(btrim(coalesce(p_email, '')))
$$;

create or replace function public._hash(p_valor text)
returns text
language sql
immutable
as $$
  select encode(sha256(convert_to(coalesce(p_valor, ''), 'UTF8')), 'hex')
$$;

-- Resolve o dono pelo token. Devolve a linha inteira; quem chama decide o que
-- expor. Nunca e exposta ao anon (revogada abaixo).
create or replace function public._sub_por_token(p_token text)
returns public.subscribers
language sql
security definer
set search_path = public, pg_temp
as $$
  select *
  from public.subscribers
  where token_hash is not null
    and token_hash = public._hash(btrim(coalesce(p_token, '')))
  limit 1
$$;

-- Pro vale enquanto o plano for pro, o status estiver ativo e o periodo pago
-- nao tiver vencido. Qualquer outro caso cai no limite gratuito.
create or replace function public._limite_do(v_sub public.subscribers)
returns integer
language sql
stable
as $$
  select case
    when v_sub.plan = 'pro'
     and v_sub.status = 'active'
     and (v_sub.paid_until is null or v_sub.paid_until > now())
    then 20
    else 3
  end
$$;

-- ---------------------------------------------------------------- RPCs

create or replace function public.join_waitlist(p_email text, p_nome text default null, p_source text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text := public._norm_email(p_email);
begin
  if v_email = '' or length(v_email) > 254 or v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    return jsonb_build_object('ok', false, 'erro', 'email-invalido');
  end if;

  insert into public.subscribers (email, nome, source)
  values (v_email, nullif(left(btrim(coalesce(p_nome, '')), 80), ''), left(coalesce(p_source, 'site'), 60))
  on conflict (email) do update
    set nome = coalesce(excluded.nome, public.subscribers.nome),
        updated_at = now();

  return jsonb_build_object('ok', true);
end
$$;

-- Troca o codigo de uso unico por um token. A partir daqui o navegador guarda o
-- token e todas as chamadas seguintes se identificam por ele.
create or replace function public.pro_setup(p_email text, p_codigo text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_email text := public._norm_email(p_email);
  v_cod text := upper(btrim(coalesce(p_codigo, '')));
  v_sub public.subscribers;
  v_token text;
begin
  if v_email = '' or length(v_cod) < 6 then
    return jsonb_build_object('ok', false, 'erro', 'codigo-invalido');
  end if;

  select * into v_sub
  from public.subscribers
  where email = v_email
    and access_hash = public._hash(v_cod)
  limit 1;

  if v_sub.id is null then
    return jsonb_build_object('ok', false, 'erro', 'codigo-invalido');
  end if;
  if v_sub.access_used_at is not null then
    return jsonb_build_object('ok', false, 'erro', 'codigo-ja-usado');
  end if;
  if v_sub.access_created_at is not null and v_sub.access_created_at < now() - interval '90 days' then
    return jsonb_build_object('ok', false, 'erro', 'codigo-expirado');
  end if;
  if v_sub.status = 'canceled' then
    return jsonb_build_object('ok', false, 'erro', 'acesso-cancelado');
  end if;

  -- Token de 64 caracteres hexadecimais (256 bits) vindo de duas UUID v4
  -- criptograficamente aleatorias: nao ha byte previsivel e nao depende de extensao.
  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  update public.subscribers
     set token_hash = public._hash(v_token),
         access_used_at = now(),
         status = case
           when plan = 'pro' and (paid_until is null or paid_until > now()) then 'active'
           else status
         end,
         updated_at = now()
   where id = v_sub.id;

  return jsonb_build_object(
    'ok', true,
    'token', v_token,
    'plan', v_sub.plan,
    'status', v_sub.status,
    'nome', v_sub.nome
  );
end
$$;

create or replace function public.pro_me(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sub public.subscribers;
  v_n integer;
begin
  v_sub := public._sub_por_token(p_token);
  if v_sub.id is null then
    return jsonb_build_object('ok', false, 'erro', 'sem-acesso');
  end if;

  select count(*) into v_n from public.follows where subscriber_id = v_sub.id;

  return jsonb_build_object(
    'ok', true,
    'email', v_sub.email,
    'nome', v_sub.nome,
    'plan', v_sub.plan,
    'status', v_sub.status,
    'paid_until', v_sub.paid_until,
    'seguidos', v_n,
    'limite', public._limite_do(v_sub)
  );
end
$$;

create or replace function public.follow_set(p_token text, p_league_id text, p_team_id text, p_team_name text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sub public.subscribers;
  v_lim integer;
  v_n integer;
  v_ja boolean;
begin
  v_sub := public._sub_por_token(p_token);
  if v_sub.id is null then
    return jsonb_build_object('ok', false, 'erro', 'sem-acesso');
  end if;
  if v_sub.status = 'canceled' then
    return jsonb_build_object('ok', false, 'erro', 'acesso-cancelado');
  end if;
  if btrim(coalesce(p_team_id, '')) = '' or btrim(coalesce(p_team_name, '')) = '' then
    return jsonb_build_object('ok', false, 'erro', 'time-invalido');
  end if;

  v_lim := public._limite_do(v_sub);
  select count(*) into v_n from public.follows where subscriber_id = v_sub.id;
  select exists (
    select 1 from public.follows where subscriber_id = v_sub.id and team_id = btrim(p_team_id)
  ) into v_ja;

  if not v_ja and v_n >= v_lim then
    return jsonb_build_object('ok', false, 'erro', 'limite', 'seguidos', v_n, 'limite', v_lim);
  end if;

  insert into public.follows (subscriber_id, league_id, team_id, team_name)
  values (
    v_sub.id,
    left(btrim(coalesce(p_league_id, '')), 40),
    left(btrim(p_team_id), 40),
    left(btrim(p_team_name), 80)
  )
  on conflict (subscriber_id, team_id) do update
    set team_name = excluded.team_name,
        league_id = excluded.league_id;

  select count(*) into v_n from public.follows where subscriber_id = v_sub.id;
  return jsonb_build_object('ok', true, 'seguidos', v_n, 'limite', v_lim);
end
$$;

create or replace function public.follow_remove(p_token text, p_team_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sub public.subscribers;
  v_n integer;
begin
  v_sub := public._sub_por_token(p_token);
  if v_sub.id is null then
    return jsonb_build_object('ok', false, 'erro', 'sem-acesso');
  end if;

  delete from public.follows
   where subscriber_id = v_sub.id
     and team_id = btrim(coalesce(p_team_id, ''));

  select count(*) into v_n from public.follows where subscriber_id = v_sub.id;
  return jsonb_build_object('ok', true, 'seguidos', v_n, 'limite', public._limite_do(v_sub));
end
$$;

create or replace function public.follow_list(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_sub public.subscribers;
  v_follows jsonb;
begin
  v_sub := public._sub_por_token(p_token);
  if v_sub.id is null then
    return jsonb_build_object('ok', false, 'erro', 'sem-acesso');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'league_id', league_id,
           'team_id', team_id,
           'team_name', team_name
         ) order by created_at), '[]'::jsonb)
    into v_follows
    from public.follows
   where subscriber_id = v_sub.id;

  return jsonb_build_object('ok', true, 'follows', v_follows);
end
$$;

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
end
$$;

create or replace function public.push_delete(p_token text, p_endpoint text)
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

  delete from public.push_subs
   where endpoint = btrim(coalesce(p_endpoint, ''))
     and subscriber_id = v_sub.id;

  return jsonb_build_object('ok', true);
end
$$;

-- ---------------------------------------------------------------- grants

revoke all on function public._norm_email(text) from public, anon, authenticated;
revoke all on function public._hash(text) from public, anon, authenticated;
revoke all on function public._sub_por_token(text) from public, anon, authenticated;
revoke all on function public._limite_do(public.subscribers) from public, anon, authenticated;

revoke all on function public.join_waitlist(text, text, text) from public;
revoke all on function public.pro_setup(text, text) from public;
revoke all on function public.pro_me(text) from public;
revoke all on function public.follow_set(text, text, text, text) from public;
revoke all on function public.follow_remove(text, text) from public;
revoke all on function public.follow_list(text) from public;
revoke all on function public.push_save(text, text, text, text, text) from public;
revoke all on function public.push_delete(text, text) from public;

grant execute on function public.join_waitlist(text, text, text) to anon, authenticated;
grant execute on function public.pro_setup(text, text) to anon, authenticated;
grant execute on function public.pro_me(text) to anon, authenticated;
grant execute on function public.follow_set(text, text, text, text) to anon, authenticated;
grant execute on function public.follow_remove(text, text) to anon, authenticated;
grant execute on function public.follow_list(text) to anon, authenticated;
grant execute on function public.push_save(text, text, text, text, text) to anon, authenticated;
grant execute on function public.push_delete(text, text) to anon, authenticated;

grant all on table public.subscribers to service_role;
grant all on table public.follows to service_role;
grant all on table public.push_subs to service_role;
grant all on table public.alert_log to service_role;
grant all on table public.orders to service_role;
grant usage, select on sequence public.alert_log_id_seq to service_role;
