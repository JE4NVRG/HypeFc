"use client"

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import {
  AlertTriangle,
  ArrowLeftRight,
  Clock,
  Flag,
  Goal,
  MapPin,
  RefreshCw,
  Shield,
  Trophy,
  Users,
  X,
  Zap,
} from 'lucide-react'
import type {
  MatchDetail,
  MatchDetailEvent,
  MatchDetailLineupPlayer,
  MatchDetailRecentGame,
  MatchDetailStat,
  MatchDetailTeamSide,
} from '@/lib/matchDetail'
import { isAllowedCrest } from './HypeFlags'
import { NextFixtures } from './NextFixtures'
import { ProbabilityBars } from './MatchProbability'
import { impliedProbabilities } from '@/lib/marketOdds'
import type { MatchProb } from '@/lib/matchProbability'
import { fetchMatchDetailData } from '@/lib/dataSource'
import { fetchTeamSchedule } from '@/lib/teamSchedule'
import type { TeamFixture } from '@/lib/teamSchedule'

interface MatchDetailPanelProps {
  eventId: string | null
  leagueId: string
  leagueName: string
  onClose: () => void
  /** Ids ESPN dos dois times: alimentam os proximos jogos no painel. */
  homeId?: string | null
  awayId?: string | null
  /** Probabilidade do modelo (Elo+Poisson) e o recorde medido dele. */
  prob?: MatchProb | null
  probRecord?: { n: number; brier: number; uniformBrier: number; bestPlaced: number | null; hitRate: number } | null
}

type Phase = 'idle' | 'loading' | 'ready' | 'error'

/* ---------- formatadores (nada de número inventado: null vira travessão) ---------- */

// Mesma zona do resto do dashboard (src/lib/espnParse.ts usa America/Sao_Paulo
// para o horário local da lista): se aqui usasse a zona do visitante, o painel
// mostraria hora diferente do card do jogo que ele abriu.
const TIME_ZONE = 'America/Sao_Paulo'

function statValue(value: number | null, unit: 'pct' | 'count'): string {
  if (value === null || value === undefined) return '—'
  if (unit === 'pct') return `${Math.round(value * 10) / 10}%`
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 10) / 10)
}

function parseDate(iso: string | null): Date | null {
  if (!iso) return null
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? null : date
}

function kickoffTime(iso: string | null): string | null {
  const date = parseDate(iso)
  if (!date) return null
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: TIME_ZONE })
}

function kickoffDay(iso: string | null): string | null {
  const date = parseDate(iso)
  if (!date) return null
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: TIME_ZONE })
}

function shortDay(iso: string | null): string {
  const date = parseDate(iso)
  if (!date) return '—'
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: TIME_ZONE })
}

function stamp(iso: string): string {
  const date = parseDate(iso)
  if (!date) return '—'
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: TIME_ZONE,
  })
}

function attendanceLabel(value: number | null): string {
  if (value === null || value === undefined) return '—'
  // A ESPN manda attendance 0 nos jogos do Brasileirao quando nao publica o
  // numero (a Premier League manda o real). Zero em estadio com jogo nao e
  // publico: e ausencia de dado, entao mostra '—' em vez de inventar 0.
  if (value <= 0) return '—'
  return value.toLocaleString('pt-BR')
}

