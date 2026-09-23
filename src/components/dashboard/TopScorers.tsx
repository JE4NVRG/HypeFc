"use client"

import { Target } from 'lucide-react'
import { isAllowedCrest } from './HypeFlags'
import type { Scorer } from '@/hooks/useDashboardData'

interface TopScorersProps {
  scorers: Scorer[]
  loading: boolean
}

/* O numero da posicao ja ordena a lista; a cor so marca o lider (laranja, o
   acento do painel). Ouro/prata/bronze era decoracao: nao acrescentava leitura
   e trazia mais dois tons para uma tela que ja tem W/D/L e placar coloridos. */
function getMedalColor(index: number) {
  if (index === 0) return 'text-orange-200 bg-orange-500/15'
  if (index === 1) return 'text-slate-200 bg-white/[0.08]'
  if (index === 2) return 'text-slate-300 bg-white/[0.06]'
  return 'text-slate-400 bg-white/[0.04]'
}

/* Escudo: so host liberado, sem next/image — o lazy do next/image nao dispara
   dentro do cockpit (medido: 0 de 72 escudos carregados). Eager e com
   width/height explicitos; sem host liberado, cai na inicial do time. */
function Escudo({ src, name }: { src: string | null; name: string }) {
  if (src && isAllowedCrest(src)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        width={20}
        height={20}
        loading="eager"
        decoding="async"
        className="h-5 w-5 shrink-0 rounded object-contain"
      />
    )
  }
  return (
    <span
      aria-hidden="true"
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-slate-800 text-[11px] font-bold text-slate-300"
    >
      {name.charAt(0).toUpperCase()}
    </span>
  )
}

export function TopScorers({ scorers, loading }: TopScorersProps) {
  return (
    <div className="flex flex-col rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="mb-3 flex items-center gap-2">
        <div aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.06] text-slate-400">
          <Target className="h-3.5 w-3.5" />
        </div>
        <h2 className="text-sm font-semibold text-slate-200">Artilheiros</h2>
        {!loading && scorers.length > 0 && (
          <span className="ml-auto rounded-lg bg-white/[0.06] px-2 py-1 text-[11px] font-medium text-slate-400">
            top {scorers.length}
          </span>
        )}
      </div>

      <div className="flex-1">
        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-white/5" />
            ))}
          </div>
        ) : scorers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Target aria-hidden="true" className="mb-3 h-8 w-8 text-slate-400/70" />
            <p className="text-[12px] text-slate-400">Sem dados de artilheiros</p>
          </div>
        ) : (
          <div className="space-y-1">
            {scorers.map((scorer, i) => (
              <div
                key={`${scorer.player}-${i}`}
                className="flex items-center gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-white/[0.04]"
              >
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${getMedalColor(i)}`}>
                  {i + 1}
                </span>
                <Escudo src={scorer.team_crest} name={scorer.team} />
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium text-slate-200">{scorer.player}</span>
                  <span className="text-[11px] text-slate-400">{scorer.team}</span>
                </div>
                <div className="flex items-center gap-2 text-right">
                  <div>
                    <span className="block text-sm font-bold text-white">{scorer.goals}</span>
                    <span className="text-[11px] text-slate-400">gols</span>
                  </div>
                  {scorer.assists > 0 && (
                    <div>
                      <span className="block text-xs font-medium text-slate-300">{scorer.assists}</span>
                      <span className="text-[11px] text-slate-400">assist.</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
