"use client"

import { useDashboardData } from '@/hooks/useDashboardData'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { StatsBar } from '@/components/dashboard/StatsBar'
import { TodayMatches } from '@/components/dashboard/TodayMatches'
import { HypeFlags } from '@/components/dashboard/HypeFlags'
import { LeagueStandings } from '@/components/dashboard/LeagueStandings'
import { LeagueIntel } from '@/components/dashboard/LeagueIntel'
import { TopScorers } from '@/components/dashboard/TopScorers'
import { DashboardFooter } from '@/components/dashboard/DashboardFooter'

export default function Home() {
  const {
    todayData,
    standingsData,
    scorersData,
    leagueId,
    loadingToday,
    loadingStandings,
    loadingScorers,
    lastUpdated,
    error,
    isLoading,
    hasLiveMatches,
    setLeagueId,
    refresh,
    groupedMatches,
  } = useDashboardData()

  return (
    <div className="flex min-h-screen flex-col">
      <DashboardHeader
        isLoading={isLoading}
        lastUpdated={lastUpdated}
        hasLiveMatches={hasLiveMatches}
        onRefresh={refresh}
      />

      <main className="w-full flex-1 px-2 py-3 sm:px-4 sm:py-4">
        {error && (
          <div className="mb-3 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        )}
        {/* Stats resumo do dia */}
        <div className="mb-3">
          <StatsBar stats={todayData?.stats} loading={loadingToday} />
        </div>

        {/* Grid principal */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          <TodayMatches
            groupedMatches={groupedMatches}
            loading={loadingToday}
          />
          <HypeFlags
            hypeTeams={todayData?.hype ?? []}
            loading={loadingToday}
          />
          <LeagueStandings
            standings={standingsData?.table ?? []}
            leagueId={leagueId}
            leagueName={standingsData?.league_name ?? ''}
            capturedAt={standingsData?.captured_at ?? null}
            loading={loadingStandings}
            onLeagueChange={setLeagueId}
          />
          <TopScorers
            scorers={scorersData?.scorers ?? []}
            loading={loadingScorers}
          />
        </div>

        <LeagueIntel
          table={standingsData?.table ?? []}
          home={standingsData?.home}
          away={standingsData?.away}
          leagueName={standingsData?.league_name ?? ''}
          loading={loadingStandings}
        />
      </main>

      <DashboardFooter />
    </div>
  )
}
