export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createCacheKey, memoryCache, withCache } from '@/lib/cache'
import { fetchTodayMatches, fetchStandings, generateHypeFlags, computeDayStats } from '@/services/footballApi'
import type { StandingRow, TodayMatch } from '@/services/footballApi'

export async function GET() {
  const startTime = Date.now()

  try {
    const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
    const matchesKey = createCacheKey('matches', hoje)
    let matches = memoryCache.get<TodayMatch[]>(matchesKey)
    if (!matches) {
      matches = await fetchTodayMatches()
      const live = matches.some(match => match.status === 'IN_PLAY' || match.status === 'PAUSED')
      memoryCache.set(matchesKey, matches, live ? 1 : 5)
    }

    const leagueIds = Array.from(new Set(matches.map(m => m.league_id)))
    const standingsMap: Record<string, StandingRow[]> = {}

    await Promise.allSettled(
      leagueIds.map(async id => {
        try {
          const s = await withCache(createCacheKey('standings', id), () => fetchStandings(id), 15)
          standingsMap[id] = s.table
        } catch {
          // Liga sem standings (ex: Copa do Mundo) - ignorar
        }
      })
    )

    const enrichedMatches = matches.map(m => {
      const table = standingsMap[m.league_id]
      if (!table) return m
      const homeRow = table.find(t => t.team === m.home)
      const awayRow = table.find(t => t.team === m.away)
      return {
        ...m,
        home_position: homeRow?.pos ?? null,
        away_position: awayRow?.pos ?? null,
      }
    })

    const hype = generateHypeFlags(enrichedMatches, standingsMap)
    const stats = computeDayStats(enrichedMatches)

    return NextResponse.json({
      date: hoje,
      matches: enrichedMatches,
      hype,
      stats,
      _meta: { responseTime: `${Date.now() - startTime}ms`, timestamp: new Date().toISOString() },
    }, {
      headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=120' },
    })
  } catch (error) {
    console.error('Error fetching today data:', error)
    const message = error instanceof Error ? error.message : 'Failed to fetch data'
    const safe = message.includes('FOOTBALL_API_TOKEN') || message.includes('429')
      ? message
      : 'Failed to fetch data'
    return NextResponse.json(
      { error: safe, _meta: { responseTime: `${Date.now() - startTime}ms` } },
      { status: message.includes('FOOTBALL_API_TOKEN') ? 503 : 500, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
