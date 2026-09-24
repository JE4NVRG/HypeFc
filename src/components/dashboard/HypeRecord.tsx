"use client"

import { useEffect, useState } from 'react'
import { CheckCircle2, XCircle, MinusCircle, ShieldQuestion } from 'lucide-react'
import { buscarPayload } from '@/lib/payloadSource'

interface Bucket {
  key: string
  n: number
  wins: number
  rate: number | null
  expected?: number | null
  lift_pp?: number | null
}

interface HypeRecordData {
  generated_at: string
  cutoff: number
  method: string
  snapshots: number
  completed_rounds: number
  cards_total: number
  cards_settled: number
  cards_pending: number
  live_cards: number
  replay_cards: number
  flagged: { n: number; wins: number; rate: number | null }
  baseline: {
    n: number
    home_rate: number | null
    away_rate: number | null
    draw_rate: number | null
    expected_for_flagged: number | null
  }
  lift_pp: number | null
  anchor: {
    n: number
    wins: number
    rate: number | null
    home_rate: number | null
    away_rate: number | null
    expected_for_flagged: number | null
  }
  anchor_lift_pp: number | null
  by_venue: Bucket[]
  by_band: Bucket[]
  by_league: Bucket[]
  by_round: Bucket[]
  by_edge: Bucket[]
  recent: Array<{
    league_id: string
    league_name: string
    team: string
    venue: 'home' | 'away'
    home: string
    away: string
    score: number
    flags: string[]
    score_home: number | null
    score_away: number | null
    hit: boolean | null
  }>
  notes: string[]
}

function pct(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined) return '—'
  // pt-BR: virgula decimal, nunca ponto. `toFixed` sempre emite ponto, entao
  // "53,6%" virava "53.6%" na tela em texto portugues.
  const n = (value * 100).toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
  return `${n}%`
}

function signed(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  const n = value.toLocaleString('pt-BR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })
  return `${value > 0 ? '+' : ''}${n}pp`
}

/** Concordancia: "1 card liquidado", "1 rodada", "2 cards liquidados". */
function contagem(total: number, singular: string, plural: string): string {
  return `${total} ${total === 1 ? singular : plural}`
}

/* Toda barra sem antivalencia (casa/fora, faixa de score) e neutra: cor so onde
   ha significado — melhor/pior que a referencia, ou acima/abaixo da metade. */
function Bar({ label, value, n, tone }: { label: string; value: number | null; n: number; tone: string }) {
  const width = value === null ? 0 : Math.max(2, Math.min(100, Math.round(value * 100)))
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-[11px] uppercase tracking-wide text-slate-400">{label}</span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${width}%` }} />
      </div>
      <span className="w-12 shrink-0 text-right text-[11px] font-medium text-slate-300">{pct(value, 0)}</span>
      <span className="w-14 shrink-0 text-right text-[11px] text-slate-400">n={n}</span>
    </div>
  )
}

