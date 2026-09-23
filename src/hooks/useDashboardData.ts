"use client"

import { useState, useEffect, useCallback } from 'react'
import type { MatchStats } from '@/lib/matchStats'
import type { MatchStatus } from '@/types'

export type { MatchStatus }

function humanError(message: string): string {
  if (message.includes('429')) {
    return 'Limite da fonte de dados atingido. Os dados voltam no próximo ciclo.'
  }
  if (message.includes('Failed to fetch') || message.includes('HTTP 50')) {
    return 'Não consegui atualizar os jogos agora. A ESPN pode estar fora do ar.'
  }
  if (message.includes('FOOTBALL_API_TOKEN')) {
    return 'Token da Football-Data inválido. O dashboard volta ao modo ESPN sem token.'
  }
  return message
}

export interface Match {
  league_id: string
  league_name: string
  home: string
  home_crest?: string | null
  home_position?: number | null
  away: string
  away_crest?: string | null
  away_position?: number | null
  time_local: string
  status: MatchStatus
  score_home: number | null
  score_away: number | null
  match_stats?: MatchStats | null
}

export interface HypeTeam {
  team: string
  reason: string
  priority: number
  crest?: string | null
  position?: number | null
  league_id: string
  league_name: string
  score?: number
  signals?: string[]
  form?: Array<'W' | 'D' | 'L'>
  opponent?: string | null
  match_status?: string | null
  time_local?: string | null
}

export interface Standing {
  pos: number
  team: string
  crest: string
  pts: number
  played: number
  wins: number
  draws: number
  losses: number
  goalsFor?: number
  goalsAgainst?: number
  form?: string | null
}

export interface Scorer {
  player: string
  team: string
  team_crest: string | null
  goals: number
  assists: number
  matches: number
}

export interface DayStats {
  totalMatches: number
  liveMatches: number
  finishedMatches: number
  scheduledMatches: number
  totalGoals: number
  avgGoals: number
  leaguesActive: number
}

interface TodayData {
  date: string
  requested_date?: string
  is_fallback?: boolean
  matches: Match[]
  hype: HypeTeam[]
  stats?: DayStats
  source?: string
}

interface StandingsData {
  league_id: string
  league_name: string
  table: Standing[]
  home?: Standing[]
  away?: Standing[]
  captured_at: string
}

interface ScorersData {
  league_id: string
  scorers: Scorer[]
}

interface DashboardState {
  todayData: TodayData | null
  standingsData: StandingsData | null
  scorersData: ScorersData | null
  leagueId: string
  loadingToday: boolean
  loadingStandings: boolean
  loadingScorers: boolean
  lastUpdated: string
  error: string
}

export function useDashboardData() {
  const [state, setState] = useState<DashboardState>({
    todayData: null,
    standingsData: null,
    scorersData: null,
    leagueId: 'BSA',
    loadingToday: true,
    loadingStandings: true,
    loadingScorers: true,
    lastUpdated: '',
    error: '',
  })

  const setLeagueId = useCallback((id: string) => {
    setState(prev => ({ ...prev, leagueId: id }))
  }, [])

  const fetchToday = useCallback(async (silent = false) => {
    if (!silent) setState(prev => ({ ...prev, loadingToday: true }))
    try {
      const res = await fetch("/api/dashboard/today")
      const json = await res.json()
      if (!res.ok) {
        throw new Error(json?.error || `HTTP ${res.status}`)
      }
      setState(prev => ({
        ...prev,
        todayData: json,
        lastUpdated: new Date().toLocaleString('pt-BR'),
        loadingToday: false,
        error: '',
      }))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao buscar jogos'
      setState(prev => ({
        ...prev,
        todayData: prev.todayData ?? { date: '', matches: [], hype: [] },
        loadingToday: false,
        error: humanError(message),
      }))
    }
  }, [])

  const fetchStandings = useCallback(async (leagueId: string) => {
    setState(prev => ({ ...prev, loadingStandings: true }))
    try {
      const res = await fetch(`/api/dashboard/standings/${leagueId}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`)
      setState(prev => ({
        ...prev,
        standingsData: json,
        loadingStandings: false,
      }))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao buscar classificação'
      setState(prev => ({
        ...prev,
        standingsData: prev.standingsData ?? { league_id: leagueId, league_name: '', table: [], captured_at: '' },
        loadingStandings: false,
        error: prev.error || humanError(message),
      }))
    }
  }, [])

  const fetchScorers = useCallback(async (leagueId: string) => {
    setState(prev => ({ ...prev, loadingScorers: true }))
    try {
      const res = await fetch(`/api/dashboard/scorers/${leagueId}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`)
      setState(prev => ({
        ...prev,
        scorersData: json,
        loadingScorers: false,
      }))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao buscar artilheiros'
      setState(prev => ({
        ...prev,
        scorersData: prev.scorersData ?? { league_id: leagueId, scorers: [] },
        loadingScorers: false,
        error: prev.error || humanError(message),
      }))
    }
  }, [])

  const refresh = useCallback(async () => {
    await Promise.all([fetchToday(), fetchStandings(state.leagueId), fetchScorers(state.leagueId)])
  }, [fetchToday, fetchStandings, fetchScorers, state.leagueId])

  useEffect(() => {
    fetchToday()
  }, [fetchToday])

  useEffect(() => {
    fetchStandings(state.leagueId)
    fetchScorers(state.leagueId)
  }, [state.leagueId, fetchStandings, fetchScorers])

  const groupedMatches = state.todayData?.matches?.reduce((acc, match) => {
    if (!match?.league_name) return acc
    if (!acc[match.league_name]) acc[match.league_name] = []
    acc[match.league_name].push(match)
    return acc
  }, {} as Record<string, Match[]>) || {}

  const hasLiveMatches = state.todayData?.matches?.some(
    m => m.status === 'IN_PLAY' || m.status === 'PAUSED'
  ) ?? false

  useEffect(() => {
    const ms = hasLiveMatches ? 60000 : 300000
    const id = setInterval(() => {
      fetchToday(true)
    }, ms)
    return () => clearInterval(id)
  }, [hasLiveMatches, fetchToday])

  return {
    ...state,
    setLeagueId,
    refresh,
    groupedMatches,
    hasLiveMatches,
    isLoading: state.loadingToday || state.loadingStandings,
  }
}
