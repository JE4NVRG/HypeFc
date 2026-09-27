export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createCacheKey, memoryCache, withCache } from '@/lib/cache'
import { fetchTodayMatches, fetchStandings } from '@/services/footballApi'
import { fetchEspnDay, fetchEspnStandings, fetchEspnFixtures, fetchEspnSeason } from '@/services/espn'
import { attachMatchStats } from '@/lib/matchStats'
import { composeDay } from '@/lib/composeDay'
import type { EspnTeamMeta } from '@/lib/espnParse'
import { LEAGUE_NAMES } from '@/types'
import type { StandingRow, TodayMatch } from '@/services/footballApi'

const HAS_TOKEN = Boolean(process.env.FOOTBALL_API_TOKEN)

interface DayData {
  matches: TodayMatch[]
  metas: EspnTeamMeta[]
}

/**
 * Datas com jogos no calendario da temporada, uma requisicao por liga (cacheada
 * por 1h). A busca dia a dia nao bastava: em setembro de 2026 a ESPN ficou de
 * 21/09 a 01/10 sem jogos nessas ligas e olhar 4 dias para tras nao alcancava a
 * rodada anterior — a home aparecia zerada e o aviso apontava uma data sem jogo.
 */
async function calendarioDeDatas(): Promise<string[]> {
  const listas = await Promise.all(
    Object.keys(LEAGUE_NAMES).map(async (id) => {
      try {
        return await withCache(createCacheKey('espn-calendario', id), () => fetchEspnSeason(id), 60)
      } catch {
        return []
      }
    })
  )
  const datas = new Set<string>()
  for (const lista of listas) {
    for (const partida of lista) {
      const dia = (partida.date || '').slice(0, 10)
      if (dia) datas.add(dia)
    }
  }
  return Array.from(datas).sort()
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

    let day: DayData = { matches: [], metas: [] }
    let usedDate = requestedDate
    let proximaRodada: string | null = null

    const doDia = await loadDay(requestedDate)
    if (doDia.matches.length > 0) {
      day = doDia
    } else if (!requested) {
      // Dia vazio nao quer dizer rodada anterior a 4 dias: o calendario da
      // temporada diz qual foi a ultima rodada de verdade e qual e a proxima.
      const datas = await calendarioDeDatas()
      const anterior = [...datas].reverse().find((dia) => dia < requestedDate)
      proximaRodada = datas.find((dia) => dia > requestedDate) ?? null
      if (anterior) {
        const rodada = await loadDay(anterior)
        if (rodada.matches.length > 0) {
          day = rodada
          usedDate = anterior
        }
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
      proxima_rodada: proximaRodada,
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
