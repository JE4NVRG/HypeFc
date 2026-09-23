"use client"

import Image from 'next/image'
import { Calendar } from 'lucide-react'
import type { Match } from '@/hooks/useDashboardData'

interface TodayMatchesProps {
  groupedMatches: Record<string, Match[]>
  loading: boolean
}

function Crest({ src, name }: { src?: string | null; name: string }) {
  if (src) {
    return <Image src={src} alt={name} width={20} height={20} className="h-5 w-5 flex-shrink-0 rounded object-contain" />
  }
  return (
    <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded bg-slate-800 text-[9px] font-bold text-slate-500">
      {name.charAt(0)}
    </div>
  )
}

function MatchCenter({ match }: { match: Match }) {
  const isLive = match.status === 'IN_PLAY' || match.status === 'PAUSED'
  const isFinished = match.status === 'FINISHED'
  const hasScore = match.score_home !== null && match.score_away !== null

  if (hasScore && (isLive || isFinished)) {
    return (
      <div className={`flex flex-shrink-0 flex-col items-center rounded-md px-2 py-0.5 ${isLive ? 'bg-emerald-500/15' : 'bg-slate-800/60'}`}>
        <span className={`font-mono text-xs font-bold leading-tight ${isLive ? 'text-emerald-300' : 'text-slate-300'}`}>
          {match.score_home} - {match.score_away}
        </span>
        {isLive && (
          <span className="flex items-center gap-0.5 text-[8px] font-bold uppercase leading-tight text-emerald-400">
            <span className="h-1 w-1 animate-pulse rounded-full bg-emerald-400" />
            live
          </span>
        )}
        {isFinished && (
          <span className="text-[8px] font-medium uppercase leading-tight text-slate-600">fim</span>
        )}
      </div>
    )
  }

  return (
    <div className="flex-shrink-0 rounded-md bg-slate-800/60 px-2 py-1">
      <span className="font-mono text-xs font-semibold text-slate-400">{match.time_local}</span>
    </div>
  )
}

function MatchRow({ match }: { match: Match }) {
  const isLive = match.status === 'IN_PLAY' || match.status === 'PAUSED'

  return (
    <div className={`flex items-center gap-1.5 rounded-lg px-2 py-2 transition-colors ${isLive ? 'bg-emerald-500/[0.06] ring-1 ring-emerald-500/10' : 'bg-white/[0.03] hover:bg-white/[0.06]'}`}>
      {/* Casa */}
      <div className="flex flex-1 items-center justify-end gap-1.5 overflow-hidden text-right">
        <span className="truncate text-sm font-medium text-slate-200">
          {match.home_position ? <span className="mr-1 font-mono text-[10px] text-slate-500">#{match.home_position}</span> : null}
          {match.home}
        </span>
        <Crest src={match.home_crest} name={match.home} />
      </div>

      <MatchCenter match={match} />

      {/* Visitante */}
      <div className="flex flex-1 items-center gap-1.5 overflow-hidden">
        <Crest src={match.away_crest} name={match.away} />
        <span className="truncate text-sm font-medium text-slate-200">
          {match.away}
          {match.away_position ? <span className="ml-1 font-mono text-[10px] text-slate-500">#{match.away_position}</span> : null}
        </span>
      </div>
    </div>
  )
}

export function TodayMatches({ groupedMatches, loading }: TodayMatchesProps) {
  const leagueEntries = Object.entries(groupedMatches)

  return (
    <div className="flex flex-col rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10">
          <Calendar className="h-3.5 w-3.5 text-emerald-400" />
        </div>
        <h2 className="text-sm font-semibold text-slate-200">Jogos de Hoje</h2>
        {!loading && leagueEntries.length > 0 && (
          <span className="ml-auto rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium text-slate-400">
            {leagueEntries.reduce((sum, [, m]) => sum + m.length, 0)} jogos
          </span>
        )}
      </div>

      <div className="flex-1">
        {loading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-white/5" />
            ))}
          </div>
        ) : leagueEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Calendar className="mb-3 h-8 w-8 text-slate-700" />
            <p className="text-sm text-slate-500">Nenhum jogo programado para hoje</p>
          </div>
        ) : (
          <div className="space-y-3">
            {leagueEntries.map(([leagueName, matches]) => (
              <div key={leagueName}>
                <div className="mb-1.5 flex items-center gap-2">
                  <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
                    {leagueName}
                  </span>
                  <div className="h-px flex-1 bg-gradient-to-l from-white/10 to-transparent" />
                </div>
                <div className="space-y-0.5">
                  {matches.map((match, i) => (
                    <MatchRow key={`${match.league_id}-${match.home}-${match.away}-${i}`} match={match} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
