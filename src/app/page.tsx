"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDashboardData } from '@/hooks/useDashboardData'
import type { Match } from '@/hooks/useDashboardData'
import { DashboardHeader } from '@/components/dashboard/DashboardHeader'
import ResgatePro from '@/components/dashboard/ResgatePro'
import { StatsBar } from '@/components/dashboard/StatsBar'
import { ViewTabs } from '@/components/dashboard/ViewTabs'
import type { ViewId } from '@/components/dashboard/ViewTabs'
import { ProView, avisarMudanca } from '@/components/dashboard/ProView'
import { ativar } from '@/lib/proStore'
import { RoundView } from '@/components/dashboard/RoundView'
import { SportsView } from '@/components/dashboard/SportsView'
import { loadRatings, probabilidadeDoJogo, type RatingsPayload } from '@/lib/ratings'
import { loadTitleOdds, type TitleOddsPayload } from '@/lib/titleOdds'
import { LeagueTabs } from '@/components/dashboard/LeagueTabs'
import { HypeRecord } from '@/components/dashboard/HypeRecord'
import { ShareRound } from '@/components/dashboard/ShareRound'
import { SourcesPanel } from '@/components/dashboard/SourcesPanel'
import { MatchDetailPanel } from '@/components/dashboard/MatchDetailPanel'
import { SiteFooter } from '@/components/site/SiteFooter'
import { buscarPayload } from '@/lib/payloadSource'

/** Formato cru de public/data/probability-record.json (registro ja liquidado). */
interface PayloadRecorde {
  sample?: { predicted_matches?: number }
  metrics?: {
    model?: { brier?: number; top_pick_hit_rate?: number }
    uniform?: { brier?: number }
  }
  anchor?: { best_placed_hit_rate?: number | null }
}

