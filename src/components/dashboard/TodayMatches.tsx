"use client"

import { Calendar } from 'lucide-react'
import type { Match } from '@/hooks/useDashboardData'
import { PROB_TOOLTIP, pct } from '@/components/dashboard/MatchProbability'
import type { MatchProb } from '@/lib/matchProbability'
import { isAllowedCrest } from '@/components/dashboard/HypeFlags'

/**
 * Card de partida com os times empilhados (casa em cima). Duas linhas de largura
 * de card valem mais que dois nomes espremidos lado a lado: o nome quase nunca
 * precisa cortar, e quando corta a posicao na tabela continua inteira, porque ela
 * mora em elemento proprio com largura fixa — nunca concatenada ao nome.
 *
 * Regra de rotulo da onda 2: os rotulos (Casa/Empate/Fora, posse/chutes/no alvo)
 * aparecem UMA vez, na legenda do topo da lista (MatchListLegend). O card mostra so
 * os valores, alinhados por coluna, na mesma ordem da legenda. Antes cada um dos 36
 * cards repetia "Prob. Casa · Empate · Fora" e o rodape "posse · chutes · no alvo":
 * 18+ repeticoes das mesmas palavras e, pior, numeros que a leitura tomava por soltos.
 */

interface TodayMatchesProps {
  groupedMatches: Record<string, Match[]>
  loading: boolean
  isFallback?: boolean
  dayLabel?: string
  /** Abre o detalhe da partida. Sem isso (ou sem event_id) o card nao clica. */
  onSelect?: (match: Match) => void
  /** Score de hype por time: o sinal aparece no confronto, nao so no card lateral. */
  hypeByTeam?: Record<string, number>
}

/** Rotulos de status iguais aos do painel de detalhe (PT-BR, sem inventar estado). */
const STATUS_TAG: Record<string, { label: string; className: string }> = {
  IN_PLAY: { label: 'ao vivo', className: 'bg-emerald-500/15 text-emerald-300' },
  PAUSED: { label: 'intervalo', className: 'bg-emerald-500/15 text-emerald-300' },
  FINISHED: { label: 'encerrado', className: 'bg-white/[0.08] text-slate-300' },
  POSTPONED: { label: 'adiado', className: 'bg-amber-500/15 text-amber-300' },
  DELAYED: { label: 'atrasado', className: 'bg-amber-500/15 text-amber-300' },
  SUSPENDED: { label: 'suspenso', className: 'bg-amber-500/15 text-amber-300' },
  CANCELED: { label: 'cancelado', className: 'bg-red-500/15 text-red-300' },
  CANCELLED: { label: 'cancelado', className: 'bg-red-500/15 text-red-300' },
}

/**
 * Escudo como `<img>` comum, e nao next/image: dentro do cockpit o lazy do
 * next/image nao dispara (0 de 72 escudos carregaram, transferSize 0) e o card
 * ficava uma parede de texto cinza, sem identificacao de time. A mesma URL carrega
 * 500px fora dele. Aqui o carregamento e eager, com largura/altura declaradas para
 * o layout nao pular quando a imagem chega. O guard de host e a queda para a inicial
 * continuam iguais.
 */
function Crest({ src, name }: { src?: string | null; name: string }) {
  if (src && isAllowedCrest(src)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- lazy do next/image nao carrega no cockpit
      <img
        src={src}
        alt={name}
        width={24}
        height={24}
        loading="eager"
        decoding="async"
        className="h-6 w-6 flex-shrink-0 rounded object-contain"
      />
    )
  }
  return (
    <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-slate-800 text-[11px] font-bold text-slate-400">
      {name.charAt(0)}
    </div>
  )
}

/**
 * Posicao na tabela em elemento proprio, largura fixa: o truncate do nome nao
 * alcanca este numero. Sem posicao, fica um espaco do mesmo tamanho para os dois
 * nomes comecarem na mesma coluna.
 */
