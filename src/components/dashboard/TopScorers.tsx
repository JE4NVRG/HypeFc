"use client"

import Image from 'next/image'
import { Target } from 'lucide-react'
import type { Scorer } from '@/hooks/useDashboardData'

interface TopScorersProps {
  scorers: Scorer[]
  loading: boolean
}

function getMedalColor(index: number) {
  if (index === 0) return 'text-yellow-400 bg-yellow-500/10'
  if (index === 1) return 'text-slate-300 bg-slate-500/10'
  if (index === 2) return 'text-orange-400 bg-orange-500/10'
  return 'text-slate-500 bg-white/5'
}

export function TopScorers({ scorers, loading }: TopScorersProps) {
  return (
    <div className="flex flex-col rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/10">
          <Target className="h-3.5 w-3.5 text-violet-400" />
        </div>
        <h2 className="text-sm font-semibold text-slate-200">Artilheiros</h2>
        {!loading && scorers.length > 0 && (
          <span className="ml-auto rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium text-slate-400">
            top {scorers.length}
          </span>
        )}
      </div>

      <div className="flex-1">
        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-white/5" />
            ))}
          </div>
        ) : scorers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Target className="mb-3 h-8 w-8 text-slate-700" />
            <p className="text-sm text-slate-500">Sem dados de artilheiros</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {scorers.map((scorer, i) => (
              <div
                key={`${scorer.player}-${i}`}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/[0.04]"
              >
                <span className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${getMedalColor(i)}`}>
                  {i + 1}
                </span>
                {scorer.team_crest ? (
                  <Image
                    src={scorer.team_crest}
                    alt={scorer.team}
                    width={16}
                    height={16}
                    className="h-4 w-4 flex-shrink-0 rounded object-contain"
                  />
                ) : (
                  <div className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded bg-slate-800 text-[8px] font-bold text-slate-500">
                    {scorer.team.charAt(0)}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-slate-200">{scorer.player}</span>
                  <span className="text-[10px] text-slate-500">{scorer.team}</span>
                </div>
                <div className="flex items-center gap-2 text-right">
                  <div>
                    <span className="block text-sm font-bold text-white">{scorer.goals}</span>
                    <span className="text-[9px] text-slate-600">gols</span>
                  </div>
                  {scorer.assists > 0 && (
                    <div>
                      <span className="block text-xs font-medium text-slate-400">{scorer.assists}</span>
                      <span className="text-[9px] text-slate-600">ast</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
