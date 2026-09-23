import {
  loadBrowserToday,
  loadBrowserStandings,
  loadBrowserScorers,
  loadBrowserMatchDetail,
} from '@/lib/browserData'
import type { TodayData, StandingsData, ScorersData } from '@/hooks/useDashboardData'
import type { MatchDetail } from '@/lib/matchDetail'

/**
 * Fonte de dados com duas implementacoes:
 * - server (padrao): as rotas /api leem a ESPN ou a Football-Data no servidor
 * - static (NEXT_PUBLIC_DATA_MODE=static): o navegador chama a ESPN direto,
 *   o que permite publicar o dashboard como site estatico, sem backend
 */
export const STATIC_MODE = process.env.NEXT_PUBLIC_DATA_MODE === 'static'

async function apiGet<T>(url: string): Promise<T> {
  const res = await fetch(url)
  const json = (await res.json().catch(() => null)) as (T & { error?: string }) | null
  if (!res.ok) {
    throw new Error(json?.error || `HTTP ${res.status}`)
  }
  return json as T
}

export async function fetchTodayData(): Promise<TodayData> {
  if (STATIC_MODE) return loadBrowserToday()
  return apiGet<TodayData>('/api/dashboard/today')
}

export async function fetchStandingsData(leagueId: string): Promise<StandingsData> {
  if (STATIC_MODE) return loadBrowserStandings(leagueId)
  return apiGet<StandingsData>(`/api/dashboard/standings/${leagueId}`)
}

export async function fetchScorersData(leagueId: string): Promise<ScorersData> {
  if (STATIC_MODE) return loadBrowserScorers(leagueId)
  return apiGet<ScorersData>(`/api/dashboard/scorers/${leagueId}`)
}

/**
 * Detalhe do confronto clicado. No modo servidor a rota cacheia 10 minutos; no
 * modo estatico o navegador busca o mesmo payload na ESPN (CORS liberado), com
 * o mesmo parser e cache em memoria por 15 minutos.
 */
export async function fetchMatchDetailData(leagueId: string, eventId: string): Promise<MatchDetail> {
  if (STATIC_MODE) return loadBrowserMatchDetail(leagueId, eventId)
  const json = await apiGet<{ detail: MatchDetail }>(
    `/api/dashboard/match/${leagueId}/${eventId}`
  )
  return json.detail
}
