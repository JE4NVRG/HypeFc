import { NextResponse } from 'next/server'
import { createCacheKey, withCache } from '@/lib/cache'
import { fetchTopScorers } from '@/services/footballApi'

export async function GET(
  _request: Request,
  { params }: { params: { league_id: string } }
) {
  const startTime = Date.now()

  try {
    const { league_id } = params
    const cacheKey = createCacheKey('scorers', league_id)

    const scorers = await withCache(cacheKey, () => fetchTopScorers(league_id, 10), 30)

    return NextResponse.json({
      league_id,
      scorers,
      _meta: { responseTime: `${Date.now() - startTime}ms` },
    }, {
      headers: { 'Cache-Control': 'public, max-age=600, stale-while-revalidate=1800' },
    })
  } catch (error) {
    console.error('Error fetching scorers:', error)
    return NextResponse.json(
      { error: 'Failed to fetch scorers', _meta: { responseTime: `${Date.now() - startTime}ms` } },
      { status: 500 }
    )
  }
}
