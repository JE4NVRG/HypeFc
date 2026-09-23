#!/usr/bin/env node
/**
 * Marca a venda como PAGA e gera o codigo de acesso do cliente.
 *
 * Uso:
 *   npm run venda:paga -- --order <uuid>
 *   npm run venda:paga -- --email fulano@exemplo.com      (o pedido pendente mais recente)
 *
 * Opcoes: --meses 1 (padrao o do pedido) · --provider pix · --ref <id do provedor>
 *
 * O que acontece:
 *   1. o pedido vira paid (com paid_at e a referencia do provedor, para auditoria);
 *   2. o assinante vira plan=pro, status=active, paid_until = fim do periodo pago
 *      (renovacao SOMA no que ja estava pago, nunca encolhe);
 *   3. gera um codigo de uso unico e imprime UMA vez, com o link de ativacao
 *      pronto para mandar ao cliente.
 *
 * Guardamos apenas o hash do codigo: se este terminal fechar, o codigo nao pode
 * ser recuperado — gere outro se perder. O codigo vale 90 dias e morre no
 * primeiro uso; o token que ele gera no navegador do cliente e o que fica valendo.
 */

import { createHash, randomInt } from 'node:crypto'
import { adminConfigurado, atualizar, normalizarEmail, selecionar } from './lib/supabaseAdmin.ts'

const ALFABETO = '23456789ABCDEFGHJKMNPQRSTVWXYZ' // sem 0/1/I/L/O/U: ninguem erra ao digitar

function gerarCodigo(): string {
  const bloco = () => Array.from({ length: 4 }, () => ALFABETO[randomInt(0, ALFABETO.length)]).join('')
  return `HFC-${bloco()}-${bloco()}-${bloco()}`
}

function hashCodigo(codigo: string): string {
  return createHash('sha256').update(codigo.trim().toUpperCase()).digest('hex')
}

function lerArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {}
  for (let i = 0; i < argv.length; i += 1) {
    if (!argv[i].startsWith('--')) continue
    const chave = argv[i].slice(2)
    const proximo = argv[i + 1]
    if (proximo && !proximo.startsWith('--')) {
      args[chave] = proximo
      i += 1
    } else {
      args[chave] = 'true'
    }
  }
  return args
}

const args = lerArgs(process.argv.slice(2))

if (!adminConfigurado()) {
  console.error('pendente: defina SUPABASE_URL e SUPABASE_SERVICE_KEY no .env.local antes de marcar venda paga.')
  process.exit(0)
}

type Pedido = {
  id: string
  subscriber_id: string | null
  email: string
  provider: string
  months: number
  amount_cents: number
  status: string
}

let pedido: Pedido | undefined

if (args.order) {
  const linhas = await selecionar<Pedido>(
    'orders',
    `id=eq.${encodeURIComponent(args.order)}&select=id,subscriber_id,email,provider,months,amount_cents,status`
  )
  pedido = linhas[0]
} else if (args.email) {
  const linhas = await selecionar<Pedido>(
    'orders',
    `email=eq.${encodeURIComponent(normalizarEmail(args.email))}&status=eq.pending&select=id,subscriber_id,email,provider,months,amount_cents,status&order=created_at.desc&limit=1`
  )
  pedido = linhas[0]
}

if (!pedido) {
  console.error('pedido nao encontrado. use --order <uuid> ou --email <email do cliente> (com pedido pendente).')
  process.exit(2)
}
if (pedido.status === 'paid' && !args.forcar) {
  console.error(`pedido ${pedido.id} ja esta pago. Para reenviar acesso, use --forcar (gera codigo novo, sem cobrar de novo).`)
  process.exit(2)
}

const meses = Math.max(1, Math.min(12, Number(args.meses || String(pedido.months || 1)) || 1))
const provider = args.provider || pedido.provider || 'manual'

// 1. pedido pago
await atualizar('orders', `id=eq.${pedido.id}`, {
  status: 'paid',
  paid_at: new Date().toISOString(),
  provider,
  ...(args.ref ? { provider_ref: args.ref } : {}),
})

// 2. assinante pro. Renovacao SOMA no periodo ja pago.
const assinantes = await selecionar<{ id: string; email: string; paid_until: string | null }>(
  'subscribers',
  `id=eq.${pedido.subscriber_id}&select=id,email,paid_until`
)
const assinante = assinantes[0]

const base = assinante?.paid_until && new Date(assinante.paid_until) > new Date() ? new Date(assinante.paid_until) : new Date()
const fim = new Date(base)
fim.setMonth(fim.getMonth() + meses)

// 3. codigo de uso unico
const codigo = gerarCodigo()
await atualizar('subscribers', `id=eq.${pedido.subscriber_id}`, {
  plan: 'pro',
  status: 'active',
  paid_until: fim.toISOString(),
  access_hash: hashCodigo(codigo),
  access_created_at: new Date().toISOString(),
  access_used_at: null,
  updated_at: new Date().toISOString(),
})

const site = process.env.HYPEFC_SITE || 'https://hypefc.je4ndev.com'
const link = `${site}/?ativar=1&email=${encodeURIComponent(pedido.email)}&codigo=${encodeURIComponent(codigo)}`

console.log('')
console.log('  VENDA FECHADA')
console.log(`  cliente: ${pedido.email}`)
console.log(`  valor:   R$ ${(pedido.amount_cents / 100).toFixed(2)} · ${meses} mes(es) · ${provider}`)
console.log(`  pago ate: ${fim.toISOString().slice(0, 10)}`)
console.log('')
console.log('  CODIGO DE ACESSO (aparece uma vez; guardamos so o hash):')
console.log(`  ${codigo}`)
console.log('')
console.log('  link pronto para mandar ao cliente (ativa em um clique):')
console.log(`  ${link}`)
console.log('')
console.log('  o codigo vale 90 dias e morre no primeiro uso. Perdeu o codigo? rode de novo com --forcar.')
