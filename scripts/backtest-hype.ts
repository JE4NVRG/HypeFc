#!/usr/bin/env node
/**
 * Backtest do hype score contra resultado real.
 *
 * Pergunta que responde: quando o painel aponta um time como "em alta", esse
 * time ganha mais do que a media da liga? Sem isso o score e so heuristica.
 *
 * Metodo (replay cronologico, sem espiar o futuro):
 *   1. busca a temporada inteira de cada liga de uma vez
 *      (scoreboard com dates=<ano>&limit=500 devolve todos os jogos com placar)
 *   2. anda jogo a jogo em ordem de data; ANTES de cada jogo monta a tabela com
 *      o que ja aconteceu (pontos, saldo, forma dos ultimos 5) e calcula a
 *      posicao por ordenacao — nada do jogo avaliado entra na conta
 *   3. chama o buildHypeBoard() real, o mesmo do produto, para esse jogo
 *   4. compara com o placar e agrega
 *
 * O que este backtest NAO cobre: xG, posse, desfalque, mando de campo como
 * sinal. E os termos "joga hoje" (+8) e classico (+18) valem para os dois
 * lados do mesmo jogo, entao nao diferenciam nada na comparacao — quem decide
 * o favorito sao forma (0-35), posicao (0-24) e saldo (0-8).
 *
 * Uso: npm run backtest
 */
import {
  buildHypeBoard,
  MIN_HYPE_SCORE,
  type HypeWeights,
} from '../src/lib/hypeScore.ts'
import type { EspnMatch } from '../src/lib/espnParse.ts'
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

/** Abaixo disso eu me recuso a tirar conclusao. */
const MIN_SAMPLE = 100

interface Tally {
  n: number
  home: number
  draw: number
  away: number
}

function newTally(): Tally {
  return { n: 0, home: 0, draw: 0, away: 0 }
}

function pct(part: number, total: number): string {
  if (!total) return '--'
  return `${((part / total) * 100).toFixed(1)}%`
}

/** Esperado dado o mando, calculado dentro do proprio split (ajuste/validacao). */
function splitExpected(split: Split, tally: EdgeTally): number {
  const base = baselineSplit[split]
  if (!tally.n || !base.n) return 0
  const homeRate = base.home / base.n
  const awayRate = base.away / base.n
  return (tally.homeN * homeRate + tally.awayN * awayRate) / tally.n
}

const baseline = newTally()
const baselineSplit: Record<Split, Tally> = { fit: newTally(), validate: newTally() }
const flaggedOnly = {
  n: 0,
  wins: 0,
  draws: 0,
  losses: 0,
  atHome: { n: 0, wins: 0 },
  away: { n: 0, wins: 0 },
}
const bothFlagged = { n: 0, higherWins: 0, draws: 0, lowerWins: 0 }
const byScore = new Map<string, { n: number; wins: number }>()

/**
 * Controle do vies obvio: o time marcado costuma ser o melhor colocado, entao
 * ganhar mais e esperado so pela tabela. Aqui separo por posicao relativa ao
 * adversario — se o lift sobrevive mesmo quando o marcado esta PIOR colocado,
 * ai o hype agrega algo alem da classificacao.
 */
interface EdgeTally {
  n: number
  wins: number
  homeN: number
  awayN: number
}
const byEdge = new Map<string, EdgeTally>()

/**
 * Ancoragem mais dura: na propria liga, o time MELHOR colocado vence quanto?
 *
 * Sem isso o lift do marcado e comparado com a media crua do mando — e como o
 * marcado quase sempre e o melhor colocado, o lift mede "time forte ganha mais",
 * que todo mundo ja sabia. Aqui guardo a taxa do melhor colocado (independente
 * de hype) para comparar maca com maca.
 */
const betterPlaced = { n: 0, wins: 0, homeN: 0, winsHome: 0, awayN: 0, winsAway: 0 }

