-- HypeFC — payloads públicos servidos pelo banco (o site deixa de depender de rebuild).
--
-- Por que existe: o registro do dia (cards liquidados, ratings, chance de título e
-- as duas bases de probabilidade) era publicado como JSON dentro do build. Isso
-- amarravam a atualização do número a um deploy: sem build, o site continuava
-- mostrando o registro de ontem. Aqui o job diário grava o payload no banco e o
-- site lê por RPC — o número atualiza sem publicar nada.
--
-- Chave de leitura: o painel público já fala com a API REST (/rest/v1/rpc/<fn>)
-- com a chave anon (mesmo caminho do Pro). Como as tabelas do projeto são
-- RLS sem policy, o caminho é uma função security definer.
--
-- Lista fechada: só os 5 nomes conhecidos saem por aqui. Qualquer outro nome
-- devolve null, mesmo que alguém grave uma linha com ele — a superfície pública
-- é exatamente o que está escrito nesta função.

create table if not exists public.site_payloads (
  nome text primary key,
  payload jsonb not null,
  atualizado_em timestamptz not null default now()
);

comment on table public.site_payloads is
  'Payloads que o painel público lê em runtime (registro, ratings, título, probabilidades). Escrita só pelo service_role (job diário na VPS).';

alter table public.site_payloads enable row level security;
-- Sem policy de propósito: anon não lê a tabela direto. A leitura passa por
-- payload_publico(), que devolve apenas a lista fechada de nomes abaixo.

create or replace function public.payload_publico(p_nome text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_nome text := coalesce(p_nome, '');
  v_payload jsonb;
begin
  if v_nome not in ('hype-record', 'ratings', 'title-odds', 'probability-record', 'probability-forward') then
    return null;
  end if;

  select payload into v_payload from public.site_payloads where nome = v_nome;
  return v_payload;
end;
$$;

revoke all on function public.payload_publico(text) from public;
grant execute on function public.payload_publico(text) to anon, authenticated;
grant all on table public.site_payloads to service_role;
