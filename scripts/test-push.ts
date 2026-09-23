#!/usr/bin/env node
/**
 * Testes do push (entrega dos alertas).
 *
 * O que e provado aqui, sem rede e sem banco:
 *   1. o par VAPID e um P-256 valido e a chave publica realmente deriva da
 *      privada (chave torta = push recusado pela Apple/Google em producao);
 *   2. a chave de idempotencia do aviso e estavel para o mesmo jogo (rodar o
 *      cron duas vezes nao pode virar dois avisos);
 *   3. o parser do payload do alerta (montarPayload) usa o rating publicado e,
 *      quando nao existe rating, NAO inventa numero nenhum;
 *   4. o service worker publicado continua com o handler de push, o de clique e
 *      o marcador literal que o build troca pelo carimbo de versao.
 *
 * Nao imprime chave nenhuma: so as conclusoes.
 */

import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { probabilidadeDoJogo, type RatingsPayload } from '../src/lib/ratings.ts'
import {
  eventKeyDe,
  horarioSaoPaulo,
  jogosDoDia,
  montarPayload,
  truncarEndpoint,
  type JogoHoje,
} from './send-alerts.ts'

// ---------------------------------------------------------------- 1. VAPID

function base64UrlParaBuffer(valor: string): Buffer {
  return Buffer.from(valor.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}

/** Le uma chave do .env.local sem depender de dotenv (e sem imprimir nada dela). */
function lerEnvLocal(chave: string): string | null {
  const caminho = path.join(process.cwd(), '.env.local')
  if (!existsSync(caminho)) return null
  for (const linha of readFileSync(caminho, 'utf8').split('\n')) {
    const semComentario = linha.trim()
    if (semComentario.startsWith('#')) continue
    const igual = semComentario.indexOf('=')
    if (igual === -1) continue
    if (semComentario.slice(0, igual).trim() !== chave) continue
    const valor = semComentario.slice(igual + 1).trim().replace(/^["']|["']$/g, '')
    return valor || null
  }
  return null
}

const publica = lerEnvLocal('NEXT_PUBLIC_VAPID_PUBLIC_KEY')
const privada = lerEnvLocal('VAPID_PRIVATE_KEY')
const assunto = lerEnvLocal('VAPID_SUBJECT')

if (!publica || !privada) {
  console.log('sem par VAPID em .env.local: validacao do par pulada (rode `npx web-push generate-vapid-keys --json` e grave as duas chaves)')
} else {
  assert.match(publica, /^[A-Za-z0-9_-]+$/, 'chave publica VAPID tem que ser base64url')
  assert.match(privada, /^[A-Za-z0-9_-]+$/, 'chave privada VAPID tem que ser base64url')

  const bytesPublica = base64UrlParaBuffer(publica)
  assert.equal(bytesPublica.length, 65, 'chave publica P-256 nao comprimida tem 65 bytes')
  assert.equal(bytesPublica[0], 4, 'chave publica nao comprimida comeca com o byte 0x04')

  const bytesPrivada = base64UrlParaBuffer(privada)
  assert.equal(bytesPrivada.length, 32, 'chave privada P-256 tem 32 bytes')

  // A prova que importa: a publica tem que sair da privada. Par trocado na
  // configuracao passa em qualquer validacao de formato e falha so no envio.
  const ecdh = crypto.createECDH('prime256v1')
  ecdh.setPrivateKey(bytesPrivada)
  assert.equal(ecdh.getPublicKey().toString('base64url'), publica, 'a chave publica nao deriva da privada')

  if (assunto) {
    assert.ok(
      assunto.startsWith('mailto:') || assunto.startsWith('https://'),
      'VAPID_SUBJECT precisa ser mailto:... ou https://...'
    )
  }
}

// --------------------------------------------------- 2. chave de idempotencia

const jogoBase: JogoHoje = {
  eventId: '401841246',
  leagueId: 'BSA',
  leagueName: 'Brasileirão Série A',
  kickoff: '2026-09-23T19:00:00Z',
  home: 'Flamengo',
  away: 'Palmeiras',
  homeId: '819',
  awayId: '2029',
  status: 'STATUS_SCHEDULED',
}

assert.equal(eventKeyDe(jogoBase), '401841246:rodada')
assert.equal(eventKeyDe({ ...jogoBase }), eventKeyDe(jogoBase), 'mesmo jogo, mesma chave')
assert.equal(eventKeyDe({ eventId: '401841246' }), eventKeyDe(jogoBase), 'a chave nao depende do resto do payload')
assert.notEqual(eventKeyDe({ eventId: '401841247' }), eventKeyDe(jogoBase), 'jogo diferente, chave diferente')
// Duas execucoes do cron (processos distintos) tem que concordar: nada de data,
// nada de horario, nada de indice de lista entrando na chave.
assert.equal(eventKeyDe(jogoBase) === '401841246:rodada', true)

// ----------------------------------------------------- 3. payload do alerta

const ratings = JSON.parse(
  readFileSync(path.join(process.cwd(), 'public', 'data', 'ratings.json'), 'utf8')
) as RatingsPayload

// Horario: 19:00Z e 16:00 em Sao Paulo (UTC-3). O texto publica o horario do
// usuario, nao o do servidor.
assert.equal(horarioSaoPaulo('2026-09-23T19:00:00Z'), '16:00')
assert.equal(horarioSaoPaulo(null), null, 'sem data nao ha horario para mostrar')

// Endpoint nunca aparece inteiro (ele identifica o aparelho do assinante).
const endpointFake = 'https://fcm.googleapis.com/fcm/send/exemplo-de-endpoint-longo-abc123def456'
assert.equal(truncarEndpoint(endpointFake), '...abc123def456')
assert.ok(!truncarEndpoint(endpointFake).includes('fcm.googleapis.com'))

const comRating = montarPayload(jogoBase, ratings)
assert.equal(comRating.title, 'Seu time joga hoje')
assert.match(
  comRating.body,
  /^Flamengo x Palmeiras hoje 16:00 — modelo: \d+% \/ \d+% \/ \d+% \(registro publico, sem palpite\)$/
)
assert.equal(comRating.tag, 'hypefc-401841246')
assert.ok(comRating.url.includes('jogo=401841246'))
assert.ok(comRating.url.includes('dia=2026-09-23'))

// O numero do texto e o numero do modelo publicado — nem mais, nem arredondado
// para outro lado.
const prob = probabilidadeDoJogo(ratings, 'BSA', 'Flamengo', 'Palmeiras')
assert.ok(prob, 'Flamengo x Palmeiras tem rating dos dois lados')
const porcentagens = (comRating.body.match(/(\d+)%/g) || []).map((p) => Number(p.replace('%', '')))
assert.deepEqual(porcentagens, [
  Math.round((prob as { home: number }).home * 100),
  Math.round((prob as { draw: number }).draw * 100),
  Math.round((prob as { away: number }).away * 100),
])
const soma = porcentagens.reduce((total, valor) => total + valor, 0)
assert.ok(Math.abs(soma - 100) <= 1, `as tres porcentagens somam 100 (somaram ${soma})`)

// Time sem rating nos dois lados: o alerta continua verdadeiro e sem numero.
const semRating = montarPayload({ ...jogoBase, home: 'Time Sem Rating', away: 'Outro Time' }, ratings)
assert.ok(!semRating.body.includes('modelo:'), 'sem rating nao sai linha de modelo')
assert.ok(!semRating.body.includes('%'), 'sem rating nao sai porcentagem nenhuma')
assert.equal(semRating.body, 'Time Sem Rating x Outro Time hoje 16:00')

// Sem ratings carregados (arquivo ausente no deploy): mesmo comportamento.
const semArquivo = montarPayload(jogoBase, null)
assert.equal(semArquivo.body, 'Flamengo x Palmeiras hoje 16:00')

// Sem horario conhecido: o texto omite a hora em vez de mostrar 00:00.
const semHora = montarPayload({ ...jogoBase, kickoff: null }, ratings)
assert.equal(semHora.body.split(' — ')[0], 'Flamengo x Palmeiras hoje')

// Nome do time escrito de outro jeito (ESPN x tabela): o rating e reaproveitado
// pelo nome normalizado, sem virar numero novo (o texto mantem o nome da ESPN).
const comAlias = montarPayload({ ...jogoBase, away: 'palmeiras' }, ratings)
const soPorcentagens = (corpo: string) => (corpo.match(/\d+%/g) || []).join(' ')
assert.equal(soPorcentagens(comAlias.body), soPorcentagens(comRating.body))
assert.match(comAlias.body, /^Flamengo x palmeiras hoje 16:00 — modelo: /)

// ------------------------------------------- 4. scoreboard do dia (parser)

const jogos = jogosDoDia(
  {
    events: [
      {
        id: '401841246',
        date: '2026-09-23T19:00:00Z',
        competitions: [
          {
            status: { type: { name: 'STATUS_SCHEDULED' } },
            competitors: [
              { homeAway: 'home', team: { id: '2029', displayName: 'Palmeiras' } },
              { homeAway: 'away', team: { id: '598', displayName: 'Flamengo' } },
            ],
          },
        ],
      },
      { id: '401841247', date: '2026-09-23T21:00:00Z', competitions: [] },
    ],
  },
  'BSA',
  'Brasileirão Série A'
)
assert.equal(jogos.length, 1, 'evento sem competidores completos fica de fora')
assert.equal(jogos[0]?.home, 'Palmeiras')
assert.equal(jogos[0]?.away, 'Flamengo')
assert.equal(jogos[0]?.homeId, '2029', 'o id do time vem do payload (e o que follows.team_id guarda)')
assert.equal(jogos[0]?.awayId, '598')
assert.equal(jogos[0]?.kickoff, '2026-09-23T19:00:00Z')
assert.equal(jogos[0]?.leagueId, 'BSA')
assert.deepEqual(jogosDoDia(null, 'BSA', 'Brasileirão Série A'), [])

// -------------------------------------------------- 5. service worker publicado

const sw = readFileSync(path.join(process.cwd(), 'public', 'sw.js'), 'utf8')
assert.ok(sw.includes("addEventListener('push'"), 'o sw.js precisa do handler de push')
assert.ok(sw.includes("addEventListener('notificationclick'"), 'o sw.js precisa abrir o jogo no clique')
assert.ok(sw.includes('showNotification'), 'o handler de push precisa mostrar a notificacao')
assert.ok(
  sw.includes('__HYPEFC_BUILD_STAMP__'),
  'o marcador de versao do cache tem que seguir no sw.js (o build troca pelo carimbo)'
)
assert.ok(sw.includes("matchAll({ type: 'window', includeUncontrolled: true })"), 'clique foca aba ja aberta')
assert.ok(sw.includes("'./icons/icon-192.png'"), 'alerta usa o icone instalavel como icon/badge')

console.log('push tests ok')
