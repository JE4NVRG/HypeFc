import { NextResponse } from 'next/server'
import { createCacheKey, withCache } from '@/lib/cache'
import { fetchStandings } from '@/services/footballApi'

export async function GET(
  _request: Request,
  { params }: { params: { league_id: string } }
) {
  const startTime = Date.now()

  try {
    const { league_id } = params
    const cacheKey = createCacheKey('standings', league_id)

    const result = await withCache(cacheKey, () => fetchStandings(league_id), 10)

    return NextResponse.json({
      ...result,
      _meta: { responseTime: `${Date.now() - startTime}ms`, timestamp: new Date().toISOString() },
    }, {
      headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=900' },
    })
  } catch (error) {
    console.error('Error fetching standings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch standings', _meta: { responseTime: `${Date.now() - startTime}ms` } },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
