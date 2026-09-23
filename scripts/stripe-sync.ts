#!/usr/bin/env node
/**
 * Sincroniza as compras da Stripe com o banco do HypeFC.
 *
 * Por que existe: o link de pagamento cobra sem backend proprio, e o comprador
 * volta para o site com `?pro=ok&session_id=...`. Para ele resgatar a licenca,
 * a sessao paga precisa existir em `public.orders` — este script e quem a
 * grava, chamando a RPC `pro_order_stripe` (service_role, idempotente por
 * sessao).
 *
 * Como le a Stripe: pelo Stripe CLI ja autenticado nesta maquina (o mesmo que
 * criou o produto e o link). Nao ha chave secreta em variavel de ambiente nem
 * no repositorio — `stripe login` guarda a credencial no perfil do usuario.
 *
 * Uso:
 *   npm run venda:sync             (modo live, o que cobra de verdade)
 *   npm run venda:sync -- --test   (sandbox, para testar com 4242)
 *   npm run venda:sync -- --dias 7 (janela maior de sessoes)
 *
 * Nao imprime e-mail completo nem id de sessao inteiro: o log e para conferir
 * volume, nao para vazar comprador.
 */

import { execFileSync } from 'node:child_process'

import { adminConfigurado, configPendente } from './lib/supabaseAdmin.ts'

const URL_BASE = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || ''
const STRIPE_BIN = process.env.STRIPE_BIN || `${process.env.HOME}/.local/bin/stripe`

const args = process.argv.slice(2)
const modoTeste = args.includes('--test')
const semLive = args.includes('--no-live')

function valor(nome: string, padrao: string): string {
  const i = args.findIndex((a) => a === nome)
  return i >= 0 && args[i + 1] ? args[i + 1] : padrao
}

const modo = modoTeste ? 'test' : semLive ? 'sandbox' : 'live'

function mascararEmail(email: string): string {
  const [usuario, dominio] = email.split('@')
  if (!dominio) return '???'
  const inicio = usuario.slice(0, 2)
  return `${inicio}${'*'.repeat(Math.max(1, usuario.length - 2))}@${dominio}`
}

function mascararId(id: string): string {
  return id.length > 16 ? `${id.slice(0, 10)}…${id.slice(-4)}` : id
}

function chamarStripe(comando: string[]): unknown {
  const flags = modo === 'live' ? ['--live'] : []
  const saida = execFileSync(STRIPE_BIN, [...comando, ...flags], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  })
  const inicio = saida.indexOf('{')
  if (inicio < 0) throw new Error(`Stripe sem JSON: ${saida.slice(0, 200)}`)
  return JSON.parse(saida.slice(inicio))
}

// O CLI guarda o modo selecionado (sandbox/live) na maquina. Deixar isso
// implicito ja causou um cron rodando no vazio: aqui a conta e o modo sao
// fixados antes de qualquer leitura.
const CONTA = (process.env.HYPEFC_STRIPE_ACCOUNT || '').trim()

function fixarConta(): void {
  if (!CONTA) return
  const flags = modo === 'live' ? ['--live'] : []
  try {
    execFileSync(STRIPE_BIN, ['switch', CONTA, ...flags], { encoding: 'utf8', stdio: 'pipe' })
  } catch {
    // sem conta selecionavel, a proxima chamada falha com mensagem clara
  }
}

