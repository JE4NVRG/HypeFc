"use client"

import { Goal, Tv, CheckCircle2, Clock, BarChart3 } from 'lucide-react'
import type { DayStats } from '@/hooks/useDashboardData'

interface StatsBarProps {
  stats: DayStats | undefined
  loading: boolean
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-lg font-bold leading-tight text-white">{value}</p>
        <p className="text-[10px] font-medium uppercase tracking-wider text-slate-500">{label}</p>
      </div>
    </div>
  )
}

export function StatsBar({ stats, loading }: StatsBarProps) {
  if (loading || !stats) {
    return (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl bg-white/5" />
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      <StatCard
        icon={<Tv className="h-4 w-4 text-blue-400" />}
        label="Jogos"
        value={stats.totalMatches}
        color="bg-blue-500/10"
      />
      <StatCard
        icon={<Goal className="h-4 w-4 text-emerald-400" />}
        label="Gols"
        value={stats.totalGoals}
        color="bg-emerald-500/10"
      />
      <StatCard
        icon={<BarChart3 className="h-4 w-4 text-orange-400" />}
        label="Media/jogo"
        value={stats.avgGoals}
        color="bg-orange-500/10"
      />
      {stats.liveMatches > 0 ? (
        <StatCard
          icon={
            <span className="relative flex h-4 w-4 items-center justify-center">
              <span className="absolute h-3 w-3 animate-ping rounded-full bg-red-400/50" />
              <span className="relative h-2 w-2 rounded-full bg-red-400" />
            </span>
          }
          label="Ao vivo"
          value={stats.liveMatches}
          color="bg-red-500/10"
        />
      ) : (
        <StatCard
          icon={<CheckCircle2 className="h-4 w-4 text-slate-400" />}
          label="Encerrados"
          value={stats.finishedMatches}
          color="bg-slate-500/10"
        />
      )}
      <StatCard
        icon={<Clock className="h-4 w-4 text-violet-400" />}
        label={stats.scheduledMatches > 0 ? "A jogar" : "Ligas"}
        value={stats.scheduledMatches > 0 ? stats.scheduledMatches : stats.leaguesActive}
        color="bg-violet-500/10"
      />
    </div>
  )
}
