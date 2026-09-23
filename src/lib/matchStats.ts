export interface MatchStats {
  possession_home: number | null
  possession_away: number | null
  shots_home: number | null
  shots_away: number | null
  shots_on_target_home: number | null
  shots_on_target_away: number | null
  corners_home: number | null
  corners_away: number | null
  fouls_home: number | null
  fouls_away: number | null
  source: 'espn'
}

export interface EspnFixture {
  home: string
  away: string
  stats: MatchStats
}

const STOP = new Set(['fc', 'sc', 'se', 'ec', 'cf', 'ac', 'afc', 'club', 'de', 'da', 'do', 'the'])

export function normalizeTeamName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function tokens(name: string): string[] {
  return normalizeTeamName(name)
    .split(' ')
    .filter((token) => token.length > 2 && !STOP.has(token))
}

export function teamsMatch(left: string, right: string): boolean {
  const a = tokens(left)
  const b = tokens(right)
  if (!a.length || !b.length) return false
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a]
  return shorter.every((token) => longer.includes(token))
}

function readStat(stats: Array<{ name?: string; displayValue?: string }> | undefined, name: string): number | null {
  const item = stats?.find((stat) => stat.name === name)
  if (!item || item.displayValue == null || item.displayValue === '') return null
  const value = Number(item.displayValue)
  return Number.isFinite(value) ? value : null
}

export function parseEspnScoreboard(payload: {
  events?: Array<{
    competitions?: Array<{
      competitors?: Array<{
        homeAway?: string
        team?: { displayName?: string; name?: string }
        statistics?: Array<{ name?: string; displayValue?: string }>
      }>
    }>
  }>
}): EspnFixture[] {
  const fixtures: EspnFixture[] = []
  for (const event of payload.events || []) {
    const competitors = event.competitions?.[0]?.competitors || []
    const home = competitors.find((side) => side.homeAway === 'home')
    const away = competitors.find((side) => side.homeAway === 'away')
    if (!home || !away) continue
    const homeName = home.team?.displayName || home.team?.name
    const awayName = away.team?.displayName || away.team?.name
    if (!homeName || !awayName) continue
    const stats: MatchStats = {
      possession_home: readStat(home.statistics, 'possessionPct'),
      possession_away: readStat(away.statistics, 'possessionPct'),
      shots_home: readStat(home.statistics, 'totalShots'),
      shots_away: readStat(away.statistics, 'totalShots'),
      shots_on_target_home: readStat(home.statistics, 'shotsOnTarget'),
      shots_on_target_away: readStat(away.statistics, 'shotsOnTarget'),
      corners_home: readStat(home.statistics, 'wonCorners'),
      corners_away: readStat(away.statistics, 'wonCorners'),
      fouls_home: readStat(home.statistics, 'foulsCommitted'),
      fouls_away: readStat(away.statistics, 'foulsCommitted'),
      source: 'espn',
    }
    if (stats.possession_home == null && stats.shots_home == null) continue
    fixtures.push({ home: homeName, away: awayName, stats })
  }
  return fixtures
}

export function attachMatchStats<T extends { home: string; away: string }>(
  matches: T[],
  fixtures: EspnFixture[]
): Array<T & { match_stats: MatchStats | null }> {
  return matches.map((match) => {
    const fixture = fixtures.find((item) =>
      (teamsMatch(match.home, item.home) && teamsMatch(match.away, item.away)) ||
      (teamsMatch(match.home, item.away) && teamsMatch(match.away, item.home))
    )
    if (!fixture) return { ...match, match_stats: null }
    const swapped = teamsMatch(match.home, fixture.away) && !teamsMatch(match.home, fixture.home)
    return { ...match, match_stats: swapped ? swapStats(fixture.stats) : fixture.stats }
  })
}

function swapStats(stats: MatchStats): MatchStats {
  return {
    possession_home: stats.possession_away,
    possession_away: stats.possession_home,
    shots_home: stats.shots_away,
    shots_away: stats.shots_home,
    shots_on_target_home: stats.shots_on_target_away,
    shots_on_target_away: stats.shots_on_target_home,
    corners_home: stats.corners_away,
    corners_away: stats.corners_home,
    fouls_home: stats.fouls_away,
    fouls_away: stats.fouls_home,
    source: 'espn',
  }
}
