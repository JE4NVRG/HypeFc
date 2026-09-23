import { parseEspnScoreboard, type EspnFixture, type MatchStats } from '@/lib/matchStats'
import {
  parseEspnStandings,
  parseEspnMatches,
  parseEspnTeamMeta,
  parseEspnLeaders,
  espnAthleteName,
  espnTeamName,
  type EspnMatch,
  type EspnTeamMeta,
} from '@/lib/espnParse'
import type { StandingRow, TodayMatch, Scorer } from '@/services/footballApi'

export interface EspnDay {
  matches: TodayMatch[]
  metas: EspnTeamMeta[]
}

export const ESPN_LEAGUE_SLUGS: Record<string, string> = {
  BSA: 'bra.1',
  PL: 'eng.1',
  PD: 'esp.1',
  SA: 'ita.1',
  BL1: 'ger.1',
  FL1: 'fra.1',
  DED: 'ned.1',
  PPL: 'por.1',
  ELC: 'eng.2',
  CL: 'uefa.champions',
}

const CORE = 'https://sports.core.api.espn.com/v2/sports/soccer/leagues'
const SITE = 'https://site.api.espn.com/apis'

const HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'HypeFC/0.2 (+https://github.com/JE4NVRG/HypeFc)',
}

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: HEADERS, cache: 'no-store' })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

interface EspnCompetitor {
  homeAway?: string
  team?: { displayName?: string; name?: string; logo?: string }
  statistics?: Array<{ name?: string; displayValue?: string }>
}

interface EspnScoreboardLite {
  events?: Array<{ competitions?: Array<{ competitors?: EspnCompetitor[] }> }>
}

function readStat(stats: EspnCompetitor['statistics'], name: string): number | null {
  const item = (stats || []).find((stat) => stat.name === name)
  if (!item || item.displayValue == null || item.displayValue === '') return null
  const value = Number(item.displayValue)
  return Number.isFinite(value) ? value : null
}

function buildStats(home: EspnCompetitor, away: EspnCompetitor): MatchStats | null {
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
  if (stats.possession_home == null && stats.shots_home == null && stats.corners_home == null) return null
  return stats
}

