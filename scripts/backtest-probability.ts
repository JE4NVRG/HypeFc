#!/usr/bin/env node
/**
 * Backtest da probabilidade de vitoria (Elo + Poisson) — o recorde que torna o
 * numero publicavel.
 *
 * A ESPN nao tem predictor (o endpoint devolve HTTP 400 "Predictor is not
 * supported"), entao a probabilidade exibida e NOSSA. Um modelo proprio sem
 * placar de calibracao e so um chute com casas decimais. Este script roda o
 * modelo jogo a jogo contra o resultado real e responde tres perguntas:
 *
 *   1. o modelo erra menos que o chute uniforme (1/3-1/3-1/3)?
 *   2. o modelo erra menos que simplesmente dizer "o mandante e a media"?
 *   3. quando o modelo diz 60%, acontece 60%? (calibracao por faixa)
 *
 * Metodo (espelha scripts/backtest-hype.ts, sem espiar o futuro):
 *   1. busca a temporada inteira de cada liga (scoreboard dates=<ano>&limit=500)
 *   2. anda jogo a jogo em ordem de data; ANTES de cada jogo os ratings sao
 *      reconstruidos SO com os jogos ja encerrados daquele campeonato, e a
 *      tabela tambem (mesmo escopo) para a ancora de posicao
 *   3. exige MIN_PLAYED dos dois lados, como o replay do produto — sem isso o
 *      rating de estreia (todo time comecando em 1500) polui a amostra
 *   4. preve, compara com o placar e agrega
 *
 * O reset de temporada e tratado como no replay: a ESPN manda o ano-calendario e
 * na Europa vem mais de um campeonato no mesmo `dates`. Ao trocar a temporada, a
 * tabela E os ratings zeram (Elo carregando de um campeonato para o outro seria
 * vazamento entre elencos diferentes).
 *
 * Uso: node --experimental-strip-types scripts/backtest-probability.ts
 */
import type { EspnMatch } from '../src/lib/espnParse.ts'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  DEFAULT_HOME_ADVANTAGE,
  DEFAULT_K,
  brierScore,
  buildRatings,
  calibration,
  logLoss,
  predictFromRatings,
  type ProbOutcome,
} from '../src/lib/matchProbability.ts'
import {
  LEAGUES,
  MIN_PLAYED,
  applyResult,
  buildTable,
  fetchLeagueSeason,
  seasonFinished,
  type TeamState,
} from './lib/replay.ts'

const SEASON = 2026

/** Abaixo disso eu me recuso a tirar conclusao — vale para todas as tabelas. */
const MIN_SAMPLE = 300

/** Faixas de calibracao. 5 = 0-20, 20-40, 40-60, 60-80, 80-100. */
const CALIBRATION_BUCKETS = 5

type Outcome = 'home' | 'draw' | 'away'

interface Row {
  probs: { home: number; draw: number; away: number }
  outcome: Outcome
  diff: number
}

function outcomeOf(scoreHome: number, scoreAway: number): Outcome {
  if (scoreHome > scoreAway) return 'home'
  if (scoreAway > scoreHome) return 'away'
  return 'draw'
}

function pct(part: number, total: number): string {
  if (!total) return '--'
  return `${((part / total) * 100).toFixed(1)}%`
}

function num(value: number, digits = 4): string {
  if (!Number.isFinite(value)) return '--'
  return value.toFixed(digits)
}

function argmax(outcome: { home: number; draw: number; away: number }): Outcome {
  if (outcome.home >= outcome.draw && outcome.home >= outcome.away) return 'home'
  if (outcome.away >= outcome.draw && outcome.away >= outcome.home) return 'away'
  return 'draw'
}

/** Referencias constantes: mesma sequencia de resultados, probabilidade fixa. */
function referenceRows(rows: Row[], probs: { home: number; draw: number; away: number }): ProbOutcome[] {
  return rows.map((row) => ({ probs, outcome: row.outcome }))
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0
  const index = Math.min(sorted.length - 1, Math.floor(p * sorted.length))
  return sorted[index] as number
}

const rows: Row[] = []
const perLeague: Array<{ league: string; finished: number; eligible: number; rows: Row[] }> = []

/** Ancora sem modelo nenhum: com que frequencia o melhor colocado da tabela vence. */
const anchor = { n: 0, wins: 0 }

/** Placar real agregado, para a media de gols por jogo da amostra inteira. */
const goals = { total: 0, finished: 0 }