async function rpc<T = Record<string, unknown>>(nome: string, corpo: Record<string, unknown>): Promise<T> {
  const resposta = await fetch(`${URL_BASE}/rest/v1/rpc/${nome}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(corpo),
  })
  const texto = await resposta.text()
  if (!resposta.ok) throw new Error(`Supabase ${resposta.status}: ${texto.slice(0, 240)}`)
  try {
    return JSON.parse(texto) as T
  } catch {
    return {} as T
  }
}

type SessaoStripe = {
  id: string
  payment_status?: string
  status?: string
  amount_total?: number | null
  currency?: string | null
  customer_email?: string | null
  customer_details?: { email?: string | null } | null
  created?: number
  livemode?: boolean
  metadata?: Record<string, string> | null
  line_items?: { data?: Array<{ price?: { id?: string | null; product?: string | null } | null }> } | null
}

// A conta que recebe é a mesma de outros produtos do Jean (uma assinatura de
// R$ 39,90 de outro produto apareceu como "paga" nesta mesma conta). Sem este
// filtro o sincronizador entregaria HypeFC Pro para quem comprou outra coisa —
// então ele falha FECHADO: sem saber quais preços são nossos, não grava nada.
//
// Resolvido em função, não em constante: os ids de sandbox e live são
// diferentes, e uma constante lida no carregamento travava o preço de live
// (foi assim que o modo teste deixou de reconhecer a própria assinatura).
function precoAlvo(): string {
  const bruto = modo === 'test' ? process.env.HYPEFC_STRIPE_PRICE_TEST : process.env.HYPEFC_STRIPE_PRICE_LIVE
  return (bruto || '').trim()
}

function produtoAlvo(): string {
  const bruto = modo === 'test' ? process.env.HYPEFC_STRIPE_PROD_TEST : process.env.HYPEFC_STRIPE_PROD_LIVE
  return (bruto || '').trim()
}

function ehDoHypefc(s: SessaoStripe): boolean {
  if ((s.metadata?.hypefc_plan || '') === 'pro') return true
  const precoEsperado = precoAlvo()
  const produtoEsperado = produtoAlvo()
  if (!precoEsperado && !produtoEsperado) return false
  const itens = s.line_items?.data ?? []
  return itens.some((i) => {
    const preco = i?.price
    if (!preco) return false
    if (precoEsperado && preco.id === precoEsperado) return true
    if (produtoEsperado && preco.product === produtoEsperado) return true
    return false
  })
}

async function principal(): Promise<void> {
  if (configPendente() || !adminConfigurado()) {
    console.error('Supabase admin nao configurado (.env.local com SUPABASE_URL e SUPABASE_SERVICE_KEY).')
    process.exit(2)
  }

  fixarConta()

  const limite = valor('--limite', '30')
  if (!precoAlvo() && !produtoAlvo()) {
    console.error(`Sincronizacao abortada: sem preco/produto do HypeFC para o modo ${modo} no .env.local.`)
    console.error('Sem saber quais precos sao do HypeFC, gravar qualquer compra da conta seria entregar Pro errado.')
    process.exit(5)
  }

  let sessoes: SessaoStripe[]
  try {
    const bruto = chamarStripe([
      'checkout',
      'sessions',
      'list',
      '--limit',
      limite,
      '--expand',
      'data.line_items',
    ]) as { data?: SessaoStripe[] }
    sessoes = bruto.data ?? []
  } catch (erro) {
    console.error(`Falha ao falar com a Stripe: ${(erro as Error).message.slice(0, 200)}`)
    console.error('Confira se o CLI esta autenticado: stripe login')
    process.exit(3)
  }

  const doHypefc = sessoes.filter(ehDoHypefc)
  const pagas = doHypefc.filter((s) => s.payment_status === 'paid' || s.status === 'complete')
  const alheias = sessoes.length - doHypefc.length
  console.log(
    `Stripe (${modo}): ${sessoes.length} sessoes lidas · ${doHypefc.length} do HypeFC ` +
      `(${alheias} de outros produtos ignoradas) · ${pagas.length} pagas`
  )

  let gravadas = 0
  let puladas = 0
  for (const s of pagas) {
    const email = (s.customer_details?.email || s.customer_email || '').trim().toLowerCase()
    if (!email) {
      console.log(`  ${mascararId(s.id)}: paga sem e-mail no cadastro — pulada`)
      puladas += 1
      continue
    }
    const r = await rpc<{ ok?: boolean; erro?: string }>('pro_order_stripe', {
      p_session: s.id,
      p_email: email,
      p_amount_cents: s.amount_total ?? 0,
      p_currency: (s.currency || 'brl').toUpperCase(),
      p_ref: s.id,
      p_meses: 1,
    })
    if (r.ok) {
      gravadas += 1
      console.log(`  ${mascararId(s.id)}: pedido gravado para ${mascararEmail(email)}`)
    } else {
      puladas += 1
      console.log(`  ${mascararId(s.id)}: nao gravado (${r.erro ?? 'erro'})`)
    }
  }

  console.log(`Resultado: ${gravadas} gravadas · ${puladas} puladas`)
  if (gravadas === 0 && pagas.length === 0) {
    console.log('Nada novo — normal quando ainda nao houve venda nesta janela.')
  }

  await sincronizarAssinaturas()
}

/**
 * Renovacao: a mensalidade seguinte NAO cria sessao de checkout nova, ela
 * aparece como assinatura ativa. Sem esta passada o assinante pagaria o segundo
 * mes e perderia o Pro — por isso o vencimento vem do `current_period_end`.
 */
async function sincronizarAssinaturas(): Promise<void> {
  let assinaturas: Array<{
    id: string
    status?: string
    customer?: { email?: string | null } | string | null
    items?: { data?: Array<{ price?: { id?: string | null; product?: string | null } | null; current_period_end?: number }> }
  }>
  try {
    const bruto = chamarStripe([
      'subscriptions',
      'list',
      '--limit',
      '50',
      // 'all' inclui canceladas: sem isso o site nunca fica sabendo do
      // cancelamento (a listagem padrao omite) e a assinatura some do radar.
      '--status',
      'all',
      '--expand',
      'data.customer',
      '--expand',
      'data.items',
    ]) as { data?: typeof assinaturas }
    assinaturas = bruto.data ?? []
  } catch (erro) {
    console.log(`  assinaturas nao lidas: ${(erro as Error).message.slice(0, 120)}`)
    return
  }

  const nossas = assinaturas.filter((a) =>
    (a.items?.data ?? []).some((i) => {
      if (!i?.price) return false
      const precoEsperado = precoAlvo()
      const produtoEsperado = produtoAlvo()
      if (precoEsperado && i.price.id === precoEsperado) return true
      if (produtoEsperado && i.price.product === produtoEsperado) return true
      return false
    })
  )
  console.log(`  assinaturas: ${assinaturas.length} lidas · ${nossas.length} do HypeFC`)

  let atualizadas = 0
  for (const a of nossas) {
    const cliente = a.customer
    const email = (typeof cliente === 'object' && cliente ? cliente.email || '' : '').trim().toLowerCase()
    if (!email) {
      console.log(`    ${mascararId(a.id)}: assinatura sem e-mail no cliente — pulada`)
      continue
    }
    const periodo = Math.max(
      ...(a.items?.data ?? []).map((i) => Number(i?.current_period_end ?? 0)),
      0
    )
    const ate = periodo > 0 ? new Date(periodo * 1000).toISOString() : null
    const r = await rpc<{ ok?: boolean; status?: string; erro?: string }>('pro_assinatura_stripe', {
      p_email: email,
      p_ate: ate,
      p_status: a.status ?? 'active',
      p_ref: a.id,
    })
    if (r.ok) {
      atualizadas += 1
      console.log(`    ${mascararId(a.id)}: ${mascararEmail(email)} · ${r.status} · ate ${ate ?? '—'}`)
    } else {
      console.log(`    ${mascararId(a.id)}: nao atualizada (${r.erro ?? 'erro'})`)
    }
  }
  if (nossas.length > 0) console.log(`  assinaturas atualizadas: ${atualizadas}/${nossas.length}`)
}

principal().catch((erro) => {
  console.error(`erro: ${(erro as Error).message}`)
  process.exit(1)
})