function shiftIsoDate(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export async function fetchEspnLatestForms(
  leagueId: string,
  fromDateIso: string,
  maxLookback = 6,
  maxDays = 3
): Promise<EspnTeamMeta[]> {
  const slug = ESPN_LEAGUE_SLUGS[leagueId]
  if (!slug) return []

  const seen = new Map<string, EspnTeamMeta>()
  let daysUsed = 0

  for (let offset = 0; offset <= maxLookback && daysUsed < maxDays; offset += 1) {
    const date = shiftIsoDate(fromDateIso, -offset).replace(/-/g, '')
    const payload = await getJson<Parameters<typeof parseEspnTeamMeta>[0]>(
      `${SITE}/site/v2/sports/soccer/${slug}/scoreboard?dates=${date}`
    )
    if (!payload?.events?.length) continue
    daysUsed += 1
    for (const meta of parseEspnTeamMeta(payload)) {
      const key = meta.id || meta.names[0] || ''
      if (!key || seen.has(key)) continue
      seen.set(key, meta)
    }
  }

  return Array.from(seen.values())
}

export async function fetchEspnStandings(leagueId: string): Promise<StandingRow[]> {
  const slug = ESPN_LEAGUE_SLUGS[leagueId]
  if (!slug) throw new Error(`League ${leagueId} not supported by ESPN`)
  const payload = await getJson<Parameters<typeof parseEspnStandings>[0]>(
    `${SITE}/v2/sports/soccer/${slug}/standings`
  )
  if (!payload) throw new Error('ESPN standings unavailable')
  const rows = parseEspnStandings(payload)
  if (!rows.length) throw new Error('ESPN standings empty')
  return rows
}

/**
 * Temporada inteira em uma chamada so.
 *
 * Detalhe importante do endpoint: ele NAO aceita faixa de datas (retorna zero
 * eventos para "20260801-20260923"), mas aceita o ANO em `dates`. E o `limit`
 * precisa ser explicito, senao vem truncado em 100.
 *
 * Como o parametro e o ano-calendario, uma temporada europeia em curso (ago ->
 * mai) atravessa dois deles; por isso a janela padrao cobre o ano atual e o
 * anterior. Sem isso, no meio da temporada europeia o split nao teria os jogos
 * necessarios para bater com a classificacao e seria descartado.
 */
export async function fetchEspnSeason(
  leagueId: string,
  years: number[] = [new Date().getFullYear(), new Date().getFullYear() - 1]
): Promise<EspnMatch[]> {
  const slug = ESPN_LEAGUE_SLUGS[leagueId]
  if (!slug) throw new Error(`League ${leagueId} not supported by ESPN`)

  const pages = await Promise.all(
    years.map((year) =>
      getJson<Parameters<typeof parseEspnMatches>[0]>(
        `${SITE}/site/v2/sports/soccer/${slug}/scoreboard?dates=${year}&limit=500`
      )
    )
  )

  const payloads = pages.filter(Boolean) as Array<Parameters<typeof parseEspnMatches>[0]>
  if (!payloads.length) throw new Error('ESPN season unavailable')

  return payloads.flatMap((payload) => parseEspnMatches(payload, leagueId, leagueId))
}

export async function fetchEspnDay(
  leagueIds: string[],
  dateIso: string,
  leagueNames: Record<string, string>
): Promise<EspnDay> {
  const date = dateIso.replace(/-/g, '')
  const targets = leagueIds.filter((id) => ESPN_LEAGUE_SLUGS[id])

  const boards = await Promise.all(
    targets.map(async (leagueId) => {
      const payload = await getJson<EspnScoreboardLite & Parameters<typeof parseEspnMatches>[0]>(
        `${SITE}/site/v2/sports/soccer/${ESPN_LEAGUE_SLUGS[leagueId]}/scoreboard?dates=${date}`
      )
      if (!payload) return { matches: [] as TodayMatch[], metas: [] as EspnTeamMeta[] }

      const statByPair = new Map<string, MatchStats | null>()
      for (const event of payload.events || []) {
        const competitors = event.competitions?.[0]?.competitors || []
        const home = competitors.find((side) => side.homeAway === 'home')
        const away = competitors.find((side) => side.homeAway === 'away')
        if (!home || !away) continue
        const homeName = home.team?.displayName || ''
        const awayName = away.team?.displayName || ''
        statByPair.set(`${homeName}|${awayName}`, buildStats(home, away))
      }

      const matches = parseEspnMatches(payload, leagueId, leagueNames[leagueId] || leagueId).map((match) => ({
        ...match,
        match_stats: statByPair.get(`${match.home}|${match.away}`) ?? null,
      }))

      return { matches, metas: parseEspnTeamMeta(payload) }
    })
  )

  const matches = boards
    .flatMap((board) => board.matches)
    .sort((a, b) => a.league_name.localeCompare(b.league_name) || a.time_local.localeCompare(b.time_local))

  return { matches, metas: boards.flatMap((board) => board.metas) }
}

async function resolveRefName(ref: string | null, kind: 'athlete' | 'team'): Promise<string> {
  if (!ref) return ''
  const payload = await getJson<{ displayName?: string; fullName?: string; shortName?: string; name?: string }>(ref)
  if (!payload) return ''
  return kind === 'athlete' ? espnAthleteName(payload) : espnTeamName(payload)
}

export async function fetchEspnScorers(leagueId: string, limit = 10): Promise<Scorer[]> {
  const slug = ESPN_LEAGUE_SLUGS[leagueId]
  if (!slug) throw new Error(`League ${leagueId} not supported by ESPN`)
  const year = new Date().getFullYear()
  const payload = await getJson<Parameters<typeof parseEspnLeaders>[0]>(
    `${CORE}/${slug}/seasons/${year}/types/1/leaders`
  )
  if (!payload) throw new Error('ESPN leaders unavailable')

  const goals = parseEspnLeaders(payload, 'goals', limit)
  if (!goals.length) throw new Error('ESPN leaders empty')
  const assists = new Map(
    parseEspnLeaders(payload, 'assists', limit).map((entry) => [entry.athleteRef, entry.value])
  )

  const rows = await Promise.all(
    goals.map(async (entry) => {
      const [player, team] = await Promise.all([
        resolveRefName(entry.athleteRef, 'athlete'),
        resolveRefName(entry.teamRef, 'team'),
      ])
      return {
        player,
        team,
        team_crest: null,
        goals: entry.value,
        assists: assists.get(entry.athleteRef) ?? 0,
        matches: 0,
      }
    })
  )

  return rows.filter((row) => row.player)
}

export async function fetchEspnFixtures(leagueIds: string[], dateIso: string): Promise<EspnFixture[]> {
  const date = dateIso.replace(/-/g, '')
  const slugs = Array.from(new Set(leagueIds.map((id) => ESPN_LEAGUE_SLUGS[id]).filter(Boolean)))
  const boards = await Promise.all(
    slugs.map(async (slug) => {
      const payload = await getJson<Parameters<typeof parseEspnScoreboard>[0]>(
        `${SITE}/site/v2/sports/soccer/${slug}/scoreboard?dates=${date}`
      )
      return payload ? parseEspnScoreboard(payload) : []
    })
  )
  return boards.flat()
}