const STATUS_META: Record<string, { label: string; tone: string }> = {
  IN_PLAY: { label: 'ao vivo', tone: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' },
  PAUSED: { label: 'intervalo', tone: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' },
  FINISHED: { label: 'encerrado', tone: 'border-slate-700 bg-slate-800/60 text-slate-400' },
  SCHEDULED: { label: 'agendado', tone: 'border-slate-700 bg-slate-800/60 text-slate-400' },
  TIMED: { label: 'agendado', tone: 'border-slate-700 bg-slate-800/60 text-slate-400' },
  POSTPONED: { label: 'adiado', tone: 'border-amber-500/25 bg-amber-500/5 text-amber-300' },
  DELAYED: { label: 'atrasado', tone: 'border-amber-500/25 bg-amber-500/5 text-amber-300' },
  SUSPENDED: { label: 'suspenso', tone: 'border-amber-500/25 bg-amber-500/5 text-amber-300' },
  CANCELED: { label: 'cancelado', tone: 'border-red-500/25 bg-red-500/5 text-red-300' },
  CANCELLED: { label: 'cancelado', tone: 'border-red-500/25 bg-red-500/5 text-red-300' },
}

function statusMeta(status: string): { label: string; tone: string } {
  return (
    STATUS_META[status.toUpperCase()] ?? {
      label: status.toLowerCase(),
      tone: 'border-slate-700 bg-slate-800/60 text-slate-400',
    }
  )
}

/* A ESPN manda campo ausente (undefined), não null: normaliza uma vez para nenhum
   bloco explodir em runtime. Nada é preenchido com valor inventado — só com vazio. */
function normalizeSide(side: MatchDetailTeamSide): MatchDetailTeamSide {
  return {
    team: side?.team ?? '',
    crest: side?.crest ?? null,
    score: typeof side?.score === 'number' ? side.score : null,
    stats: Array.isArray(side?.stats) ? side.stats : [],
    lineup: Array.isArray(side?.lineup) ? side.lineup : [],
    lastFive: Array.isArray(side?.lastFive) ? side.lastFive : [],
  }
}

function normalizeDetail(raw: MatchDetail): MatchDetail {
  const venue = raw.venue ?? { name: null, city: null, country: null, attendance: null }
  return {
    ...raw,
    status: raw.status ?? '',
    kickoff: raw.kickoff ?? null,
    league_name: raw.league_name ?? '',
    venue: {
      name: venue.name ?? null,
      city: venue.city ?? null,
      country: venue.country ?? null,
      attendance: typeof venue.attendance === 'number' ? venue.attendance : null,
    },
    referee: raw.referee ?? null,
    home: normalizeSide(raw.home),
    away: normalizeSide(raw.away),
    meetings: Array.isArray(raw.meetings) ? raw.meetings : [],
    events: Array.isArray(raw.events) ? raw.events : [],
    odds: Array.isArray(raw.odds) ? raw.odds : [],
    captured_at: raw.captured_at ?? '',
  }
}

/* ---------- peças ---------- */

function Crest({ src, name, size = 36 }: { src: string | null; name: string; size?: number }) {
  if (src && isAllowedCrest(src)) {
    return (
      <Image
        src={src}
        alt={name}
        width={size}
        height={size}
        className="rounded-lg object-contain"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <div
      className="flex items-center justify-center rounded-lg bg-slate-800 font-bold text-slate-400"
      style={{ width: size, height: size, fontSize: size / 2.6 }}
    >
      {name.charAt(0)}
    </div>
  )
}

function Section({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{title}</h3>
        {hint ? <span className="text-[10px] text-slate-600">{hint}</span> : null}
      </div>
      {children}
    </section>
  )
}

function ContextTile({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-slate-500">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 truncate text-xs text-slate-200" title={value}>
        {value}
      </div>
      {hint ? <div className="truncate text-[10px] text-slate-500">{hint}</div> : null}
    </div>
  )
}

function StatRow({ stat }: { stat: MatchDetailStat }) {
  const { home, away } = stat
  const bothNull = home === null && away === null
  const total = (home ?? 0) + (away ?? 0)
  // Arredonda em décimos: sem isso o inline style sai com float feio (57.999...%).
  const homeWidth = bothNull ? 0 : total > 0 ? Math.round(((home ?? 0) / total) * 1000) / 10 : 50
  const homeLeads = home !== null && away !== null && home > away
  const awayLeads = home !== null && away !== null && away > home

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className={`font-mono text-[11px] ${homeLeads ? 'text-emerald-300' : 'text-slate-300'}`}>
          {statValue(home, stat.unit)}
        </span>
        <span className="text-[10px] uppercase tracking-wide text-slate-500">{stat.label}</span>
        <span className={`font-mono text-[11px] ${awayLeads ? 'text-sky-300' : 'text-slate-300'}`}>
          {statValue(away, stat.unit)}
        </span>
      </div>
      <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-slate-800">
        {bothNull ? null : (
          <>
            <div className="h-full rounded-l-full bg-emerald-500/70" style={{ width: `${homeWidth}%` }} />
            <div className="h-full flex-1 rounded-r-full bg-sky-500/70" />
          </>
        )}
      </div>
    </div>
  )
}

function StatsBlock({ detail }: { detail: MatchDetail }) {
  const started =
    detail.status === 'IN_PLAY' ||
    detail.status === 'PAUSED' ||
    detail.status === 'FINISHED' ||
    detail.home.score !== null ||
    detail.away.score !== null
  // Stat sem nenhum dos dois lados não vira linha: não há o que comparar.
  const stats = detail.home.stats.filter((stat) => stat.home !== null || stat.away !== null)

  if (!started) {
    return <p className="text-[11px] leading-snug text-slate-500">Estatísticas aparecem depois do apito.</p>
  }
  if (!stats.length) {
    return <p className="text-[11px] leading-snug text-slate-500">Sem estatísticas publicadas para esta partida.</p>
  }
  return (
    <>
      <div className="mb-2 flex items-center justify-between text-[10px]">
        <span className="truncate text-emerald-300/90">{detail.home.team}</span>
        <span className="truncate text-sky-300/90">{detail.away.team}</span>
      </div>
      <div className="space-y-2">
        {stats.map((stat) => (
          <StatRow key={stat.key} stat={stat} />
        ))}
      </div>
    </>
  )
}

function ResultPill({ result }: { result: 'W' | 'D' | 'L' | null }) {
  if (!result) {
    return <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] bg-slate-800 text-[8px] font-bold text-slate-500">–</span>
  }
  const tone =
    result === 'W'
      ? 'bg-emerald-500/20 text-emerald-300'
      : result === 'D'
        ? 'bg-slate-500/20 text-slate-300'
        : 'bg-red-500/20 text-red-300'
  return (
    <span className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] text-[8px] font-bold ${tone}`}>
      {result}
    </span>
  )
}

function RecentList({ games }: { games: MatchDetailRecentGame[] }) {
  if (!games.length) {
    return <p className="text-[11px] text-slate-500">Sem jogos recentes nesta fonte.</p>
  }
  return (
    <div className="space-y-1">
      {games.map((game, index) => (
        <div key={`${game.opponent}-${index}`} className="flex items-center gap-2 text-[11px]">
          <ResultPill result={game.result} />
          <span className="min-w-0 flex-1 truncate text-slate-300" title={`${game.home ? 'em casa' : 'fora'} vs ${game.opponent}`}>
            <span className="text-slate-500">{game.home ? 'casa' : 'fora'}</span> {game.opponent}
          </span>
          <span className="shrink-0 font-mono text-[10px] text-slate-500">{shortDay(game.date)}</span>
          <span className="w-11 shrink-0 text-right font-mono text-slate-300">{game.score ?? '—'}</span>
        </div>
      ))}
    </div>
  )
}

function LineupColumn({ side }: { side: MatchDetailTeamSide }) {
  const starters = side.lineup.filter((player) => player.starter)
  const bench = side.lineup.filter((player) => !player.starter)

  if (!side.lineup.length) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-950/30 p-2.5">
        <div className="truncate text-[11px] font-medium text-slate-300">{side.team}</div>
        <p className="mt-1 text-[10px] text-slate-500">Escalação não divulgada.</p>
      </div>
    )
  }

  const rows = (players: MatchDetailLineupPlayer[]) =>
    players.map((player, index) => (
      <div key={`${player.name}-${index}`} className="flex items-center gap-1.5 text-[11px]">
        <span className="w-5 shrink-0 text-right font-mono text-[10px] text-slate-500">{player.number ?? '—'}</span>
        <span className="min-w-0 flex-1 truncate text-slate-300" title={player.name}>
          {player.name}
        </span>
        {player.position ? (
          <span className="max-w-[64px] shrink-0 truncate text-[10px] text-slate-500" title={player.position}>
            {player.position}
          </span>
        ) : null}
      </div>
    ))

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/30 p-2.5">
      <div className="truncate text-[11px] font-medium text-slate-300" title={side.team}>
        {side.team}
      </div>
      {starters.length ? (
        <>
          <div className="mt-1.5 text-[10px] uppercase tracking-wide text-slate-500">Titulares</div>
          <div className="mt-1 space-y-0.5">{rows(starters)}</div>
        </>
      ) : null}
      {bench.length ? (
        <>
          <div className="mt-2 text-[10px] uppercase tracking-wide text-slate-500">Banco</div>
          <div className="mt-1 space-y-0.5">{rows(bench)}</div>
        </>
      ) : null}
    </div>
  )
}

function eventVisual(event: MatchDetailEvent): { icon: React.ReactNode; tone: string } {
  const type = event.type.toLowerCase()
  if (type.includes('goal') || type.includes('penalty - scored')) {
    return { icon: <Goal className="h-3 w-3" />, tone: 'text-emerald-300' }
  }
  if (type.includes('red')) return { icon: <Shield className="h-3 w-3" />, tone: 'text-red-300' }
  if (type.includes('yellow') || type.includes('card')) {
    return { icon: <Shield className="h-3 w-3" />, tone: 'text-amber-300' }
  }
  if (type.includes('sub')) return { icon: <ArrowLeftRight className="h-3 w-3" />, tone: 'text-sky-300' }
  return { icon: <Zap className="h-3 w-3" />, tone: 'text-slate-400' }
}

/* ---------- painel ---------- */

export function MatchDetailPanel({ eventId, leagueId, leagueName, onClose, homeId, awayId, prob, probRecord }: MatchDetailPanelProps) {
  const [detail, setDetail] = useState<MatchDetail | null>(null)
  const [loadedFor, setLoadedFor] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [errorInfo, setErrorInfo] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [fixtures, setFixtures] = useState<{ home: TeamFixture[]; away: TeamFixture[] } | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const closeRef = useRef(onClose)

  // onClose pode trocar de identidade a cada render do pai: mantém o listener de Esc estável.
  useEffect(() => {
    closeRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!eventId) {
      setDetail(null)
      setLoadedFor(null)
      setPhase('idle')
      setErrorInfo(null)
      setFixtures(null)
      return
    }

    let alive = true
    setPhase('loading')
    setDetail(null)
    setLoadedFor(null)
    setErrorInfo(null)
    setFixtures(null)

    // Carregador ciente do modo (src/lib/dataSource.ts): no servidor ele bate na
    // rota /api; no site estático o navegador fala com a ESPN direto. Devolve o
    // MatchDetail já desembrulhado — nada de montar URL de /api aqui dentro.
    Promise.resolve()
      .then(() => fetchMatchDetailData(leagueId, eventId))
      .then((payload) => {
        if (!alive) return
        if (!payload || typeof payload !== 'object') {
          throw new Error('A fonte não devolveu o detalhe desta partida.')
        }
        setDetail(normalizeDetail(payload as MatchDetail))
        setLoadedFor(eventId)
        setPhase('ready')
      })
      .catch((error: unknown) => {
        if (!alive) return
        setErrorInfo(error instanceof Error ? error.message : null)
        setPhase('error')
      })

    return () => {
      alive = false
    }
  }, [eventId, leagueId, attempt])

  // Proximos jogos dos dois times. Endpoint provado: sem ?fixture=true a ESPN
  // devolve so o que ja aconteceu. Duas chamadas pequenas, so com o painel aberto.
  useEffect(() => {
    if (!detail || !homeId || !awayId) return
    let alive = true
    Promise.all([
      fetchTeamSchedule(leagueId, homeId, detail.home.team).catch(() => []),
      fetchTeamSchedule(leagueId, awayId, detail.away.team).catch(() => []),
    ]).then(([home, away]) => {
      if (alive) setFixtures({ home, away })
    })
    return () => {
      alive = false
    }
  }, [detail, homeId, awayId, leagueId])

  const open = eventId !== null

  // Esc fecha + body travado enquanto o painel está aberto.
  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeRef.current()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open])

  // Foco entra no painel ao abrir.
  useEffect(() => {
    if (open) panelRef.current?.focus({ preventScroll: true })
  }, [open])

  if (!open) return null

  const ready = phase === 'ready' && detail !== null && loadedFor === eventId
  const dialogLabel = ready && detail ? `${detail.home.team} x ${detail.away.team}, ${detail.league_name}` : `${leagueName}, detalhe da partida`
  const status = ready && detail ? statusMeta(detail.status) : null

  return (
    <div className="fixed inset-0 z-50">
      {/* Fundo escurecido: clique fora fecha. */}
      <div
        className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
        onClick={() => closeRef.current()}
        aria-hidden="true"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={dialogLabel}
        aria-busy={phase === 'loading'}
        tabIndex={-1}
        className="absolute inset-y-0 right-0 flex h-full w-full max-w-md flex-col overflow-y-auto overscroll-contain border-l border-slate-800 bg-slate-950 outline-none shadow-2xl"
      >
        {/* Cabeçalho fixo: liga, confronto, status e saída. */}
        <div className="sticky top-0 z-10 flex items-start gap-2 border-b border-slate-800 bg-slate-950/95 px-3 py-2.5 backdrop-blur">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-slate-500">
              <Trophy className="h-3 w-3 shrink-0" />
              <span className="truncate">{ready && detail ? detail.league_name : leagueName}</span>
            </div>
            <h2 className="mt-0.5 truncate text-sm font-semibold text-slate-200">
              {ready && detail ? `${detail.home.team} x ${detail.away.team}` : 'Carregando partida'}
            </h2>
          </div>
          {status ? (
            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${status.tone}`}>
              {status.label}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => closeRef.current()}
            aria-label="Fechar detalhe da partida"
            className="-mr-1 shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/5 hover:text-slate-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Esqueleto discreto — nada de spinner gigante. */}
        {!ready && phase !== 'error' ? (
          <div className="space-y-3 px-3 py-3">
            <div className="flex items-center justify-center gap-6">
              <div className="h-12 w-12 animate-pulse rounded-lg bg-white/5" />
              <div className="h-6 w-16 animate-pulse rounded bg-white/5" />
              <div className="h-12 w-12 animate-pulse rounded-lg bg-white/5" />
            </div>
            <div className="space-y-2.5 rounded-xl border border-slate-800 bg-slate-900/40 p-3">
              {[...Array(5)].map((_, index) => (
                <div key={index} className="space-y-1.5">
                  <div className="h-2.5 w-full animate-pulse rounded bg-white/5" />
                  <div className="h-1.5 w-full animate-pulse rounded-full bg-white/5" />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[...Array(4)].map((_, index) => (
                <div key={index} className="h-12 animate-pulse rounded-lg bg-white/5" />
              ))}
            </div>
            <p className="text-center text-[10px] text-slate-500">Carregando números e escalações…</p>
          </div>
        ) : null}

        {/* Erro honesto, com retentativa. */}
        {phase === 'error' ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-12 text-center">
            <AlertTriangle className="h-6 w-6 text-slate-600" />
            <p className="text-xs text-slate-300">Não consegui carregar o detalhe desta partida</p>
            {errorInfo ? <p className="text-[10px] leading-snug text-slate-600">{errorInfo}</p> : null}
            <button
              type="button"
              onClick={() => setAttempt((value) => value + 1)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-[11px] font-medium text-slate-200 transition-colors hover:bg-slate-800"
            >
              <RefreshCw className="h-3 w-3" />
              Tentar de novo
            </button>
          </div>
        ) : null}

        {ready && detail ? (
          <div className="space-y-3 px-3 py-3">
            {/* Placar ou horário local do apito. */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-3">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <div className="flex min-w-0 flex-col items-center gap-1.5">
                  <Crest src={detail.home.crest} name={detail.home.team} />
                  <span className="w-full truncate text-center text-xs font-semibold leading-tight text-slate-200" title={detail.home.team}>
                    {detail.home.team}
                  </span>
                </div>
                <div className="flex flex-col items-center px-1">
                  {detail.home.score !== null && detail.away.score !== null ? (
                    <span
                      className={`font-mono text-2xl font-bold leading-none ${
                        detail.status === 'IN_PLAY' || detail.status === 'PAUSED' ? 'text-emerald-300' : 'text-white'
                      }`}
                    >
                      {detail.home.score}
                      <span className="px-1 text-slate-600">–</span>
                      {detail.away.score}
                    </span>
                  ) : (
                    <span className="font-mono text-xl font-semibold leading-none text-slate-200">
                      {kickoffTime(detail.kickoff) ?? '—'}
                    </span>
                  )}
                  <span className="mt-1 whitespace-nowrap text-[10px] uppercase tracking-wide text-slate-500">
                    {detail.home.score !== null && detail.away.score !== null
                      ? detail.status === 'IN_PLAY' || detail.status === 'PAUSED'
                        ? 'no placar'
                        : 'final'
                      : (kickoffDay(detail.kickoff) ?? 'horário a definir')}
                  </span>
                </div>
                <div className="flex min-w-0 flex-col items-center gap-1.5">
                  <Crest src={detail.away.crest} name={detail.away.team} />
                  <span className="w-full truncate text-center text-xs font-semibold leading-tight text-slate-200" title={detail.away.team}>
                    {detail.away.team}
                  </span>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-center gap-1.5 text-[10px] text-slate-500">
                <Clock className="h-3 w-3" />
                {kickoffTime(detail.kickoff) ?? '—'} · {kickoffDay(detail.kickoff) ?? '—'}
                {detail.referee ? ` · ${detail.referee}` : ''}
              </div>
            </div>

            {/* Comparação de estatísticas (verde = casa, azul = fora). */}
            {prob ? (
              <Section title="Probabilidade (modelo)">
                <ProbabilityBars
                  prob={prob}
                  homeName={detail.home.team}
                  awayName={detail.away.team}
                  record={probRecord ?? null}
                />
              </Section>
            ) : null}

            <Section title="Estatísticas">
              <StatsBlock detail={detail} />
            </Section>

            {/* Contexto do jogo. */}
            <div className="grid grid-cols-2 gap-2">
              <ContextTile
                icon={<MapPin className="h-3 w-3" />}
                label="Estádio"
                value={detail.venue.name ?? '—'}
                hint={detail.venue.country ?? undefined}
              />
              <ContextTile
                icon={<MapPin className="h-3 w-3" />}
                label="Cidade"
                value={detail.venue.city ?? '—'}
              />
              <ContextTile
                icon={<Users className="h-3 w-3" />}
                label="Público"
                value={attendanceLabel(detail.venue.attendance)}
              />
              <ContextTile
                icon={<Flag className="h-3 w-3" />}
                label="Árbitro"
                value={detail.referee ?? '—'}
              />
            </div>

            {/* Últimos 5 de cada lado. */}
            <Section title="Últimos 5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-slate-800 bg-slate-950/30 p-2.5">
                  <div className="mb-1.5 truncate text-[11px] font-medium text-slate-300" title={detail.home.team}>
                    {detail.home.team}
                  </div>
                  <RecentList games={detail.home.lastFive} />
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950/30 p-2.5">
                  <div className="mb-1.5 truncate text-[11px] font-medium text-slate-300" title={detail.away.team}>
                    {detail.away.team}
                  </div>
                  <RecentList games={detail.away.lastFive} />
                </div>
              </div>
            </Section>

            {/* Proximos jogos de cada lado: o painel cobria so o passado. */}
            {(fixtures || (homeId && awayId)) && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <NextFixtures
                  fixtures={fixtures?.home ?? []}
                  team={detail.home.team}
                  loading={fixtures === null}
                />
                <NextFixtures
                  fixtures={fixtures?.away ?? []}
                  team={detail.away.team}
                  loading={fixtures === null}
                />
              </div>
            )}

            {/* Confrontos diretos. */}
            <Section title="Confrontos" hint={detail.meetings.length ? `${detail.meetings.length} jogos` : undefined}>
              {detail.meetings.length ? (
                <div className="space-y-1">
                  {detail.meetings.map((meeting, index) => (
                    <div key={`${meeting.date ?? 'sem-data'}-${index}`} className="flex items-center gap-2 text-[11px]">
                      <span className="w-14 shrink-0 font-mono text-[10px] text-slate-500">{shortDay(meeting.date)}</span>
                      <span className="min-w-0 flex-1 truncate text-slate-300" title={`${meeting.home} x ${meeting.away}`}>
                        {meeting.home} <span className="font-mono text-slate-200">{meeting.score_home ?? '—'}–{meeting.score_away ?? '—'}</span> {meeting.away}
                      </span>
                      {meeting.competition ? (
                        <span className="max-w-[80px] shrink-0 truncate text-[10px] text-slate-500" title={meeting.competition}>
                          {meeting.competition}
                        </span>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-500">Sem confrontos registrados nesta fonte.</p>
              )}
            </Section>

            {/* Escalações lado a lado. */}
            {detail.home.lineup.length || detail.away.lineup.length ? (
              <Section title="Escalações">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <LineupColumn side={detail.home} />
                  <LineupColumn side={detail.away} />
                </div>
              </Section>
            ) : null}

            {/* Lances em ordem de jogo. */}
            <Section title="Lances" hint={detail.events.length ? `${detail.events.length} registros` : undefined}>
              {detail.events.length ? (
                <div className="space-y-1">
                  {detail.events.map((event, index) => {
                    const visual = eventVisual(event)
                    return (
                      <div key={`${event.minute ?? 's/min'}-${index}`} className="flex items-start gap-2 text-[11px]">
                        <span className="w-8 shrink-0 text-right font-mono text-[10px] text-slate-500">{event.minute ?? '—'}</span>
                        <span className={`mt-0.5 shrink-0 ${visual.tone}`}>{visual.icon}</span>
                        <span className="min-w-0 flex-1 leading-snug text-slate-300">{event.text}</span>
                        {event.team ? (
                          <span className="max-w-[84px] shrink-0 truncate text-right text-[10px] text-slate-500" title={event.team}>
                            {event.team}
                          </span>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-[11px] text-slate-500">Nenhum lance registrado nesta fonte.</p>
              )}
            </Section>

            {/* Mercado, quando a fonte manda. Odd e fato da fonte convertido em
                probabilidade — com a margem da casa a mostra e sem recomendacao. */}
            {detail.odds.length ? (
              <Section title="Mercado (referência)">
                {detail.market.length ? (
                  <div className="space-y-2">
                    {detail.market.map((linha, index) => {
                      const prob = impliedProbabilities(linha)
                      if (!prob) return null
                      return (
                        <div key={`${linha.provider}-prob-${index}`} className="space-y-1">
                          <div className="flex items-baseline justify-between gap-2 text-[11px]">
                            <span className="truncate text-slate-400" title={linha.provider}>
                              {linha.provider}
                            </span>
                            <span className="shrink-0 font-mono text-[10px] text-slate-500">
                              margem {(prob.margin * 100).toFixed(1)}pp
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px]">
                            <span className="w-[32%] truncate text-right text-slate-300" title={detail.home.team}>
                              {detail.home.team}
                            </span>
                            <span className="font-mono font-semibold text-slate-100">{Math.round(prob.home * 100)}%</span>
                            {prob.draw !== null ? (
                              <>
                                <span className="text-slate-600">·</span>
                                <span className="font-mono text-slate-300" title="empate">
                                  {Math.round(prob.draw * 100)}%
                                </span>
                              </>
                            ) : null}
                            <span className="text-slate-600">·</span>
                            <span className="font-mono font-semibold text-slate-100">{Math.round(prob.away * 100)}%</span>
                            <span className="w-[32%] truncate text-slate-300" title={detail.away.team}>
                              {detail.away.team}
                            </span>
                          </div>
                          {linha.over_under !== null ? (
                            <p className="text-[10px] text-slate-500">
                              linha de gols: {linha.over_under}
                              {linha.detail ? ` · ${linha.detail}` : ''}
                            </p>
                          ) : null}
                        </div>
                      )
                    })}
                    <p className="text-[10px] leading-relaxed text-slate-600">
                      Probabilidade do MERCADO: a odd publicada convertida e normalizada (a margem da casa já foi removida e está
                      mostrada acima). É o que a casa precificou, não previsão nossa nem recomendação.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {detail.odds.map((odd, index) => (
                    <div key={`${odd.provider}-${index}`} className="flex items-baseline gap-2 text-[11px]">
                      <span className="shrink-0 text-slate-500">{odd.provider}</span>
                      <span className="min-w-0 flex-1 break-words text-slate-300">{odd.detail}</span>
                    </div>
                    ))}
                  </div>
                )}
              </Section>
            ) : null}

            <p className="px-1 pb-1 text-[10px] leading-snug text-slate-600">
              Fonte {detail.source ? detail.source.toUpperCase() : '—'} · atualizado {stamp(detail.captured_at)} · evento {detail.event_id}. Campos sem
              informação na fonte aparecem como —.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
