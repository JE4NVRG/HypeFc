"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDashboardData } from '@/hooks/useDashboardData'
import type { Match } from '@/hooks/useDashboardData'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import { StatsBar } from '@/components/dashboard/StatsBar'
import { TodayMatches } from '@/components/dashboard/TodayMatches'
import { HypeFlags } from '@/components/dashboard/HypeFlags'
import { LeagueTabs } from '@/components/dashboard/LeagueTabs'
import { HypeRecord } from '@/components/dashboard/HypeRecord'
import { ShareRound } from '@/components/dashboard/ShareRound'
import { SourcesPanel } from '@/components/dashboard/SourcesPanel'
import { MatchDetailPanel } from '@/components/dashboard/MatchDetailPanel'
import { DashboardFooter } from '@/components/dashboard/DashboardFooter'

function formatDay(iso: string): string {
  const [year, month, day] = iso.split('-')
  if (!year || !month || !day) return iso
  return `${day}/${month}/${year}`
}

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
    loadDay,
  } = useDashboardData()

  // Uma pagina so: o detalhe abre por cima, sem tirar o usuario da rodada.
  const [selected, setSelected] = useState<Match | null>(null)
  const [linkNotice, setLinkNotice] = useState('')
  const diaPedido = useRef(false)
  const diaAberto = useRef(false)

  const diaAtual = todayData?.date ?? ''

  // URL absoluta so depois de montar: no build estatico nao existe window.
  const [urlBase, setUrlBase] = useState('')
  useEffect(() => {
    setUrlBase(window.location.origin + window.location.pathname)
  }, [])

  // Texto de compartilhamento: fato medido, sem promessa de ganho.
  const textoRodada = useMemo(() => {
    const s = todayData?.stats
    const partes: string[] = []
    if (diaAtual) partes.push(`Rodada de ${formatDay(diaAtual)}`)
    if (s) partes.push(`${s.totalMatches} jogos, ${s.totalGoals} gols`)
    partes.push('Score calibrado com recorde público medido')
    return partes.join(' · ')
  }, [todayData, diaAtual])

  // Times em alta por nome: o selo do score vai para dentro do confronto.
  const hypePorTime = useMemo(() => {
    const mapa: Record<string, number> = {}
    for (const t of todayData?.hype ?? []) {
      if (t?.team && typeof t.score === 'number') mapa[t.team] = t.score
    }
    return mapa
  }, [todayData])

  // Abrir gera uma entrada no historico: o botao voltar do navegador fecha o
  // painel, e o link daquele confronto fica copiavel na barra de endereco.
  const abrirConfronto = useCallback(
    (match: Match) => {
      setSelected(match)
      setLinkNotice('')
      if (typeof window === 'undefined') return
      const params = new URLSearchParams({ jogo: String(match.event_id), dia: diaAtual })
      window.history.pushState({ jogo: String(match.event_id) }, '', `?${params.toString()}`)
    },
    [diaAtual]
  )

  const fecharConfronto = useCallback(() => {
    // Se a URL tem o confronto, fechar e voltar (limpa o link); senao so fecha.
    if (typeof window !== 'undefined' && window.location.search.includes('jogo=')) {
      window.history.back()
      return
    }
    setSelected(null)
  }, [])

  useEffect(() => {
    const onPop = () => {
      const id = new URLSearchParams(window.location.search).get('jogo')
      if (!id) {
        setSelected(null)
        return
      }
      const alvo = todayData?.matches?.find(m => String(m.event_id) === id)
      setSelected(alvo ?? null)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [todayData])

  // Link compartilhado: ?jogo=<eventId>&dia=YYYY-MM-DD
  useEffect(() => {
    if (!todayData || diaAberto.current) return
    const params = new URLSearchParams(window.location.search)
    const jogo = params.get('jogo')
    const dia = params.get('dia')

    // O dia veio no link e nao e o que esta carregado: busca ele (sem procurar
    // para tras). Depois de carregar, este efeito roda de novo e abre o jogo.
    if (dia && /^\d{4}-\d{2}-\d{2}$/.test(dia) && dia !== todayData.date && !diaPedido.current) {
      diaPedido.current = true
      loadDay(dia)
      return
    }

    diaAberto.current = true
    if (!jogo) return
    const alvo = todayData.matches?.find(m => String(m.event_id) === jogo)
    if (alvo) {
      setSelected(alvo)
      return
    }
    setLinkNotice('Esse confronto nao esta na rodada exibida.')
  }, [todayData, loadDay])

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
        {linkNotice && (
          <div className="mb-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            {linkNotice}
          </div>
        )}
        {todayData?.is_fallback && (
          <div className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            <span className="font-medium">Sem jogos hoje.</span>
            <span className="text-amber-200/80">
              Mostrando a ultima rodada com jogos: {formatDay(todayData.date)}.
            </span>
            {todayData.requested_date && (
              <span className="text-amber-200/60">Hoje: {formatDay(todayData.requested_date)}.</span>
            )}
          </div>
        )}
        {/* Stats resumo do dia */}
        <div className="mb-3">
          <StatsBar stats={todayData?.stats} loading={loadingToday} />
        </div>

        <div className="mb-3">
          <ShareRound
            url={diaAtual && urlBase ? `${urlBase}?dia=${diaAtual}` : urlBase}
            text={textoRodada}
          />
        </div>

        {/* A rodada domina a primeira tela (spec: em 390px nada alem dos jogos
            ocupa a dobra); o resto desce depois. */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <TodayMatches
              groupedMatches={groupedMatches}
              loading={loadingToday}
              isFallback={todayData?.is_fallback}
              dayLabel={todayData?.date ? formatDay(todayData.date) : undefined}
              onSelect={abrirConfronto}
              hypeByTeam={hypePorTime}
            />
          </div>
          <HypeFlags
            hypeTeams={todayData?.hype ?? []}
            loading={loadingToday}
          />
        </div>

        <div className="mt-3">
          <LeagueTabs
            standingsData={standingsData}
            scorersData={scorersData}
            leagueId={leagueId}
            loadingStandings={loadingStandings}
            loadingScorers={loadingScorers}
            onLeagueChange={setLeagueId}
          />
        </div>

        <div className="mt-3">
          <HypeRecord />
        </div>

        <div className="mt-3">
          <SourcesPanel
            stats={
              todayData?.stats
                ? { totalMatches: todayData.stats.totalMatches, totalGoals: todayData.stats.totalGoals }
                : null
            }
            leagueCount={todayData?.stats?.leaguesActive ?? 0}
            liveCount={todayData?.stats?.liveMatches ?? 0}
            lastUpdated={lastUpdated}
          />
        </div>

        <MatchDetailPanel
          eventId={selected?.event_id ?? null}
          leagueId={selected?.league_id ?? ''}
          leagueName={selected?.league_name ?? ''}
          homeId={selected?.home_id ?? null}
          awayId={selected?.away_id ?? null}
          onClose={fecharConfronto}
        />
      </main>

      <DashboardFooter source={todayData?.source} />
    </div>
  )
}
