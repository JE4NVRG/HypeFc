export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createCacheKey, withCache } from '@/lib/cache'
import { fetchTodayMatches, fetchStandings, generateHypeFlags } from '@/services/footballApi'
import type { StandingRow } from '@/services/footballApi'

export async function GET() {
  const startTime = Date.now()

  try {
    const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
    const cacheKey = createCacheKey('today', hoje)

    const result = await withCache(cacheKey, async () => {
      const matches = await fetchTodayMatches()

      // Buscar standings das ligas que tem jogos hoje (para gerar hype)
      const leagueIds = Array.from(new Set(matches.map(m => m.league_id)))
      const standingsMap: Record<string, StandingRow[]> = {}

      await Promise.allSettled(
        leagueIds.map(async id => {
          try {
            const s = await fetchStandings(id)
            standingsMap[id] = s.table
          } catch {
            // Liga sem standings (ex: Copa do Mundo) - ignorar
          }
        })
      )

      // Enriquecer matches com posicoes do standings
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

      return { date: hoje, matches: enrichedMatches, hype }
    }, 5)

    return NextResponse.json({
      ...result,
      _meta: { responseTime: `${Date.now() - startTime}ms`, timestamp: new Date().toISOString() },
    }, {
      headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' },
    })
  } catch (error) {
    console.error('Error fetching today data:', error)
    return NextResponse.json(
      { error: 'Failed to fetch data', _meta: { responseTime: `${Date.now() - startTime}ms` } },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
