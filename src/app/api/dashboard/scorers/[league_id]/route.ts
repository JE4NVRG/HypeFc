import { NextResponse } from 'next/server'
import { createCacheKey, withCache } from '@/lib/cache'
import { fetchTopScorers } from '@/services/footballApi'
import { fetchEspnScorers } from '@/services/espn'

const HAS_TOKEN = Boolean(process.env.FOOTBALL_API_TOKEN)

export async function GET(
  _request: Request,
  { params }: { params: { league_id: string } }
) {
  const startTime = Date.now()

  try {
    const { league_id } = params

    if (HAS_TOKEN) {
      const scorers = await withCache(createCacheKey('scorers', league_id), () => fetchTopScorers(league_id, 10), 30)
      return NextResponse.json({
        league_id,
        scorers,
        source: 'football-data',
        _meta: { responseTime: `${Date.now() - startTime}ms` },
      }, {
        headers: { 'Cache-Control': 'public, max-age=600, stale-while-revalidate=1800' },
      })
    }

    const scorers = await withCache(
      createCacheKey('espn-scorers', league_id),
      () => fetchEspnScorers(league_id, 10),
      60
    )

    return NextResponse.json({
      league_id,
      scorers,
      source: 'espn',
      _meta: { responseTime: `${Date.now() - startTime}ms` },
    }, {
      headers: { 'Cache-Control': 'public, max-age=600, stale-while-revalidate=1800' },
    })
  } catch (error) {
    console.error('Error fetching scorers:', error)
    const { league_id } = params
    return NextResponse.json(
      {
        error: 'Artilheiros indisponíveis para esta liga agora.',
        detail: error instanceof Error ? error.message : 'unknown',
        league_id,
        scorers: [],
        _meta: { responseTime: `${Date.now() - startTime}ms` },
      },
      { status: 502, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
