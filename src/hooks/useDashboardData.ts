"use client"

import { useState, useEffect, useCallback } from 'react'

export type MatchStatus = 'SCHEDULED' | 'TIMED' | 'IN_PLAY' | 'PAUSED' | 'FINISHED' | 'POSTPONED' | 'CANCELLED' | 'SUSPENDED'

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
}

export interface HypeTeam {
  team: string
  reason: string
  priority: number
  crest?: string | null
  position?: number | null
  league_id: string
  league_name: string
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
}

interface TodayData {
  date: string
  matches: Match[]
  hype: HypeTeam[]
}

interface StandingsData {
  league_id: string
  league_name: string
  table: Standing[]
  captured_at: string
}

interface DashboardState {
  todayData: TodayData | null
  standingsData: StandingsData | null
  leagueId: string
  loadingToday: boolean
  loadingStandings: boolean
  lastUpdated: string
}

export function useDashboardData() {
  const [state, setState] = useState<DashboardState>({
    todayData: null,
    standingsData: null,
    leagueId: 'BSA',
    loadingToday: true,
    loadingStandings: true,
    lastUpdated: '',
  })

  const setLeagueId = useCallback((id: string) => {
    setState(prev => ({ ...prev, leagueId: id }))
  }, [])

  const fetchToday = useCallback(async () => {
    setState(prev => ({ ...prev, loadingToday: true }))
    try {
      const res = await fetch("/api/dashboard/today")
      const json = await res.json()
      setState(prev => ({
        ...prev,
        todayData: json,
        lastUpdated: new Date().toLocaleString('pt-BR'),
        loadingToday: false,
      }))
    } catch {
      setState(prev => ({
        ...prev,
        todayData: { date: '', matches: [], hype: [] },
        loadingToday: false,
      }))
    }
  }, [])

  const fetchStandings = useCallback(async (leagueId: string) => {
    setState(prev => ({ ...prev, loadingStandings: true }))
    try {
      const res = await fetch(`/api/dashboard/standings/${leagueId}`)
      const json = await res.json()
      setState(prev => ({
        ...prev,
        standingsData: json,
        loadingStandings: false,
      }))
    } catch {
      setState(prev => ({
        ...prev,
        standingsData: { league_id: leagueId, league_name: '', table: [], captured_at: '' },
        loadingStandings: false,
      }))
    }
  }, [])

  const refresh = useCallback(async () => {
    await Promise.all([fetchToday(), fetchStandings(state.leagueId)])
  }, [fetchToday, fetchStandings, state.leagueId])

  useEffect(() => {
    fetchToday()
  }, [fetchToday])

  useEffect(() => {
    fetchStandings(state.leagueId)
  }, [state.leagueId, fetchStandings])

  const groupedMatches = state.todayData?.matches?.reduce((acc, match) => {
    if (!match?.league_name) return acc
    if (!acc[match.league_name]) acc[match.league_name] = []
    acc[match.league_name].push(match)
    return acc
  }, {} as Record<string, Match[]>) || {}

  const hasLiveMatches = state.todayData?.matches?.some(
    m => m.status === 'IN_PLAY' || m.status === 'PAUSED'
  ) ?? false

  return {
    ...state,
    setLeagueId,
    refresh,
    groupedMatches,
    hasLiveMatches,
    isLoading: state.loadingToday || state.loadingStandings,
  }
}
