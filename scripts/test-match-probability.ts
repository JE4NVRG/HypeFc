#!/usr/bin/env node
/**
 * Testes do modelo de probabilidade (Elo + Poisson).
 *
 * Nao testa "o numero bonito": testa as propriedades que, se quebrarem, fazem o
 * site publicar probabilidade invalida — soma 1, monotonicidade, empate dentro de
 * faixa plausivel, rating de soma zero, Brier/log loss com valor conferido a mao.
 *
 * Uso: node --experimental-strip-types scripts/test-match-probability.ts
 */
import assert from 'node:assert/strict'
import {
  BASE_RATING,
  brierScore,
  buildRatings,
  calibration,
  logLoss,
  predictFromRatings,
  predictMatch,
  type H2HLikeMatch,
  type ProbOutcome,
} from '../src/lib/matchProbability.ts'

let checks = 0
function ok(label: string, fn: () => void): void {
  fn()
  checks += 1
  console.log(`ok ${checks}. ${label}`)
}

const played = (
  date: string | null,
  home: string,
  away: string,
  score_home: number,
  score_away: number
): H2HLikeMatch => ({ date, home, away, status: 'FINISHED', score_home, score_away })

const close = (a: number, b: number, eps = 1e-9) =>
  assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`)

// ---------------------------------------------------------------------------
// predictMatch: e uma distribuicao de probabilidade ou nao e nada
// ---------------------------------------------------------------------------

ok('1X2 soma exatamente 1 em varias diferencas de rating', () => {
  const diffs = [-500, -300, -150, -70, 0, 70, 150, 300, 500]
  for (const diff of diffs) {
    const p = predictMatch(BASE_RATING + diff, BASE_RATING)
    close(p.home + p.draw + p.away, 1)
    for (const value of [p.home, p.draw, p.away]) {
      assert.ok(value > 0 && value < 1, `probabilidade fora de (0,1): ${value}`)
    }
  }
})

ok('com ratings iguais o mando decide (empate equilibrado em casa)', () => {
  const p = predictMatch(BASE_RATING, BASE_RATING)
  assert.ok(p.home > p.away, 'mandante deveria ser favorito')
  close(p.home + p.draw + p.away, 1)
  assert.ok(p.home + p.draw / 2 > 0.5)
})

ok('a vantagem de mando e parametrizavel e desloca o resultado', () => {
  const sem = predictMatch(BASE_RATING, BASE_RATING, { homeAdvantage: 0 })
  const com = predictMatch(BASE_RATING, BASE_RATING, { homeAdvantage: 200 })
  // sem mando a partida e simetrica
  close(sem.home, sem.away, 1e-6)
  assert.ok(com.home > sem.home, 'mais mando -> mais chance de vitoria em casa')
  assert.ok(com.away < sem.away)
})

ok('mais rating implica mais probabilidade (monotonico nos dois sentidos)', () => {
  let previous = -1
  for (const diff of [-400, -200, -50, 0, 50, 200, 400]) {
    const p = predictMatch(BASE_RATING + diff, BASE_RATING)
    assert.ok(p.home > previous, `home nao cresceu em diff=${diff}`)
    previous = p.home
  }
})

ok('empate fica numa faixa de futebol (nunca 0 nem 50%)', () => {
  // Faixa realista [-250, 250]: o empate de futebol vive em 15%-30%.
  for (const diff of [-250, -200, -150, -70, -30, 0, 30, 70, 150, 200, 250]) {
    const p = predictMatch(BASE_RATING + diff, BASE_RATING)
    assert.ok(p.draw > 0.15 && p.draw < 0.30, `empate fora da faixa em diff=${diff}: ${p.draw}`)
  }
  // Cauda extrema (|diff| >= 300, quase nao ocorre com k=20 numa temporada): o
  // empate cai de verdade em jogo decidido, mas o modelo nunca zera nem infla.
  // E o away some demais? Nao: fica acima de 1% em vez de virar 0 absoluto.
  for (const diff of [-400, -300, 300, 400]) {
    const p = predictMatch(BASE_RATING + diff, BASE_RATING)
    assert.ok(p.draw > 0.08 && p.draw < 0.32, `empate fora da cauda em diff=${diff}: ${p.draw}`)
    assert.ok(p.home > 0.01 && p.away > 0.01, `lado zerado em diff=${diff}`)
  }
  // e o empate e MAXIMO no jogo equilibrado, caindo quando o favoritismo cresce
  const equil = predictMatch(BASE_RATING, BASE_RATING)
  const favorito = predictMatch(BASE_RATING + 400, BASE_RATING)
  assert.ok(equil.draw > favorito.draw)
})

ok('o bridge PRODUZ o expected score do Elo (home + draw/2 == E_elo)', () => {
  // A propriedade central do modelo: o Elo fixa o balanco e o Poisson so o
  // reparte em tres. Se isso descolar, o Poisson virou enfeite e o rating nao
  // esta sendo usado.
  for (const diff of [-400, -150, 0, 90, 250, 400]) {
    const p = predictMatch(BASE_RATING + diff, BASE_RATING)
    const E = 1 / (1 + Math.pow(10, -(diff + 70) / 400))
    close(p.home + p.draw / 2, E, 1e-3)
  }
})

ok('o argumento mais provavel acompanha o rating', () => {
  assert.equal(predictMatch(BASE_RATING + 300, BASE_RATING).home > predictMatch(BASE_RATING, BASE_RATING, { homeAdvantage: 0 }).home, true)
  const gol = predictMatch(BASE_RATING + 400, BASE_RATING)
  assert.ok(gol.home > gol.away)
})

// ---------------------------------------------------------------------------
// buildRatings
// ---------------------------------------------------------------------------

ok('vencer soma rating e perder subtrai (e a soma e conservada)', () => {
  const matches: H2HLikeMatch[] = [
    played('2026-01-01', 'A', 'B', 3, 0),
    played('2026-01-08', 'A', 'B', 2, 1),
  ]
  const ratings = buildRatings(matches)
  const a = ratings.get('A') as number
  const b = ratings.get('B') as number
  assert.ok(a > BASE_RATING, 'A venceu duas, tem que subir')
  assert.ok(b < BASE_RATING, 'B perdeu duas, tem que cair')
  close(a + b, BASE_RATING * 2, 1e-9)
  close(a - BASE_RATING, BASE_RATING - b, 1e-9)
})

ok('so jogo FINISHED com placar entra no rating (mesma regra do repo)', () => {
  const matches: H2HLikeMatch[] = [
    { date: '2026-01-01', home: 'A', away: 'B', status: 'TIMED', score_home: null, score_away: null },
    { date: '2026-01-02', home: 'A', away: 'B', status: 'FINISHED', score_home: null, score_away: null },
    { date: '2026-01-03', home: 'A', away: 'B', status: 'IN_PLAY', score_home: 1, score_away: 1 },
  ]
  const ratings = buildRatings(matches)
  assert.equal(ratings.get('A'), undefined)
  assert.equal(ratings.get('B'), undefined)
})

ok('a ORDEM do array nao muda nada: o rating ordena por DATA', () => {
  const cronologico: H2HLikeMatch[] = [
    played('2026-01-01', 'A', 'B', 0, 3),
    played('2026-02-01', 'A', 'B', 3, 0),
    played('2026-03-01', 'A', 'B', 3, 0),
  ]
  const embaralhado: H2HLikeMatch[] = [cronologico[2], cronologico[0], cronologico[1]]
  assert.deepEqual(
    Array.from(buildRatings(cronologico).entries()),
    Array.from(buildRatings(embaralhado).entries())
  )
})

ok('a CHRONOLOGIA e que decide: datas trocadas dao ratings diferentes', () => {
  const sobeDepois: H2HLikeMatch[] = [
    played('2026-01-01', 'A', 'B', 0, 3),
    played('2026-02-01', 'A', 'B', 3, 0),
  ]
  const sobeAntes: H2HLikeMatch[] = [
    played('2026-01-01', 'A', 'B', 3, 0),
    played('2026-02-01', 'A', 'B', 0, 3),
  ]
  assert.notDeepEqual(
    Array.from(buildRatings(sobeDepois).entries()),
    Array.from(buildRatings(sobeAntes).entries())
  )
})

ok('sem data o jogo nao some: entra no fim da ordenacao', () => {
  const matches: H2HLikeMatch[] = [
    played(null, 'A', 'B', 1, 0),
    played('2026-01-01', 'A', 'B', 1, 0),
  ]
  const ratings = buildRatings(matches)
  assert.equal(ratings.size, 2)
})

// ---------------------------------------------------------------------------
// predictFromRatings
// ---------------------------------------------------------------------------

ok('predictFromRatings resolve por nome e carimba a origem e a amostra', () => {
  const ratings = new Map<string, number>([
    ['A', BASE_RATING + 120],
    ['B', BASE_RATING - 120],
  ])
  const p = predictFromRatings(ratings, 'A', 'B')
  assert.equal(p.source, 'elo+poisson')
  assert.equal(p.sample, 2)
  close(p.home + p.draw + p.away, 1)
  assert.ok(p.home > p.away)
})

ok('time sem rating nao desaparece: entra com BASE_RATING', () => {
  const ratings = new Map<string, number>([['A', BASE_RATING + 300]])
  const p = predictFromRatings(ratings, 'A', 'DESCONHECIDO')
  close(p.home + p.draw + p.away, 1)
  // e o jogo e equivalente ao de rating 1500 explicito
  const explicito = predictMatch(BASE_RATING + 300, BASE_RATING)
  close(p.home, explicito.home)
  close(p.draw, explicito.draw)
})

// ---------------------------------------------------------------------------
// brierScore / logLoss: valores conferidos a mao
// ---------------------------------------------------------------------------

ok('Brier: previsao perfeita zera e a uniforme vale 2/3', () => {
  const perfeito: ProbOutcome[] = [
    { probs: { home: 1, draw: 0, away: 0 }, outcome: 'home' },
    { probs: { home: 0, draw: 0, away: 1 }, outcome: 'away' },
  ]
  close(brierScore(perfeito), 0)

  const uniforme: ProbOutcome[] = [
    { probs: { home: 1 / 3, draw: 1 / 3, away: 1 / 3 }, outcome: 'home' },
    { probs: { home: 1 / 3, draw: 1 / 3, away: 1 / 3 }, outcome: 'draw' },
    { probs: { home: 1 / 3, draw: 1 / 3, away: 1 / 3 }, outcome: 'away' },
  ]
  close(brierScore(uniforme), 2 / 3)
})

ok('Brier: valor conferido a mao em uma linha (0.38)', () => {
  // (0.5-1)^2 + 0.3^2 + 0.2^2 = 0.25 + 0.09 + 0.04
  const rows: ProbOutcome[] = [
    { probs: { home: 0.5, draw: 0.3, away: 0.2 }, outcome: 'home' },
  ]
  close(brierScore(rows), 0.38)
})

ok('log loss: uniforme vale ln 3', () => {
  const uniforme: ProbOutcome[] = [
    { probs: { home: 1 / 3, draw: 1 / 3, away: 1 / 3 }, outcome: 'home' },
    { probs: { home: 1 / 3, draw: 1 / 3, away: 1 / 3 }, outcome: 'away' },
  ]
  close(logLoss(uniforme), Math.log(3), 1e-12)
})

ok('log loss: conferido a mao (-ln 0.5) e punindo o erro com forca', () => {
  const uma: ProbOutcome[] = [
    { probs: { home: 0.5, draw: 0.3, away: 0.2 }, outcome: 'home' },
  ]
  close(logLoss(uma), Math.log(2), 1e-12)

  const errada: ProbOutcome[] = [
    { probs: { home: 0.98, draw: 0.01, away: 0.01 }, outcome: 'away' },
  ]
  assert.ok(logLoss(errada) > 4, 'errar com 98% de confianca tem que doer')
})

ok('Brier e log loss de conjunto vazio nao inventam numero (NaN)', () => {
  assert.ok(Number.isNaN(brierScore([])))
  assert.ok(Number.isNaN(logLoss([])))
})

// ---------------------------------------------------------------------------
// calibration
// ---------------------------------------------------------------------------

ok('calibracao cobre TODAS as classes: n da tabela = 3x jogos', () => {
  const rows: ProbOutcome[] = [
    { probs: { home: 0.5, draw: 0.3, away: 0.2 }, outcome: 'home' },
    { probs: { home: 0.4, draw: 0.35, away: 0.25 }, outcome: 'away' },
  ]
  const buckets = calibration(rows, 5)
  const total = buckets.reduce((sum, bucket) => sum + bucket.n, 0)
  assert.equal(total, rows.length * 3)
})

ok('calibracao: faixa confere previsto vs observado', () => {
  // 0.5 -> faixa 40-60% ; empate e fora (0.3, 0.2) -> faixa 20-40%
  const rows: ProbOutcome[] = [
    { probs: { home: 0.5, draw: 0.3, away: 0.2 }, outcome: 'home' },
  ]
  const buckets = calibration(rows, 5)
  const alta = buckets.find((bucket) => bucket.bucket === '40-60%') as typeof buckets[number]
  assert.equal(alta.n, 1)
  close(alta.predicted, 0.5)
  close(alta.observed, 1)

  const baixa = buckets.find((bucket) => bucket.bucket === '20-40%') as typeof buckets[number]
  assert.equal(baixa.n, 2)
  close(baixa.predicted, 0.25)
  close(baixa.observed, 0)
})

ok('calibracao nao devolve faixa vazia nem explode no vazio', () => {
  const rows: ProbOutcome[] = [
    { probs: { home: 0.9, draw: 0.06, away: 0.04 }, outcome: 'home' },
  ]
  const buckets = calibration(rows, 5)
  assert.ok(buckets.every((bucket) => bucket.n > 0))
  assert.deepEqual(calibration([], 5), [])
  // probabilidade exatamente 1 cai na ultima faixa, nao fora do array
  const limite = calibration([{ probs: { home: 1, draw: 0, away: 0 }, outcome: 'home' }], 5)
  assert.equal(limite.find((bucket) => bucket.bucket === '80-100%')?.n, 1)
})

ok('calibracao: faixas alternativas mudam o rotulo e mantem o n', () => {
  const rows: ProbOutcome[] = [
    { probs: { home: 0.6, draw: 0.25, away: 0.15 }, outcome: 'home' },
  ]
  const dez = calibration(rows, 10)
  assert.equal(dez.reduce((sum, bucket) => sum + bucket.n, 0), 3)
  assert.ok(dez.some((bucket) => bucket.bucket === '60-70%'))
})

// ---------------------------------------------------------------------------
// integracao: o modelo num replay em miniatura
// ---------------------------------------------------------------------------

ok('replay em miniatura: favorito medido vence a previsao do azarado', () => {
  const matches: H2HLikeMatch[] = [
    played('2026-01-01', 'FORTE', 'FRACO', 4, 0),
    played('2026-01-08', 'FORTE', 'MEIO', 3, 0),
    played('2026-01-15', 'MEIO', 'FRACO', 2, 0),
    played('2026-01-22', 'FORTE', 'FRACO', 2, 0),
  ]
  const ratings = buildRatings(matches)
  const p = predictFromRatings(ratings, 'FORTE', 'FRACO')
  assert.ok((ratings.get('FORTE') as number) > (ratings.get('FRACO') as number))
  assert.ok(p.home > p.away)
  assert.ok(p.home > 0.5, 'um time invicto e goleador em casa tem que passar de 50%')
  assert.equal(p.sample, 3)
})

console.log(`probability tests ok (${checks} checks)`)
