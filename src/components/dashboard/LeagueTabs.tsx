"use client"

import { useState } from 'react'
import { Trophy, TrendingUp, Target } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LeagueStandings } from '@/components/dashboard/LeagueStandings'
import type { TitleOddsPayload } from '@/lib/titleOdds'
import { LeagueIntel } from '@/components/dashboard/LeagueIntel'
import { TopScorers } from '@/components/dashboard/TopScorers'
import { LEAGUE_NAMES } from '@/types'
import type { StandingsData, ScorersData } from '@/hooks/useDashboardData'

/**
 * Uma secao de liga em vez de tres: classificacao, rendimento por mando e
 * artilheiros respondem ao mesmo leagueId, entao dividem o mesmo seletor e
 * so uma visao fica montada por vez. Antes eram 2.121px de rolagem empilhada.
 */
interface LeagueTabsProps {
  standingsData: StandingsData | null
  scorersData: ScorersData | null
  leagueId: string
  loadingStandings: boolean
  loadingScorers: boolean
  onLeagueChange: (id: string) => void
  /** Simulacao da temporada (public/data/title-odds.json) — coluna "Tit.". */
  titleOdds?: TitleOddsPayload | null
}

const TABS = [
  { id: 'classificacao', label: 'Classificação', icon: Trophy },
  { id: 'rendimento', label: 'Rendimento', icon: TrendingUp },
  { id: 'artilheiros', label: 'Artilheiros', icon: Target },
] as const

type TabId = (typeof TABS)[number]['id']

export function LeagueTabs({
  standingsData,
  scorersData,
  leagueId,
  loadingStandings,
  loadingScorers,
  onLeagueChange,
  titleOdds = null,
}: LeagueTabsProps) {
  const [tab, setTab] = useState<TabId>('classificacao')
  const leagueName = standingsData?.league_name ?? ''

  return (
    <div className="flex flex-col rounded-xl border border-ink/[0.06] bg-ink/[0.02] p-4">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {/* Abas de verdade (44px no toque / 36px no desktop, o piso do contrato): erram menos o dedo. */}
        <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Visões da liga">
          {TABS.map(({ id, label, icon: Icon }) => {
            const ativo = tab === id
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={ativo}
                onClick={() => setTab(id)}
                className={`inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/60 md:min-h-[36px] ${
                  ativo
                    ? 'border-ink/20 bg-ink/[0.1] text-ink'
                    : 'border-transparent text-ink-2 hover:bg-ink/[0.06] hover:text-ink'
                }`}
              >
                <Icon className={`h-4 w-4 flex-shrink-0 ${ativo ? 'text-ink-2' : 'text-ink-3'}`} />
                {label}
              </button>
            )
          })}
        </div>

        <div className="ml-auto min-w-[180px]">
          <Select value={leagueId} onValueChange={onLeagueChange}>
            <SelectTrigger className="h-11 border-ink/10 bg-ink/5 text-[13px] text-ink focus:ring-2 focus:ring-ink/60 md:h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="border-ink/10 bg-paper-2">
              {Object.entries(LEAGUE_NAMES).map(([id, nome]) => (
                <SelectItem
                  key={id}
                  value={id}
                  className="text-[13px] text-ink focus:bg-ink/10 focus:text-ink"
                >
                  {nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* So a visao ativa fica montada: 20 linhas de tabela + 38 artilheiros
          montados ao mesmo tempo so serviriam para pesar o scroll. */}
      {tab === 'classificacao' && (
        <LeagueStandings
          standings={standingsData?.table ?? []}
          leagueId={leagueId}
          leagueName={leagueName}
          capturedAt={standingsData?.captured_at ?? null}
          loading={loadingStandings}
          onLeagueChange={onLeagueChange}
          showLeagueSelect={false}
          titleOdds={titleOdds}
        />
      )}

      {tab === 'rendimento' && (
        <LeagueIntel
          table={standingsData?.table ?? []}
          home={standingsData?.home}
          away={standingsData?.away}
          leagueName={leagueName}
          loading={loadingStandings}
        />
      )}

      {tab === 'artilheiros' && (
        <TopScorers scorers={scorersData?.scorers ?? []} loading={loadingScorers} />
      )}
    </div>
  )
}
