"use client"

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { CalendarDays, MapPin, RefreshCw, Tv, Trophy } from 'lucide-react'
import { SPORTS, fetchScoreboard, sportsByKind } from '@/lib/multiSport'
import type { SportGame, SportKind } from '@/lib/sports'

/**
 * Outros esportes na mesma fonte (ESPN), sem chave nova. O que muda de verdade
 * entre esportes e o formato do placar — entao a linha mostra placar, estado,
 * estadio e transmissao, e nao inventa tabela nem hype que so existem no futebol.
 */

const KIND_LABEL: Record<SportKind, string> = {
  soccer: 'Futebol',
  basketball: 'Basquete',
  football: 'F. Americano',
  hockey: 'Hóquei',
  baseball: 'Beisebol',
  racing: 'F1',
  mma: 'MMA',
  tennis: 'Tênis',
}

const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: 'agendado',
  IN_PLAY: 'ao vivo',
  PAUSED: 'intervalo',
  FINISHED: 'final',
  POSTPONED: 'adiado',
  OTHER: '—',
}

function horaLocal(iso: string | null): string {
  if (!iso) return '—'
  const data = new Date(iso)
  if (Number.isNaN(data.getTime())) return '—'
  return data.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function diaDe(iso: string | null): string {
  if (!iso) return 'sem data'
  const data = new Date(iso)
  if (Number.isNaN(data.getTime())) return 'sem data'
  return data.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
}

function Estado({ status, clock }: { status: string; clock: string | null }) {
  const aoVivo = status === 'IN_PLAY' || status === 'PAUSED'
  const final = status === 'FINISHED'
  return (
    <span
      className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
        aoVivo
          ? 'bg-emerald-500/15 text-emerald-300'
          : final
            ? 'bg-white/[0.06] text-slate-400'
            : 'bg-sky-500/10 text-sky-300'
      }`}
    >
      {aoVivo && clock ? clock : (STATUS_LABEL[status] ?? status.toLowerCase())}
    </span>
  )
}

function LinhaJogo({ jogo }: { jogo: SportGame }) {
  const temTimes = jogo.competitors.length > 0
  // ESPN manda casa primeiro; o padrao do board e "visitante @ mandante", e o
  // placar tem que sair na MESMA ordem do nome para nao enganar.
  const casa = jogo.competitors.find((c) => c.home_away === 'home') ?? null
  const fora = jogo.competitors.find((c) => c.home_away === 'away') ?? null
  const ordenados = casa && fora ? [fora, casa] : jogo.competitors
  const ladoConhecido = Boolean(casa && fora)

  return (
    <div className="rounded-lg bg-white/[0.03] px-2 py-1.5">
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {temTimes ? (
            ordenados.map((c, indice) => (
              <span key={`${jogo.id}-${c.name}`} className="flex min-w-0 flex-1 items-center gap-1.5">
                {indice > 0 ? (
                  <span className="shrink-0 text-[10px] text-slate-600" title={ladoConhecido ? 'visitante @ mandante' : undefined}>
                    @
                  </span>
                ) : null}
                <span className={`min-w-0 truncate text-xs ${indice === 0 ? 'text-slate-300' : 'font-medium text-slate-200'}`} title={c.name}>
                  {c.name}
                </span>
                {c.record ? <span className="shrink-0 font-mono text-[9px] text-slate-600">{c.record}</span> : null}
                {indice > 0 && c.crest ? (
                  <Image src={c.crest} alt="" width={16} height={16} className="h-4 w-4 shrink-0 object-contain" unoptimized />
                ) : null}
              </span>
            ))
          ) : (
            <span className="min-w-0 flex-1 truncate text-xs text-slate-200" title={jogo.name}>
              {jogo.name}
              {jogo.note ? <span className="ml-1 text-slate-500">· {jogo.note}</span> : null}
            </span>
          )}
        </div>

        {temTimes ? (
          <span className="flex shrink-0 items-center gap-1 font-mono text-sm tabular-nums">
            {ordenados.map((c) => (
              <span
                key={`${jogo.id}-score-${c.name}`}
                className={`min-w-[18px] text-center ${c.winner ? 'font-semibold text-emerald-300' : 'text-slate-200'}`}
              >
                {c.score ?? '–'}
              </span>
            ))}
          </span>
        ) : null}

        <Estado status={jogo.status} clock={jogo.clock} />
      </div>

      <div className="mt-0.5 flex items-center gap-3 pl-1 text-[10px] text-slate-500">
        <span className="flex items-center gap-1">
          <CalendarDays className="h-3 w-3" />
          {horaLocal(jogo.date)}
        </span>
        {jogo.venue ? (
          <span className="flex min-w-0 items-center gap-1">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate" title={jogo.venue}>
              {jogo.venue}
            </span>
          </span>
        ) : null}
        {jogo.broadcast ? (
          <span className="flex items-center gap-1">
            <Tv className="h-3 w-3" />
            {jogo.broadcast}
          </span>
        ) : null}
      </div>
    </div>
  )
}

export function SportsView() {
  const porTipo = useMemo(() => sportsByKind(), [])
  const tipos = useMemo(() => (Object.keys(porTipo) as SportKind[]).filter((k) => porTipo[k].length > 0), [porTipo])
  const [tipo, setTipo] = useState<SportKind>('basketball')
  const [ligaId, setLigaId] = useState<string>('NBA')
  const [jogos, setJogos] = useState<SportGame[]>([])
  const [fase, setFase] = useState<'loading' | 'ready' | 'error'>('loading')
  const [tentativa, setTentativa] = useState(0)

  useEffect(() => {
    let vivo = true
    setFase('loading')
    fetchScoreboard(ligaId)
      .then((lista) => {
        if (!vivo) return
        setJogos(lista)
        setFase('ready')
      })
      .catch(() => {
        if (!vivo) return
        setJogos([])
        setFase('error')
      })
    return () => {
      vivo = false
    }
  }, [ligaId, tentativa])

  function trocarTipo(kind: SportKind) {
    setTipo(kind)
    const primeira = porTipo[kind]?.[0]
    if (primeira) setLigaId(primeira.id)
  }

  const grupos = useMemo(() => {
    const mapa = new Map<string, SportGame[]>()
    for (const jogo of jogos) {
      const chave = diaDe(jogo.date)
      const atual = mapa.get(chave)
      if (atual) atual.push(jogo)
      else mapa.set(chave, [jogo])
    }
    return Array.from(mapa.entries())
  }, [jogos])

  const liga = SPORTS.find((l) => l.id === ligaId)

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1">
        {tipos.map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => trocarTipo(kind)}
            aria-pressed={tipo === kind}
            className={`shrink-0 cursor-pointer rounded-full px-2.5 py-1 text-[10px] font-medium transition focus:outline-none focus-visible:ring-1 focus-visible:ring-emerald-400/50 ${
              tipo === kind ? 'bg-emerald-500/15 text-emerald-300' : 'bg-white/[0.04] text-slate-400 hover:text-slate-200'
            }`}
          >
            {KIND_LABEL[kind]}
            <span className="ml-1.5 font-mono text-[9px] text-slate-500">{porTipo[kind].length}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-1 border-t border-white/[0.04] pt-2">
        {porTipo[tipo].map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => setLigaId(l.id)}
            aria-pressed={ligaId === l.id}
            className={`shrink-0 cursor-pointer rounded-full px-2.5 py-1 text-[10px] transition focus:outline-none focus-visible:ring-1 focus-visible:ring-emerald-400/50 ${
              ligaId === l.id ? 'bg-white/[0.1] text-slate-100' : 'bg-white/[0.03] text-slate-400 hover:text-slate-200'
            }`}
            title={l.name}
          >
            {l.name}
          </button>
        ))}
        <span className="ml-auto flex items-center gap-2 text-[10px] text-slate-500">
          {fase === 'ready' ? <span className="font-mono">{jogos.length} jogos</span> : null}
          <button
            type="button"
            onClick={() => setTentativa((n) => n + 1)}
            className="flex cursor-pointer items-center gap-1 rounded px-1.5 py-0.5 text-slate-400 transition hover:text-slate-100 focus:outline-none focus-visible:ring-1 focus-visible:ring-emerald-400/50"
            aria-label="Recarregar"
          >
            <RefreshCw className={`h-3 w-3 ${fase === 'loading' ? 'animate-spin' : ''}`} />
            atualizar
          </button>
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
        {fase === 'loading' ? (
          <div className="space-y-1">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-white/5" />
            ))}
          </div>
        ) : fase === 'error' ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <p className="text-sm text-slate-400">A fonte não respondeu para {liga?.name ?? ligaId}.</p>
            <p className="mt-1 text-xs text-slate-600">Nada é mostrado de cache: prefiro vazio a dado velho.</p>
          </div>
        ) : jogos.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <Trophy className="mb-2 h-7 w-7 text-slate-700" />
            <p className="text-sm text-slate-400">Sem jogos publicados em {liga?.name ?? ligaId} agora.</p>
            <p className="mt-1 text-xs text-slate-600">
              {liga && ['racing', 'mma', 'tennis'].includes(liga.kind)
                ? 'Neste esporte a fonte publica por evento, não por rodada.'
                : 'Fora de temporada ou nenhum jogo na data de hoje.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {grupos.map(([dia, lista]) => (
              <div key={dia}>
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">{dia}</span>
                  <div className="h-px flex-1 bg-gradient-to-r from-white/10 to-transparent" />
                  <span className="font-mono text-[9px] text-slate-600">{lista.length}</span>
                </div>
                <div className="space-y-1">
                  {lista.map((jogo) => (
                    <LinhaJogo key={jogo.id} jogo={jogo} />
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
