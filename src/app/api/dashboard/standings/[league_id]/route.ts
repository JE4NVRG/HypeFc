import { NextResponse } from 'next/server'
import { createCacheKey, withCache } from '@/lib/cache'
import { fetchStandings } from '@/services/footballApi'
import { fetchEspnStandings, fetchEspnLatestForms, fetchEspnSeason } from '@/services/espn'
import { buildTeamFormIndex, lookupTeamForm } from '@/lib/espnParse'
import { buildHomeAwaySplits, alignSplitRows, playedWindow, splitsReconcile } from '@/lib/splits'
import { LEAGUE_NAMES } from '@/types'

const HAS_TOKEN = Boolean(process.env.FOOTBALL_API_TOKEN)

export async function GET(
  _request: Request,
  { params }: { params: { league_id: string } }
) {
  const startTime = Date.now()

  try {
    const { league_id } = params

    if (HAS_TOKEN) {
      const result = await withCache(createCacheKey('standings', league_id), () => fetchStandings(league_id), 10)
      return NextResponse.json({
        ...result,
        source: 'football-data',
        _meta: { responseTime: `${Date.now() - startTime}ms`, timestamp: new Date().toISOString() },
      }, {
        headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=900' },
      })
    }

    const table = await withCache(
      createCacheKey('espn-standings', league_id),
      () => fetchEspnStandings(league_id),
      15
    )

    // A tabela da ESPN nao traz forma; ela vem do ultimo dia com jogos.
    try {
      const hoje = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
      const metas = await withCache(
        createCacheKey('espn-forms', league_id, hoje),
        () => fetchEspnLatestForms(league_id, hoje),
        15
      )
      if (metas.length) {
        const index = buildTeamFormIndex(metas)
        for (const row of table) {
          if (row.form) continue
          const form = lookupTeamForm(index, row)
          if (form) row.form = form
        }
      }
    } catch (formError) {
      console.error('ESPN form enrichment failed:', formError)
    }

    // Split de mando: a tabela da ESPN so traz o geral, entao casa/fora e
    // reconstruido dos jogos encerrados da temporada (uma chamada por liga).
    let home: Awaited<ReturnType<typeof buildHomeAwaySplits>>['home'] = []
    let away: Awaited<ReturnType<typeof buildHomeAwaySplits>>['away'] = []
    try {
      const season = await withCache(
        createCacheKey('espn-season', league_id),
        () => fetchEspnSeason(league_id),
        60
      )
      const splits = buildHomeAwaySplits(season, playedWindow(table))
      // Alinha ao nome canonico da tabela pelo id: o scoreboard chama o mesmo
      // time de "Athletico-PR" e a tabela de "Athletico Paranaense", e o painel
      // casa o split por nome.
      const alignedHome = alignSplitRows(splits.home, table)
      const alignedAway = alignSplitRows(splits.away, table)

      // So publica o split se casa+fora somar exatamente a tabela.
      if (splitsReconcile(alignedHome, alignedAway, table)) {
        home = alignedHome
        away = alignedAway
      } else {
        console.error('ESPN home/away split did not reconcile with the table; dropping it')
      }
    } catch (splitError) {
      console.error('ESPN home/away split failed:', splitError)
    }

    return NextResponse.json({
      league_id,
      league_name: LEAGUE_NAMES[league_id] || league_id,
      table,
      home,
      away,
      source: 'espn',
      captured_at: new Date().toISOString(),
      _meta: { responseTime: `${Date.now() - startTime}ms`, timestamp: new Date().toISOString() },
    }, {
      headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=900' },
    })
  } catch (error) {
    console.error('Error fetching standings:', error)
    const { league_id } = params
    return NextResponse.json(
      {
        error: 'Classificação indisponível para esta liga agora.',
        detail: error instanceof Error ? error.message : 'unknown',
        league_id,
        league_name: LEAGUE_NAMES[league_id] || league_id,
        table: [],
        captured_at: '',
        _meta: { responseTime: `${Date.now() - startTime}ms` },
      },
      { status: 502, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