function PositionTag({ value }: { value?: number | null }) {
  if (!value) return <span aria-hidden="true" className="h-5 w-8 flex-shrink-0" />
  return (
    <span
      className="flex h-5 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white/[0.07] font-mono text-[11px] leading-none tabular-nums text-slate-400"
      title={`${value}º lugar na tabela`}
    >
      {value}º
    </span>
  )
}

/** Placar e o numero-herói do card: 20px bold contra 13px do nome do time. */
function TeamLine({
  name,
  crest,
  position,
  score,
}: {
  name: string
  crest?: string | null
  position?: number | null
  score: number | null
}) {
  return (
    <div className="flex h-7 items-center gap-2">
      <Crest src={crest} name={name} />
      <PositionTag value={position} />
      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-slate-200" title={name}>
        {name}
      </span>
      {score !== null ? (
        <span className="flex w-7 flex-shrink-0 justify-end font-mono text-[20px] font-bold leading-none tabular-nums text-slate-50">
          {score}
        </span>
      ) : null}
    </div>
  )
}

/** Ordem fixa dos valores no rodape do card — a legenda fala nesta ordem. */
const STAT_KEYS = ['posse', 'chutes', 'no alvo'] as const

/** Ordem fixa dos valores de probabilidade — a legenda fala nesta ordem. */
const PROB_KEYS = ['casa', 'empate', 'fora'] as const

function par(home?: number | null, away?: number | null): string | null {
  if (home == null || away == null) return null
  return `${Math.round(home)}–${Math.round(away)}`
}

/**
 * Rodape do card: so os valores, em tres colunas fixas na ordem da legenda. Dado
 * nao publicado sai como "—" em vez de coluna sumida: manter as tres colunas e o que
 * permite ler o card sem os rotulos.
 */
function StatsLine({ match }: { match: Match }) {
  const stats = match.match_stats
  if (!stats) return null
  const valores = [
    par(stats.possession_home, stats.possession_away),
    par(stats.shots_home, stats.shots_away),
    par(stats.shots_on_target_home, stats.shots_on_target_away),
  ]
  if (valores.every((v) => v === null)) return null
  const leitura = STAT_KEYS.map((chave, i) => `${chave} ${valores[i] ?? '—'}${i === 0 ? '%' : ''}`).join(' · ')
  return (
    // O rotulo de leitor de tela fica FORA da grade: dentro dela viraria item de
    // grade (e o `divide-x` desenharia uma divisoria sobrando na primeira coluna).
    <div className="mt-2 border-t border-white/[0.08] pt-2" title={`${leitura} (casa–fora)`}>
      <span className="sr-only">Estatísticas casa–fora — posse, chutes, no alvo:</span>
      <div className="grid grid-cols-3 divide-x divide-white/[0.08] text-center font-mono text-[11px] leading-none tabular-nums text-slate-400">
        {valores.map((valor, i) => (
          <span key={STAT_KEYS[i]}>{valor ?? '—'}</span>
        ))}
      </div>
    </div>
  )
}

/**
 * Valores da probabilidade, sem rotulo: a ordem (Casa · Empate · Fora) esta na
 * legenda fixa do topo da lista. O maior valor continua marcado em verde, como a
 * legenda explica, e o title repete a leitura honesta do modelo.
 */
function ProbValues({ prob }: { prob: MatchProb | null }) {
  if (!prob) return null
  const maior = Math.max(prob.home, prob.draw, prob.away)
  const valores = [prob.home, prob.draw, prob.away]
  return (
    <span className="ml-auto flex shrink-0 items-center" title={PROB_TOOLTIP}>
      <span className="sr-only">Probabilidade do modelo (Casa, Empate, Fora):</span>
      <span className="flex items-center gap-1">
        {valores.map((valor, i) => (
          <span
            key={PROB_KEYS[i]}
            className={`w-8 text-right font-mono text-[11px] leading-none tabular-nums ${
              valor === maior ? 'font-semibold text-emerald-300' : 'text-slate-300'
            }`}
          >
            {pct(valor)}%
          </span>
        ))}
      </span>
    </span>
  )
}

