/**
 * Replay cronologico da temporada — base do backtest e do recorde publico.
 *
 * A regra que nao pode mudar: a tabela de um momento so pode conter jogos
 * anteriores a esse momento. Sem isso todo numero publicado vira hindsight.
 */
import { parseEspnMatches, type EspnMatch } from '../../src/lib/espnParse.ts'
import type { HypeTableRow } from '../../src/lib/hypeScore.ts'

export const HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'HypeFC/0.2 (+https://github.com/JE4NVRG/HypeFc)',
}

/** [id interno, slug da ESPN, nome] */
export const LEAGUES: Array<[string, string, string]> = [
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
export const MIN_PLAYED = 5

export interface TeamState {
  played: number
  points: number
  gf: number
  ga: number
  results: string[]
}

export async function fetchLeagueSeason(slug: string, year: number): Promise<EspnMatch[]> {
  const url =
    `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard` +
    `?dates=${year}&limit=500`
  const res = await fetch(url, { headers: HEADERS })
  if (!res.ok) throw new Error(`${slug}: HTTP ${res.status}`)
  return parseEspnMatches(await res.json(), slug, slug)
}

/** Ordena como uma tabela de verdade: pontos, saldo, gols pro, nome. */
export function buildTable(state: Map<string, TeamState>): HypeTableRow[] {
  const rows = Array.from(state.entries())
    .filter(([, s]) => s.played > 0)
    .map(([team, s]) => ({
      team,
      played: s.played,
      points: s.points,
      gd: s.gf - s.ga,
      gf: s.gf,
    }))

  rows.sort(
    (a, b) =>
      b.points - a.points || b.gd - a.gd || b.gf - a.gf || a.team.localeCompare(b.team)
  )

  return rows.map((row, index) => ({
    team: row.team,
    pos: index + 1,
    played: row.played,
    form: (state.get(row.team)?.results ?? []).slice(-5).join(''),
    goalDifference: row.gd,
  }))
}

export function applyResult(
  state: Map<string, TeamState>,
  team: string,
  scored: number,
  conceded: number
): void {
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

/** Jogos com placar, com data, em ordem cronologica. */
export function seasonFinished(matches: EspnMatch[]): EspnMatch[] {
  return matches
    .filter((m) => m.status === 'FINISHED' && m.score_home !== null && m.score_away !== null)
    .filter((m) => Boolean(m.date))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
}

/** 'YYYY-MM-DD' do ISO da ESPN, no fuso de Sao Paulo. */
export function dayOf(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return String(iso).slice(0, 10)
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}
