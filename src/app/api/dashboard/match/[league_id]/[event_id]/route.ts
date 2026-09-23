import { NextResponse } from 'next/server'
import { fetchMatchDetail } from '@/lib/matchDetail'

/**
 * Detalhe de uma partida sob demanda. O payload da ESPN tem ~400KB, entao so
 * buscamos quando alguem clica no confronto — nunca no carregamento da home.
 * O site publicado e estatico e nao tem esta rota: la o navegador chama a ESPN
 * direto (src/lib/browserData.ts), com o mesmo parser.
 */
export const revalidate = 600

export async function GET(
  _req: Request,
  { params }: { params: { league_id: string; event_id: string } }
) {
  const leagueId = (params.league_id || '').toUpperCase()
  const eventId = String(params.event_id || '').trim()

  if (!/^\d{4,12}$/.test(eventId)) {
    return NextResponse.json({ error: 'event_id invalido' }, { status: 400 })
  }

  try {
    const detail = await fetchMatchDetail(leagueId, eventId)
    return NextResponse.json(
      { detail },
      { headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1800' } }
    )
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'falha ao buscar o detalhe da partida' },
      { status: 502 }
    )
  }
}
