export interface TableSide {
  team: string
  crest?: string
  pos?: number
  played: number
  points: number
  goalsFor: number
  goalsAgainst: number
  form?: string | null
}

export interface TeamIntel {
  team: string
  crest: string
  pos: number
  played: number
  points: number
  ppg: number
  goalsFor: number
  goalsAgainst: number
  gfPerGame: number
  gaPerGame: number
  gdPerGame: number
  form: Array<'W' | 'D' | 'L'>
  formPoints: number
  homePpg: number | null
  awayPpg: number | null
  homeBias: number | null
  attackRank: number
  defenseRank: number
  formRank: number
}

export interface LeagueProfile {
  teams: number
  matches: number
  goals: number
  goalsPerMatch: number
  homePointsShare: number | null
  avgHomePpg: number | null
  avgAwayPpg: number | null
}

export interface LeagueLeaders {
  attack: TeamIntel | null
  defense: TeamIntel | null
  homeBias: TeamIntel | null
  form: TeamIntel | null
}

export interface LeagueIntel {
  profile: LeagueProfile
  teams: TeamIntel[]
  leaders: LeagueLeaders
}

const MIN_SPLIT_GAMES = 3

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function perGame(total: number, played: number): number {
  if (!played) return 0
  return round2(total / played)
}

export function parseForm(form: string | null | undefined): Array<'W' | 'D' | 'L'> {
  if (!form) return []
  const letters = form.toUpperCase().match(/[WDL]/g) || []
  return letters.slice(-5) as Array<'W' | 'D' | 'L'>
}

function formPoints(letters: Array<'W' | 'D' | 'L'>): number {
  return letters.reduce((sum, letter) => sum + (letter === 'W' ? 3 : letter === 'D' ? 1 : 0), 0)
}

function byTeam(rows: TableSide[]): Map<string, TableSide> {
  const map = new Map<string, TableSide>()
  for (const row of rows) map.set(row.team, row)
  return map
}

function splitPpg(row: TableSide | undefined): number | null {
  if (!row || row.played < MIN_SPLIT_GAMES) return null
  return perGame(row.points, row.played)
}

function rankBy(teams: TeamIntel[], pick: (team: TeamIntel) => number, direction: 'desc' | 'asc'): Map<string, number> {
  const sorted = [...teams].sort((a, b) => {
    const delta = pick(a) - pick(b)
    if (delta !== 0) return direction === 'desc' ? -delta : delta
    return a.team.localeCompare(b.team)
  })
  const ranks = new Map<string, number>()
  sorted.forEach((team, index) => ranks.set(team.team, index + 1))
  return ranks
}

export function buildLeagueIntel(
  total: TableSide[],
  home: TableSide[] = [],
  away: TableSide[] = []
): LeagueIntel {
  const homeMap = byTeam(home)
  const awayMap = byTeam(away)
  const base: TeamIntel[] = total.map((row) => {
    const homeRow = homeMap.get(row.team)
    const awayRow = awayMap.get(row.team)
    const homePpg = splitPpg(homeRow)
    const awayPpg = splitPpg(awayRow)
    const letters = parseForm(row.form)
    return {
      team: row.team,
      crest: row.crest || '',
      pos: row.pos || 0,
      played: row.played,
      points: row.points,
      ppg: perGame(row.points, row.played),
      goalsFor: row.goalsFor,
      goalsAgainst: row.goalsAgainst,
      gfPerGame: perGame(row.goalsFor, row.played),
      gaPerGame: perGame(row.goalsAgainst, row.played),
      gdPerGame: perGame(row.goalsFor - row.goalsAgainst, row.played),
      form: letters,
      formPoints: formPoints(letters),
      homePpg,
      awayPpg,
      homeBias: homePpg != null && awayPpg != null ? round2(homePpg - awayPpg) : null,
      attackRank: 0,
      defenseRank: 0,
      formRank: 0,
    }
  })

  const qualified = base.filter((team) => team.played > 0)
  const attackRank = rankBy(qualified, (team) => team.gfPerGame, 'desc')
  const defenseRank = rankBy(qualified, (team) => team.gaPerGame, 'asc')
  const formRank = rankBy(qualified, (team) => team.formPoints, 'desc')
  const teams = base.map((team) => ({
    ...team,
    attackRank: attackRank.get(team.team) || 0,
    defenseRank: defenseRank.get(team.team) || 0,
    formRank: formRank.get(team.team) || 0,
  }))

  const played = teams.reduce((sum, team) => sum + team.played, 0)
  const goals = teams.reduce((sum, team) => sum + team.goalsFor, 0)
  const homePoints = home.reduce((sum, row) => sum + row.points, 0)
  const awayPoints = away.reduce((sum, row) => sum + row.points, 0)
  const splitPoints = homePoints + awayPoints
  const homeSamples = teams.filter((team) => team.homePpg != null)
  const awaySamples = teams.filter((team) => team.awayPpg != null)

  const profile: LeagueProfile = {
    teams: teams.length,
    matches: Math.round(played / 2),
    goals,
    goalsPerMatch: played > 0 ? round2((goals * 2) / played) : 0,
    homePointsShare: splitPoints > 0 ? round2(homePoints / splitPoints) : null,
    avgHomePpg: homeSamples.length
      ? round2(homeSamples.reduce((sum, team) => sum + (team.homePpg || 0), 0) / homeSamples.length)
      : null,
    avgAwayPpg: awaySamples.length
      ? round2(awaySamples.reduce((sum, team) => sum + (team.awayPpg || 0), 0) / awaySamples.length)
      : null,
  }

  const withGames = teams.filter((team) => team.played > 0)
  const leaders: LeagueLeaders = {
    attack: [...withGames].sort((a, b) => b.gfPerGame - a.gfPerGame || a.team.localeCompare(b.team))[0] || null,
    defense: [...withGames].sort((a, b) => a.gaPerGame - b.gaPerGame || a.team.localeCompare(b.team))[0] || null,
    homeBias: [...teams]
      .filter((team) => team.homeBias != null)
      .sort((a, b) => (b.homeBias || 0) - (a.homeBias || 0) || a.team.localeCompare(b.team))[0] || null,
    form: [...withGames].sort((a, b) => b.formPoints - a.formPoints || a.team.localeCompare(b.team))[0] || null,
  }

  return { profile, teams, leaders }
}
