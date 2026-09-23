"use client"

import Image from 'next/image'
import { Clock } from 'lucide-react'
import { isAllowedCrest } from './HypeFlags'
import type { TeamFixture } from '@/lib/teamSchedule'

/**
 * Lista compacta dos proximos jogos do time. Nada e calculado aqui: as fixtures chegam
 * prontas do parser (src/lib/teamSchedule.ts), que ja filtrou futuro, ordenou por data e
 * cortou em 5. O componente so formata e, quando nao ha jogo publicado, diz isso com
 * todas as letras em vez de preencher linha vazia.
 */
interface NextFixturesProps {
  fixtures: TeamFixture[]
  team: string
  loading?: boolean
}

// Mesma zona do resto do dashboard (o painel de detalhe usa valor local de Sao Paulo):
// se aqui usasse a zona do visitante, a data sairia diferente do card que ele abriu.
const TIME_ZONE = 'America/Sao_Paulo'

function parseDate(iso: string | null): Date | null {
  if (!iso) return null
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? null : date
}

/**
 * dd/MM em pt-BR. Sem ano quando o jogo e do ano corrente (o caso comum e poluiria a
 * linha); fora disso o ano entra em 2 digitos para nao virar dado ambiguo.
 */
function fixtureDay(iso: string | null): string {
  const date = parseDate(iso)
  if (!date) return '—'
  const sameYear =
    date.toLocaleDateString('en-CA', { timeZone: TIME_ZONE }).slice(0, 4) ===
    new Date().toLocaleDateString('en-CA', { timeZone: TIME_ZONE }).slice(0, 4)
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    ...(sameYear ? {} : { year: '2-digit' }),
    timeZone: TIME_ZONE,
  })
}

function fixtureDayTitle(iso: string | null): string {
  const date = parseDate(iso)
  if (!date) return 'data a definir'
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: TIME_ZONE })
}

/* Escudo do adversario: mesma regra do painel de detalhe (so host liberado) e mesma
   queda para a inicial quando a fonte nao manda escudo. Tamanho menor que o do painel:
   aqui a linha e compacta. */
function Crest({ src, name, size = 18 }: { src: string | null; name: string; size?: number }) {
  if (src && isAllowedCrest(src)) {
    return (
      <Image
        src={src}
        alt={name}
        width={size}
        height={size}
        className="rounded object-contain"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <div
      className="flex items-center justify-center rounded bg-slate-800 font-bold text-slate-400"
      style={{ width: size, height: size, fontSize: size / 2.6 }}
    >
      {name.charAt(0)}
    </div>
  )
}

function FixtureRow({ fixture }: { fixture: TeamFixture }) {
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="w-8 shrink-0 text-[10px] uppercase tracking-wide text-slate-500">
        {fixture.home ? 'casa' : 'fora'}
      </span>
      <Crest src={fixture.opponent_crest} name={fixture.opponent} />
      <span
        className="min-w-0 flex-1 truncate text-slate-300"
        title={`${fixture.home ? 'em casa' : 'fora'} vs ${fixture.opponent}`}
      >
        {fixture.opponent}
      </span>
      {fixture.competition ? (
        <span className="max-w-[88px] shrink-0 truncate text-[10px] text-slate-500" title={fixture.competition}>
          {fixture.competition}
        </span>
      ) : null}
      <span className="w-10 shrink-0 text-right font-mono text-[10px] text-slate-500" title={fixtureDayTitle(fixture.date)}>
        {fixtureDay(fixture.date)}
      </span>
    </div>
  )
}

export function NextFixtures({ fixtures, team, loading = false }: NextFixturesProps) {
  const list = Array.isArray(fixtures) ? fixtures.slice(0, 5) : []

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-slate-500">
          <Clock className="h-3 w-3 shrink-0" />
          Próximos jogos
        </h3>
        {team ? (
          <span className="truncate text-[10px] text-slate-600" title={team}>
            {team}
          </span>
        ) : null}
      </div>

      {loading ? (
        <div className="space-y-1.5">
          {[...Array(3)].map((_, index) => (
            <div key={index} className="h-3.5 w-full animate-pulse rounded bg-white/5" />
          ))}
        </div>
      ) : list.length ? (
        <div className="space-y-1">
          {list.map((fixture, index) => (
            <FixtureRow key={`${fixture.date ?? 'sem-data'}-${fixture.opponent}-${index}`} fixture={fixture} />
          ))}
        </div>
      ) : (
        <p className="text-[11px] leading-snug text-slate-500">Próximos jogos ainda não publicados para este time.</p>
      )}
    </section>
  )
}
