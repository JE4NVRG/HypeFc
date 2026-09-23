export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createCacheKey, memoryCache, withCache } from '@/lib/cache'
import { fetchTodayMatches, fetchStandings } from '@/services/footballApi'
import { fetchEspnDay, fetchEspnStandings, fetchEspnFixtures } from '@/services/espn'
import { attachMatchStats } from '@/lib/matchStats'
import { composeDay } from '@/lib/composeDay'
import type { EspnTeamMeta } from '@/lib/espnParse'
import { LEAGUE_NAMES } from '@/types'
import type { StandingRow, TodayMatch } from '@/services/footballApi'

const HAS_TOKEN = Boolean(process.env.FOOTBALL_API_TOKEN)
const MAX_LOOKBACK = 4

interface DayData {
  matches: TodayMatch[]
  metas: EspnTeamMeta[]
}

function shiftDate(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

async function loadDay(dateIso: string): Promise<DayData> {
  if (HAS_TOKEN) {
    const key = createCacheKey('matches', dateIso)
    const cached = memoryCache.get<TodayMatch[]>(key)
    if (cached) return { matches: cached, metas: [] }
    const matches = await fetchTodayMatches(dateIso)
    const live = matches.some((match) => match.status === 'IN_PLAY' || match.status === 'PAUSED')
    memoryCache.set(key, matches, live ? 1 : 15)
    return { matches, metas: [] }
  }
  return withCache(
    createCacheKey('espn-day', dateIso),
    () => fetchEspnDay(Object.keys(LEAGUE_NAMES), dateIso, LEAGUE_NAMES),
    15
  )
}

async function loadStandings(leagueIds: string[]): Promise<Record<string, StandingRow[]>> {
  const map: Record<string, StandingRow[]> = {}
  await Promise.allSettled(
    leagueIds.map(async (id) => {
      try {
        map[id] = HAS_TOKEN
          ? (await withCache(createCacheKey('standings', id), () => fetchStandings(id), 15)).table
          : await withCache(createCacheKey('espn-standings', id), () => fetchEspnStandings(id), 15)
      } catch {
        // liga sem tabela (copa em fase de grupos, por exemplo)
      }
    })
  )
  return map
}

export async function GET(request: Request) {
  const startTime = Date.now()

  try {
    const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
    const requested = new URL(request.url).searchParams.get('date')
    const requestedDate = requested && /^\d{4}-\d{2}-\d{2}$/.test(requested) ? requested : hoje

    const candidates = [requestedDate]
    if (!requested) {
      for (let offset = 1; offset <= MAX_LOOKBACK; offset += 1) {
        candidates.push(shiftDate(hoje, -offset))
      }
    }

    let day: DayData = { matches: [], metas: [] }
    let usedDate = requestedDate

    for (const candidate of candidates) {
      const loaded = await loadDay(candidate)
      const isLast = candidate === candidates[candidates.length - 1]
      if (loaded.matches.length > 0) {
        day = loaded
        usedDate = candidate
        break
      }
      if (isLast) {
        day = loaded
        usedDate = candidate
      }
    }

    const matches = day.matches
    const leagueIds = Array.from(new Set(matches.map((match) => match.league_id)))
    const standingsMap = await loadStandings(leagueIds)

    let withStats = matches
    if (HAS_TOKEN && matches.length > 0) {
      try {
        const fixtures = await withCache(
          createCacheKey('espn', usedDate, leagueIds.slice().sort().join(',')),
          () => fetchEspnFixtures(leagueIds, usedDate),
          15
        )
        withStats = attachMatchStats(matches, fixtures)
      } catch (espnError) {
        console.error('ESPN stats unavailable:', espnError)
      }
    }

    const composed = composeDay(withStats, standingsMap, day.metas)

    return NextResponse.json({
      date: usedDate,
      requested_date: requestedDate,
      is_fallback: usedDate !== requestedDate,
      source: HAS_TOKEN ? 'football-data' : 'espn',
      matches: composed.matches,
      hype: composed.hype,
      stats: composed.stats,
      _meta: { responseTime: `${Date.now() - startTime}ms`, timestamp: new Date().toISOString() },
    }, {
      headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=120' },
    })
  } catch (error) {
    console.error('Error fetching today data:', error)
    const message = error instanceof Error ? error.message : 'Failed to fetch data'
    return NextResponse.json(
      { error: 'Failed to fetch data', detail: message, _meta: { responseTime: `${Date.now() - startTime}ms` } },
      { status: 502, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
