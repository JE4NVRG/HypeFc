#!/usr/bin/env node
/**
 * Acesso ao Supabase com a chave de servico (service_role).
 *
 * Regra: a service key NUNCA entra no repositorio e nunca e impressa. Estes
 * scripts (cobranca e entrega de alerta) rodam no Mac, onde ela vive no
 * .env.local; o site publico so conhece a chave anon, que nao le nem escreve
 * nas tabelas (RLS sem policy) — tudo passa pelas RPCs.
 *
 * Uso interno pelos scripts: venda:abrir, venda:paga, alertas.
 */

const URL_BASE = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || ''

export function adminConfigurado(): boolean {
  return URL_BASE.length > 20 && SERVICE_KEY.length > 40
}

export function configPendente(): boolean {
  return !adminConfigurado()
}

function cabecalhos(extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
    ...extra,
  }
}

async function pedir(caminho: string, init: RequestInit = {}): Promise<unknown[]> {
  if (!adminConfigurado()) {
    throw new Error(
      'Supabase admin nao configurado: defina SUPABASE_URL e SUPABASE_SERVICE_KEY no .env.local (chave de servico do projeto HypeFC).'
    )
  }
  const resposta = await fetch(`${URL_BASE}/rest/v1/${caminho}`, {
    ...init,
    headers: cabecalhos((init.headers as Record<string, string>) || {}),
  })
  const texto = await resposta.text()
  if (!resposta.ok) {
    throw new Error(`Supabase ${resposta.status}: ${texto.slice(0, 300)}`)
  }
  if (!texto) return []
  try {
    const dados = JSON.parse(texto)
    return Array.isArray(dados) ? dados : [dados]
  } catch {
    return []
  }
}

/** SELECT com filtro no formato do PostgREST, ex.: `email=eq.x@y.com&select=*`. */
export async function selecionar<T = Record<string, unknown>>(tabela: string, filtro: string): Promise<T[]> {
  return (await pedir(`${tabela}?${filtro}`)) as T[]
}

export async function inserir<T = Record<string, unknown>>(tabela: string, dados: unknown): Promise<T[]> {
  return (await pedir(tabela, { method: 'POST', body: JSON.stringify(dados) })) as T[]
}

/**
 * UPSERT: cria a linha ou substitui o conteudo da chave existente.
 *
 * `onConflict` vira o parametro `on_conflict` do PostgREST (a coluna da chave);
 * sem ele o PostgREST tentaria a chave primaria. `atualizado_em` tem de vir no
 * corpo: num UPDATE o default da coluna nao roda de novo.
 */
export async function upsert<T = Record<string, unknown>>(
  tabela: string,
  dados: unknown,
  onConflict?: string
): Promise<T[]> {
  const filtro = onConflict ? `?on_conflict=${encodeURIComponent(onConflict)}` : ''
  return (await pedir(`${tabela}${filtro}`, {
    method: 'POST',
    body: JSON.stringify(dados),
    headers: { Prefer: 'return=representation,resolution=merge-duplicates' },
  })) as T[]
}

export async function atualizar<T = Record<string, unknown>>(
  tabela: string,
  filtro: string,
  dados: unknown
): Promise<T[]> {
  return (await pedir(`${tabela}?${filtro}`, { method: 'PATCH', body: JSON.stringify(dados) })) as T[]
}

export async function apagar<T = Record<string, unknown>>(tabela: string, filtro: string): Promise<T[]> {
  return (await pedir(`${tabela}?${filtro}`, { method: 'DELETE' })) as T[]
}

export function normalizarEmail(email: string): string {
  return email.trim().toLowerCase()
}
