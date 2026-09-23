"use client"

import { useMemo, useState } from 'react'
import { Calendar, Zap } from 'lucide-react'
import { MatchRow } from '@/components/dashboard/TodayMatches'
import type { Match, HypeTeam } from '@/hooks/useDashboardData'
import { probabilidadeDoJogo, type RatingsPayload } from '@/lib/ratings'

/**
 * View da rodada: chips de liga no topo (troca em vez de rolar), faixa de times
 * em alta em uma linha, e os jogos em grade de ate 3 colunas. O container tem
 * altura de tela e so ele rola — a pagina em si nao rola.
 */
interface RoundViewProps {
  groupedMatches: Record<string, Match[]>
  loading: boolean
  isFallback?: boolean
  dayLabel?: string
  onSelect?: (match: Match) => void
  hypeByTeam?: Record<string, number>
  hypeTeams: HypeTeam[]
  ratings?: RatingsPayload | null
}

export function RoundView({
  groupedMatches,
  loading,
  isFallback,
  dayLabel,
  onSelect,
  hypeByTeam,
  hypeTeams,
  ratings,
}: RoundViewProps) {
  const [liga, setLiga] = useState<string>('todas')

  const leagues = useMemo(() => {
    return Object.entries(groupedMatches).map(([name, matches]) => ({ name, matches }))
  }, [groupedMatches])

  const total = useMemo(() => leagues.reduce((sum, l) => sum + l.matches.length, 0), [leagues])

  const visiveis = liga === 'todas' ? leagues : leagues.filter((l) => l.name === liga)

  return (
    <div className="flex h-full flex-col gap-2">
      {/* Cabeçalho da rodada + chips de liga: trocar de liga substitui a lista. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 text-emerald-400" />
          <span className="text-xs font-semibold text-slate-200">
            {isFallback ? 'Última rodada' : 'Jogos de hoje'}
          </span>
          {dayLabel ? <span className="text-[10px] text-amber-300/80">{dayLabel}</span> : null}
          {!loading && total > 0 ? (
            <span className="rounded-full bg-white/5 px-2 py-0.5 font-mono text-[10px] text-slate-400">{total} jogos</span>
          ) : null}
        </div>

        {leagues.length > 1 ? (
          <div className="flex flex-1 items-center gap-1 overflow-x-auto pb-0.5">
            <button
              type="button"
              onClick={() => setLiga('todas')}
              className={`shrink-0 cursor-pointer rounded-full px-2.5 py-1 text-[10px] font-medium transition focus:outline-none focus-visible:ring-1 focus-visible:ring-emerald-400/50 ${
                liga === 'todas' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/[0.04] text-slate-400 hover:text-slate-200'
              }`}
            >
              Todas
            </button>
            {leagues.map(({ name, matches }) => (
              <button
                key={name}
                type="button"
                onClick={() => setLiga(name)}
                aria-pressed={liga === name}
                className={`shrink-0 cursor-pointer rounded-full px-2.5 py-1 text-[10px] font-medium transition focus:outline-none focus-visible:ring-1 focus-visible:ring-emerald-400/50 ${
                  liga === name ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/[0.04] text-slate-400 hover:text-slate-200'
                }`}
                title={name}
              >
                <span className="max-w-[92px] truncate align-middle">{name}</span>
                <span className="ml-1.5 font-mono text-[9px] text-slate-500">{matches.length}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* Times em alta em uma faixa: custa 1 linha de altura, nao 1.180px. */}
      {hypeTeams.length > 0 ? (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          <Zap className="h-3 w-3 shrink-0 text-amber-400" />
          {hypeTeams.slice(0, 12).map((t) => (
            <span
              key={`${t.league_id}-${t.team}`}
              className="flex shrink-0 items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/[0.08] px-2 py-0.5 text-[10px] text-amber-200"
              title={`${t.team}${t.opponent ? ` vs ${t.opponent}` : ''}${t.time_local ? ` · ${t.time_local}` : ''}`}
            >
              <span className="font-mono font-semibold text-amber-300">{t.score ?? '—'}</span>
              <span className="max-w-[92px] truncate">{t.team}</span>
            </span>
          ))}
        </div>
      ) : null}

      {/* Lista: só ela rola. */}
      <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
        {loading ? (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-lg bg-white/5" />
            ))}
          </div>
        ) : visiveis.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <Calendar className="mb-2 h-7 w-7 text-slate-700" />
            <p className="text-sm text-slate-500">Nenhum jogo programado</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-x-3 gap-y-2 md:grid-cols-2 xl:grid-cols-3">
            {visiveis.map(({ name, matches }) => (
              <div key={name} className="min-w-0">
                <div className="mb-1 flex items-center gap-2">
                  <span className="truncate text-[9px] font-semibold uppercase tracking-wider text-slate-500" title={name}>
                    {name}
                  </span>
                  <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
                  <span className="font-mono text-[9px] text-slate-600">{matches.length}</span>
                </div>
                <div className="space-y-0.5">
                  {matches.map((match, i) => (
                    <MatchRow
                      key={`${match.league_id}-${match.home}-${match.away}-${i}`}
                      match={match}
                      onSelect={onSelect}
                      hypeByTeam={hypeByTeam}
                      prob={probabilidadeDoJogo(ratings ?? null, match.league_id, match.home, match.away)}
                    />
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
