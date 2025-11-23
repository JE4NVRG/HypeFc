"use client"

import { useState, useEffect } from 'react'
import Image from 'next/image'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Trophy, Calendar, Flame, RefreshCw } from 'lucide-react'

interface Match {
  league_id: string
  league_name: string
  home: string
  home_crest?: string | null
  home_position?: number | null
  away: string
  away_crest?: string | null
  away_position?: number | null
  time_local: string
}

interface HypeTeam {
  team: string
  reason: string
  priority: number
  crest?: string | null
  position?: number | null
  league_id: string
}

interface Standing {
  pos: number
  team: string
  crest: string // Adicionar URL do escudo
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

export default function Home() {
  const [todayData, setTodayData] = useState<TodayData | null>(null)
  const [leagueId, setLeagueId] = useState('BSA')
  const [standingsData, setStandingsData] = useState<StandingsData | null>(null)
  const [loadingToday, setLoadingToday] = useState(true)
  const [loadingStandings, setLoadingStandings] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<string>('')
  const [apiPerformance, setApiPerformance] = useState<{today?: string, standings?: string}>({})


  // useEffect #1: Buscar dados de hoje
  useEffect(() => {
    async function loadToday() {
      setLoadingToday(true)
      try {
        const res = await fetch("/api/dashboard/today")
        const json = await res.json()
        console.log("todayData:", json)
        setTodayData(json)
        setLastUpdated(new Date().toLocaleString('pt-BR'))
        setApiPerformance(prev => ({ ...prev, today: json._meta?.responseTime || 'N/A' }))
      } catch (error) {
        console.error("Erro ao carregar dados de hoje:", error)
        setTodayData({ date: '', matches: [], hype: [] })
      } finally {
        setLoadingToday(false)
      }
    }
    loadToday()
  }, [])

  // useEffect #2: Buscar classificação quando leagueId muda
  useEffect(() => {
    async function loadStandings() {
      setLoadingStandings(true)
      try {
        const res = await fetch(`/api/dashboard/standings/${leagueId}`)
        const json = await res.json()
        console.log("standingsData:", json)
        setStandingsData(json)
        setApiPerformance(prev => ({ ...prev, standings: json._meta?.responseTime || 'N/A' }))
      } catch (error) {
        console.error("Erro ao carregar standings:", error)
        setStandingsData({ league_id: leagueId, league_name: '', table: [], captured_at: '' })
      } finally {
        setLoadingStandings(false)
      }
    }
    loadStandings()
  }, [leagueId])

  // Função para atualizar dados manualmente
  const handleRefresh = async () => {
    // Recarregar dados de hoje
    setLoadingToday(true)
    try {
      const res = await fetch("/api/dashboard/today")
      const json = await res.json()
      console.log("todayData (refresh):", json)
      setTodayData(json)
      setLastUpdated(new Date().toLocaleString('pt-BR'))
      setApiPerformance(prev => ({ ...prev, today: json._meta?.responseTime || 'N/A' }))
    } catch (error) {
      console.error("Erro ao recarregar dados de hoje:", error)
    } finally {
      setLoadingToday(false)
    }

    // Recarregar standings
    setLoadingStandings(true)
    try {
      const res = await fetch(`/api/dashboard/standings/${leagueId}`)
      const json = await res.json()
      console.log("standingsData (refresh):", json)
      setStandingsData(json)
      setApiPerformance(prev => ({ ...prev, standings: json._meta?.responseTime || 'N/A' }))
    } catch (error) {
      console.error("Erro ao recarregar standings:", error)
    } finally {
      setLoadingStandings(false)
    }
    
    console.log("refresh ok")
  }

  // Agrupar jogos por league_name - com verificação de segurança
  const groupedMatches = todayData?.matches?.reduce((acc, match) => {
    if (!match?.league_name) return acc
    if (!acc[match.league_name]) {
      acc[match.league_name] = []
    }
    acc[match.league_name].push(match)
    return acc
  }, {} as Record<string, Match[]>) || {}

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100 antialiased">
      {/* Header fixo */}
      <header className="mb-6 flex items-start justify-between p-6">
        <div className="flex items-center gap-3">
          <Trophy className="h-8 w-8 text-yellow-400" />
          <div>
            <h1 className="text-2xl font-bold text-white">HypeFC</h1>
            <p className="text-sm text-slate-400">Times quentes para vender hoje</p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-600 transition-colors"
          disabled={loadingToday || loadingStandings}
        >
          <RefreshCw className={`h-4 w-4 ${(loadingToday || loadingStandings) ? 'animate-spin' : ''}`} />
          Atualizar agora
        </button>
      </header>

      {/* Container principal */}
      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card 1: Jogos de Hoje */}
        <Card className="rounded-2xl bg-white/5 border border-white/10 shadow-xl p-5 flex flex-col gap-4">
          <CardHeader className="p-0">
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-emerald-400" />
              <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent font-semibold">
                Jogos de Hoje
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1">
            {loadingToday ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-4 w-40 bg-white/10 rounded animate-pulse" />
                ))}
              </div>
            ) : !loadingToday && (!todayData?.matches || todayData.matches.length === 0) ? (
              <p className="text-slate-500 text-sm">Nenhum jogo programado para hoje</p>
            ) : (
              <div className="space-y-4">
                {Object.entries(groupedMatches || {}).map(([league_name, matches]) => (
                  <div key={league_name}>
                    <div className="text-xs uppercase text-slate-400 mt-4 first:mt-0 mb-2">
                      {league_name}
                    </div>
                    <div className="space-y-2">
                      {(matches || []).map((match, matchIndex) => (
                        <div 
                          key={`${match.league_id}-${match.home}-${match.away}-${match.time_local}-${matchIndex}`} 
                          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm text-slate-200 p-2 rounded-lg bg-white/5 border border-white/10"
                        >
                          <div className="flex items-center gap-2 font-medium min-w-0 flex-1">
                            <div className="flex items-center gap-1 min-w-0">
                              {match.home_crest && (
                                <Image
                                  src={match.home_crest}
                                  alt={`${match.home} logo`}
                                  width={16}
                                  height={16}
                                  className="rounded-sm flex-shrink-0"
                                />
                              )}
                              <div className="flex flex-col min-w-0">
                                <div className="flex items-center gap-1">
                                  <span className="truncate">{match.home}</span>
                                  {match.home_position && (
                                    <span className="text-xs text-slate-400 flex-shrink-0">(#{match.home_position})</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <span className="text-slate-400 flex-shrink-0">x</span>
                            <div className="flex items-center gap-1 min-w-0">
                              {match.away_crest && (
                                <Image
                                  src={match.away_crest}
                                  alt={`${match.away} logo`}
                                  width={16}
                                  height={16}
                                  className="rounded-sm flex-shrink-0"
                                />
                              )}
                              <div className="flex flex-col min-w-0">
                                <div className="flex items-center gap-1">
                                  <span className="truncate">{match.away}</span>
                                  {match.away_position && (
                                    <span className="text-xs text-slate-400 flex-shrink-0">(#{match.away_position})</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                          <div className="text-slate-400 text-xs sm:text-sm font-mono bg-slate-800/50 px-2 py-1 rounded flex-shrink-0 self-start sm:self-center">
                            {match.time_local}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 2: Times em Alta */}
        <Card className="rounded-2xl bg-white/5 border border-white/10 shadow-xl p-5 flex flex-col gap-4">
          <CardHeader className="p-0">
            <CardTitle className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-rose-400" />
              <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent font-semibold">
                Times em Alta
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 flex-1">
            {loadingToday ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-4 w-40 bg-white/10 rounded animate-pulse" />
                ))}
              </div>
            ) : !loadingToday && (!todayData?.hype || todayData.hype.length === 0) ? (
              <p className="text-slate-500 text-sm">Nenhum time em destaque hoje</p>
            ) : (
              <div className="space-y-3">
                {(todayData?.hype || []).map((h, hypeIndex) => (
                  <div
                    key={h.team + "-" + h.reason + "-" + hypeIndex}
                    className="flex items-center justify-between text-sm text-slate-200 border-b border-white/5 py-2 last:border-none"
                  >
                    <div className="flex items-center gap-2 font-medium">
                      {h.crest && h.crest.includes('football-data.org') && (
                        <Image
                          src={h.crest}
                          alt={`${h.team} logo`}
                          width={20}
                          height={20}
                          className="rounded-sm"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      )}
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1">
                          {h.position && (
                            <span className="text-xs text-slate-400">#{h.position}</span>
                          )}
                          <span>{h.team}</span>
                        </div>
                      </div>
                    </div>
                    <span className="text-xs rounded bg-white/10 px-2 py-1 text-slate-300">{h.reason}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Card 3: Top 10 da Liga */}
        <Card className="rounded-2xl bg-white/5 border border-white/10 shadow-xl p-5 flex flex-col gap-4">
          <CardHeader className="p-0">
            <CardTitle className="flex items-center gap-2 mb-4">
              <Trophy className="h-4 w-4 text-yellow-400" />
              <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent font-semibold">
                Tabela da Liga
              </span>
            </CardTitle>

            {/* Seletor de Liga Simples */}
            <div className="space-y-3">
              <select
                value={leagueId}
                onChange={(e) => setLeagueId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="BSA">Brasileirão Série A</option>
                <option value="PL">Premier League</option>
                <option value="PD">La Liga</option>
                <option value="SA">Serie A</option>
                <option value="FL1">Ligue 1</option>
                <option value="BL1">Bundesliga</option>
                <option value="DED">Eredivisie</option>
                <option value="PPL">Primeira Liga</option>
                <option value="ELC">Championship</option>
                <option value="CL">Champions League</option>
                <option value="EC">Eurocopa</option>
                <option value="WC">Copa do Mundo</option>
              </select>
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1">
            {loadingStandings ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-4 w-40 bg-white/10 rounded animate-pulse" />
                ))}
              </div>
            ) : !loadingStandings && (!standingsData?.table || standingsData.table.length === 0) ? (
              <p className="text-slate-500 text-sm">Nenhuma classificação disponível</p>
            ) : (
              <>
                <table className="w-full text-sm text-slate-200">
                  <thead className="text-xs text-slate-400 uppercase">
                    <tr>
                      <th className="text-left py-2">POS</th>
                      <th className="text-left py-2">TIME</th>
                      <th className="text-right py-2">PTS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(standingsData?.table || []).map((standing, index) => (
                      <tr key={standing.pos + "-" + standing.team} className="hover:bg-white/5">
                        <td className="py-2 text-slate-400 text-xs w-[2rem]">{standing.pos}</td>
                        <td className="py-2 flex items-center gap-2">
                          {standing.crest && standing.crest.includes('football-data.org') ? (
                            <Image 
                              src={standing.crest} 
                              alt={standing.team} 
                              width={20}
                              height={20}
                              className="h-5 w-5 rounded bg-slate-800 border border-white/10 object-contain"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="h-5 w-5 rounded bg-slate-700 border border-white/10 flex items-center justify-center">
                              <span className="text-xs text-slate-400 font-bold">
                                {standing.team.charAt(0)}
                              </span>
                            </div>
                          )}
                          <span className="text-slate-200 text-sm font-medium">{standing.team}</span>
                        </td>
                        <td className="py-2 text-right font-semibold text-slate-100">{standing.pts}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {standingsData?.captured_at && (
                  <p className="text-xs text-slate-500 mt-3">
                    Atualizado em {new Date(standingsData.captured_at).toLocaleString('pt-BR')}
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Rodapé */}
      <footer className="mt-12 text-center space-y-3 py-6 border-t border-slate-800">
        <div className="flex justify-center items-center gap-4 text-xs text-slate-500">
          <span>HypeFC Dashboard</span>
          <span>•</span>
          <span>Dados atualizados diariamente às 6:00 (horário de Brasília)</span>
          {lastUpdated && (
            <>
              <span>•</span>
              <span>Última atualização: {lastUpdated}</span>
            </>
          )}
        </div>
        
        <div className="flex justify-center items-center gap-6 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span>Criado por</span>
            <a 
              href="https://github.com/JE4NVRG" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
              <span className="font-medium">JEANVRG</span>
            </a>
          </div>
          
          <span>•</span>
          
          <div className="text-slate-500">
            <span>Sistema criado para empresa </span>
            <span className="font-medium text-slate-400">DEBAJEYU</span>
          </div>
        </div>
      </footer>
    </div>
  )
}