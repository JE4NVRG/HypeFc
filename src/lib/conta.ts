'use client'

/**
 * Conta HypeFC — login com Google via Supabase Auth.
 *
 * O que muda em relacao ao token anonimo: o e-mail da conta passa a ser o dono
 * da licenca. O cliente entra em qualquer aparelho e o Pro volta; sem isso, a
 * licenca morria junto com os dados do navegador.
 *
 * O navegador nunca decide se tem direito: quem responde e a RPC
 * `pro_conta_entrar` (Supabase), lendo o e-mail de dentro do JWT assinado. A UI
 * so guarda o token que voltou.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { aplicarToken, limparContaLocal } from './proStore'

let cliente: SupabaseClient | null = null

function urlApi(): string {
  return (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '')
}

function chaveAnon(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
}

export function contaConfigurada(): boolean {
  return urlApi() !== '' && chaveAnon() !== ''
}

/** Cliente único (evita varias instancias escutando a URL ao mesmo tempo). */
export function clienteConta(): SupabaseClient | null {
  if (!contaConfigurada() || typeof window === 'undefined') return null
  if (!cliente) {
    cliente = createClient(urlApi(), chaveAnon(), {
      auth: {
        flowType: 'pkce',
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
        storageKey: 'hypefc.conta',
      },
    })
  }
  return cliente
}

export type ContaEstado = {
  logado: boolean
  email?: string
  pro?: boolean
  paidUntil?: string
  erro?: string
}

/** Manda para o Google e volta para a raiz do site (a sessão é lida na volta). */
export async function entrarComGoogle(): Promise<{ ok: boolean; erro?: string }> {
  const c = clienteConta()
  if (!c) return { ok: false, erro: 'loja-offline' }
  const { error } = await c.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/`,
      queryParams: { prompt: 'select_account' },
    },
  })
  return error ? { ok: false, erro: 'google' } : { ok: true }
}

export async function sairDaConta(): Promise<void> {
  const c = clienteConta()
  try {
    await c?.auth.signOut()
  } catch {
    // sem rede o token local ja basta: segue limpando
  }
  limparContaLocal()
}

type SessaoAtual = { email: string; token: string }

async function sessaoAtual(): Promise<SessaoAtual | null> {
  const c = clienteConta()
  if (!c) return null
  const { data } = await c.auth.getSession()
  const sessao = data.session
  if (!sessao?.access_token) return null
  return { email: sessao.user?.email ?? '', token: sessao.access_token }
}

/**
 * Troca a conta pelo acesso Pro: chama a RPC autenticada, que acha o assinante
 * pelo e-mail do JWT (resgatando uma compra paga ainda não resgatada) e devolve
 * um token novo. Guarda o token e diz se ficou Pro.
 */
export async function entrarComoAssinante(): Promise<ContaEstado> {
  const sessao = await sessaoAtual()
  if (!sessao) return { logado: false, erro: 'sem-sessao' }

  const resposta = await fetch(`${urlApi()}/rest/v1/rpc/pro_conta_entrar`, {
    method: 'POST',
    headers: {
      apikey: chaveAnon(),
      Authorization: `Bearer ${sessao.token}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  }).catch(() => null)

  if (!resposta) return { logado: true, email: sessao.email, pro: false, erro: 'rede' }

  const dados = (await resposta.json().catch(() => ({}))) as {
    ok?: boolean
    token?: string
    email?: string
    paid_until?: string
    erro?: string
  }

  if (dados.ok === true && typeof dados.token === 'string' && dados.token.length > 20) {
    aplicarToken(dados.token)
    return { logado: true, email: dados.email ?? sessao.email, pro: true, paidUntil: dados.paid_until }
  }

  return {
    logado: true,
    email: sessao.email,
    pro: false,
    erro: typeof dados.erro === 'string' ? dados.erro : 'rede',
  }
}

/** Só mostra o estado (não libera nada): útil para a UI dizer em que pé está. */
export async function estadoDaConta(): Promise<ContaEstado> {
  const sessao = await sessaoAtual()
  if (!sessao) return { logado: false }

  const resposta = await fetch(`${urlApi()}/rest/v1/rpc/pro_conta_estado`, {
    method: 'POST',
    headers: {
      apikey: chaveAnon(),
      Authorization: `Bearer ${sessao.token}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  }).catch(() => null)

  if (!resposta) return { logado: true, email: sessao.email, erro: 'rede' }
  const dados = (await resposta.json().catch(() => ({}))) as {
    email?: string
    assinatura?: boolean
    paid_until?: string
  }
  return {
    logado: true,
    email: dados.email ?? sessao.email,
    pro: dados.assinatura === true,
    paidUntil: dados.paid_until,
  }
}

/**
 * Chamado no carregamento do site: se veio um `?code=` do Google, o supabase-js
 * já trocou por sessão; aqui ligamos isso à licença e avisamos a UI.
 */
export async function sincronizarConta(): Promise<ContaEstado | null> {
  const c = clienteConta()
  if (!c) return null
  const sessao = await sessaoAtual()
  if (!sessao) return null
  return entrarComoAssinante()
}
