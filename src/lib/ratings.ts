import { predictFromRatings, type MatchProb } from './matchProbability.ts'
import { buscarPayload } from './payloadSource.ts'

/**
 * Ratings do modelo publicado como arquivo estatico pelo build
 * (scripts/build-ratings.ts) e, em runtime, tambem pelo banco (site_payloads) —
 * ver src/lib/payloadSource.ts. O cliente nao reconstroi a temporada: ele le a
 * tabela pronta e combina com o adversario.
 */
export interface LeagueRatings {
  league_id: string
  league_name: string
  slug: string
  season: number | null
  matches: number
  teams: number
  ratings: Record<string, number>
}

export interface RatingsPayload {
  generated_at: string
  season: number
  model: { name: string; k: number; home_advantage: number }
  note: string
  leagues: Record<string, LeagueRatings>
}

let pedido: Promise<RatingsPayload | null> | null = null

/** Uma busca so para a pagina inteira (36 linhas nao fazem 36 requests). */
export function loadRatings(): Promise<RatingsPayload | null> {
  if (!pedido) {
    pedido = buscarPayload<RatingsPayload>('ratings')
  }
  return pedido
}

/**
 * Probabilidade do modelo para um jogo. Devolve null quando falta rating de
 * qualquer um dos dois times (time recem-promovido, liga fora do arquivo):
 * preferimos nao mostrar nada a mostrar chute.
 */
export function probabilidadeDoJogo(
  payload: RatingsPayload | null,
  leagueId: string,
  home: string,
  away: string
): MatchProb | null {
  const liga = payload?.leagues?.[leagueId]
  if (!liga || !home || !away) return null
  if (liga.ratings[home] === undefined || liga.ratings[away] === undefined) return null
  const tabela = new Map(Object.entries(liga.ratings))
  return predictFromRatings(tabela, home, away, {
    homeAdvantage: payload?.model?.home_advantage,
  })
}