function bumpEdge(key: string, won: boolean, isHome: boolean) {
  const current = byEdge.get(key) ?? { n: 0, wins: 0, homeN: 0, awayN: 0 }
  current.n += 1
  if (won) current.wins += 1
  if (isHome) current.homeN += 1
  else current.awayN += 1
  byEdge.set(key, current)
}

const perLeague: Array<{ league: string; finished: number; eligible: number }> = []

/** Cortes testados para o MIN_HYPE_SCORE. */
const CUTOFFS = [24, 28, 32, 36, 40, 44, 48]

/**
 * Fora da amostra: dentro de cada liga, os jogos antes da data mediana servem de
 * ajuste e os depois dela de validacao. Nunca escolho o corte olhando a
 * validacao — senao seria so overfitting com outro nome.
 */
type Split = 'fit' | 'validate'

const EMPTY_ABLATIONS: Record<string, Partial<HypeWeights>> = {}

/** Zera um grupo de pesos para medir o que cada sinal carrega sozinho. */
const ZERO_FORM: Partial<HypeWeights> = { formWin: 0, formDraw: 0 }
const ZERO_POSITION: Partial<HypeWeights> = {
  positionFirst: 0,
  positionSecond: 0,
  positionThird: 0,
  positionTop6: 0,
}
const ZERO_BALANCE: Partial<HypeWeights> = { balanceHigh: 0, balanceMid: 0 }
const ZERO_MATCH: Partial<HypeWeights> = { classic: 0, live: 0, playing: 0 }

const ABLATIONS: Array<{ key: string; weights: Partial<HypeWeights> }> = [
  { key: 'score completo', weights: EMPTY_ABLATIONS },
  { key: 'so forma', weights: { ...ZERO_POSITION, ...ZERO_BALANCE, ...ZERO_MATCH } },
  { key: 'so posicao', weights: { ...ZERO_FORM, ...ZERO_BALANCE, ...ZERO_MATCH } },
  { key: 'so saldo', weights: { ...ZERO_FORM, ...ZERO_POSITION, ...ZERO_MATCH } },
]

const cutoffSweep = new Map<number, Record<Split, EdgeTally>>()
const ablationSweep = new Map<string, Record<Split, EdgeTally>>()

function sweepEntry<K, T>(map: Map<K, T>, key: K, make: () => T): T {
  const current = map.get(key)
  if (current) return current
  const fresh = make()
  map.set(key, fresh)
  return fresh
}

function newEdgeTally(): EdgeTally {
  return { n: 0, wins: 0, homeN: 0, awayN: 0 }
}

function registerEdge(tally: EdgeTally, won: boolean, pickedIsHome: boolean) {
  tally.n += 1
  if (won) tally.wins += 1
  if (pickedIsHome) tally.homeN += 1
  else tally.awayN += 1
}

function band(score: number): string {
  if (score < 40) return '28-39'
  if (score < 55) return '40-54'
  return '55+'
}

function bump(map: Map<string, { n: number; wins: number }>, key: string, won: boolean) {
  const current = map.get(key) ?? { n: 0, wins: 0 }
  current.n += 1
  if (won) current.wins += 1
  map.set(key, current)
}

