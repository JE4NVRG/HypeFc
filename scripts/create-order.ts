#!/usr/bin/env node
/**
 * Abre uma venda: cria (ou reaproveita) o assinante e registra o pedido PENDENTE.
 *
 * Uso:
 *   npm run venda:abrir -- --email fulano@exemplo.com [--nome Fulano] [--meses 1] [--valor 990] [--provider pix]
 *
 * O codigo de acesso NAO sai aqui: ele e gerado so em `npm run venda:paga`, ou
 * seja, depois do dinheiro entrar. Assim um codigo nunca vaza antes do
 * pagamento, e um pedido pendente nao libera nada.
 *
 * Saida: id do pedido + link de checkout com a referencia do pedido, quando a
 * variavel NEXT_PUBLIC_CHECKOUT_URL estiver definida (e ela que aponta para a sua
 * pagina de cobranca do provedor).
 */

import { adminConfigurado, inserir, normalizarEmail, selecionar } from './lib/supabaseAdmin.ts'

type Args = Record<string, string>

function lerArgs(argv: string[]): Args {
  const args: Args = {}
  for (let i = 0; i < argv.length; i += 1) {
    const atual = argv[i]
    if (!atual.startsWith('--')) continue
    const chave = atual.slice(2)
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
const email = normalizarEmail(args.email || '')

if (!email.includes('@')) {
  console.error('uso: npm run venda:abrir -- --email fulano@exemplo.com [--nome Fulano] [--meses 1] [--valor 990] [--provider pix]')
  process.exit(2)
}
if (!adminConfigurado()) {
  console.error('pendente: defina SUPABASE_URL e SUPABASE_SERVICE_KEY no .env.local antes de abrir venda.')
  process.exit(0)
}

const meses = Math.max(1, Math.min(12, Number(args.meses || '1') || 1))
// Cuidado com `0 || 990`: valor zero e legitimo (cortesia, validacao) e virava
// 990 por causa do curto-circuito. Trata ausencia e zero como casos diferentes.
const valorBruto = args.valor === undefined ? 990 : Number(args.valor)
const valor = Number.isFinite(valorBruto) ? Math.max(0, Math.min(100000, Math.trunc(valorBruto))) : 990
const provider = args.provider || 'manual'
const nome = (args.nome || '').trim() || null

const existentes = await selecionar<{ id: string; status: string; plan: string }>(
  'subscribers',
  `email=eq.${encodeURIComponent(email)}&select=id,status,plan`
)

let assinanteId: string
if (existentes.length > 0) {
  assinanteId = existentes[0].id
  console.log(`assinante existente: ${assinanteId} (plan=${existentes[0].plan} status=${existentes[0].status})`)
} else {
  const [novo] = await inserir<{ id: string }>('subscribers', { email, nome, source: 'venda-manual' })
  assinanteId = novo.id
  console.log(`assinante criado: ${assinanteId}`)
}

const [pedido] = await inserir<{ id: string; created_at: string }>('orders', {
  subscriber_id: assinanteId,
  email,
  provider,
  amount_cents: valor,
  currency: 'BRL',
  months: meses,
  status: 'pending',
})

const checkout = process.env.NEXT_PUBLIC_CHECKOUT_URL || ''
const link = checkout
  ? `${checkout}${checkout.includes('?') ? '&' : '?'}ref=${pedido.id}&email=${encodeURIComponent(email)}&valor=${valor}`
  : ''

console.log('')
console.log(`pedido: ${pedido.id}`)
console.log(`valor:  R$ ${(valor / 100).toFixed(2)} · ${meses} mes(es) · ${provider}`)
if (link) {
  console.log('')
  console.log('link de cobranca (mande para o cliente):')
  console.log(link)
  console.log('')
  console.log('antes de mandar, confira que o valor no link bate com o pedido — o link e do provedor, nao nosso.')
} else {
  console.log('')
  console.log('NEXT_PUBLIC_CHECKOUT_URL nao definida: cobre por Pix/outro meio e depois rode:')
  console.log(`  npm run venda:paga -- --order ${pedido.id}`)
}
console.log('')
console.log('quando o dinheiro entrar: npm run venda:paga -- --order ' + pedido.id)
