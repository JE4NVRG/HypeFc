"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Calendar, Zap } from 'lucide-react'
import { MatchListLegend, MatchRow } from '@/components/dashboard/TodayMatches'
import type { Match, HypeTeam } from '@/hooks/useDashboardData'
import { probabilidadeDoJogo, type RatingsPayload } from '@/lib/ratings'

/**
 * View da rodada: chips de liga no topo (troca em vez de rolar), faixa de times
 * em alta em uma linha, e os jogos agrupados por liga em colunas equilibradas.
 *
 * O agrupamento e um bloco atomico por liga: o titulo viaja junto dos seus cards.
 * Antes o fluxo `columns-*` do CSS fragmentava o bloco — o titulo ficava na primeira
 * coluna e os cards das ligas seguintes apareciam sem titulo nenhum (o defeito medido).
 * CSS multi-coluna nao tem como garantir isso (break-inside-avoid nao segura um bloco
 * maior que a coluna), entao a distribuicao em colunas e calculada aqui e o bloco
 * inteiro e um item de coluna: nao existe fragmentacao para quebrar o titulo.
 *
 * O container tem altura de tela e so ele rola — a pagina em si nao rola.
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

type LigaBloco = { name: string; matches: Match[] }

const chipBase =
  'inline-flex min-h-[44px] shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border px-3 text-[12px] font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60 md:min-h-[36px]'

const chipAtivo = 'border-white/20 bg-white/[0.1] text-slate-100'
const chipInativo = 'border-white/10 bg-white/[0.04] text-slate-300 hover:border-white/20 hover:bg-white/[0.08] hover:text-slate-100'

/**
 * Rolagem horizontal sem a scrollbar nativa (a barra clara em cima do painel escuro
 * parece prototipo). O scroll continua funcionando no mouse, no trackpad e no teclado:
 * os itens de dentro continuam focaveis e o navegador rola sozinho ao focar.
 */
const semScrollbar = '[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'

const FADE = 16

/**
 * Mascara de fade nas bordas que realmente tem conteudo escondido: comeca sem nada,
 * mede no primeiro render e acompanha scroll + redimensionamento (e mudanca de itens,
 * via `chaves`). Mascara, e nao um gradiente solido, porque o fundo do cockpit muda
 * (card ao vivo, hover): a mascara deixa o fundo real aparecer.
 */
