import {
  LEAGUE_MAPPING,
  COMPETITION_ID_TO_LEAGUE,
  LEAGUE_NAMES,
} from '@/types'
import { buildHypeBoard, computeDayStats as scoreDay, type HypeBoardItem } from '@/lib/hypeScore'

const BASE_URL = process.env.FOOTBALL_API_BASE_URL || 'https://api.football-data.org/v4'
const TOKEN = process.env.FOOTBALL_API_TOKEN

async function fetchWithRetry(url: string, attempts = 3): Promise<Response> {
  let lastError: Error | null = null
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, {
        headers: { 'X-Auth-Token': TOKEN || '', 'Content-Type': 'application/json' },
      })
      if (res.status === 429 || res.status >= 500) {
        const retryAfter = Number(res.headers.get('retry-after')) || 0
        const backoff = retryAfter > 0 ? retryAfter * 1000 : Math.min(2000 * 2 ** i, 15000)
        await new Promise(r => setTimeout(r, backoff))
        lastError = new Error(`HTTP ${res.status}`)
        continue
      }
      return res
    } catch (err) {
      lastError = err as Error
      await new Promise(r => setTimeout(r, Math.min(1000 * 2 ** i, 10000)))
    }
  }
  throw lastError || new Error('Fetch failed')
}

async function apiGet<T>(endpoint: string): Promise<T> {
  if (!TOKEN) throw new Error('FOOTBALL_API_TOKEN not configured')
  const res = await fetchWithRetry(`${BASE_URL}${endpoint}`)
  if (!res.ok) throw new Error(`Football API ${res.status}: ${res.statusText}`)
  return res.json()
}

// ---------- Types ----------

interface ApiMatch {
  competition: { id: number; name: string; code: string }
  utcDate: string
  status: string
  homeTeam: { id: number; name: string; crest?: string }
  awayTeam: { id: number; name: string; crest?: string }
  score: {
    fullTime: { home: number | null; away: number | null }
    halfTime: { home: number | null; away: number | null }
  }
}

export type MatchStatus = 'SCHEDULED' | 'TIMED' | 'IN_PLAY' | 'PAUSED' | 'FINISHED' | 'POSTPONED' | 'CANCELLED' | 'SUSPENDED'

export interface TodayMatch {
  league_id: string
  league_name: string
  home: string
  home_crest: string | null
  home_position: number | null
  away: string
  away_crest: string | null
  away_position: number | null
  time_local: string
  status: MatchStatus
  score_home: number | null
  score_away: number | null
  match_stats?: import('@/lib/matchStats').MatchStats | null
}

export interface StandingRow {
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
}

export type HypeFlag = HypeBoardItem

// ---------- Today's matches ----------

export async function fetchTodayMatches(): Promise<TodayMatch[]> {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  const validCompIds = new Set(Object.values(LEAGUE_MAPPING))

  const data = await apiGet<{ matches: ApiMatch[] }>(`/matches?date=${today}`)

  const seen = new Set<string>()

  return (data.matches || [])
    .filter(m => validCompIds.has(m.competition.id))
    .map(m => {
      const leagueCode = COMPETITION_ID_TO_LEAGUE[m.competition.id] || m.competition.code
      const key = `${leagueCode}-${m.homeTeam.name}-${m.awayTeam.name}`
      if (seen.has(key)) return null
      seen.add(key)

      const utc = new Date(m.utcDate)
      const timeLocal = utc.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Sao_Paulo',
      })

      return {
        league_id: leagueCode,
        league_name: LEAGUE_NAMES[leagueCode] || m.competition.name,
        home: m.homeTeam.name,
        home_crest: m.homeTeam.crest || null,
        home_position: null,
        away: m.awayTeam.name,
        away_crest: m.awayTeam.crest || null,
        away_position: null,
        time_local: timeLocal,
        status: m.status as MatchStatus,
        score_home: m.score?.fullTime?.home ?? m.score?.halfTime?.home ?? null,
        score_away: m.score?.fullTime?.away ?? m.score?.halfTime?.away ?? null,
      } as TodayMatch
    })
    .filter((m): m is TodayMatch => m !== null)
    .sort((a, b) => a.league_name.localeCompare(b.league_name) || a.time_local.localeCompare(b.time_local))
}

// ---------- Standings ----------

interface ApiStandingTeam {
  position: number
  team: { id: number; name: string; crest?: string }
  playedGames: number
  won: number
  draw: number
  lost: number
  points: number
  goalsFor?: number
  goalsAgainst?: number
  form?: string | null
  goalDifference?: number
}

export async function fetchStandings(leagueCode: string): Promise<{
  league_id: string
  league_name: string
  table: StandingRow[]
  home: StandingRow[]
  away: StandingRow[]
  captured_at: string
}> {
  const compId = LEAGUE_MAPPING[leagueCode]
  if (!compId) throw new Error(`League ${leagueCode} not supported`)

  const data = await apiGet<{ standings: Array<{ type?: string; table: ApiStandingTeam[] }> }>(
    `/competitions/${compId}/standings`
  )
  const blocks = data.standings || []
  const pick = (type: string) => {
    const block = blocks.find(item => item.type === type) || (type === 'TOTAL' ? blocks[0] : undefined)
    return (block?.table || []).map(mapStandingRow)
  }

  return {
    league_id: leagueCode,
    league_name: LEAGUE_NAMES[leagueCode] || leagueCode,
    table: pick('TOTAL'),
    home: pick('HOME'),
    away: pick('AWAY'),
    captured_at: new Date().toISOString(),
  }
}

function mapStandingRow(t: ApiStandingTeam): StandingRow {
  const goalsFor = t.goalsFor || 0
  const goalsAgainst = t.goalsAgainst || 0
  return {
    pos: t.position,
    team: t.team.name,
    crest: t.team.crest || '',
    pts: t.points,
    played: t.playedGames,
    wins: t.won,
    draws: t.draw,
    losses: t.lost,
    form: t.form || null,
    goalDifference: t.goalDifference ?? goalsFor - goalsAgainst,
    goalsFor,
    goalsAgainst,
  }
}

// ---------- Hype flags (max 12) ----------

export function generateHypeFlags(
  matches: TodayMatch[],
  standingsMap: Record<string, StandingRow[]>
): HypeFlag[] {
  return buildHypeBoard(matches, standingsMap, LEAGUE_NAMES)
}

// ---------- Top Scorers ----------

interface ApiScorer {
  player: { id: number; name: string; nationality: string }
  team: { id: number; name: string; crest?: string }
  goals: number
  assists: number | null
  playedMatches: number
}

export interface Scorer {
  player: string
  team: string
  team_crest: string | null
  goals: number
  assists: number
  matches: number
}

export async function fetchTopScorers(leagueCode: string, limit = 10): Promise<Scorer[]> {
  const compId = LEAGUE_MAPPING[leagueCode]
  if (!compId) throw new Error(`League ${leagueCode} not supported`)

  const data = await apiGet<{ scorers: ApiScorer[] }>(
    `/competitions/${compId}/scorers?limit=${limit}`
  )

  return (data.scorers || []).map(s => ({
    player: s.player.name,
    team: s.team.name,
    team_crest: s.team.crest || null,
    goals: s.goals,
    assists: s.assists || 0,
    matches: s.playedMatches,
  }))
}

// ---------- Day Summary Stats ----------

export interface DayStats {
  totalMatches: number
  liveMatches: number
  finishedMatches: number
  scheduledMatches: number
  totalGoals: number
  avgGoals: number
  leaguesActive: number
}

export function computeDayStats(matches: TodayMatch[]): DayStats {
  return scoreDay(matches)
}