async function main() {
  console.log(`Backtest do hype score — temporada ${SEASON} (fonte: ESPN)\n`)
  console.log(
    'nota: a tabela zera na virada de temporada (a ESPN manda o ano da temporada);\n' +
      'sem isso a Europa acumularia pontos de 2025-26 na tabela de 2026-27\n'
  )

  for (const [leagueId, slug, leagueName] of LEAGUES) {
    let matches: EspnMatch[] = []
    try {
      matches = seasonFinished(await fetchLeagueSeason(slug, SEASON))
    } catch (error) {
      console.log(`  ${leagueId}: falhou (${error instanceof Error ? error.message : error})`)
      continue
    }

    const finished = matches

    const state = new Map<string, TeamState>()
    let seasonAtual: number | null = null
    let eligible = 0

    // Metade de cada liga marca a fronteira ajuste/validacao (sem espiar o fim).
    const medianDate = finished.length
      ? String(finished[Math.floor(finished.length / 2)].date)
      : ''

    for (const match of finished) {
      const matchSeason = match.season ?? null
      if (matchSeason !== null && seasonAtual !== null && matchSeason !== seasonAtual) {
        state.clear()
      }
      if (matchSeason !== null) seasonAtual = matchSeason

      const homeState = state.get(match.home)
      const awayState = state.get(match.away)
      const ready =
        (homeState?.played ?? 0) >= MIN_PLAYED && (awayState?.played ?? 0) >= MIN_PLAYED
      const split: Split = String(match.date) < medianDate ? 'fit' : 'validate'

      const scoreHome = match.score_home as number
      const scoreAway = match.score_away as number

      if (ready) {
        eligible += 1

        // Previsao com o estado de ANTES do jogo.
        const table = buildTable(state)
        const posOf = new Map(table.map((row) => [row.team, row.pos]))

        const board = buildHypeBoard(
          [
            {
              league_id: match.league_id,
              league_name: leagueName,
              home: match.home,
              away: match.away,
              status: 'TIMED',
            },
          ],
          { [match.league_id]: table },
          { [match.league_id]: leagueName }
        )

        const homeItem = board.find((item) => item.team === match.home)
        const awayItem = board.find((item) => item.team === match.away)

        const homeWon = scoreHome > scoreAway
        const awayWon = scoreAway > scoreHome

        // Ancoragem independente do hype: o melhor colocado da tabela vence
        // quanto, nestes mesmos jogos? E contra isso que o marcado tem que se
        // comparar, nao contra a media crua do mando.
        const homePos = posOf.get(match.home)
        const awayPos = posOf.get(match.away)
        if (homePos && awayPos && homePos !== awayPos) {
          const betterIsHome = homePos < awayPos
          const betterWon = betterIsHome ? homeWon : awayWon
          betterPlaced.n += 1
          if (betterWon) betterPlaced.wins += 1
          if (betterIsHome) {
            betterPlaced.homeN += 1
            if (betterWon) betterPlaced.winsHome += 1
          } else {
            betterPlaced.awayN += 1
            if (betterWon) betterPlaced.winsAway += 1
          }
        }

        baseline.n += 1
        if (homeWon) baseline.home += 1
        else if (awayWon) baseline.away += 1
        else baseline.draw += 1
        baselineSplit[split].n += 1
        if (homeWon) baselineSplit[split].home += 1
        else if (awayWon) baselineSplit[split].away += 1
        else baselineSplit[split].draw += 1

        if (homeItem && awayItem) {
          bothFlagged.n += 1
          if (homeItem.score === awayItem.score) {
            bothFlagged.draws += 1
          } else {
            const higher = homeItem.score > awayItem.score ? homeItem : awayItem
            const higherWon = higher.team === match.home ? homeWon : awayWon
            const lowerWon = higher.team === match.home ? awayWon : homeWon
            if (higherWon) bothFlagged.higherWins += 1
            else if (lowerWon) bothFlagged.lowerWins += 1
            else bothFlagged.draws += 1
          }
        } else if (homeItem || awayItem) {
          const flagged = (homeItem ?? awayItem) as { team: string; score: number }
          const flaggedIsHome = flagged.team === match.home
          const flaggedWon = flaggedIsHome ? homeWon : awayWon
          const drew = scoreHome === scoreAway

          flaggedOnly.n += 1
          if (flaggedWon) flaggedOnly.wins += 1
          else if (drew) flaggedOnly.draws += 1
          else flaggedOnly.losses += 1

          if (flaggedIsHome) {
            flaggedOnly.atHome.n += 1
            if (flaggedWon) flaggedOnly.atHome.wins += 1
          } else {
            flaggedOnly.away.n += 1
            if (flaggedWon) flaggedOnly.away.wins += 1
          }

          bump(byScore, band(flagged.score), flaggedWon)

          const flaggedPos = posOf.get(flagged.team) ?? null
          const opponentPos = posOf.get(flaggedIsHome ? match.away : match.home) ?? null
          if (flaggedPos && opponentPos) {
            const edge =
              flaggedPos < opponentPos
                ? 'marcado MELHOR colocado'
                : flaggedPos > opponentPos
                  ? 'marcado PIOR colocado'
                  : 'mesma posicao'
            bumpEdge(edge, flaggedWon, flaggedIsHome)
          }
        }

        // --- varredura de corte: uma chamada com minScore 0 devolve todos os
        // itens com score, entao cada corte candidato vira um filtro. Testa o
        // codigo real, sem reimplementar a conta nem repetir o replay. ---
        const allItems = buildHypeBoard(
          [
            {
              league_id: match.league_id,
              league_name: leagueName,
              home: match.home,
              away: match.away,
              status: 'TIMED',
            },
          ],
          { [match.league_id]: table },
          { [match.league_id]: leagueName },
          { minScore: 0 }
        )
        const allHome = allItems.find((item) => item.team === match.home)
        const allAway = allItems.find((item) => item.team === match.away)

        for (const cutoff of CUTOFFS) {
          const flaggedHome = Boolean(allHome && allHome.score >= cutoff)
          const flaggedAway = Boolean(allAway && allAway.score >= cutoff)
          if (flaggedHome === flaggedAway) continue
          const pickedIsHome = flaggedHome
          registerEdge(
            sweepEntry(cutoffSweep, cutoff, () => ({
              fit: newEdgeTally(),
              validate: newEdgeTally(),
            }))[split],
            pickedIsHome ? homeWon : awayWon,
            pickedIsHome
          )
        }

        // --- ablacao: qual sinal carrega o score sozinho ---
        for (const variant of ABLATIONS) {
          const items = buildHypeBoard(
            [
              {
                league_id: match.league_id,
                league_name: leagueName,
                home: match.home,
                away: match.away,
                status: 'TIMED',
              },
            ],
            { [match.league_id]: table },
            { [match.league_id]: leagueName },
            { minScore: 0, weights: variant.weights }
          )
          const sideHome = items.find((item) => item.team === match.home)
          const sideAway = items.find((item) => item.team === match.away)
          if (!sideHome || !sideAway) continue
          if (sideHome.score === sideAway.score) continue
          const pickedIsHome = sideHome.score > sideAway.score
          registerEdge(
            sweepEntry(ablationSweep, variant.key, () => ({
              fit: newEdgeTally(),
              validate: newEdgeTally(),
            }))[split],
            pickedIsHome ? homeWon : awayWon,
            pickedIsHome
          )
        }
      }

      applyResult(state, match.home, scoreHome, scoreAway)
      applyResult(state, match.away, scoreAway, scoreHome)
    }

    perLeague.push({ league: leagueId, finished: finished.length, eligible })
  }

  console.log('=== AMOSTRA ===')
  for (const row of perLeague) {
    console.log(
      `  ${row.league.padEnd(5)} ${String(row.finished).padStart(4)} jogos finalizados | ` +
        `${String(row.eligible).padStart(4)} elegiveis (ambos com >= ${MIN_PLAYED} jogos)`
    )
  }
  const totalFinished = perLeague.reduce((sum, r) => sum + r.finished, 0)
  console.log(`  TOTAL ${String(totalFinished).padStart(4)} jogos | ${baseline.n} elegiveis\n`)

  console.log('=== BASELINE (os mesmos jogos elegiveis) ===')
  console.log(
    `  casa vence ${pct(baseline.home, baseline.n)} | empate ${pct(baseline.draw, baseline.n)} | ` +
      `fora vence ${pct(baseline.away, baseline.n)}  (n=${baseline.n})\n`
  )

  const homeBase = baseline.n ? baseline.home / baseline.n : 0
  const awayBase = baseline.n ? baseline.away / baseline.n : 0

  if (MIN_HYPE_SCORE !== 28) {
    console.log(`  [aviso] corte do produto mudou para ${MIN_HYPE_SCORE}; os rotulos abaixo assumem 28\n`)
  }

  console.log(`=== SO UM LADO MARCADO (score >= ${MIN_HYPE_SCORE}) ===`)
  if (flaggedOnly.n < MIN_SAMPLE) {
    console.log(`  amostra insuficiente (n=${flaggedOnly.n} < ${MIN_SAMPLE}) — nao concluo nada aqui\n`)
  } else {
    console.log(
      `  lado marcado: vence ${pct(flaggedOnly.wins, flaggedOnly.n)} | ` +
        `empata ${pct(flaggedOnly.draws, flaggedOnly.n)} | ` +
        `perde ${pct(flaggedOnly.losses, flaggedOnly.n)}  (n=${flaggedOnly.n})`
    )
    const homeHit = flaggedOnly.atHome.n ? flaggedOnly.atHome.wins / flaggedOnly.atHome.n : 0
    const awayHit = flaggedOnly.away.n ? flaggedOnly.away.wins / flaggedOnly.away.n : 0
    console.log(
      `    marcado em casa: vence ${pct(flaggedOnly.atHome.wins, flaggedOnly.atHome.n)} ` +
        `vs baseline casa ${(homeBase * 100).toFixed(1)}% ` +
        `(lift ${((homeHit - homeBase) * 100).toFixed(1)}pp, n=${flaggedOnly.atHome.n})`
    )
    console.log(
      `    marcado fora:    vence ${pct(flaggedOnly.away.wins, flaggedOnly.away.n)} ` +
        `vs baseline fora ${(awayBase * 100).toFixed(1)}% ` +
        `(lift ${((awayHit - awayBase) * 100).toFixed(1)}pp, n=${flaggedOnly.away.n})\n`
    )
  }

  console.log('=== POR VALOR DO SCORE (so um lado marcado) ===')
  for (const key of ['28-39', '40-54', '55+']) {
    const row = byScore.get(key)
    if (!row || row.n < 30) {
      console.log(`  ${key.padEnd(6)} amostra insuficiente (n=${row?.n ?? 0})`)
      continue
    }
    console.log(`  ${key.padEnd(6)} vence ${pct(row.wins, row.n)}  (n=${row.n})`)
  }
  console.log()

  console.log('=== CONTROLE DE VIES: POSICAO RELATIVA AO ADVERSARIO ===')
  console.log('  esperado = media do mando nesses mesmos jogos (casa/fora), nao um numero unico')
  const anchorHome = betterPlaced.homeN ? betterPlaced.winsHome / betterPlaced.homeN : 0
  const anchorAway = betterPlaced.awayN ? betterPlaced.winsAway / betterPlaced.awayN : 0
  if (betterPlaced.n >= MIN_SAMPLE) {
    console.log(
      `  ancora SEM hype (o melhor colocado vence): ${pct(betterPlaced.wins, betterPlaced.n)} ` +
        `| casa ${pct(betterPlaced.winsHome, betterPlaced.homeN)} ` +
        `| fora ${pct(betterPlaced.winsAway, betterPlaced.awayN)} (n=${betterPlaced.n})`
    )
  }
  for (const key of ['marcado MELHOR colocado', 'marcado PIOR colocado', 'mesma posicao']) {
    const row = byEdge.get(key)
    if (!row || row.n < 30) {
      console.log(`  ${key}: amostra insuficiente (n=${row?.n ?? 0})`)
      continue
    }
    const expected = (row.homeN * homeBase + row.awayN * awayBase) / row.n
    const actual = row.wins / row.n
    console.log(
      `  ${key}: vence ${pct(row.wins, row.n)} | esperado ${(expected * 100).toFixed(1)}% | ` +
        `lift ${((actual - expected) * 100).toFixed(1)}pp  (n=${row.n})`
    )
    // O teste duro: o marcado que esta MELHOR colocado vence mais do que um
    // melhor colocado qualquer venceria? Se nao, o score so repetiu a tabela.
    if (key === 'marcado MELHOR colocado' && betterPlaced.n >= MIN_SAMPLE) {
      const anchor = (row.homeN * anchorHome + row.awayN * anchorAway) / row.n
      console.log(
        `      ancorado no melhor colocado: ${(anchor * 100).toFixed(1)}% esperado vs ` +
          `${(actual * 100).toFixed(1)}% real -> ${((actual - anchor) * 100).toFixed(1)}pp`
      )
    }
  }
  console.log()

  console.log('=== OS DOIS LADOS MARCADOS ===')
  if (bothFlagged.n < MIN_SAMPLE) {
    console.log(`  amostra insuficiente (n=${bothFlagged.n} < ${MIN_SAMPLE})\n`)
  } else {
    console.log(
      `  maior score vence ${pct(bothFlagged.higherWins, bothFlagged.n)} | ` +
        `empate ${pct(bothFlagged.draws, bothFlagged.n)} | ` +
        `menor score vence ${pct(bothFlagged.lowerWins, bothFlagged.n)}  (n=${bothFlagged.n})`
    )
  }

  console.log('=== VARREDURA DE CORTE (MIN_HYPE_SCORE) ===')
  console.log('  ajuste = 1a metade de cada liga | validacao = 2a metade')
  console.log(
    `  baseline ajuste: casa ${pct(baselineSplit.fit.home, baselineSplit.fit.n)} / ` +
      `fora ${pct(baselineSplit.fit.away, baselineSplit.fit.n)} (n=${baselineSplit.fit.n})`
  )
  console.log(
    `  baseline validacao: casa ${pct(baselineSplit.validate.home, baselineSplit.validate.n)} / ` +
      `fora ${pct(baselineSplit.validate.away, baselineSplit.validate.n)} (n=${baselineSplit.validate.n})`
  )
  console.log('  corte |  ajuste            |  validacao         | card em')
  for (const cutoff of CUTOFFS) {
    const row = cutoffSweep.get(cutoff)
    if (!row) continue
    const fit = row.fit
    const val = row.validate
    const cardRate = baseline.n ? ((fit.n + val.n) / baseline.n) * 100 : 0
    console.log(
      `  ${String(cutoff).padStart(4)}  | ${pct(fit.wins, fit.n).padStart(6)} (n=${String(fit.n).padStart(4)}) | ` +
        `${pct(val.wins, val.n).padStart(6)} (n=${String(val.n).padStart(4)}) | ${cardRate.toFixed(1)}%`
    )
  }
  console.log()

  console.log('=== ABLACAO: QUAL SINAL CARREGA O SCORE ===')
  console.log('  regra: fica com o lado de maior score; so jogos em que os dois tem sinal')
  for (const variant of ABLATIONS) {
    const row = ablationSweep.get(variant.key)
    if (!row) continue
    for (const split of ['fit', 'validate'] as Split[]) {
      const tally = row[split]
      const expected = splitExpected(split, tally)
      const actual = tally.n ? tally.wins / tally.n : 0
      const lift =
        tally.n >= 30 ? `${((actual - expected) * 100).toFixed(1)}pp` : 'amostra baixa'
      console.log(
        `  ${variant.key.padEnd(15)} ${split.padEnd(8)} vence ${pct(tally.wins, tally.n).padStart(6)} | ` +
          `esperado ${(expected * 100).toFixed(1)}% | lift ${lift} (n=${tally.n})`
      )
    }
  }
  console.log()

  console.log('\n=== LEITURA ===')
  console.log('  Baseline e a media dos mesmos jogos. Lift positivo no mando certo e o unico')
  console.log('  sinal de valor: se o time marcado vence mais em casa E fora, o score agrega;')
  console.log('  se so em casa, o que mexe e o mando, nao o hype.')
}

main().catch((error) => {
  console.error('backtest falhou:', error)
  process.exit(1)
})
