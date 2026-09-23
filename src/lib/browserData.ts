import {
  fetchEspnDay,
  fetchEspnStandings,
  fetchEspnScorers,
  fetchEspnLatestForms,
  fetchEspnSeason,
  ESPN_LEAGUE_SLUGS,
} from '@/services/espn'
import { composeDay, applyForm } from '@/lib/composeDay'
import { buildHomeAwaySplits, alignSplitRows, playedWindow, splitsReconcile } from '@/lib/splits'
import { LEAGUE_NAMES } from '@/types'
import type { StandingRow, TodayMatch, Scorer } from '@/services/footballApi'
import type { DayStats, HypeBoardItem } from '@/lib/hypeScore'

/**
 * Caminho sem servidor: o navegador fala direto com a ESPN publica, que libera
 * CORS. Permite publicar o dashboard como site estatico (GitHub Pages), sem
 * chave, sem backend e sem custo.
 */

const MAX_LOOKBACK = 4
const TTL_MS = 2 * 60 * 1000

interface CacheEntry {
  at: number
  value: unknown
}

const cache = new Map<string, CacheEntry>()

async function cached<T>(key: string, ttlMs: number, produce: () => Promise<T>): Promise<T> {
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as T
  const value = await produce()
  cache.set(key, { at: Date.now(), value })
  return value
}

export function saoPauloToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

export function shiftIso(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export interface BrowserToday {
  date: string
  requested_date: string
  is_fallback: boolean
  source: 'espn'
  matches: TodayMatch[]
  hype: HypeBoardItem[]
  stats: DayStats
}

async function standingsFor(leagueIds: string[]): Promise<Record<string, StandingRow[]>> {
  const map: Record<string, StandingRow[]> = {}
  await Promise.allSettled(
    leagueIds.map(async (leagueId) => {
      try {
        map[leagueId] = await cached(`standings:${leagueId}`, 15 * TTL_MS, () => fetchEspnStandings(leagueId))
      } catch {
        // liga sem tabela (copa em fase de grupos, por exemplo)
      }
    })
  )
  return map
}

async function formsFor(leagueIds: string[], from: string) {
  const lists = await Promise.all(
    leagueIds.map(async (leagueId) => {
      try {
        return await cached(`forms:${leagueId}:${from}`, 30 * TTL_MS, () => fetchEspnLatestForms(leagueId, from))
      } catch {
        return []
      }
    })
  )
  return lists.flat()
}

export async function loadBrowserToday(): Promise<BrowserToday> {
  const requestedDate = saoPauloToday()
  const candidates = [requestedDate]
  for (let offset = 1; offset <= MAX_LOOKBACK; offset += 1) {
    candidates.push(shiftIso(requestedDate, -offset))
  }

  let matches: TodayMatch[] = []
  let metas: Awaited<ReturnType<typeof fetchEspnLatestForms>> = []
  let usedDate = requestedDate

  for (const candidate of candidates) {
    const day = await cached(`day:${candidate}`, 2 * TTL_MS, () =>
      fetchEspnDay(Object.keys(ESPN_LEAGUE_SLUGS), candidate, LEAGUE_NAMES)
    )
    usedDate = candidate
    if (day.matches.length > 0) {
      matches = day.matches
      metas = day.metas
      break
    }
  }

  const leagueIds = Array.from(new Set(matches.map((match) => match.league_id)))
  const standingsMap = await standingsFor(leagueIds)
  const extra = await formsFor(leagueIds, saoPauloToday())
  const composed = composeDay(matches, standingsMap, [...metas, ...extra])

  return {
    date: usedDate,
    requested_date: requestedDate,
    is_fallback: usedDate !== requestedDate,
    source: 'espn',
    matches: composed.matches,
    hype: composed.hype,
    stats: composed.stats,
  }
}

export interface BrowserStandings {
  league_id: string
  league_name: string
  table: StandingRow[]
  home: StandingRow[]
  away: StandingRow[]
  captured_at: string
  source: 'espn'
}

export async function loadBrowserStandings(leagueId: string): Promise<BrowserStandings> {
  const table = await cached(`standings:${leagueId}`, 15 * TTL_MS, () => fetchEspnStandings(leagueId))
  const today = saoPauloToday()
  const metas = await formsFor([leagueId], today)
  applyForm({ [leagueId]: table }, metas)

  // Split de mando reconstruido da temporada. Se falhar, as colunas CASA/FORA
  // ficam vazias e o painel esconde os cards — melhor que inventar numero.
  let home: StandingRow[] = []
  let away: StandingRow[] = []
  try {
    const season = await cached(`season:${leagueId}`, 60 * TTL_MS, () => fetchEspnSeason(leagueId))
    const splits = buildHomeAwaySplits(season, playedWindow(table))
    const alignedHome = alignSplitRows(splits.home, table)
    const alignedAway = alignSplitRows(splits.away, table)
    // Mesma rede de seguranca da rota: sem reconciliar com a tabela, nao mostra.
    if (splitsReconcile(alignedHome, alignedAway, table)) {
      home = alignedHome
      away = alignedAway
    }
  } catch {
    // sem split nesta liga
  }

  return {
    league_id: leagueId,
    league_name: LEAGUE_NAMES[leagueId] || leagueId,
    table,
    home,
    away,
    captured_at: new Date().toISOString(),
    source: 'espn',
  }
}

export interface BrowserScorers {
  league_id: string
  scorers: Scorer[]
  source: 'espn'
}

export async function loadBrowserScorers(leagueId: string): Promise<BrowserScorers> {
  const scorers = await cached(`scorers:${leagueId}`, 60 * TTL_MS, () => fetchEspnScorers(leagueId, 10))
  return { league_id: leagueId, scorers, source: 'espn' }
}