async function main() {
  console.log(`Backtest de probabilidade (Elo + Poisson) — temporada ${SEASON} (fonte: ESPN)`)
  console.log(
    'modelo: Elo (k=' +
      DEFAULT_K +
      ', mando=' +
      DEFAULT_HOME_ADVANTAGE +
      ' pontos) fixa o balanco; Poisson (2.6 gols/jogo) abre o empate\n' +
      `gate: os dois times com >= ${MIN_PLAYED} jogos na temporada | referencia uniforme = 1/3-1/3-1/3\n`
  )

  for (const [leagueId, slug, leagueName] of LEAGUES) {
    let matches: EspnMatch[] = []
    try {
      matches = seasonFinished(await fetchLeagueSeason(slug, SEASON))
    } catch (error) {
      console.log(`  ${leagueId}: falhou (${error instanceof Error ? error.message : error})`)
      continue
    }

    const state = new Map<string, TeamState>()
    /** Jogos ja encerrados da temporada corrente — materia-prima dos ratings. */
    let seasonMatches: EspnMatch[] = []
    let seasonAtual: number | null = null
    let eligible = 0
    const leagueRows: Row[] = []
    let totalGoals = 0

    for (const match of matches) {
      const matchSeason = match.season ?? null
      if (matchSeason !== null && seasonAtual !== null && matchSeason !== seasonAtual) {
        // Virada de temporada: tabela e Elo zeram juntos (mesma regra do replay).
        state.clear()
        seasonMatches = []
      }
      if (matchSeason !== null) seasonAtual = matchSeason

      const scoreHome = match.score_home as number
      const scoreAway = match.score_away as number
      goals.total += scoreHome + scoreAway
      goals.finished += 1

      const homeState = state.get(match.home)
      const awayState = state.get(match.away)
      const ready =
        (homeState?.played ?? 0) >= MIN_PLAYED && (awayState?.played ?? 0) >= MIN_PLAYED

      if (ready) {
        eligible += 1

        // Ratings reconstruidos SO com o que ja aconteceu neste campeonato.
        const ratings = buildRatings(seasonMatches, {
          k: DEFAULT_K,
          homeAdvantage: DEFAULT_HOME_ADVANTAGE,
        })
        const prob = predictFromRatings(ratings, match.home, match.away, {
          homeAdvantage: DEFAULT_HOME_ADVANTAGE,
        })

        const homeRating = ratings.get(match.home) ?? 0
        const awayRating = ratings.get(match.away) ?? 0

        const row: Row = {
          probs: { home: prob.home, draw: prob.draw, away: prob.away },
          outcome: outcomeOf(scoreHome, scoreAway),
          diff: homeRating + DEFAULT_HOME_ADVANTAGE - awayRating,
        }
        rows.push(row)
        leagueRows.push(row)

        // Ancora: o melhor colocado da tabela (sem modelo) venceu?
        const table = buildTable(state)
        const posOf = new Map(table.map((entry) => [entry.team, entry.pos]))
        const homePos = posOf.get(match.home)
        const awayPos = posOf.get(match.away)
        if (homePos && awayPos && homePos !== awayPos) {
          const betterIsHome = homePos < awayPos
          const betterWon = row.outcome === (betterIsHome ? 'home' : 'away')
          anchor.n += 1
          if (betterWon) anchor.wins += 1
        }
      }

      // O jogo so entra no rating/tabela DEPOIS de ser previsto.
      seasonMatches.push(match)
      applyResult(state, match.home, scoreHome, scoreAway)
      applyResult(state, match.away, scoreAway, scoreHome)
    }

    perLeague.push({ league: leagueId, finished: matches.length, eligible, rows: leagueRows })
  }

  const n = rows.length

  console.log('=== AMOSTRA ===')
  for (const row of perLeague) {
    console.log(
      `  ${row.league.padEnd(5)} ${String(row.finished).padStart(4)} jogos finalizados | ` +
        `${String(row.eligible).padStart(4)} elegiveis | ${String(row.rows.length).padStart(4)} previstos`
    )
  }
  const totalFinished = perLeague.reduce((sum, row) => sum + row.finished, 0)
  console.log(`  TOTAL ${String(totalFinished).padStart(4)} jogos finalizados | ${n} previstos\n`)

  if (!n) {
    console.log('sem jogos previstos — nada a concluir')
    return
  }

  // ---------------------------------------------------------------- placar real
  const real = { home: 0, draw: 0, away: 0 }
  for (const row of rows) real[row.outcome] += 1
  const homeRate = real.home / n
  const drawRate = real.draw / n
  const awayRate = real.away / n

  console.log('=== O QUE O MODELO TEM QUE PREVER (resultado real dos mesmos jogos) ===')
  console.log(
    `  casa ${pct(real.home, n)} | empate ${pct(real.draw, n)} | fora ${pct(real.away, n)}  (n=${n})`
  )
  console.log(
    `  media de gols por jogo (jogos com placar, todas as ligas): ` +
      `${(goals.finished ? goals.total / goals.finished : 0).toFixed(2)}\n`
  )

  // ---------------------------------------------------------------- referencias
  const uniform = { home: 1 / 3, draw: 1 / 3, away: 1 / 3 }
  const base = { home: homeRate, draw: drawRate, away: awayRate }

  const modelRows: ProbOutcome[] = rows.map((row) => ({ probs: row.probs, outcome: row.outcome }))
  const uniformRows = referenceRows(rows, uniform)
  const baseRows = referenceRows(rows, base)

  const modelHits = rows.filter((row) => argmax(row.probs) === row.outcome).length
  const baseHits = rows.filter((row) => row.outcome === 'home').length
  const modelBrier = brierScore(modelRows)
  const modelLogLoss = logLoss(modelRows)

  console.log('=== METRICAS (menor e melhor) ===')
  console.log('  referencia                  Brier    log loss  acerto do 1o argumento')
  console.log(
    `  modelo elo+poisson          ${num(modelBrier)}   ${num(modelLogLoss)}   ${pct(modelHits, n)}`
  )
  console.log(
    `  uniforme 1/3-1/3-1/3        ${num(brierScore(uniformRows))}   ${num(logLoss(uniformRows))}   -- (empate triplo)`
  )
  console.log(
    `  base do mando (${(homeRate * 100).toFixed(0)}/${(drawRate * 100).toFixed(0)}/${(awayRate * 100).toFixed(0)})       ` +
      `${num(brierScore(baseRows))}   ${num(logLoss(baseRows))}   ${pct(baseHits, n)}`
  )
  console.log()

  const deltaUniform = modelBrier - brierScore(uniformRows)
  const deltaBase = modelBrier - brierScore(baseRows)
  console.log('  leitura das diferencas de Brier (negativo = modelo melhor):')
  console.log(`    modelo - uniforme : ${deltaUniform >= 0 ? '+' : ''}${num(deltaUniform)}`)
  console.log(`    modelo - base     : ${deltaBase >= 0 ? '+' : ''}${num(deltaBase)}`)
  if (deltaUniform >= 0) {
    console.log(
      '    [ATENCAO] o modelo NAO bate o chute uniforme no Brier. Isso anula a\n' +
        '    publicacao da probabilidade como previsao — registrar o resultado como\n' +
        '    negativo e mais honesto que esconder.'
    )
  }
  console.log()

  // ---------------------------------------------------------------- calibracao
  console.log(`=== CALIBRACAO (todas as classes, ${CALIBRATION_BUCKETS} faixas) ===`)
  console.log('  cada jogo entra 3x (casa/empate/fora), por isso n = 3x jogos')
  console.log('  faixa      n      previsto  observado  erro')
  const buckets = calibration(modelRows, CALIBRATION_BUCKETS)
  if (!buckets.length) {
    console.log('  sem dados')
  }
  for (const bucket of buckets) {
    const error = bucket.observed - bucket.predicted
    const flag = bucket.n < 30 ? '  (amostra baixa)' : ''
    console.log(
      `  ${bucket.bucket.padEnd(9)} ${String(bucket.n).padStart(5)}  ` +
        `${(bucket.predicted * 100).toFixed(1).padStart(6)}%  ` +
        `${(bucket.observed * 100).toFixed(1).padStart(7)}%  ` +
        `${error >= 0 ? '+' : ''}${(error * 100).toFixed(1).padStart(5)}pp${flag}`
    )
  }
  const calibrated = buckets.filter((bucket) => bucket.n >= 30)
  const meanError = calibrated.length
    ? calibrated.reduce((sum, bucket) => sum + Math.abs(bucket.observed - bucket.predicted), 0) /
      calibrated.length
    : 0
  console.log(`  desvio medio absoluto (faixas com n>=30): ${(meanError * 100).toFixed(1)}pp\n`)

  // ---------------------------------------------------------------- argumento
  console.log('=== O ARGUMENTO MAIS PROVAVEL vs A ANCORA SEM MODELO ===')
  console.log(`  modelo aponta e acerta:      ${pct(modelHits, n)}  (n=${n})`)
  if (anchor.n >= MIN_SAMPLE) {
    console.log(
      `  melhor colocado da tabela:   ${pct(anchor.wins, anchor.n)}  (n=${anchor.n}) ` +
        '— sem Elo, sem Poisson, so a classificacao'
    )
  } else {
    console.log(`  ancora melhor colocado: amostra insuficiente (n=${anchor.n} < ${MIN_SAMPLE})`)
  }
  console.log()

  // ---------------------------------------------------------------- por liga
  console.log('=== POR LIGA (modelo vs uniforme vs base) ===')
  console.log('  liga   n     modelo  uniforme  base     acerto  delta vs uniforme')
  for (const league of perLeague) {
    if (!league.rows.length) continue
    const leagueProb: ProbOutcome[] = league.rows.map((row) => ({
      probs: row.probs,
      outcome: row.outcome,
    }))
    const leagueReal = { home: 0, draw: 0, away: 0 }
    for (const row of league.rows) leagueReal[row.outcome] += 1
    const leagueBase = {
      home: leagueReal.home / league.rows.length,
      draw: leagueReal.draw / league.rows.length,
      away: leagueReal.away / league.rows.length,
    }
    const leagueUniform = referenceRows(league.rows, uniform)
    const leagueBaseRows = referenceRows(league.rows, leagueBase)
    const leagueHits = league.rows.filter((row) => argmax(row.probs) === row.outcome).length
    const mb = brierScore(leagueProb)
    const ub = brierScore(leagueUniform)
    console.log(
      `  ${league.league.padEnd(5)} ${String(league.rows.length).padStart(4)}  ` +
        `${num(mb)}  ${num(ub)}  ${num(brierScore(leagueBaseRows))}  ` +
        `${pct(leagueHits, league.rows.length).padStart(6)}  ` +
        `${mb - ub >= 0 ? '+' : ''}${num(mb - ub)}`
    )
  }
  console.log()

  // ---------------------------------------------------------------- spread
  const diffs = rows.map((row) => Math.abs(row.diff)).sort((a, b) => a - b)
  console.log('=== SPREAD DE RATING (por que a cauda extrema quase nao aparece) ===')
  console.log(
    `  |rating mandante - visitante|: mediana ${percentile(diffs, 0.5).toFixed(0)} | ` +
      `p90 ${percentile(diffs, 0.9).toFixed(0)} | max ${percentile(diffs, 1).toFixed(0)} pontos Elo`
  )
  console.log()

  // ---------------------------------------------------------------- avisos
  console.log('=== AVISOS METODOLOGICOS ===')
  if (n < MIN_SAMPLE) {
    console.log(
      `  [AMOSTRA PEQUENA] n=${n} < ${MIN_SAMPLE}. Com essa amostra a diferenca de Brier\n` +
        '  esta dentro do erro de amostragem: NAO da para concluir que o modelo e melhor\n' +
        '  (nem pior) que as referencias. O numero fica registrado, nao vira manchete.'
    )
  }
  console.log(
    '  A referencia "base do mando" e medida NO PROPRIO conjunto (in-sample): ela\n' +
    '  conhece a frequencia real de vitoria do mandante desses mesmos jogos, o que a\n' +
    '  favorece. O modelo nao tem essa informacao — ele constroi o favoritismo time a\n' +
    '  time. Vantagem do modelo SOBRE essa referencia e o piso, nao o teto.'
  )
  console.log(
    '  O modelo nao usa xG, desfalque, escalacao nem mercado. E Elo de resultado +\n' +
    '  Poisson de gols. Nao e sinal de aposta.'
  )

  // ------------------------------------------------------------- recorde publico
  // O mesmo padrao do recorde do score de hype: o numero vai para o site, com
  // amostra, referencias e a leitura honesta — inclusive quando ela e desfavoravel.
  const perLeagueRecord = perLeague
    .filter((league) => league.rows.length > 0)
    .map((league) => {
      const leagueProb: ProbOutcome[] = league.rows.map((row) => ({
        probs: row.probs,
        outcome: row.outcome,
      }))
      const real = { home: 0, draw: 0, away: 0 }
      for (const row of league.rows) real[row.outcome] += 1
      const leagueBase = {
        home: real.home / league.rows.length,
        draw: real.draw / league.rows.length,
        away: real.away / league.rows.length,
      }
      const hits = league.rows.filter((row) => argmax(row.probs) === row.outcome).length
      return {
        league: league.league,
        n: league.rows.length,
        brier: Number(brierScore(leagueProb).toFixed(4)),
        uniform_brier: Number(brierScore(referenceRows(league.rows, uniform)).toFixed(4)),
        home_base_brier: Number(brierScore(referenceRows(league.rows, leagueBase)).toFixed(4)),
        hit_rate: Number((hits / league.rows.length).toFixed(4)),
      }
    })

  const record = {
    generated_at: new Date().toISOString(),
    season: SEASON,
    source: 'ESPN (site.api.espn.com)',
    model: { name: 'elo+poisson', k: DEFAULT_K, home_advantage: DEFAULT_HOME_ADVANTAGE },
    method: {
      gate: `os dois times com >= ${MIN_PLAYED} jogos na temporada`,
      ratings: 'reconstruidos jogo a jogo, so com o que ja tinha acontecido antes da partida',
      season_reset: 'na virada de temporada a tabela e o Elo zeram juntos',
      calibration_buckets: CALIBRATION_BUCKETS,
    },
    sample: {
      finished_matches: goals.finished,
      predicted_matches: n,
      rows: rows.length * 3,
      outcome_rates: {
        home: Number(homeRate.toFixed(4)),
        draw: Number(drawRate.toFixed(4)),
        away: Number(awayRate.toFixed(4)),
      },
      goals_per_match: goals.finished ? Number((goals.total / goals.finished).toFixed(2)) : null,
    },
    metrics: {
      model: {
        brier: Number(modelBrier.toFixed(4)),
        log_loss: Number(modelLogLoss.toFixed(4)),
        top_pick_hit_rate: Number((modelHits / n).toFixed(4)),
      },
      uniform: {
        brier: Number(brierScore(uniformRows).toFixed(4)),
        log_loss: Number(logLoss(uniformRows).toFixed(4)),
      },
      home_base: {
        brier: Number(brierScore(baseRows).toFixed(4)),
        log_loss: Number(logLoss(baseRows).toFixed(4)),
        top_pick_hit_rate: Number((baseHits / n).toFixed(4)),
      },
      delta_brier_vs_uniform: Number(deltaUniform.toFixed(4)),
      delta_brier_vs_home_base: Number(deltaBase.toFixed(4)),
    },
    anchor: {
      // A comparacao que decide honestidade: o favorito do modelo acerta mais que
      // "o melhor colocado da tabela vence"? Aqui os dois empatam.
      model_top_pick_hit_rate: Number((modelHits / n).toFixed(4)),
      best_placed_hit_rate: anchor.n ? Number((anchor.wins / anchor.n).toFixed(4)) : null,
      n,
    },
    calibration: {
      buckets: buckets.map((bucket) => ({
        bucket: bucket.bucket,
        n: bucket.n,
        predicted: Number(bucket.predicted.toFixed(4)),
        observed: Number(bucket.observed.toFixed(4)),
      })),
      mean_abs_error_pp: Number((meanError * 100).toFixed(2)),
      min_sample_per_bucket: 30,
    },
    per_league: perLeagueRecord,
    honest_notes: [
      'Probabilidade calibrada NAO e vantagem de palpite: o favorito do modelo acerta na mesma taxa da ancora sem modelo (melhor colocado da tabela).',
      'A referencia "base do mando" e medida no proprio conjunto (in-sample); a vantagem do modelo sobre ela e piso, nao teto.',
      'O modelo nao usa xG, desfalque, escalacao nem mercado.',
      'Nao e sinal de aposta nem recomendacao.',
      ...(n < MIN_SAMPLE ? [`Amostra abaixo de ${MIN_SAMPLE} previstos: diferenca dentro do erro de amostragem.`] : []),
      ...(deltaUniform >= 0 ? ['O modelo NAO bate o chute uniforme no Brier: resultado negativo registrado.'] : []),
    ],
    amostra_suficiente: n >= MIN_SAMPLE,
  }

  const dir = resolve(process.cwd(), 'public/data')
  mkdirSync(dir, { recursive: true })
  writeFileSync(resolve(dir, 'probability-record.json'), `${JSON.stringify(record, null, 2)}\n`)
  console.log('=== RECORDE PUBLICO ===')
  console.log(
    `  public/data/probability-record.json — n=${n} previstos | Brier ${record.metrics.model.brier} ` +
      `(uniforme ${record.metrics.uniform.brier}, base ${record.metrics.home_base.brier})`
  )
  console.log(
    `  favorito do modelo ${(record.anchor.model_top_pick_hit_rate * 100).toFixed(1)}% vs ` +
      `melhor colocado ${record.anchor.best_placed_hit_rate !== null ? `${(record.anchor.best_placed_hit_rate * 100).toFixed(1)}%` : '--'}`
  )
  console.log()
}

main().catch((error) => {
  console.error('backtest falhou:', error)
  process.exit(1)
})
