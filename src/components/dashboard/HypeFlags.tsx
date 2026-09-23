"use client"

import Image from 'next/image'
import { Flame, TrendingUp, Trophy, Swords } from 'lucide-react'
import type { HypeTeam } from '@/hooks/useDashboardData'

export function isAllowedCrest(url: string): boolean {
  return url.includes('football-data.org') || url.includes('espncdn.com')
}

interface HypeFlagsProps {
  hypeTeams: HypeTeam[]
  loading: boolean
}

const priorityConfig: Record<number, { color: string; bg: string; border: string; glow: string; icon: React.ReactNode }> = {
  1: {
    color: 'text-red-400',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20',
    glow: 'shadow-red-500/10',
    icon: <Trophy className="h-3 w-3" />,
  },
  2: {
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/20',
    glow: 'shadow-orange-500/10',
    icon: <TrendingUp className="h-3 w-3" />,
  },
  3: {
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    glow: 'shadow-emerald-500/10',
    icon: <Swords className="h-3 w-3" />,
  },
  4: {
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    glow: 'shadow-blue-500/10',
    icon: <Swords className="h-3 w-3" />,
  },
}

function FormPills({ form }: { form?: Array<'W' | 'D' | 'L'> }) {
  if (!form?.length) return null
  return (
    <div className="flex gap-0.5">
      {form.map((letter, index) => (
        <span
          key={`${letter}-${index}`}
          className={`flex h-3.5 w-3.5 items-center justify-center rounded-[3px] text-[8px] font-bold ${
            letter === 'W' ? 'bg-emerald-500/20 text-emerald-300' : letter === 'D' ? 'bg-slate-500/20 text-slate-300' : 'bg-red-500/20 text-red-300'
          }`}
        >
          {letter}
        </span>
      ))}
    </div>
  )
}

function HypeCard({ team, rank }: { team: HypeTeam; rank: number }) {
  const config = priorityConfig[team.priority] || priorityConfig[3]
  const live = team.match_status === 'IN_PLAY' || team.match_status === 'PAUSED'

  return (
    <div className={`group relative flex items-center gap-3 rounded-xl border ${config.border} ${config.bg} p-3 shadow-lg ${config.glow} transition-all hover:scale-[1.02] hover:shadow-xl`}>
      <div className="flex w-5 flex-shrink-0 justify-center font-mono text-[11px] font-semibold text-slate-500">
        {rank}
      </div>
      <div className="flex-shrink-0">
        {team.crest && isAllowedCrest(team.crest) ? (
          <Image
            src={team.crest}
            alt={team.team}
            width={32}
            height={32}
            className="h-8 w-8 rounded-lg object-contain"
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-sm font-bold text-slate-400">
            {team.team.charAt(0)}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {team.position && (
            <span className="text-[10px] font-medium text-slate-500">#{team.position}</span>
          )}
          <span className="truncate text-sm font-semibold text-slate-100">{team.team}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          <div className={`flex min-w-0 items-center gap-1 text-[11px] ${config.color}`}>
            {config.icon}
            <span className="truncate">{team.reason}</span>
          </div>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <FormPills form={team.form} />
          {team.opponent && (
            <span className="truncate text-[10px] text-slate-500">
              vs {team.opponent}{live ? ' · ao vivo' : team.time_local ? ` · ${team.time_local}` : ''}
            </span>
          )}
        </div>
      </div>

      {typeof team.score === 'number' && (
        <div className="flex-shrink-0 text-right">
          <div className="font-mono text-sm font-bold text-white">{team.score}</div>
          <div className="text-[9px] uppercase tracking-wider text-slate-500">hype</div>
        </div>
      )}
    </div>
  )
}

export function HypeFlags({ hypeTeams, loading }: HypeFlagsProps) {
  return (
    <div className="flex flex-col rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-500/10">
          <Flame className="h-3.5 w-3.5 text-orange-400" />
        </div>
        <h2 className="text-sm font-semibold text-slate-200">Times em Alta</h2>
        {!loading && hypeTeams.length > 0 && (
          <span className="ml-auto rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium text-slate-400">
            {hypeTeams.length} times
          </span>
        )}
      </div>

      <div className="flex-1">
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-white/5" />
            ))}
          </div>
        ) : hypeTeams.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Flame className="mb-3 h-8 w-8 text-slate-700" />
            <p className="text-sm text-slate-500">Nenhum time em destaque hoje</p>
          </div>
        ) : (
          <div className="space-y-2">
            {hypeTeams.map((team, i) => (
              <HypeCard key={`${team.team}-${team.league_id}`} team={team} rank={i + 1} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
