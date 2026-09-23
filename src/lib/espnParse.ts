import type { MatchStatus } from '@/types'

export interface EspnStandingRow {
  pos: number
  team: string
  crest: string
  pts: number
  played: number
  wins: number
  draws: number
  losses: number
  form: string | null
  goalDifference: number
  goalsFor: number
  goalsAgainst: number
  espn_id: string
  espn_short: string
  espn_abbr: string
}

export interface EspnTeamMeta {
  id: string
  names: string[]
  short: string
  abbr: string
  form: string | null
}

export interface TeamFormIndex {
  byId: Map<string, string>
  byAbbr: Map<string, string>
  byName: Map<string, string>
}

export function normalizeTeamKey(raw: string | null | undefined): string {
  if (!raw) return ''
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

export function buildTeamFormIndex(metas: EspnTeamMeta[]): TeamFormIndex {
  const byId = new Map<string, string>()
  const byAbbr = new Map<string, string>()
  const byName = new Map<string, string>()
  for (const meta of metas) {
    if (!meta.form) continue
    if (meta.id) byId.set(String(meta.id), meta.form)
    if (meta.abbr) byAbbr.set(meta.abbr.toUpperCase(), meta.form)
    for (const name of meta.names) {
      const key = normalizeTeamKey(name)
      if (key) byName.set(key, meta.form)
    }
    const shortKey = normalizeTeamKey(meta.short)
    if (shortKey) byName.set(shortKey, meta.form)
  }
  return { byId, byAbbr, byName }
}

export function lookupTeamForm(
  index: TeamFormIndex,
  row: { team: string; espn_id?: string; espn_short?: string; espn_abbr?: string }
): string | null {
  if (row.espn_id && index.byId.has(row.espn_id)) return index.byId.get(row.espn_id) ?? null
  if (row.espn_abbr && index.byAbbr.has(row.espn_abbr.toUpperCase())) {
    return index.byAbbr.get(row.espn_abbr.toUpperCase()) ?? null
  }
  const keys = [row.team, row.espn_short].map(normalizeTeamKey).filter(Boolean)
  for (const key of keys) {
    if (index.byName.has(key)) return index.byName.get(key) ?? null
  }
  return null
}

export interface EspnMatch {
  league_id: string
  league_name: string
  home: string
  home_crest: string | null
  home_position: number | null
  away: string
  away_crest: string | null
  away_position: number | null
  /** ISO do inicio. Necessario para ordenar historico (a busca por temporada traz varios dias). */
  date?: string | null
  time_local: string
  status: MatchStatus
  score_home: number | null
  score_away: number | null
}

export interface EspnLeaderEntry {
  athleteRef: string | null
  teamRef: string | null
  value: number
}

const STATUS_BY_STATE: Record<string, MatchStatus> = {
  pre: 'TIMED',
  in: 'IN_PLAY',
  post: 'FINISHED',
}

const STATUS_BY_NAME: Record<string, MatchStatus> = {
  STATUS_SCHEDULED: 'TIMED',
  STATUS_TIMED: 'TIMED',
  STATUS_IN_PROGRESS: 'IN_PLAY',
  STATUS_FIRST_HALF: 'IN_PLAY',
  STATUS_SECOND_HALF: 'IN_PLAY',
  STATUS_HALFTIME: 'PAUSED',
  STATUS_FULL_TIME: 'FINISHED',
  STATUS_FINAL: 'FINISHED',
  STATUS_POSTPONED: 'POSTPONED',
  STATUS_CANCELED: 'CANCELLED',
  STATUS_CANCELLED: 'CANCELLED',
  STATUS_SUSPENDED: 'SUSPENDED',
}

export function mapEspnStatus(name: string | undefined, state: string | undefined): MatchStatus {
  if (name && STATUS_BY_NAME[name]) return STATUS_BY_NAME[name]
  if (state && STATUS_BY_STATE[state]) return STATUS_BY_STATE[state]
  return 'SCHEDULED'
}

function statValue(stats: Array<{ name?: string; value?: number; displayValue?: string }> | undefined, name: string): number {
  const item = stats?.find((stat) => stat.name === name)
  if (!item) return 0
  if (typeof item.value === 'number' && Number.isFinite(item.value)) return item.value
  const parsed = Number(String(item.displayValue ?? '').replace(/[^0-9.+-]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

function signedNumber(raw: unknown): number {
  const parsed = Number(String(raw ?? '').replace(/[^0-9.+-]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

function crestOf(team: { logo?: string; logos?: Array<{ href?: string }> } | undefined): string {
  if (!team) return ''
  if (team.logo) return team.logo
  const list = team.logos || []
  return list[0]?.href || ''
}

interface EspnStandingsPayload {
  children?: Array<{
    standings?: {
      entries?: Array<{
        team?: {
          id?: string
          displayName?: string
          name?: string
          shortDisplayName?: string
          abbreviation?: string
          logo?: string
          logos?: Array<{ href?: string }>
        }
        stats?: Array<{ name?: string; value?: number; displayValue?: string }>
      }>
    }
  }>
}

export function parseEspnStandings(payload: EspnStandingsPayload): EspnStandingRow[] {
  const entries = payload.children?.[0]?.standings?.entries || []
  const rows = entries.map((entry, index) => {
    const stats = entry.stats
    const team = entry.team
    const played = statValue(stats, 'gamesPlayed')
    const goalsFor = statValue(stats, 'pointsFor')
    const goalsAgainst = statValue(stats, 'pointsAgainst')
    const rank = statValue(stats, 'rank')
    return {
      pos: rank || index + 1,
      team: team?.displayName || team?.name || '',
      crest: crestOf(team),
      pts: statValue(stats, 'points'),
      played,
      wins: statValue(stats, 'wins'),
      draws: statValue(stats, 'ties'),
      losses: statValue(stats, 'losses'),
      form: null,
      goalDifference: signedNumber(
        stats?.find((stat) => stat.name === 'pointDifferential')?.displayValue ??
        goalsFor - goalsAgainst
      ),
      goalsFor,
      goalsAgainst,
      espn_id: team?.id || '',
      espn_short: team?.shortDisplayName || '',
      espn_abbr: team?.abbreviation || '',
    }
  })
  return rows.filter((row) => row.team).sort((a, b) => a.pos - b.pos)
}

interface EspnScoreboardPayload {
  events?: Array<{
    date?: string
    status?: { type?: { name?: string; state?: string } }
    competitions?: Array<{
      status?: { type?: { name?: string; state?: string } }
      competitors?: Array<{
        homeAway?: string
        score?: string
        form?: string
        team?: {
          id?: string
          displayName?: string
          name?: string
          shortDisplayName?: string
          abbreviation?: string
          logo?: string
          logos?: Array<{ href?: string }>
        }
      }>
    }>
  }>
}

export function parseEspnTeamMeta(payload: EspnScoreboardPayload): EspnTeamMeta[] {
  const byId = new Map<string, EspnTeamMeta>()
  for (const event of payload.events || []) {
    for (const competition of event.competitions || []) {
      for (const competitor of competition.competitors || []) {
        const team = competitor.team
        if (!team) continue
        const id = String(team.id || '')
        const key = id || team.displayName || ''
        if (!key) continue
        const existing = byId.get(key)
        const form = competitor.form ?? existing?.form ?? null
        if (existing) {
          existing.form = form
          continue
        }
        byId.set(key, {
          id,
          names: [team.displayName, team.name].filter((value): value is string => Boolean(value)),
          short: team.shortDisplayName || '',
          abbr: team.abbreviation || '',
          form,
        })
      }
    }
  }
  return Array.from(byId.values())
}

export function parseEspnMatches(
  payload: EspnScoreboardPayload,
  leagueId: string,
  leagueName: string,
  timeZone = 'America/Sao_Paulo'
): EspnMatch[] {
  const out: EspnMatch[] = []

  for (const event of payload.events || []) {
    const competition = event.competitions?.[0]
    const competitors = competition?.competitors || []
    const home = competitors.find((side) => side.homeAway === 'home')
    const away = competitors.find((side) => side.homeAway === 'away')
    if (!home || !away) continue

    const homeName = home.team?.displayName || home.team?.name
    const awayName = away.team?.displayName || away.team?.name
    if (!homeName || !awayName) continue

    const status = mapEspnStatus(
      competition?.status?.type?.name || event.status?.type?.name,
      competition?.status?.type?.state || event.status?.type?.state
    )
    const started = status === 'IN_PLAY' || status === 'PAUSED' || status === 'FINISHED'
    const kickoff = event.date ? new Date(event.date) : null
    const timeLocal = kickoff && !Number.isNaN(kickoff.getTime())
      ? kickoff.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone })
      : '--:--'

    out.push({
      league_id: leagueId,
      league_name: leagueName,
      home: homeName,
      home_crest: crestOf(home.team) || null,
      home_position: null,
      away: awayName,
      away_crest: crestOf(away.team) || null,
      away_position: null,
      date: event.date ?? null,
      time_local: timeLocal,
      status,
      score_home: started ? Number(home.score ?? 0) : null,
      score_away: started ? Number(away.score ?? 0) : null,
    })
  }

  return out.sort((a, b) => a.time_local.localeCompare(b.time_local))
}

interface EspnLeadersPayload {
  categories?: Array<{
    name?: string
    leaders?: Array<{
      value?: number
      athlete?: { $ref?: string }
      team?: { $ref?: string }
    }>
  }>
}

export function parseEspnLeaders(payload: EspnLeadersPayload, category: string, limit = 10): EspnLeaderEntry[] {
  const block = (payload.categories || []).find((item) => item.name === category)
  return (block?.leaders || []).slice(0, limit).map((leader) => ({
    athleteRef: leader.athlete?.$ref || null,
    teamRef: leader.team?.$ref || null,
    value: typeof leader.value === 'number' ? leader.value : 0,
  }))
}

export function parseEspnLeaderTotals(payload: EspnLeadersPayload, limit = 10): Array<{ goals: number; assists: number; matches: number }> {
  const goals = parseEspnLeaders(payload, 'goals', limit)
  const assists = parseEspnLeaders(payload, 'assists', limit)
  const assistByAthlete = new Map(assists.map((entry) => [entry.athleteRef, entry.value]))
  return goals.map((entry, index) => ({
    goals: entry.value,
    assists: assistByAthlete.get(entry.athleteRef) ?? assists[index]?.value ?? 0,
    matches: 0,
  }))
}

export function espnAthleteName(payload: { displayName?: string; fullName?: string; shortName?: string }): string {
  return payload.displayName || payload.fullName || payload.shortName || ''
}

export function espnTeamName(payload: { displayName?: string; name?: string }): string {
  return payload.displayName || payload.name || ''
}

export function espnTeamCrest(payload: { logo?: string; logos?: Array<{ href?: string }> }): string | null {
  return crestOf(payload as { logo?: string; logos?: Array<{ href?: string }> }) || null
}