function useScrollFade(chaves: readonly unknown[]) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [bordas, setBordas] = useState({ inicio: false, fim: false })

  const medir = useCallback(() => {
    const el = ref.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    const inicio = el.scrollLeft > 1
    const fim = max > 1 && el.scrollLeft < max - 1
    setBordas((atual) => (atual.inicio === inicio && atual.fim === fim ? atual : { inicio, fim }))
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    medir()
    el.addEventListener('scroll', medir, { passive: true })
    window.addEventListener('resize', medir)
    const observador = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(medir)
    observador?.observe(el)
    return () => {
      el.removeEventListener('scroll', medir)
      window.removeEventListener('resize', medir)
      observador?.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `chaves` sao os itens que mudam a largura do conteudo
  }, [medir, ...chaves])

  const mask =
    !bordas.inicio && !bordas.fim
      ? undefined
      : `linear-gradient(to right, ${[
          bordas.inicio ? 'transparent 0px' : '#000 0px',
          bordas.inicio ? `#000 ${FADE}px` : null,
          bordas.fim ? `#000 calc(100% - ${FADE}px)` : null,
          bordas.fim ? 'transparent 100%' : '#000 100%',
        ]
          .filter((parada): parada is string => parada !== null)
          .join(', ')})`

  return {
    ref,
    estilo: mask ? { maskImage: mask, WebkitMaskImage: mask } : undefined,
  }
}

/**
 * Quantas colunas o CSS mostra (mesmos cortes do Tailwind: md 768, xl 1280). Sem isso
 * a distribuicao erraria a coluna e voltaria o card orfao de titulo que a onda 2 veio
 * consertar. Comeca em 1 (mobile) e o efeito corrige no cliente.
 */
function useColumnCount(): number {
  const [colunas, setColunas] = useState(1)

  useEffect(() => {
    const md = window.matchMedia('(min-width: 768px)')
    const xl = window.matchMedia('(min-width: 1280px)')
    const atualizar = () => setColunas(xl.matches ? 3 : md.matches ? 2 : 1)
    atualizar()
    md.addEventListener('change', atualizar)
    xl.addEventListener('change', atualizar)
    return () => {
      md.removeEventListener('change', atualizar)
      xl.removeEventListener('change', atualizar)
    }
  }, [])

  return colunas
}

/**
 * Distribui as ligas em colunas por peso (1 por jogo + 0,34 pelo cabecalho) sempre na
 * coluna menos carregada, preservando a ordem das ligas. Isso mantem o bloco atomico
 * e evita o buraco embaixo da coluna curta que o grid simples de ligas deixava.
 */
function distribuir(ligas: LigaBloco[], colunas: number): LigaBloco[][] {
  const baldes: LigaBloco[][] = Array.from({ length: Math.max(1, colunas) }, () => [])
  const peso: number[] = new Array(baldes.length).fill(0)
  for (const liga of ligas) {
    let alvo = 0
    for (let i = 1; i < baldes.length; i += 1) {
      if (peso[i] < peso[alvo]) alvo = i
    }
    baldes[alvo].push(liga)
    peso[alvo] += liga.matches.length + 0.34
  }
  return baldes
}

/** Titulo da liga: nome tem prioridade de largura, a linha e so decoracao. */
function LeagueHeader({ name, jogos }: { name: string; jogos: number }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="min-w-0 shrink truncate text-[11px] font-semibold uppercase tracking-wider text-slate-400"
        title={name}
      >
        {name}
      </span>
      <div className="h-px min-w-[16px] flex-1 bg-gradient-to-r from-white/20 to-transparent" aria-hidden="true" />
      <span className="shrink-0 font-mono text-[11px] tabular-nums text-slate-400">
        {jogos} {jogos === 1 ? 'jogo' : 'jogos'}
      </span>
    </div>
  )
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
  const colunas = useColumnCount()

  const leagues = useMemo(() => {
    return Object.entries(groupedMatches).map(([name, matches]) => ({ name, matches }))
  }, [groupedMatches])

  const total = useMemo(() => leagues.reduce((sum, l) => sum + l.matches.length, 0), [leagues])

  const visiveis = useMemo(
    () => (liga === 'todas' ? leagues : leagues.filter((l) => l.name === liga)),
    [liga, leagues]
  )

  // Uma liga visivel nao precisa de bloco por coluna: o titulo aparece uma vez e os
  // cards ficam lado a lado. E o caso do filtro por liga.
  const ligaUnica = visiveis.length === 1
  const blocos = useMemo(() => distribuir(visiveis, colunas), [visiveis, colunas])

  // A probabilidade so existe quando o arquivo de ratings cobre os dois times: a
  // legenda promete o rotulo apenas se algum card visivel realmente carrega o valor.
  const temProb = useMemo(
    () =>
      visiveis.some((l) =>
        l.matches.some((m) => probabilidadeDoJogo(ratings ?? null, m.league_id, m.home, m.away) !== null)
      ),
    [visiveis, ratings]
  )
  const temStats = useMemo(() => visiveis.some((l) => l.matches.some((m) => m.match_stats != null)), [visiveis])

  const chips = useScrollFade([leagues.length])
  const faixaTimes = useScrollFade([hypeTeams.length])

  const card = (match: Match, i: number) => (
    <MatchRow
      key={`${match.league_id}-${match.home}-${match.away}-${i}`}
      match={match}
      onSelect={onSelect}
      hypeByTeam={hypeByTeam}
      prob={probabilidadeDoJogo(ratings ?? null, match.league_id, match.home, match.away)}
    />
  )

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Cabeçalho da rodada + chips de liga: trocar de liga substitui a lista. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-emerald-400" />
          <h2 className="text-[14px] font-semibold text-slate-200">{isFallback ? 'Última rodada' : 'Jogos de hoje'}</h2>
          {dayLabel ? <span className="text-[11px] font-medium text-amber-300">{dayLabel}</span> : null}
          {!loading && total > 0 ? (
            <span className="rounded-lg bg-white/[0.06] px-2 py-0.5 font-mono text-[11px] tabular-nums text-slate-400">
              {total} {total === 1 ? 'jogo' : 'jogos'}
            </span>
          ) : null}
        </div>

        {leagues.length > 1 ? (
          <div
            ref={chips.ref}
            style={chips.estilo}
            role="group"
            aria-label="Filtrar jogos por liga"
            className={`flex flex-1 items-center gap-1.5 overflow-x-auto pb-0.5 ${semScrollbar}`}
          >
            <button
              type="button"
              onClick={() => setLiga('todas')}
              aria-pressed={liga === 'todas'}
              className={`${chipBase} ${liga === 'todas' ? chipAtivo : chipInativo}`}
            >
              Todas
              <span className="font-mono text-[11px] tabular-nums text-slate-300">{total}</span>
            </button>
            {leagues.map(({ name, matches }) => (
              <button
                key={name}
                type="button"
                onClick={() => setLiga(name)}
                aria-pressed={liga === name}
                title={name}
                className={`${chipBase} ${liga === name ? chipAtivo : chipInativo}`}
              >
                <span className="max-w-[120px] truncate">{name}</span>
                <span className="font-mono text-[11px] tabular-nums text-slate-300">{matches.length}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* Times em alta em uma faixa: custa 1 linha de altura, nao 1.180px. */}
      {hypeTeams.length > 0 ? (
        <div
          ref={faixaTimes.ref}
          style={faixaTimes.estilo}
          role="group"
          aria-label="Times em alta hoje, com o score de hype de 0 a 100"
          className={`flex items-center gap-2 overflow-x-auto pb-0.5 ${semScrollbar}`}
        >
          {/* O numero da fileira e o score de hype (0-100), nao o rating Elo.
              Sem rotulo visivel o usuario le como numero solto — e foi assim que
              o painel foi criticado. O rotulo fica dentro da faixa, colado no
              primeiro chip, para nao gastar uma linha de altura. */}
          <span className="flex shrink-0 items-center gap-1.5 pr-1">
            <Zap className="h-4 w-4 shrink-0 text-amber-400" aria-hidden />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-300/90">
              Em alta
            </span>
          </span>
          {hypeTeams.slice(0, 12).map((t) => (
            <span
              key={`${t.league_id}-${t.team}`}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-amber-500/25 bg-amber-500/[0.08] px-2 py-1 text-[11px] text-amber-200"
              title={`${t.team}${t.opponent ? ` vs ${t.opponent}` : ''}${t.time_local ? ` · ${t.time_local}` : ''}`}
            >
              <span className="font-mono font-semibold tabular-nums text-amber-300">{t.score ?? '—'}</span>
              <span className="max-w-[110px] truncate">{t.team}</span>
            </span>
          ))}
        </div>
      ) : null}

      {/* Rotulos uma vez, fora do container que rola: a legenda nao sai da tela. */}
      {!loading && visiveis.length > 0 ? <MatchListLegend showProb={temProb} showStats={temStats} /> : null}

      {/* Lista: só ela rola. Blocos de liga atomicos em colunas equilibradas. */}
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {loading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((coluna) => (
              <div
                key={coluna}
                className={`flex-col gap-2 ${
                  coluna === 0 ? 'flex' : coluna === 1 ? 'hidden md:flex' : 'hidden xl:flex'
                }`}
              >
                <div className="h-4 w-32 animate-pulse rounded bg-white/[0.05]" />
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-[116px] animate-pulse rounded-xl bg-white/[0.05]" />
                ))}
              </div>
            ))}
          </div>
        ) : visiveis.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <Calendar className="mb-4 h-8 w-8 text-slate-600" />
            <p className="text-[13px] text-slate-400">Nenhum jogo programado</p>
          </div>
        ) : ligaUnica ? (
          <div className="flex flex-col gap-2">
            <LeagueHeader name={visiveis[0].name} jogos={visiveis[0].matches.length} />
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
              {visiveis[0].matches.map(card)}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-3">
            {blocos.map((bloco, coluna) => (
              <div key={coluna} className="flex flex-col gap-4">
                {bloco.map(({ name, matches }) => (
                  <div key={name} className="flex flex-col gap-2">
                    <LeagueHeader name={name} jogos={matches.length} />
                    <div className="flex flex-col gap-2">{matches.map(card)}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