/**
 * Rotulos ditos UMA vez para a lista inteira, fora do container que rola: a legenda
 * nao sai da tela enquanto o leitor desce os cards. Substitui as 36 repeticoes de
 * "Prob. Casa · Empate · Fora" / "posse · chutes · no alvo".
 */
export function MatchListLegend({ showProb, showStats }: { showProb: boolean; showStats: boolean }) {
  if (!showProb && !showStats) return null
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-1.5 text-[11px] leading-tight text-slate-400">
      <span className="font-semibold uppercase tracking-wider text-slate-300">Legenda</span>
      {showProb ? (
        <>
          <span aria-hidden="true">·</span>
          <span title={PROB_TOOLTIP}>
            Probabilidade: <span className="font-semibold text-slate-200">Casa</span> ·{' '}
            <span className="font-semibold text-slate-200">Empate</span> ·{' '}
            <span className="font-semibold text-slate-200">Fora</span> (verde = maior).
          </span>
        </>
      ) : null}
      {showStats ? (
        <>
          <span aria-hidden="true">·</span>
          <span>
            Rodapé: <span className="font-semibold text-slate-200">posse</span> ·{' '}
            <span className="font-semibold text-slate-200">chutes</span> ·{' '}
            <span className="font-semibold text-slate-200">no alvo</span> (casa–fora); “—” = não publicado.
          </span>
        </>
      ) : null}
    </div>
  )
}

export function MatchRow({
  match,
  onSelect,
  hypeByTeam,
  prob,
}: {
  match: Match
  onSelect?: (match: Match) => void
  hypeByTeam?: Record<string, number>
  prob?: MatchProb | null
}) {
  const isLive = match.status === 'IN_PLAY' || match.status === 'PAUSED'
  // Sem id de evento nao existe detalhe para abrir: o card continua informativo,
  // mas nao vira botao (nao prometemos clique que nao funciona).
  const canOpen = Boolean(match.event_id && onSelect)

  // Placar so aparece quando o jogo comecou e o dado existe dos dois lados.
  const hasScore = match.score_home !== null && match.score_away !== null
  const showScore = hasScore && (isLive || match.status === 'FINISHED')

  // Selo do score no proprio confronto. Quando os dois lados estao em alta, e o
  // mesmo jogo marcado duas vezes (Porto/Benfica): o card fala no singular.
  const casaScore = hypeByTeam?.[match.home] ?? null
  const foraScore = hypeByTeam?.[match.away] ?? null
  const lados = [casaScore, foraScore].filter((s): s is number => s !== null)
  const selo =
    lados.length === 0
      ? null
      : lados.length === 1
        ? `${lados[0]} em alta`
        : '2 em alta'

  const tag = STATUS_TAG[String(match.status)] ?? null

  const base =
    'group flex min-h-[116px] w-full min-w-0 flex-col rounded-xl border p-3.5 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60 disabled:opacity-50'
  const tone = isLive ? 'border-emerald-500/25 bg-emerald-500/[0.07]' : 'border-white/[0.07] bg-white/[0.03]'
  const hover = !canOpen
    ? ''
    : isLive
      ? 'cursor-pointer hover:bg-emerald-500/[0.11]'
      : 'cursor-pointer hover:border-white/[0.16] hover:bg-white/[0.06]'

  const content = (
    <>
      {/* Faixa de contexto: estado/horario a esquerda, rotulo + probabilidade a direita. */}
      <div className="flex min-h-[20px] flex-wrap items-center gap-x-2 gap-y-1">
        {tag ? (
          <span
            className={`inline-flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${tag.className}`}
          >
            {isLive ? <span className="h-1.5 w-1.5 flex-shrink-0 animate-pulse rounded-full bg-current" /> : null}
            {tag.label}
          </span>
        ) : (
          <span className="font-mono text-[13px] font-semibold tabular-nums text-slate-200">{match.time_local}</span>
        )}

        {selo ? (
          <span className="flex-shrink-0 rounded-lg bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-amber-300">
            {selo}
          </span>
        ) : null}

        <ProbValues prob={prob ?? null} />
      </div>

      <div className="mt-2 space-y-1">
        <TeamLine
          name={match.home}
          crest={match.home_crest}
          position={match.home_position}
          score={showScore ? match.score_home : null}
        />
        <TeamLine
          name={match.away}
          crest={match.away_crest}
          position={match.away_position}
          score={showScore ? match.score_away : null}
        />
      </div>

      <StatsLine match={match} />
    </>
  )

  if (!canOpen) {
    return <div className={`${base} ${tone}`}>{content}</div>
  }

  return (
    <button
      type="button"
      onClick={() => onSelect!(match)}
      aria-label={`Ver detalhes de ${match.home} contra ${match.away}`}
      className={`${base} ${tone} ${hover}`}
    >
      {content}
    </button>
  )
}

