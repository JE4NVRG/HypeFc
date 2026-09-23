"use client"

import { Clock, Database, ExternalLink, EyeOff, Github, ShieldQuestion } from 'lucide-react'
import {
  DATA_SOURCE,
  REFUSALS,
  REPO_URL,
  SCORE_STANCE,
  SOURCE_GAPS,
  buildProvenance,
  cadenceFacts,
  type CoveragePoint,
} from '@/lib/dataCoverage'

export interface SourcesPanelProps {
  stats?: { totalMatches: number; totalGoals: number } | null
  leagueCount?: number | null
  liveCount?: number | null
  lastUpdated?: string | null
}

function Group({
  icon,
  title,
  hint,
  children,
}: {
  icon: React.ReactNode
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/30 p-2.5">
      <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
        {icon}
        {title}
      </div>
      {hint ? <p className="mt-1 text-[10px] leading-snug text-slate-600">{hint}</p> : null}
      <div className="mt-2">{children}</div>
    </div>
  )
}

/** Item de limite do dado: o campo em negrito, o porque em cinza. */
function Points({ items }: { items: CoveragePoint[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((item) => (
        <li key={item.key} className="text-[11px] leading-snug">
          <span className="font-medium text-slate-300">{item.label}</span>
          <span className="text-slate-500"> — {item.detail}</span>
        </li>
      ))}
    </ul>
  )
}

/**
 * Procedencia, cobertura e limites do dado. Nao e rodape: quem publica um
 * recorde medido precisa mostrar de onde veio cada numero, o que a fonte nao
 * entrega e o que o produto prefere nao mostrar a mostrar errado.
 */
export function SourcesPanel({ stats, leagueCount, liveCount, lastUpdated }: SourcesPanelProps) {
  const provenance = buildProvenance({ stats, leagueCount, liveCount, lastUpdated })
  const cadence = cadenceFacts(liveCount)

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-200">Procedência e limites do dado</h2>
          <p className="mt-0.5 text-[11px] text-slate-500">
            De onde vem cada número, o que a fonte não entrega e o que o painel se recusa a estimar.
          </p>
        </div>
        <span className="rounded-full border border-slate-700 bg-slate-800/60 px-2 py-0.5 font-mono text-[10px] text-slate-400">
          {DATA_SOURCE.host}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
        {/* 1. A fonte, com o que ela responde. */}
        <Group
          icon={<Database className="h-3 w-3" />}
          title="Fonte dos dados"
          hint="Toda a rodada, a tabela e o detalhe do jogo saem da mesma origem."
        >
          <div className="space-y-1">
            <p className="text-[11px] font-medium text-emerald-300">{DATA_SOURCE.name}</p>
            <p className="text-[10px] leading-snug text-slate-500">{DATA_SOURCE.access}</p>
            <div className="flex flex-wrap gap-1 pt-0.5">
              {DATA_SOURCE.endpoints.map((endpoint) => (
                <span
                  key={endpoint}
                  className="rounded border border-slate-800 bg-slate-900/60 px-1.5 py-0.5 font-mono text-[10px] text-slate-500"
                >
                  {endpoint}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-2 space-y-1 border-t border-slate-800 pt-2">
            {provenance.map((row) => (
              <div key={row.key} className="flex items-baseline justify-between gap-2 text-[11px]">
                <span className="text-slate-500">{row.label}</span>
                <span className="shrink-0 font-mono text-slate-300">{row.value}</span>
              </div>
            ))}
          </div>
        </Group>

        {/* 2. O buraco da fonte — nada aqui e "a implementar": e o limite dela. */}
        <Group
          icon={<EyeOff className="h-3 w-3" />}
          title="O que a fonte não dá"
          hint="Campo que não vem no payload não é estimado no cliente."
        >
          <Points items={SOURCE_GAPS} />
        </Group>

        {/* 3. A regra do produto: prefere o vazio ao numero errado. */}
        <Group
          icon={<ShieldQuestion className="h-3 w-3" />}
          title="Onde o produto prefere não mostrar a mostrar errado"
          hint="A mesma regra em todas as telas — não um caso isolado deste painel."
        >
          <Points items={REFUSALS} />
          <div className="mt-2 rounded-lg border border-amber-500/25 bg-amber-500/5 p-2">
            <p className="text-[11px] font-medium text-amber-300">{SCORE_STANCE.title}</p>
            <p className="mt-0.5 text-[10px] leading-snug text-slate-400">{SCORE_STANCE.detail}</p>
          </div>
        </Group>
      </div>

      <div className="mt-3 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
        <Clock className="h-3 w-3" />
        Ritmo de leitura
      </div>
      <div className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {cadence.map((fact) => (
          <div
            key={fact.key}
            className={`rounded-lg border px-2.5 py-2 ${
              fact.active ? 'border-emerald-500/25 bg-emerald-500/5' : 'border-slate-800 bg-slate-950/30'
            }`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                {fact.label}
              </span>
              <span
                className={`shrink-0 font-mono text-[11px] ${
                  fact.active ? 'text-emerald-300' : 'text-slate-300'
                }`}
              >
                {fact.value}
              </span>
            </div>
            <p className="mt-0.5 text-[10px] leading-snug text-slate-600">{fact.detail}</p>
            {fact.active ? <p className="mt-0.5 text-[10px] text-emerald-400/80">em vigor agora</p> : null}
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-800 pt-2 text-[10px] text-slate-500">
        <a
          href={REPO_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-slate-400 transition-colors hover:text-slate-200"
        >
          <Github className="h-3 w-3" />
          <span className="font-mono">github.com/JE4NVRG/HypeFc</span>
          <ExternalLink className="h-2.5 w-2.5" />
        </a>
        <span className="text-slate-700">|</span>
        <span>Site aberto: sem login e sem wallet.</span>
        <span className="text-slate-700">|</span>
        <span className="font-mono">histórico versionado em data/snapshots</span>
      </div>
    </section>
  )
}
