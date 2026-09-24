"use client"

import type { MatchProb } from '@/lib/matchProbability'

/**
 * Probabilidade de vitoria do modelo (Elo + Poisson), separada visualmente do
 * resto por um motivo: e previsao, nao placar. E o modelo nao tem vantagem de
 * palpite — o favorito dele acerta na mesma taxa da ancora "melhor colocado da
 * tabela vence" (46,5%, n=1203). O numero e calibrado, nao e edge.
 *
 * Regra de rotulo: nenhuma sequencia de numeros sai daqui sem dizer o que ela e.
 * O rotulo ('Casa', 'Empate', 'Fora') aparece sempre em texto visivel — nao so
 * no title, que nao existe no toque — e o title repete a leitura honesta.
 */
export const PROB_TOOLTIP =
  'Probabilidade do modelo Elo+Poisson, rotulada: Casa (vitoria do mandante) · Empate · Fora (vitoria do visitante). Calibrado, mas sem vantagem de palpite: o favorito acerta 46,5%, a mesma taxa de "o melhor colocado da tabela vence" (n=1203). Nao e palpite nem recomendacao.'

export function pct(valor: number): string {
  return `${Math.round(valor * 100)}`
}

/** Numero visivel em pt-BR: virgula decimal, nunca ponto. */
function decimal(valor: number, casas: number): string {
  return valor.toFixed(casas).replace('.', ',')
}

/** Versao de uma linha, para caber na linha do confronto sem custar rolagem. */
export function ProbabilityChip({ prob }: { prob: MatchProb | null }) {
  if (!prob) return null
  const maior = Math.max(prob.home, prob.draw, prob.away)
  return (
    <span
      className="hidden shrink-0 items-center gap-1 whitespace-nowrap font-mono text-[11px] tabular-nums sm:flex"
      title={PROB_TOOLTIP}
    >
      <span className="text-slate-400">Casa</span>
      <span className={prob.home === maior ? 'font-semibold text-emerald-300' : 'text-slate-200'}>{pct(prob.home)}%</span>
      <span className="text-slate-400">·</span>
      <span className="text-slate-400">Empate</span>
      <span className={prob.draw === maior ? 'font-semibold text-emerald-300' : 'text-slate-200'}>{pct(prob.draw)}%</span>
      <span className="text-slate-400">·</span>
      <span className="text-slate-400">Fora</span>
      <span className={prob.away === maior ? 'font-semibold text-emerald-300' : 'text-slate-200'}>{pct(prob.away)}%</span>
    </span>
  )
}

/** Versao do painel: rotulo explicito, numero-herói, barra nomeada e a leitura honesta. */
export function ProbabilityBars({
  prob,
  homeName,
  awayName,
  record,
  forward,
}: {
  prob: MatchProb
  homeName: string
  awayName: string
  record?: { n: number; brier: number; uniformBrier: number; bestPlaced: number | null; hitRate: number } | null
  forward?: { n: number; brier: number | null; hitRate: number | null; pendentes: number } | null
}) {
  // A ordem e sempre Casa · Empate · Fora, e cada linha carrega o proprio rotulo:
  // o numero nunca aparece solto.
  const linhas = [
    { rotulo: 'Casa', nome: homeName, valor: prob.home, cor: 'bg-emerald-400', numero: 'text-emerald-300' },
    { rotulo: 'Empate', nome: 'sem vencedor', valor: prob.draw, cor: 'bg-slate-400', numero: 'text-slate-100' },
    { rotulo: 'Fora', nome: awayName, valor: prob.away, cor: 'bg-sky-400', numero: 'text-sky-300' },
  ]
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {linhas.map(({ rotulo, nome, valor, cor, numero }) => (
          <div key={rotulo} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-center">
            <span className="flex items-center justify-center gap-1.5">
              <span className={`h-2 w-2 shrink-0 rounded-full ${cor}`} aria-hidden="true" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{rotulo}</span>
            </span>
            <span className="mt-1 block truncate text-[12px] leading-tight text-slate-300" title={nome}>
              {nome}
            </span>
            <span className={`mt-1 block font-mono text-2xl font-bold leading-none tabular-nums ${numero}`}>
              {pct(valor)}%
            </span>
          </div>
        ))}
      </div>

      <div
        className="flex h-2.5 overflow-hidden rounded-full bg-white/[0.06]"
        role="img"
        aria-label={`Probabilidade do modelo — Casa ${pct(prob.home)}%, Empate ${pct(prob.draw)}%, Fora ${pct(prob.away)}%`}
      >
        <span className="h-full bg-emerald-400" style={{ width: `${prob.home * 100}%` }} />
        <span className="h-full bg-slate-400" style={{ width: `${prob.draw * 100}%` }} />
        <span className="h-full flex-1 bg-sky-400" />
      </div>
      <p className="text-[12px] leading-relaxed text-slate-400">Barra na mesma ordem dos rótulos acima: Casa · Empate · Fora.</p>

      <p className="text-[12px] leading-relaxed text-slate-400">
        Modelo Elo+Poisson (k=20, mando 70 pontos).{' '}
        {record
          ? `Medido em ${record.n} jogos: Brier ${decimal(record.brier, 3)} contra ${decimal(record.uniformBrier, 3)} do chute uniforme — o número é calibrado. Mas o favorito dele acerta ${decimal(
              record.hitRate * 100,
              1
            )}%${
              record.bestPlaced !== null
                ? `, a mesma taxa de “o melhor colocado da tabela vence” (${decimal(record.bestPlaced * 100, 1)}%)`
                : ''
            }: probabilidade melhor, palpite igual.`
          : 'Acerto medido e publicado no recorde do modelo.'}
      </p>
      <p className="text-[12px] leading-relaxed text-slate-400">
        {forward && forward.n > 0
          ? `Registro em produção (gravado antes do jogo, ${forward.n} partidas liquidadas): Brier ${
              forward.brier === null ? '—' : decimal(forward.brier, 3)
            }${
              forward.hitRate !== null ? ` · favorito ${decimal(forward.hitRate * 100, 1)}%` : ''
            }${forward.pendentes ? ` · ${forward.pendentes} pendentes` : ''}.`
          : 'Registro em produção começa do zero: cada probabilidade é gravada antes do apito e liquidada depois, sem número até o primeiro jogo terminar.'}
      </p>
    </div>
  )
}
