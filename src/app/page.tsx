"use client"

import { useDashboardData } from '@/hooks/useDashboardData'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { TodayMatches } from '@/components/dashboard/TodayMatches'
import { HypeFlags } from '@/components/dashboard/HypeFlags'
import { LeagueStandings } from '@/components/dashboard/LeagueStandings'
import { DashboardFooter } from '@/components/dashboard/DashboardFooter'

export default function Home() {
  const {
    todayData,
    standingsData,
    leagueId,
    loadingToday,
    loadingStandings,
    lastUpdated,
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
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
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
        </div>
      </main>

      <DashboardFooter />
    </div>
  )
}