/** Formato cru de public/data/probability-forward.json (registro em formacao). */
interface PayloadForward {
  counts?: { pendentes?: number }
  metrics?: { n?: number; brier?: number | null; top_pick_hit_rate?: number | null }
}

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
  // Cockpit: a view troca o conteudo em vez de empilhar rolagem.
  const [view, setView] = useState<ViewId>('rodada')
  // Ratings do modelo (arquivo estatico do build) e o recorde medido dele.
  const [ratings, setRatings] = useState<RatingsPayload | null>(null)
  const [titleOdds, setTitleOdds] = useState<TitleOddsPayload | null>(null)
  const [probRecord, setProbRecord] = useState<{ n: number; brier: number; uniformBrier: number; bestPlaced: number | null; hitRate: number } | null>(null)
  // Recorde EM PRODUCAO: previsoes gravadas antes do jogo e liquidadas depois.
  const [probForward, setProbForward] = useState<{ n: number; brier: number | null; hitRate: number | null; pendentes: number } | null>(null)
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

  const totalRodada = Object.values(groupedMatches).reduce((sum, list) => sum + list.length, 0)

  // Modelo de probabilidade: ratings do build + o recorde medido dele.
  useEffect(() => {
    let vivo = true
    loadRatings().then((payload) => {
      if (vivo) setRatings(payload)
    })
    loadTitleOdds().then((payload) => {
      if (vivo) setTitleOdds(payload)
    })
    buscarPayload<PayloadRecorde>('probability-record')
      .then((dados) => {
        if (!vivo || !dados?.metrics) return
        setProbRecord({
          n: dados.sample?.predicted_matches ?? 0,
          brier: dados.metrics.model?.brier ?? 0,
          uniformBrier: dados.metrics.uniform?.brier ?? 0,
          bestPlaced: dados.anchor?.best_placed_hit_rate ?? null,
          hitRate: dados.metrics.model?.top_pick_hit_rate ?? 0,
        })
      })
      .catch(() => {})
    buscarPayload<PayloadForward>('probability-forward')
      .then((dados) => {
        if (!vivo || !dados?.counts) return
        setProbForward({
          n: dados.metrics?.n ?? 0,
          brier: dados.metrics?.brier ?? null,
          hitRate: dados.metrics?.top_pick_hit_rate ?? null,
          pendentes: dados.counts.pendentes ?? 0,
        })
      })
      .catch(() => {})
    return () => {
      vivo = false
    }
  }, [])

  // Link do pos-pagamento: /?ativar=1&email=...&codigo=...
  // Troca o codigo de uso unico pela chave de acesso e ja abre a aba Pro. O
  // codigo sai da URL assim que e aceito: link de ativacao nao fica no historico
  // nem no autocompletar de quem compartilha a barra de enderecos.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)

    const viewPedida = params.get('view')
    if (viewPedida && ['rodada', 'liga', 'record', 'esportes', 'pro'].includes(viewPedida)) {
      setView(viewPedida as ViewId)
    }

    if (!params.get('ativar')) return
    const email = params.get('email') || ''
    const codigo = params.get('codigo') || ''
    setView('pro')

    if (!email || !codigo) {
      setLinkNotice('Link de ativação incompleto: falta o e-mail ou o código. Use o link exatamente como recebeu.')
      return
    }

    let vivo = true
    ativar(email, codigo)
      .then((r) => {
        if (!vivo) return
        if (r.ok) {
          // A aba Pro pode ter montado antes do token existir: avisa para ela
          // reler o acesso em vez de continuar dizendo "sem acesso".
          avisarMudanca()
          setLinkNotice(`Acesso ativado${r.plan === 'pro' ? ' no plano Pro' : ''}. Ligue os alertas nesta aba para receber o aviso antes da rodada.`)
          const url = new URL(window.location.href)
          ;['ativar', 'email', 'codigo'].forEach((k) => url.searchParams.delete(k))
          window.history.replaceState(null, '', url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : ''))
        } else {
          setLinkNotice(`Não deu para ativar: ${r.erro || 'código inválido ou já usado'}.`)
        }
      })
      .catch(() => {
        if (vivo) setLinkNotice('Não deu para ativar agora: falha de rede. Tente o link de novo daqui a pouco.')
      })

    return () => {
      vivo = false
    }
  }, [])

  return (
    <div className="cockpit-shell flex h-[100dvh] flex-col overflow-hidden">
      <DashboardHeader
        isLoading={isLoading}
        lastUpdated={lastUpdated}
        hasLiveMatches={hasLiveMatches}
        onRefresh={refresh}
      />

      <main className="flex min-h-0 w-full flex-1 flex-col gap-2 px-2 py-2 sm:px-4">
        <ResgatePro />
        {error && (
          <div className="rounded-xl border border-carimbo/20 bg-carimbo/10 px-3 py-2 text-sm text-carimbo">
            {error}
          </div>
        )}
        {linkNotice && (
          <div className="flex items-start justify-between gap-3 rounded-xl border border-carimbo/20 bg-carimbo/10 px-3 py-2 text-xs text-carimbo">
            <span>{linkNotice}</span>
            <button
              type="button"
              onClick={() => setLinkNotice('')}
              className="shrink-0 cursor-pointer rounded px-1 text-carimbo/70 transition hover:text-carimbo"
              aria-label="Fechar aviso"
            >
              ×
            </button>
          </div>
        )}
        {todayData?.is_fallback && (
          <div className="rounded-xl border border-carimbo/20 bg-carimbo/10 px-3 py-1.5 text-xs text-carimbo">
            <span className="font-medium">Sem jogos hoje.</span>{" "}
            <span className="text-ink-2">Mostrando a última rodada com jogos: {formatDay(todayData.date)}.</span>
            {todayData.requested_date && (
              <span className="text-ink-3"> Hoje: {formatDay(todayData.requested_date)}.</span>
            )}
          </div>
        )}

        <StatsBar stats={todayData?.stats} loading={loadingToday} />

        {/* Trocar de view substitui o conteudo. Nada empilha: a pagina nao rola. */}
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <ViewTabs view={view} onChange={setView} counts={{ rodada: totalRodada }} />
          </div>
          <div className="hidden shrink-0 sm:block">
            <ShareRound
              url={diaAtual && urlBase ? `${urlBase}?dia=${diaAtual}` : urlBase}
              text={textoRodada}
            />
          </div>
        </div>

        <div className="cockpit-painel relative min-h-0 flex-1 overflow-hidden">
          {view === 'rodada' && (
            <RoundView
              groupedMatches={groupedMatches}
              loading={loadingToday}
              isFallback={todayData?.is_fallback}
              dayLabel={todayData?.date ? formatDay(todayData.date) : undefined}
              onSelect={abrirConfronto}
              hypeByTeam={hypePorTime}
              hypeTeams={todayData?.hype ?? []}
              ratings={ratings}
            />
          )}

          {view === 'liga' && (
            <div className="cockpit-rolagem relative h-full overflow-y-auto pr-0.5">
              <LeagueTabs
                standingsData={standingsData}
                scorersData={scorersData}
                leagueId={leagueId}
                loadingStandings={loadingStandings}
                loadingScorers={loadingScorers}
                onLeagueChange={setLeagueId}
                titleOdds={titleOdds}
              />
            </div>
          )}

          {view === 'record' && (
            <div className="cockpit-rolagem relative h-full overflow-y-auto pr-0.5">
              <HypeRecord />
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
            </div>
          )}

          {view === 'esportes' && <SportsView />}

          {view === 'pro' && (
            <div className="cockpit-rolagem relative h-full overflow-y-auto pr-0.5">
              <ProView />
            </div>
          )}
        </div>

        <MatchDetailPanel
          eventId={selected?.event_id ?? null}
          leagueId={selected?.league_id ?? ''}
          leagueName={selected?.league_name ?? ''}
          homeId={selected?.home_id ?? null}
          awayId={selected?.away_id ?? null}
          prob={
            selected
              ? probabilidadeDoJogo(ratings, selected.league_id, selected.home, selected.away)
              : null
          }
          probRecord={probRecord}
          probForward={probForward}
          onClose={fecharConfronto}
        />
      </main>

      <SiteFooter source={todayData?.source} />
    </div>
  )
}
