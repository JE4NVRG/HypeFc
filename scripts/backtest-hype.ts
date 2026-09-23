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
import { buildHypeBoard, MIN_HYPE_SCORE, type HypeTableRow } from '../src/lib/hypeScore.ts'
import { parseEspnMatches, type EspnMatch } from '../src/lib/espnParse.ts'

const SEASON = 2026
const LEAGUES: Array<[string, string, string]> = [
  ['BSA', 'bra.1', 'Brasileirao'],
  ['PL', 'eng.1', 'Premier League'],
  ['PD', 'esp.1', 'La Liga'],
  ['SA', 'ita.1', 'Serie A'],
  ['BL1', 'ger.1', 'Bundesliga'],
  ['FL1', 'fra.1', 'Ligue 1'],
  ['PPL', 'por.1', 'Primeira Liga'],
  ['DED', 'ned.1', 'Eredivisie'],
]

/** Um time so entra na conta depois de ter forma minima acumulada. */
const MIN_PLAYED = 5
/** Abaixo disso eu me recuso a tirar conclusao. */
const MIN_SAMPLE = 100

const HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'HypeFC/0.1 (+https://github.com/JE4NVRG/HypeFc)',
}

interface TeamState {
  played: number
  points: number
  gf: number
  ga: number
  results: string[]
}

async function fetchLeagueSeason(slug: string): Promise<EspnMatch[]> {
  const url =
    `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard` +
    `?dates=${SEASON}&limit=500`
  const res = await fetch(url, { headers: HEADERS })
  if (!res.ok) throw new Error(`${slug}: HTTP ${res.status}`)
  const payload = await res.json()
  return parseEspnMatches(payload, slug, slug)
}

/** Ordena como uma tabela de verdade: pontos, saldo, gols pro, nome. */
function buildTable(state: Map<string, TeamState>): HypeTableRow[] {
  const rows = [...state.entries()]
    .filter(([, s]) => s.played > 0)
    .map(([team, s]) => ({ team, played: s.played, points: s.points, gd: s.gf - s.ga, gf: s.gf }))

  rows.sort(
    (a, b) =>
      b.points - a.points ||
      b.gd - a.gd ||
      b.gf - a.gf ||
      a.team.localeCompare(b.team)
  )

  return rows.map((row, index) => ({
    team: row.team,
    pos: index + 1,
    played: row.played,
    form: (state.get(row.team)?.results ?? []).slice(-5).join(''),
    goalDifference: row.gd,
  }))
}

function applyResult(state: Map<string, TeamState>, team: string, scored: number, conceded: number) {
  const current =
    state.get(team) ?? { played: 0, points: 0, gf: 0, ga: 0, results: [] as string[] }
  current.played += 1
  current.gf += scored
  current.ga += conceded
  if (scored > conceded) {
    current.points += 3
    current.results.push('W')
  } else if (scored === conceded) {
    current.points += 1
    current.results.push('D')
  } else {
    current.results.push('L')
  }
  state.set(team, current)
}

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

const baseline = newTally()
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

function bumpEdge(key: string, won: boolean, isHome: boolean) {
  const current = byEdge.get(key) ?? { n: 0, wins: 0, homeN: 0, awayN: 0 }
  current.n += 1
  if (won) current.wins += 1
  if (isHome) current.homeN += 1
  else current.awayN += 1
  byEdge.set(key, current)
}

const perLeague: Array<{ league: string; finished: number; eligible: number }> = []

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

  for (const [leagueId, slug, leagueName] of LEAGUES) {
    let matches: EspnMatch[] = []
    try {
      matches = await fetchLeagueSeason(slug)
    } catch (error) {
      console.log(`  ${leagueId}: falhou (${error instanceof Error ? error.message : error})`)
      continue
    }

    const finished = matches
      .filter((m) => m.status === 'FINISHED' && m.score_home !== null && m.score_away !== null)
      .filter((m) => Boolean(m.date))
      .sort((a, b) => String(a.date).localeCompare(String(b.date)))

    const state = new Map<string, TeamState>()
    let eligible = 0

    for (const match of finished) {
      const homeState = state.get(match.home)
      const awayState = state.get(match.away)
      const ready =
        (homeState?.played ?? 0) >= MIN_PLAYED && (awayState?.played ?? 0) >= MIN_PLAYED

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

        baseline.n += 1
        if (homeWon) baseline.home += 1
        else if (awayWon) baseline.away += 1
        else baseline.draw += 1

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

  console.log('\n=== LEITURA ===')
  console.log('  Baseline e a media dos mesmos jogos. Lift positivo no mando certo e o unico')
  console.log('  sinal de valor: se o time marcado vence mais em casa E fora, o score agrega;')
  console.log('  se so em casa, o que mexe e o mando, nao o hype.')
}

main().catch((error) => {
  console.error('backtest falhou:', error)
  process.exit(1)
})
