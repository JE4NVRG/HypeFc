/**
 * Confrontos diretos (H2H), forma recente e rendimento por mando.
 *
 * Modulo PURO: nao importa nada de src/ para poder rodar direto no node
 * (--experimental-strip-types), onde os aliases @/ nao resolvem. A interface
 * H2HMatch e estrutural e minima — descreve so o que as tres funcoes usam.
 *
 * Regra transversal: so jogo FINISHED com placar nos dois lados conta. Jogo
 * agendado, ao vivo ou com placar null nunca entra em nenhuma conta.
 */

export interface H2HMatch {
  home: string
  away: string
  score_home: number | null
  score_away: number | null
  status: string
  date?: string | null
  league_id?: string
}

export interface H2HMeeting {
  date: string | null
  home: string
  away: string
  score_home: number
  score_away: number
  winner: 'home' | 'away' | 'draw'
}

export interface TeamFormGame {
  date: string | null
  opponent: string
  home: boolean
  result: 'W' | 'D' | 'L'
  goals_for: number
  goals_against: number
}

export interface VenueSplit {
  team: string
  venue: 'home' | 'away'
  played: number
  wins: number
  draws: number
  losses: number
  goals_for: number
  goals_against: number
  points_per_game: number
}

/** Mais recente primeiro; sem data vai para o fim (e stable, preserva entrada). */
function byDateDesc<T extends { sort: string }>(a: T, b: T): number {
  return b.sort.localeCompare(a.sort)
}

function isPlayed(match: H2HMatch): boolean {
  return (
    match.status === 'FINISHED' &&
    match.score_home !== null &&
    match.score_away !== null &&
    match.score_home !== undefined &&
    match.score_away !== undefined
  )
}

/** Arredonda a 2 casas; 0 quando nao houve jogo (nunca divide por zero). */
function ppg(points: number, played: number): number {
  if (played <= 0) return 0
  return Math.round((points / played) * 100) / 100
}

function resultFor(scored: number, conceded: number): 'W' | 'D' | 'L' {
  if (scored > conceded) return 'W'
  if (scored < conceded) return 'L'
  return 'D'
}

/**
 * Confrontos diretos entre os dois times, em qualquer mando, do mais recente
 * para o mais antigo. `limit` default 5.
 */
export function buildH2H(
  matches: H2HMatch[],
  teamA: string,
  teamB: string,
  limit = 5
): H2HMeeting[] {
  const meetings: Array<H2HMeeting & { sort: string }> = []

  for (const match of matches) {
    if (!isPlayed(match)) continue

    const isA = match.home === teamA && match.away === teamB
    const isB = match.home === teamB && match.away === teamA
    if (!isA && !isB) continue

    const scoreHome = match.score_home as number
    const scoreAway = match.score_away as number
    const winner: H2HMeeting['winner'] =
      scoreHome > scoreAway ? 'home' : scoreHome < scoreAway ? 'away' : 'draw'

    meetings.push({
      date: match.date ?? null,
      home: match.home,
      away: match.away,
      score_home: scoreHome,
      score_away: scoreAway,
      winner,
      sort: match.date ?? '',
    })
  }

  meetings.sort(byDateDesc)

  return meetings.slice(0, limit).map(({ sort: _sort, ...meeting }) => meeting)
}

/**
 * Ultimos jogos do time (casa ou fora), com o resultado do ponto de vista
 * dele. `limit` default 5.
 */
export function buildTeamForm(matches: H2HMatch[], team: string, limit = 5): TeamFormGame[] {
  const games: Array<TeamFormGame & { sort: string }> = []

  for (const match of matches) {
    if (!isPlayed(match)) continue

    const atHome = match.home === team
    const atAway = match.away === team
    if (!atHome && !atAway) continue

    const scoreHome = match.score_home as number
    const scoreAway = match.score_away as number
    const goalsFor = atHome ? scoreHome : scoreAway
    const goalsAgainst = atHome ? scoreAway : scoreHome

    games.push({
      date: match.date ?? null,
      opponent: atHome ? match.away : match.home,
      home: atHome,
      result: resultFor(goalsFor, goalsAgainst),
      goals_for: goalsFor,
      goals_against: goalsAgainst,
      sort: match.date ?? '',
    })
  }

  games.sort(byDateDesc)

  return games.slice(0, limit).map(({ sort: _sort, ...game }) => game)
}

/**
 * Rendimento por mando. Devolve SEMPRE as duas linhas (home e away, nessa
 * ordem), zeradas quando o time nao jogou naquele mando — o painel exibe as
 * duas colunas, entao linha ausente viraria buraco na tela.
 */
export function buildVenueSplit(matches: H2HMatch[], team: string): VenueSplit[] {
  const home = emptySplit(team, 'home')
  const away = emptySplit(team, 'away')

  for (const match of matches) {
    if (!isPlayed(match)) continue

    const scoreHome = match.score_home as number
    const scoreAway = match.score_away as number

    if (match.home === team) {
      applyResult(home, scoreHome, scoreAway)
    } else if (match.away === team) {
      applyResult(away, scoreAway, scoreHome)
    }
  }

  return [home, away]
}

function emptySplit(team: string, venue: 'home' | 'away'): VenueSplit {
  return {
    team,
    venue,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goals_for: 0,
    goals_against: 0,
    points_per_game: 0,
  }
}

function applyResult(row: VenueSplit, scored: number, conceded: number): void {
  row.played += 1
  row.goals_for += scored
  row.goals_against += conceded

  const result = resultFor(scored, conceded)
  if (result === 'W') row.wins += 1
  else if (result === 'D') row.draws += 1
  else row.losses += 1

  // 3 pts por vitoria; recalculado a cada jogo para nunca ficar defasado.
  row.points_per_game = ppg(row.wins * 3 + row.draws, row.played)
}
