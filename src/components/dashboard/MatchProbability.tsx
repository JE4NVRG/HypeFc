"use client"

import type { MatchProb } from '@/lib/matchProbability'

/**
 * Probabilidade de vitoria do modelo (Elo + Poisson), separada visualmente do
 * resto por um motivo: e previsao, nao placar. E o modelo nao tem vantagem de
 * palpite — o favorito dele acerta na mesma taxa da ancora "melhor colocado da
 * tabela vence" (46,5%, n=1203). O numero e calibrado, nao e edge. O title diz
 * isso em texto para quem passar o mouse, e o rotulo diz em texto para quem nao.
 */
export const PROB_TOOLTIP =
  'Probabilidade do modelo Elo+Poisson (casa · empate · fora). Calibrado, mas sem vantagem de palpite: o favorito acerta 46,5%, a mesma taxa de "o melhor colocado da tabela vence" (n=1203). Nao e palpite nem recomendacao.'

export function pct(valor: number): string {
  return `${Math.round(valor * 100)}`
}

/** Versao de uma linha, para caber na linha do confronto sem custar rolagem. */
export function ProbabilityChip({ prob }: { prob: MatchProb | null }) {
  if (!prob) return null
  const favorito = prob.home >= prob.away ? 'home' : 'away'
  return (
    <span
      className="hidden shrink-0 items-center gap-0.5 font-mono text-[10px] tabular-nums sm:flex"
      title={PROB_TOOLTIP}
    >
      <span className={favorito === 'home' ? 'font-semibold text-emerald-300' : 'text-slate-500'}>{pct(prob.home)}</span>
      <span className="text-slate-700">·</span>
      <span className="text-slate-500">{pct(prob.draw)}</span>
      <span className="text-slate-700">·</span>
      <span className={favorito === 'away' ? 'font-semibold text-emerald-300' : 'text-slate-500'}>{pct(prob.away)}</span>
    </span>
  )
}

/** Versao do painel: barras, numeros e a leitura honesta ao lado. */
export function ProbabilityBars({
  prob,
  homeName,
  awayName,
  record,
}: {
  prob: MatchProb
  homeName: string
  awayName: string
  record?: { n: number; brier: number; uniformBrier: number; bestPlaced: number | null; hitRate: number } | null
}) {
  const linhas = [
    { rotulo: homeName, valor: prob.home, cor: 'bg-emerald-400' },
    { rotulo: 'Empate', valor: prob.draw, cor: 'bg-slate-400' },
    { rotulo: awayName, valor: prob.away, cor: 'bg-sky-400' },
  ]
  return (
    <div className="space-y-1.5">
      {linhas.map(({ rotulo, valor, cor }) => (
        <div key={rotulo} className="flex items-center gap-2">
          <span className="w-[38%] truncate text-[11px] text-slate-300" title={rotulo}>
            {rotulo}
          </span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
            <div className={`h-full rounded-full ${cor}`} style={{ width: `${Math.max(2, valor * 100)}%` }} />
          </div>
          <span className="w-9 shrink-0 text-right font-mono text-[11px] tabular-nums text-slate-200">
            {Math.round(valor * 100)}%
          </span>
        </div>
      ))}
      <p className="pt-0.5 text-[10px] leading-relaxed text-slate-500">
        Modelo Elo+Poisson (k=20, mando 70 pontos).{' '}
        {record
          ? `Medido em ${record.n} jogos: Brier ${record.brier.toFixed(3)} contra ${record.uniformBrier.toFixed(3)} do chute uniforme — o numero e calibrado. Mas o favorito dele acerta ${(record.hitRate * 100).toFixed(1)}%${
              record.bestPlaced !== null ? `, a mesma taxa de "o melhor colocado da tabela vence" (${(record.bestPlaced * 100).toFixed(1)}%)` : ''
            }: probabilidade melhor, palpite igual.`
          : 'Acerto medido e publicado no recorde do modelo.'}
      </p>
    </div>
  )
}
