"use client"

import Image from 'next/image'
import { Trophy } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Standing } from '@/hooks/useDashboardData'
import { isAllowedCrest } from '@/components/dashboard/HypeFlags'

interface LeagueStandingsProps {
  standings: Standing[]
  leagueId: string
  leagueName: string
  capturedAt: string | null
  loading: boolean
  onLeagueChange: (id: string) => void
}

const LEAGUES = [
  { id: 'BSA', name: 'Brasileirao Serie A', flag: '\u{1F1E7}\u{1F1F7}' },
  { id: 'PL', name: 'Premier League', flag: '\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}' },
  { id: 'PD', name: 'La Liga', flag: '\u{1F1EA}\u{1F1F8}' },
  { id: 'SA', name: 'Serie A', flag: '\u{1F1EE}\u{1F1F9}' },
  { id: 'FL1', name: 'Ligue 1', flag: '\u{1F1EB}\u{1F1F7}' },
  { id: 'BL1', name: 'Bundesliga', flag: '\u{1F1E9}\u{1F1EA}' },
  { id: 'DED', name: 'Eredivisie', flag: '\u{1F1F3}\u{1F1F1}' },
  { id: 'PPL', name: 'Primeira Liga', flag: '\u{1F1F5}\u{1F1F9}' },
  { id: 'ELC', name: 'Championship', flag: '\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}' },
  { id: 'CL', name: 'Champions League', flag: '\u{1F3C6}' },
] as const

function getPositionStyle(pos: number, totalTeams: number) {
  if (pos <= 4) return 'border-l-emerald-500/60 bg-emerald-500/[0.04]'
  if (pos <= 6) return 'border-l-blue-500/60 bg-blue-500/[0.03]'
  if (totalTeams > 0 && pos > totalTeams - 4) return 'border-l-red-500/60 bg-red-500/[0.04]'
  return 'border-l-transparent'
}

// As zonas mudam por pais: no Brasil nao existe vaga de Champions/Europa.
function getZones(leagueId: string, totalTeams: number) {
  const relegated = totalTeams > 0 ? totalTeams - 3 : 4
  if (leagueId === 'BSA') {
    return [
      { color: 'bg-emerald-500/60', label: `Libertadores (1-4)` },
      { color: 'bg-blue-500/60', label: `Sul-Americana (5-6)` },
      { color: 'bg-red-500/60', label: `Rebaixamento (${relegated}-${totalTeams || 20})` },
    ]
  }
  if (leagueId === 'ELC') {
    return [
      { color: 'bg-emerald-500/60', label: 'Acesso (1-2)' },
      { color: 'bg-blue-500/60', label: 'Playoff de acesso (3-6)' },
      { color: 'bg-red-500/60', label: `Rebaixamento (${relegated}-${totalTeams || 24})` },
    ]
  }
  if (leagueId === 'CL') return []
  return [
    { color: 'bg-emerald-500/60', label: 'Champions' },
    { color: 'bg-blue-500/60', label: 'Europa' },
    { color: 'bg-red-500/60', label: `Rebaixamento (${relegated}-${totalTeams || 20})` },
  ]
}

export function LeagueStandings({
  standings,
  leagueId,
  capturedAt,
  loading,
  onLeagueChange,
}: LeagueStandingsProps) {
  return (
    <div className="flex flex-col rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-yellow-500/10">
          <Trophy className="h-3.5 w-3.5 text-yellow-400" />
        </div>
        <h2 className="text-sm font-semibold text-slate-200">Classificacao</h2>
      </div>

      <Select value={leagueId} onValueChange={onLeagueChange}>
        <SelectTrigger className="mb-4 border-white/10 bg-white/5 text-sm text-slate-200 focus:ring-orange-500/30">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="border-white/10 bg-slate-900">
          {LEAGUES.map((league) => (
            <SelectItem key={league.id} value={league.id} className="text-slate-200 focus:bg-white/10 focus:text-white">
              <span className="flex items-center gap-2">
                <span>{league.flag}</span>
                <span>{league.name}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex-1">
        {loading ? (
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-9 animate-pulse rounded bg-white/5" />
            ))}
          </div>
        ) : standings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Trophy className="mb-3 h-8 w-8 text-slate-700" />
            <p className="text-sm text-slate-500">Sem classificacao disponivel</p>
          </div>
        ) : (
          <>
            <div className="mb-1 grid grid-cols-[1.5rem_1fr_1.8rem_1.8rem_1.8rem_1.8rem_2.2rem] items-center gap-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              <span>#</span>
              <span>Time</span>
              <span className="text-center">J</span>
              <span className="text-center">V</span>
              <span className="text-center">E</span>
              <span className="text-center">D</span>
              <span className="text-right">Pts</span>
            </div>

            <div className="space-y-0.5">
              {standings.map((s) => (
                <div
                  key={`${s.pos}-${s.team}`}
                  className={`grid grid-cols-[1.5rem_1fr_1.8rem_1.8rem_1.8rem_1.8rem_2.2rem] items-center gap-1 rounded-lg border-l-2 px-2 py-2 transition-colors hover:bg-white/[0.04] ${getPositionStyle(s.pos, standings.length)}`}
                >
                  <span className="text-xs font-medium text-slate-500">{s.pos}</span>
                  <div className="flex items-center gap-2 overflow-hidden">
                    {s.crest && isAllowedCrest(s.crest) ? (
                      <Image
                        src={s.crest}
                        alt={s.team}
                        width={18}
                        height={18}
                        className="h-[18px] w-[18px] flex-shrink-0 rounded object-contain"
                      />
                    ) : (
                      <div className="flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded bg-slate-800 text-[9px] font-bold text-slate-500">
                        {s.team.charAt(0)}
                      </div>
                    )}
                    <span className="truncate text-xs font-medium text-slate-200">{s.team}</span>
                  </div>
                  <span className="text-center text-xs text-slate-500">{s.played}</span>
                  <span className="text-center text-xs text-slate-400">{s.wins}</span>
                  <span className="text-center text-xs text-slate-500">{s.draws}</span>
                  <span className="text-center text-xs text-slate-500">{s.losses}</span>
                  <span className="text-right text-xs font-bold text-slate-100">{s.pts}</span>
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap gap-3 text-[10px] text-slate-600">
              {getZones(leagueId, standings.length).map((zone) => (
                <span key={zone.label} className="flex items-center gap-1">
                  <span className={`h-2 w-2 rounded-full ${zone.color}`} /> {zone.label}
                </span>
              ))}
            </div>

            {capturedAt && (
              <p className="mt-3 text-[10px] text-slate-600">
                Atualizado em {new Date(capturedAt).toLocaleString('pt-BR')}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
