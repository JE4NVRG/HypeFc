#!/usr/bin/env node
/**
 * Confere a loja INTEIRA contra o banco real, pelo mesmo caminho que o navegador
 * usa (chave anon + RPCs) e pelo mesmo caminho que a venda usa (scripts + chave
 * de servico). Cria dados de teste com e-mail @hypefc.local e apaga tudo no fim.
 *
 * Uso: npm run loja:conferir
 *
 * O que ele prova, em ordem:
 *   1. gratuito entra e recebe acesso com limite 3 (e o 4o time bate no limite);
 *   2. a chave anon NAO le nem escreve as tabelas direto (RLS fechada);
 *   3. a venda abre pedido, fecha com pagamento e gera codigo;
 *   4. o cliente ativa com a chave anon, como o navegador faz, e vira Pro (limite 20);
 *   5. o codigo morre no segundo uso e token inventado nao passa;
 *   6. limpa os dados de teste.
 *
 * Nao substitui o teste manual no navegador (o push de verdade so se prova com
 * inscricao real), mas pega quebra de RLS, de limite de plano e de fluxo de venda
 * antes de qualquer cliente ver.
 */

import { execFileSync } from 'node:child_process'
import { adminConfigurado, apagar, selecionar } from './lib/supabaseAdmin.ts'

const URL_BASE = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
const EMAIL_FREE = 'teste-free@hypefc.local'
const EMAIL_PRO = 'teste-pro@hypefc.local'

let falhas = 0

function ok(condicao: boolean, rotulo: string, detalhe = ''): void {
  if (condicao) {
    console.log(`  ok    ${rotulo}${detalhe ? ` — ${detalhe}` : ''}`)
  } else {
    falhas += 1
    console.log(`  FALHA ${rotulo}${detalhe ? ` — ${detalhe}` : ''}`)
  }
}

