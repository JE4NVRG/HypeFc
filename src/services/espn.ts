import { parseEspnScoreboard, type EspnFixture } from '@/lib/matchStats'

export const ESPN_LEAGUE_SLUGS: Record<string, string> = {
  BSA: 'bra.1',
  PL: 'eng.1',
  PD: 'esp.1',
  SA: 'ita.1',
  BL1: 'ger.1',
  FL1: 'fra.1',
  DED: 'ned.1',
  PPL: 'por.1',
  ELC: 'eng.2',
  CL: 'uefa.champions',
}

export async function fetchEspnFixtures(leagueIds: string[], dateIso: string): Promise<EspnFixture[]> {
  const date = dateIso.replace(/-/g, '')
  const slugs = Array.from(new Set(leagueIds.map((id) => ESPN_LEAGUE_SLUGS[id]).filter(Boolean)))
  const boards = await Promise.all(slugs.map(async (slug) => {
    const res = await fetch(
      `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard?dates=${date}`,
      { headers: { Accept: 'application/json' }, cache: 'no-store' }
    )
    if (!res.ok) return []
    return parseEspnScoreboard(await res.json())
  }))
  return boards.flat()
}
