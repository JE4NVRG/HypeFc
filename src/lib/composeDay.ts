import { buildHypeBoard, computeDayStats, type DayStats, type HypeBoardItem } from '@/lib/hypeScore'
import { buildTeamFormIndex, lookupTeamForm, normalizeTeamKey, type EspnTeamMeta } from '@/lib/espnParse'
import { LEAGUE_NAMES } from '@/types'
import type { StandingRow, TodayMatch } from '@/services/footballApi'

export interface ComposedDay {
  matches: TodayMatch[]
  hype: HypeBoardItem[]
  stats: DayStats
}

/**
 * A tabela da ESPN nao traz forma. Ela vem do ultimo dia com jogos e e casada
 * por id (exato) e por apelido normalizado, porque o nome do time muda entre
 * o scoreboard e a tabela (ex.: "Athletico-PR" x "Athletico Paranaense").
 */
export function applyForm(standingsMap: Record<string, StandingRow[]>, metas: EspnTeamMeta[]): void {
  if (!metas.length) return
  const index = buildTeamFormIndex(metas)
  for (const table of Object.values(standingsMap)) {
    for (const row of table) {
      if (row.form) continue
      const form = lookupTeamForm(index, row)
      if (form) row.form = form
    }
  }
}

function indexTable(table: StandingRow[]): Map<string, StandingRow> {
  const index = new Map<string, StandingRow>()
  for (const row of table) {
    if (row.espn_abbr) {
      const abbrKey = `abbr:${row.espn_abbr.toUpperCase()}`
      if (!index.has(abbrKey)) index.set(abbrKey, row)
    }
    for (const alias of [row.team, row.espn_short]) {
      const key = normalizeTeamKey(alias)
      if (key && !index.has(key)) index.set(key, row)
    }
  }
  return index
}

export function enrichPositions(
  matches: TodayMatch[],
  standingsMap: Record<string, StandingRow[]>
): TodayMatch[] {
  const indexes: Record<string, Map<string, StandingRow>> = {}
  for (const [leagueId, table] of Object.entries(standingsMap)) {
    indexes[leagueId] = indexTable(table)
  }
  return matches.map((match) => {
    const index = indexes[match.league_id]
    if (!index) return match
    const homeRow = index.get(normalizeTeamKey(match.home))
    const awayRow = index.get(normalizeTeamKey(match.away))
    return {
      ...match,
      home_position: homeRow?.pos ?? match.home_position ?? null,
      away_position: awayRow?.pos ?? match.away_position ?? null,
    }
  })
}

export function composeDay(
  matches: TodayMatch[],
  standingsMap: Record<string, StandingRow[]>,
  metas: EspnTeamMeta[] = []
): ComposedDay {
  applyForm(standingsMap, metas)
  const enriched = enrichPositions(matches, standingsMap)
  return {
    matches: enriched,
    hype: buildHypeBoard(enriched, standingsMap, LEAGUE_NAMES),
    stats: computeDayStats(enriched),
  }
}