export function HypeRecord() {
  const [data, setData] = useState<HypeRecordData | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'empty'>('loading')

  useEffect(() => {
    let alive = true
    // banco (site_payloads) primeiro; arquivo do build como rede de seguranca.
    buscarPayload<HypeRecordData>('hype-record')
      .then((json) => {
        if (!alive) return
        if (!json) {
          setState('empty')
          return
        }
        setData(json)
        setState(json.cards_settled > 0 ? 'ready' : 'empty')
      })
      .catch(() => {
        if (alive) setState('empty')
      })
    return () => {
      alive = false
    }
  }, [])

  if (state === 'loading') {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
        <h2 className="text-sm font-semibold text-slate-200">Recorde público</h2>
        <p className="mt-2 text-[12px] text-slate-400">Carregando histórico…</p>
      </section>
    )
  }

  if (state === 'empty' || !data) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
        <h2 className="text-sm font-semibold text-slate-200">Recorde público</h2>
        <p className="mt-2 text-[12px] leading-snug text-slate-400">
          Sem histórico ainda: nenhum card liquidado. O painel grava a rodada antes dos jogos e
          preenche o resultado depois — não existe número antes de o jogo acontecer.
        </p>
      </section>
    )
  }

  const flagged = data.flagged
  const anchor = data.anchor
  const rounds = data.by_round.filter((row) => row.n > 0).slice(-8).reverse()
  const leagues = data.by_league.slice(0, 8)

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-200">Recorde público</h2>
          <p className="mt-1 text-[11px] text-slate-400">
            {contagem(data.cards_settled, 'card liquidado', 'cards liquidados')} em{' '}
            {contagem(data.completed_rounds, 'rodada', 'rodadas')} · corte {data.cutoff} · sempre antes do jogo
          </p>
        </div>
        <span className="rounded-lg border border-slate-700 bg-slate-800/60 px-2 py-1 text-[11px] text-slate-400">
          {data.replay_cards} reconstruídos · {data.live_cards} gravados ao vivo
        </span>
      </div>

      {/* Dois lifts: o do mando (inflado, porque o marcado quase sempre é o melhor
          colocado) e o ancorado no melhor colocado, que é o número honesto. O
          número honesto é o único que ganha cor — âmbar, de atenção. */}
      <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
          <div className="text-[11px] uppercase tracking-wide text-slate-400">Acerto dos cards</div>
          <div className="mt-1 text-xl font-semibold text-slate-100">{pct(flagged.rate)}</div>
          <div className="text-[11px] text-slate-400">
            {flagged.wins}/{flagged.n} · empate conta como erro
          </div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
          <div className="text-[11px] uppercase tracking-wide text-slate-400">vs média do mando</div>
          <div className="mt-1 text-xl font-semibold text-slate-100">{signed(data.lift_pp)}</div>
          <div className="text-[11px] text-slate-400">
            esperado {pct(data.baseline.expected_for_flagged)} nesse conjunto
          </div>
        </div>
        <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2">
          <div className="text-[11px] uppercase tracking-wide text-amber-300">
            vs melhor colocado (honesto)
          </div>
          <div className="mt-1 text-xl font-semibold text-amber-200">{signed(data.anchor_lift_pp)}</div>
          <div className="text-[11px] text-slate-400">
            um melhor colocado qualquer vence {pct(anchor.rate)} (n={anchor.n})
          </div>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
          <div className="text-[11px] uppercase tracking-wide text-slate-400">Faixa 55+</div>
          <div className="mt-1 text-xl font-semibold text-slate-100">
            {pct(data.by_band.find((row) => row.key === '55+')?.rate ?? null)}
          </div>
          <div className="text-[11px] text-slate-400">
            n={data.by_band.find((row) => row.key === '55+')?.n ?? 0} · score mais alto acerta mais
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/30 p-3">
          <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Por mando</div>
          {data.by_venue.map((row) => (
            <Bar key={row.key} label={row.key} value={row.rate} n={row.n} tone="bg-slate-400/70" />
          ))}
        </div>
        <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/30 p-3">
          <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Por faixa de score</div>
          {data.by_band.map((row) => (
            <Bar key={row.key} label={row.key} value={row.rate} n={row.n} tone="bg-slate-400/70" />
          ))}
        </div>
        <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/30 p-3">
          <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            Viés: posição relativa
          </div>
          {data.by_edge.map((row) => (
            <Bar
              key={row.key}
              label={row.key.replace('marcado ', '').replace(' colocado', '')}
              value={row.rate}
              n={row.n}
              tone={row.key.includes('MELHOR') ? 'bg-emerald-500/70' : 'bg-red-500/70'}
            />
          ))}
          <p className="pt-1 text-[11px] leading-snug text-slate-400">
            O score quase nunca marca o azarão: ele confirma o favorito, não descobre zebra.
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-800 bg-slate-950/30 p-3">
          <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            Últimas rodadas <span className="normal-case tracking-normal">(acertos/cards — contagem, não taxa)</span>
          </div>
          <div className="mt-2 space-y-1">
            {rounds.map((row) => (
              <div key={row.key} className="flex items-center gap-2 text-[11px]">
                <span className="font-mono text-slate-400">{row.key}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className={`h-full rounded-full ${
                      row.wins / row.n >= 0.5 ? 'bg-emerald-500/70' : 'bg-red-500/70'
                    }`}
                    style={{ width: `${Math.max(4, Math.round((row.wins / row.n) * 100))}%` }}
                  />
                </div>
                <span className="w-12 shrink-0 text-right font-medium text-slate-300">
                  {row.wins}/{row.n}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/30 p-3">
          <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            Últimos cards liquidados{' '}
            <span className="normal-case tracking-normal">(número = score do modelo, placar = resultado)</span>
          </div>
          <div className="mt-2 space-y-1">
            {data.recent.slice(0, 8).map((card, index) => (
              <div key={`${card.team}-${index}`} className="flex items-center gap-2 text-[11px]">
                {card.hit ? (
                  <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                ) : card.hit === false ? (
                  <XCircle aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-red-400" />
                ) : (
                  <MinusCircle aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                )}
                <span className="truncate font-medium text-slate-200">{card.team}</span>
                <span className="truncate text-slate-400">
                  {card.venue === 'home' ? 'em casa' : 'fora'} vs {card.venue === 'home' ? card.away : card.home}
                </span>
                <span
                  className="ml-auto shrink-0 font-mono text-slate-300"
                  title={`placar ${card.score_home ?? '-'} a ${card.score_away ?? '-'}`}
                >
                  {card.score_home ?? '-'}–{card.score_away ?? '-'}
                </span>
                <span
                  className="w-8 shrink-0 text-right text-slate-400"
                  title={`score do modelo: ${card.score}`}
                >
                  {card.score}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {leagues.map((row) => (
          <span
            key={row.key}
            className="rounded-lg border border-slate-800 bg-slate-950/40 px-2 py-1 text-[11px] text-slate-400"
          >
            {row.key} <span className="text-slate-200">{pct(row.rate, 0)}</span>{' '}
            <span className="text-slate-400">n={row.n}</span>
          </span>
        ))}
      </div>

      <details className="mt-3 rounded-lg border border-slate-800 bg-slate-950/30 p-3">
        <summary className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg text-[11px] font-medium text-slate-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60 sm:min-h-[36px]">
          <ShieldQuestion aria-hidden="true" className="h-3.5 w-3.5" />
          Como este número foi medido
        </summary>
        <ul className="mt-2 space-y-2 text-[11px] leading-snug text-slate-400">
          {data.notes.map((note) => (
            <li key={note}>• {note}</li>
          ))}
          <li>• Baseline do mando neste conjunto: casa {pct(data.baseline.home_rate)} · fora{' '}
            {pct(data.baseline.away_rate)} · empate {pct(data.baseline.draw_rate)} (
            {contagem(data.baseline.n, 'jogo', 'jogos')}).
          </li>
          <li>• Atualizado em {new Date(data.generated_at).toLocaleString('pt-BR')}.</li>
        </ul>
      </details>
    </section>
  )
}
