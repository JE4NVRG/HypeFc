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

const milhar = (n: number) => n.toLocaleString('pt-BR')

/* Celula de numero do registro. As celulas nao sao caixas: elas sao separadas
   pela regua de 1px que o `gap-px` cria sobre o fundo de regua do grid. */
function Celula({ rotulo, valor, nota }: { rotulo: string; valor: string; nota?: string }) {
  return (
    <div className="bg-paper-2 px-4 py-3.5">
      <div className="text-[9px] font-medium uppercase tracking-[0.18em] text-ink-2">{rotulo}</div>
      <div className="mt-1.5 font-mono text-[26px] font-semibold leading-none tracking-[-0.03em] text-ink lg:text-[31px]">
        {valor}
      </div>
      {nota ? <div className="mt-1.5 text-[11px] leading-snug text-ink-3">{nota}</div> : null}
    </div>
  )
}

/* Toda barra e a mesma forma (regua de 3px): trilho neutro e preenchimento no
   verde do modelo. Barra nao ganha vermelho, porque vermelho aqui e alerta, e
   acerto abaixo da metade nao e alerta: e o dado. */
function Bar({ label, value, n, tom }: { label: string; value: number | null; n: number; tom: string }) {
  const width = value === null ? 0 : Math.max(2, Math.min(100, Math.round(value * 100)))
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-[11px] uppercase tracking-[0.08em] text-ink-3">{label}</span>
      <div className="h-[3px] flex-1 bg-rule-2">
        <div className={`h-full ${tom}`} style={{ width: `${width}%` }} />
      </div>
      <span className="w-12 shrink-0 text-right font-mono text-[11px] font-medium text-ink-2">{pct(value, 0)}</span>
      <span className="w-14 shrink-0 text-right font-mono text-[11px] text-ink-3">n={n}</span>
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
      <section className="border border-rule bg-paper-2 p-4">
        <p className="text-[12px] text-ink-3">Carregando histórico…</p>
      </section>
    )
  }

  if (state === 'empty' || !data) {
    return (
      <section className="border border-rule bg-paper-2 p-4">
        <p className="text-[12px] leading-snug text-ink-3">
          Sem histórico ainda: nenhum card liquidado. O painel grava a rodada antes dos jogos e
          preenche o resultado depois, então não existe número antes de o jogo acontecer.
        </p>
      </section>
    )
  }

  const flagged = data.flagged
  const anchor = data.anchor
  const faixa55 = data.by_band.find((row) => row.key === '55+')
  const rounds = data.by_round.filter((row) => row.n > 0).slice(-8).reverse()
  const leagues = data.by_league.slice(0, 8)

  return (
    <section className="border border-rule bg-paper-2">
      {/* Fita do registro. O numero grande e o acento do bloco: e o unico
          lugar do painel, alem do botao de assinar, que usa o sinal acido. */}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 border-b border-rule px-4 pb-4 pt-4">
        <div className="min-w-0">
          <div className="text-[9px] font-medium uppercase tracking-[0.18em] text-sinal">registro público</div>
          <div className="mt-1.5 font-mono text-[30px] font-semibold leading-none tracking-[-0.04em] text-sinal sm:text-[38px]">
            {milhar(data.cards_settled)}
          </div>
          <p className="mt-2 max-w-prose text-[11px] leading-snug text-ink-2">
            {contagem(data.cards_settled, 'card liquidado', 'cards liquidados')} em{' '}
            {contagem(data.completed_rounds, 'rodada', 'rodadas')} · corte {data.cutoff} · gravado sempre
            antes do jogo
          </p>
        </div>
        <div className="text-[11px] leading-snug text-ink-3 sm:text-right">
          {data.replay_cards} reconstruídos · {data.live_cards} gravados ao vivo
          <br />
          {contagem(data.cards_pending, 'card pendente', 'cards pendentes')} · {contagem(data.snapshots, 'leitura', 'leituras')}
        </div>
      </div>

      {/* Quatro numeros do registro, separados por regua em vez de caixa. Cada um
          com a mesma base tipografica: era isso que dava o degrau entre eles antes. */}
      <div className="grid grid-cols-2 gap-px bg-rule-2 lg:grid-cols-4">
        <Celula rotulo="Acerto dos cards" valor={pct(flagged.rate)} nota={`${flagged.wins}/${flagged.n} · empate conta como erro`} />
        <Celula rotulo="vs média do mando" valor={signed(data.lift_pp)} nota={`esperado ${pct(data.baseline.expected_for_flagged)} nesse conjunto`} />
        <Celula rotulo="vs melhor colocado (honesto)" valor={signed(data.anchor_lift_pp)} nota={`um melhor colocado qualquer vence ${pct(anchor.rate)} (n=${anchor.n})`} />
        <Celula rotulo="Faixa 55+" valor={pct(faixa55?.rate ?? null)} nota={`n=${faixa55?.n ?? 0} · score mais alto acerta mais`} />
      </div>

      {/* Tres leituras do mesmo numero: por mando, por faixa e o vies do score. */}
      <div className="grid gap-px bg-rule-2 lg:grid-cols-3">
        <div className="space-y-2 bg-paper-2 px-4 py-4">
          <div className="text-[9px] font-medium uppercase tracking-[0.18em] text-ink-3">Por mando</div>
          {data.by_venue.map((row) => (
            <Bar key={row.key} label={row.key} value={row.rate} n={row.n} tom="bg-verde-2" />
          ))}
        </div>
        <div className="space-y-2 bg-paper-2 px-4 py-4">
          <div className="text-[9px] font-medium uppercase tracking-[0.18em] text-ink-3">Por faixa de score</div>
          {data.by_band.map((row) => (
            <Bar key={row.key} label={row.key} value={row.rate} n={row.n} tom="bg-verde-2" />
          ))}
        </div>
        <div className="space-y-2 bg-paper-2 px-4 py-4">
          <div className="text-[9px] font-medium uppercase tracking-[0.18em] text-ink-3">
            Viés: posição relativa
          </div>
          {data.by_edge.map((row) => (
            <Bar
              key={row.key}
              label={row.key.replace('marcado ', '').replace(' colocado', '')}
              value={row.rate}
              n={row.n}
              tom={row.key.includes('MELHOR') ? 'bg-verde-2' : 'bg-line'}
            />
          ))}
          <p className="pt-1 text-[11px] leading-snug text-ink-3">
            O score quase nunca marca o azarão: ele confirma o favorito, não descobre zebra.
          </p>
        </div>
      </div>

      <div className="grid gap-px bg-rule-2 lg:grid-cols-2">
        <div className="bg-paper-2 px-4 py-4">
          <div className="text-[9px] font-medium uppercase tracking-[0.18em] text-ink-3">
            Últimas rodadas <span className="tracking-[0.02em] normal-case">(acertos por card, não taxa)</span>
          </div>
          <div className="mt-2.5 space-y-1.5">
            {rounds.map((row) => (
              <div key={row.key} className="flex items-center gap-2 text-[11px]">
                <span className="font-mono text-ink-3">{row.key}</span>
                <div className="h-[3px] flex-1 bg-rule-2">
                  <div
                    className={`h-full ${row.wins / row.n >= 0.5 ? 'bg-verde-2' : 'bg-line'}`}
                    style={{ width: `${Math.max(4, Math.round((row.wins / row.n) * 100))}%` }}
                  />
                </div>
                <span className="w-12 shrink-0 text-right font-mono font-medium text-ink-2">
                  {row.wins}/{row.n}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-paper-2 px-4 py-4">
          <div className="text-[9px] font-medium uppercase tracking-[0.18em] text-ink-3">
            Últimos cards liquidados{' '}
            <span className="tracking-[0.02em] normal-case">(número = score do modelo, placar = resultado)</span>
          </div>
          <div className="mt-2.5 space-y-1.5">
            {data.recent.slice(0, 8).map((card, index) => (
              <div key={`${card.team}-${index}`} className="flex items-center gap-2 text-[11px]">
                {card.hit ? (
                  <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-verde-2" />
                ) : card.hit === false ? (
                  <XCircle aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-ink-3" />
                ) : (
                  <MinusCircle aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-ink-3" />
                )}
                <span className="truncate font-medium text-ink">{card.team}</span>
                <span className="truncate text-ink-3">
                  {card.venue === 'home' ? 'em casa' : 'fora'} vs {card.venue === 'home' ? card.away : card.home}
                </span>
                <span
                  className="ml-auto shrink-0 font-mono text-ink-2"
                  title={`placar ${card.score_home ?? '-'} a ${card.score_away ?? '-'}`}
                >
                  {card.score_home ?? '-'}–{card.score_away ?? '-'}
                </span>
                <span
                  className="w-8 shrink-0 text-right font-mono text-ink-3"
                  title={`score do modelo: ${card.score}`}
                >
                  {card.score}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-rule px-4 py-3.5">
        {leagues.map((row) => (
          <span key={row.key} className="border border-rule-2 px-2 py-1 text-[11px] text-ink-3">
            {row.key} <span className="font-mono text-ink">{pct(row.rate, 0)}</span>{' '}
            <span className="font-mono text-ink-3">n={row.n}</span>
          </span>
        ))}
      </div>

      <details className="border-t border-rule px-4 py-3.5">
        <summary className="flex min-h-[44px] cursor-pointer items-center gap-2 text-[11px] font-medium text-ink-2 focus:outline-none sm:min-h-[36px]">
          <ShieldQuestion aria-hidden="true" className="h-3.5 w-3.5" />
          Como este número foi medido
        </summary>
        <ul className="mt-2 space-y-2 text-[11px] leading-snug text-ink-3">
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