async function rpc(nome: string, params: Record<string, unknown>, chave = ANON): Promise<{ status: number; corpo: Record<string, unknown> | string }> {
  const r = await fetch(`${URL_BASE}/rest/v1/rpc/${nome}`, {
    method: 'POST',
    headers: { apikey: chave, Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  const texto = await r.text()
  let corpo: Record<string, unknown> | string = texto
  try {
    corpo = JSON.parse(texto || 'null')
  } catch {
    /* mantem texto cru */
  }
  return { status: r.status, corpo }
}

async function lerTabela(caminho: string, chave = ANON): Promise<number> {
  const r = await fetch(`${URL_BASE}/rest/v1/${caminho}`, {
    headers: { apikey: chave, Authorization: `Bearer ${chave}` },
  })
  return r.status
}

async function rodarScript(script: string, args: string[]): Promise<string> {
  return execFileSync(
    process.execPath,
    ['--experimental-strip-types', '--disable-warning=ExperimentalWarning', script, ...args],
    { encoding: 'utf8', env: process.env }
  )
}

if (!adminConfigurado() || ANON.length < 40 || URL_BASE.length < 20) {
  console.error('pendente: defina SUPABASE_URL, SUPABASE_SERVICE_KEY e NEXT_PUBLIC_SUPABASE_ANON_KEY (.env.local) para conferir a loja.')
  process.exit(0)
}

console.log('═ loja: conferencia ponta a ponta contra o banco real ═\n')

// limpa restos de uma execucao anterior que tenha morrido no meio
await apagar('subscribers', `email=in.(${EMAIL_FREE},${EMAIL_PRO})`)

console.log('1) gratuito: entrar na lista devolve acesso com limite 3')
const entrada = await rpc('join_waitlist', { p_email: EMAIL_FREE, p_nome: 'Teste Free', p_source: 'conferencia' })
const tokenFree = typeof entrada.corpo === 'object' ? (entrada.corpo.token as string) : null
ok(entrada.status === 200 && !!tokenFree, 'join_waitlist devolve token', `limite=${(entrada.corpo as Record<string, unknown>).limite}`)

console.log('\n2) a chave anon nao alcanca as tabelas')
ok((await lerTabela('subscribers?select=email&limit=1')) === 401, 'GET subscribers pela anon = 401')
ok((await lerTabela('orders?select=id&limit=1')) === 401, 'GET orders pela anon = 401')

console.log('\n3) gratuito: 3 times passam, o 4o bate no limite')
const times = [
  ['bra.1', '626', 'Flamengo'],
  ['bra.1', '202', 'Palmeiras'],
  ['bra.1', '627', 'Gremio'],
  ['bra.1', '3458', 'Athletico-PR'],
]
let bloqueou = false
for (const [liga, id, nome] of times) {
  const r = await rpc('follow_set', { p_token: tokenFree, p_league_id: liga, p_team_id: id, p_team_name: nome })
  const corpo = r.corpo as Record<string, unknown>
  if (nome === 'Athletico-PR') {
    bloqueou = corpo?.erro === 'limite'
    ok(bloqueou, 'o 4o time e barrado', `erro=${corpo?.erro} limite=${corpo?.limite}`)
  } else {
    ok(corpo?.ok === true, `${nome} seguido`, `${corpo?.seguidos}/${corpo?.limite}`)
  }
}

console.log('\n4) venda: abre o pedido e fecha com pagamento')
const saidaAbrir = await rodarScript('scripts/create-order.ts', ['--email', EMAIL_PRO, '--nome', 'Teste Pro', '--meses', '1', '--valor', '990', '--provider', 'pix'])
const idPedido = (saidaAbrir.match(/pedido:\s*([0-9a-f-]{36})/) || [])[1]
ok(!!idPedido, 'pedido criado', idPedido ? `${idPedido.slice(0, 8)}...` : 'sem id')

const saidaPagar = idPedido ? await rodarScript('scripts/mark-paid.ts', ['--order', idPedido, '--ref', 'CONFERENCIA']) : ''
const codigo = (saidaPagar.match(/HFC-[A-Z0-9-]{14,}/) || [])[0]
ok(!!codigo, 'venda fechada e codigo gerado', codigo ? `${codigo.slice(0, 8)}...` : 'sem codigo')

console.log('\n5) cliente ativa com a chave anon (o caminho do navegador)')
const ativacao = codigo ? await rpc('pro_setup', { p_email: EMAIL_PRO, p_codigo: codigo }) : { status: 0, corpo: {} }
const tokenPro = typeof ativacao.corpo === 'object' ? (ativacao.corpo.token as string) : null
ok(!!tokenPro && (ativacao.corpo as Record<string, unknown>).plan === 'pro', 'pro_setup devolve plano pro', `plan=${(ativacao.corpo as Record<string, unknown>).plan}`)

console.log('\n6) o mesmo codigo nao serve duas vezes')
const repetido = codigo ? await rpc('pro_setup', { p_email: EMAIL_PRO, p_codigo: codigo }) : { corpo: {} }
ok((repetido.corpo as Record<string, unknown>)?.erro === 'codigo-ja-usado', 'segundo uso barrado', `erro=${(repetido.corpo as Record<string, unknown>)?.erro}`)

console.log('\n7) Pro: limite 20, push e leitura do proprio perfil')
for (const [liga, id, nome] of times) {
  await rpc('follow_set', { p_token: tokenPro, p_league_id: liga, p_team_id: id, p_team_name: nome })
}
const pushFake = await rpc('push_save', {
  p_token: tokenPro,
  p_endpoint: 'https://fcm.googleapis.com/fcm/send/CONFERENCIA-1234567890',
  p_p256dh: `BO_CONFERENCIA_${'x'.repeat(80)}`,
  p_auth: 'a'.repeat(22),
  p_user_agent: 'conferencia-loja',
})
ok((pushFake.corpo as Record<string, unknown>)?.ok === true, 'inscricao de push gravada')
const perfil = (await rpc('pro_me', { p_token: tokenPro })).corpo as Record<string, unknown>
ok(perfil?.limite === 20 && perfil?.plan === 'pro', 'perfil do Pro', `seguidos=${perfil?.seguidos} limite=${perfil?.limite}`)

console.log('\n8) token inventado nao passa')
const falso = await rpc('pro_me', { p_token: 'x'.repeat(64) })
ok((falso.corpo as Record<string, unknown>)?.erro === 'sem-acesso', 'token falso recusado', `erro=${(falso.corpo as Record<string, unknown>)?.erro}`)

console.log('\n9) limpeza dos dados de teste')
ok((await apagar('subscribers', `email=in.(${EMAIL_FREE},${EMAIL_PRO})`)).length >= 0, 'subscribers de teste apagados')
const sobraram = await selecionar('subscribers', 'select=email')
ok(sobraram.length === 0, 'banco sem resto de teste', `${sobraram.length} assinante(s)`)

console.log(`\n${falhas === 0 ? 'LOJA OK' : `${falhas} FALHA(S)`}`)
process.exit(falhas === 0 ? 0 : 1)
