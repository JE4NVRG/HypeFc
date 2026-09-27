#!/usr/bin/env node
/**
 * Aplica os e-mails do HypeFC (pt-BR, identidade 002) no projeto Supabase.
 *
 * Os templates ficam versionados em `supabase/emails/*.html`; o texto no painel do
 * Supabase e so o resultado desta aplicacao. Sem pre-visualizacao, o que a pessoa
 * recebe e o que ninguem revisou: e o primeiro e-mail que o cliente ve, e ate aqui
 * era o template padrao do Supabase, em ingles.
 *
 * Uso (da raiz do repo):
 *   npm run emails:conferir   compara o que esta no projeto com os arquivos
 *   npm run emails:seco       mostra o que seria aplicado
 *   npm run emails:aplicar    aplica de verdade
 *
 * Precisa de SUPABASE_ACCESS_TOKEN (token pessoal da Management API, o mesmo do
 * `sbx.sh`) e, opcionalmente, HYPE_REF para outro projeto. Nunca imprime o token.
 */

import { readFileSync } from 'node:fs'
import path from 'node:path'

interface Fluxo {
  /** chave do assunto no /config/auth */
  assunto: string
  /** chave do corpo no /config/auth */
  corpo: string
  /** arquivo em supabase/emails */
  arquivo: string
  /** assunto que vai no e-mail */
  titulo: string
}

const FLUXOS: Fluxo[] = [
  {
    assunto: 'mailer_subjects_confirmation',
    corpo: 'mailer_templates_confirmation_content',
    arquivo: 'confirmacao.html',
    titulo: 'Confirme seu e-mail no HypeFC',
  },
  {
    assunto: 'mailer_subjects_recovery',
    corpo: 'mailer_templates_recovery_content',
    arquivo: 'recuperacao.html',
    titulo: 'Redefinir a senha do HypeFC',
  },
  {
    assunto: 'mailer_subjects_email_change',
    corpo: 'mailer_templates_email_change_content',
    arquivo: 'troca-de-email.html',
    titulo: 'Confirme o novo e-mail no HypeFC',
  },
]

const REF = process.env.HYPE_REF || 'sebyzlcgadsiinikxfgu'
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || ''
const modo = process.argv.includes('--aplicar')
  ? 'aplicar'
  : process.argv.includes('--seco')
    ? 'seco'
    : 'conferir'

const API = `https://api.supabase.com/v1/projects/${REF}/config/auth`
const raiz = process.cwd()

async function pedir(metodo: string, corpo?: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(API, {
    method: metodo,
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: corpo ? JSON.stringify(corpo) : undefined,
  })
  const texto = await res.text()
  if (!res.ok) throw new Error(`Management API ${res.status}: ${texto.slice(0, 200)}`)
  return texto ? (JSON.parse(texto) as Record<string, unknown>) : {}
}

if (!TOKEN) {
  console.log('config pendente: SUPABASE_ACCESS_TOKEN (Management API). O token nunca e impresso.')
  process.exit(1)
}

const atual = modo === 'conferir' ? await pedir('GET') : {}
const patch: Record<string, string> = {}
let divergentes = 0

for (const fluxo of FLUXOS) {
  const html = readFileSync(path.join(raiz, 'supabase', 'emails', fluxo.arquivo), 'utf8')
  patch[fluxo.assunto] = fluxo.titulo
  patch[fluxo.corpo] = html

  if (modo === 'conferir') {
    const assuntoAtual = String(atual[fluxo.assunto] ?? '')
    const corpoAtual = String(atual[fluxo.corpo] ?? '')
    const assuntoOk = assuntoAtual === fluxo.titulo
    const corpoOk = corpoAtual.trim() === html.trim()
    if (!assuntoOk || !corpoOk) divergentes += 1
    console.log(
      `${fluxo.arquivo}: assunto ${assuntoOk ? 'igual' : `divergente ("${assuntoAtual.slice(0, 40)}")`} · corpo ${corpoOk ? 'igual' : `divergente (${corpoAtual.length} chars no projeto, ${html.length} no arquivo)`}`
    )
    continue
  }

  console.log(`${fluxo.arquivo}: assunto "${fluxo.titulo}" · corpo ${html.length} chars`)
}

if (modo === 'conferir') {
  console.log(divergentes ? `${divergentes} fluxo(s) fora do arquivo: rode npm run emails:aplicar.` : 'tudo igual ao que esta no repo.')
  process.exit(divergentes ? 1 : 0)
}

if (modo === 'seco') {
  console.log('seco: nada foi enviado para o projeto.')
  process.exit(0)
}

await pedir('PATCH', patch)
console.log(`aplicado no projeto ${REF}: ${FLUXOS.length} fluxo(s).`)

const depois = await pedir('GET')
for (const fluxo of FLUXOS) {
  const assuntoOk = String(depois[fluxo.assunto] ?? '') === fluxo.titulo
  const corpoOk = String(depois[fluxo.corpo] ?? '').trim() === patch[fluxo.corpo].trim()
  console.log(`  ${fluxo.arquivo}: ${assuntoOk && corpoOk ? 'ok' : 'DIVERGENTE depois do PATCH'}`)
}
process.exit(0)