export function TodayMatches({ groupedMatches, loading, isFallback, dayLabel, onSelect, hypeByTeam }: TodayMatchesProps) {
  const leagueEntries = Object.entries(groupedMatches)
  const total = leagueEntries.reduce((sum, [, m]) => sum + m.length, 0)
  // Este painel nao recebe ratings: a probabilidade do modelo so existe na rodada
  // (RoundView). A legenda daqui fala apenas do rodape de estatisticas — nunca promete
  // um rotulo que nenhum card deste painel mostra.
  const temStats = leagueEntries.some(([, ms]) => ms.some((m) => m.match_stats != null))

  return (
    <div className="flex flex-col rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
          <Calendar className="h-4 w-4 text-emerald-400" />
        </div>
        <h2 className="text-[14px] font-semibold text-slate-200">
          {isFallback ? 'Última rodada' : 'Jogos de hoje'}
        </h2>
        {isFallback && dayLabel && <span className="text-[11px] font-medium text-amber-300">{dayLabel}</span>}
        {!loading && leagueEntries.length > 0 && (
          <span className="ml-auto rounded-lg bg-white/[0.06] px-2 py-0.5 text-[11px] font-medium text-slate-400">
            {total} {total === 1 ? 'jogo' : 'jogos'}
          </span>
        )}
      </div>

      {!loading && leagueEntries.length > 0 ? (
        <div className="mb-3">
          <MatchListLegend showProb={false} showStats={temStats} />
        </div>
      ) : null}

      <div className="flex-1">
        {loading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-[116px] animate-pulse rounded-xl bg-white/[0.05]" />
            ))}
          </div>
        ) : leagueEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Calendar className="mb-4 h-8 w-8 text-slate-600" />
            <p className="text-[13px] text-slate-400">Nenhum jogo programado para hoje</p>
          </div>
        ) : (
          <div className="space-y-4">
            {leagueEntries.map(([leagueName, matches]) => (
              <div key={leagueName} className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className="min-w-0 shrink truncate text-[11px] font-semibold uppercase tracking-wider text-slate-400"
                    title={leagueName}
                  >
                    {leagueName}
                  </span>
                  <div className="h-px min-w-[16px] flex-1 bg-gradient-to-r from-white/20 to-transparent" />
                  <span className="shrink-0 font-mono text-[11px] tabular-nums text-slate-400">
                    {matches.length} {matches.length === 1 ? 'jogo' : 'jogos'}
                  </span>
                </div>
                <div className="space-y-2">
                  {matches.map((match, i) => (
                    <MatchRow key={`${match.league_id}-${match.home}-${match.away}-${i}`} match={match} onSelect={onSelect} hypeByTeam={hypeByTeam} />
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
