"use client"

import { Goal, Tv, CheckCircle2, Clock, BarChart3 } from 'lucide-react'
import type { DayStats } from '@/hooks/useDashboardData'

interface StatsBarProps {
  stats: DayStats | undefined
  loading: boolean
}

const TITULO_ID = 'resumo-do-dia'

/**
 * Faixa de KPIs do dia (DESIGN.md): o numero e o heroi (28px no desktop, 20px
 * no mobile, ambos com leading-none), o rotulo e label tecnico (11px, piso
 * absoluto).
 *
 * Cor: os icones sao mono (slate-400 em caixa neutra) porque icone colorido nao
 * significa nada — e cinco cores diferentes lado a lado viram ruido. Verde fica
 * reservado para "ao vivo", que e o unico estado com significado proprio.
 *
 * Altura: 56px no mobile (3 por linha, 2 linhas), 60px no desktop (5 por
 * linha, 1 linha). O icone desaparece no mobile para o rotulo inteiro caber.
 */
function StatCard({
  icon,
  label,
  value,
  live = false,
}: {
  icon: React.ReactNode
  label: string
  value: string | number
  live?: boolean
}) {
  return (
    <div className="flex min-h-[56px] min-w-[104px] shrink-0 items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-2 py-2 sm:min-h-[60px] sm:gap-3 sm:px-3 lg:min-w-0">
      <div
        aria-hidden="true"
        className={`h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
          live ? 'flex bg-emerald-500/10 text-emerald-300' : 'hidden bg-white/[0.06] text-slate-400 sm:flex'
        }`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[20px] font-bold leading-none tracking-tight text-white tabular-nums sm:text-[28px]">{value}</p>
        <p className="mt-1 text-[11px] font-medium uppercase leading-none tracking-wider text-slate-400">{label}</p>
      </div>
    </div>
  )
}

export function StatsBar({ stats, loading }: StatsBarProps) {
  if (loading || !stats) {
    return (
      <section aria-labelledby={TITULO_ID}>
        <h2 id={TITULO_ID} className="sr-only">
          Resumo do dia
        </h2>
        <div aria-hidden="true" className="grid grid-cols-3 gap-2 lg:grid-cols-5">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-[56px] animate-pulse rounded-xl bg-white/5 sm:h-[60px]" />
          ))}
        </div>
        <p role="status" className="sr-only">
          Carregando o resumo do dia.
        </p>
      </section>
    )
  }

  return (
    <section aria-labelledby={TITULO_ID}>
      <h2 id={TITULO_ID} className="sr-only">
        Resumo do dia
      </h2>
      {/* No mobile os 5 KPIs viram UMA linha que rola: a grade 3x2 custava 120px
          antes do primeiro card, e o cockpit nao pode gastar a tela antes do
          conteudo. A partir de lg volta a grade de 5. */}
      <div className="-mx-0.5 flex gap-2 overflow-x-auto px-0.5 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:grid lg:grid-cols-5 lg:overflow-visible lg:pb-0">
        <StatCard icon={<Tv className="h-4 w-4" />} label={stats.totalMatches === 1 ? 'Jogo' : 'Jogos'} value={stats.totalMatches} />
        <StatCard icon={<Goal className="h-4 w-4" />} label={stats.totalGoals === 1 ? 'Gol' : 'Gols'} value={stats.totalGoals} />
        <StatCard icon={<BarChart3 className="h-4 w-4" />} label="Média/jogo" value={stats.avgGoals} />
        {stats.liveMatches > 0 ? (
          <StatCard
            icon={
              <span className="relative flex h-4 w-4 items-center justify-center">
                <span className="absolute h-3 w-3 animate-ping rounded-full bg-emerald-400/40" />
                <span className="relative h-2 w-2 rounded-full bg-emerald-400" />
              </span>
            }
            label="Ao vivo"
            value={stats.liveMatches}
            live
          />
        ) : (
          <StatCard
            icon={<CheckCircle2 className="h-4 w-4" />}
            label={stats.finishedMatches === 1 ? 'Encerrado' : 'Encerrados'}
            value={stats.finishedMatches}
          />
        )}
        <StatCard
          icon={<Clock className="h-4 w-4" />}
          label={stats.scheduledMatches > 0 ? 'A jogar' : 'Ligas'}
          value={stats.scheduledMatches > 0 ? stats.scheduledMatches : stats.leaguesActive}
        />
      </div>
    </section>
  )
}
