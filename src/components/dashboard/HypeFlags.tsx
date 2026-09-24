"use client"

import { Flame, TrendingUp, Trophy, Swords } from 'lucide-react'
import type { HypeTeam } from '@/hooks/useDashboardData'

/**
 * Hosts liberados para escudo. Usado por todos os cards/lista do painel: quem nao
 * passa por aqui cai na inicial do time, nunca numa imagem de origem desconhecida.
 */
export function isAllowedCrest(url: string): boolean {
  return url.includes('football-data.org') || url.includes('espncdn.com')
}

interface HypeFlagsProps {
  hypeTeams: HypeTeam[]
  loading: boolean
}

/*
 * Direcao 002: a posicao na fila nao vira cor de categoria. O primeiro colocado
 * fica no painel elevado com a regua estrutural; os outros ficam em paper-2 com
 * a regua de 1px. Hierarquia por peso e regua, nunca por cor.
 */
const priorityConfig: Record<number, { color: string; bg: string; border: string; icon: React.ReactNode }> = {
  1: {
    color: 'text-ink-2',
    bg: 'bg-paper-3/60',
    border: 'border-line',
    icon: <Trophy className="h-3 w-3" />,
  },
  2: {
    color: 'text-ink-3',
    bg: 'bg-paper-2/60',
    border: 'border-rule',
    icon: <TrendingUp className="h-3 w-3" />,
  },
  3: {
    color: 'text-ink-3',
    bg: 'bg-paper-2/40',
    border: 'border-rule',
    icon: <Swords className="h-3 w-3" />,
  },
  4: {
    color: 'text-ink-3',
    bg: 'bg-paper-2/40',
    border: 'border-rule',
    icon: <Swords className="h-3 w-3" />,
  },
}

function FormPills({ form }: { form?: Array<'W' | 'D' | 'L'> }) {
  if (!form?.length) return null
  return (
    <div className="flex gap-1">
      {form.map((letter, index) => (
        <span
          key={`${letter}-${index}`}
          className={`flex h-5 w-5 items-center justify-center rounded-lg text-[11px] font-bold ${
            letter === 'W' ? 'bg-ink/15 text-ink' : letter === 'D' ? 'bg-ink-3/20 text-ink-2' : 'bg-paper-3 text-ink-3'
          }`}
        >
          {letter}
        </span>
      ))}
    </div>
  )
}

function HypeCard({ team, rank }: { team: HypeTeam; rank: number }) {
  const config = priorityConfig[team.priority] || priorityConfig[3]
  const live = team.match_status === 'IN_PLAY' || team.match_status === 'PAUSED'

  return (
    <div className={`group relative flex items-center gap-3 rounded-xl border ${config.border} ${config.bg} p-3.5 transition-all hover:scale-[1.02]`}>
      <div className="flex w-5 flex-shrink-0 justify-center font-mono text-[11px] font-semibold tabular-nums text-ink-3">
        {rank}
      </div>
      <div className="flex-shrink-0">
        {team.crest && isAllowedCrest(team.crest) ? (
          // eslint-disable-next-line @next/next/no-img-element -- lazy do next/image nao carrega no cockpit
          <img
            src={team.crest}
            alt={team.team}
            width={32}
            height={32}
            loading="eager"
            decoding="async"
            className="h-8 w-8 rounded-lg object-contain"
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-paper-3 text-[14px] font-bold text-ink-3">
            {team.team.charAt(0)}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {team.position && (
            <span className="flex-shrink-0 rounded-lg bg-ink/[0.07] px-1.5 py-0.5 font-mono text-[11px] leading-none tabular-nums text-ink-3" title={`${team.position}º lugar na tabela`}>
              {team.position}º
            </span>
          )}
          <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink" title={team.team}>{team.team}</span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <div className={`flex min-w-0 items-center gap-1 text-[11px] ${config.color}`}>
            {config.icon}
            <span className="truncate" title={team.reason}>{team.reason}</span>
          </div>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <FormPills form={team.form} />
          {team.opponent && (
            <span className="truncate text-[11px] text-ink-3" title={`${team.opponent}${live ? ' · ao vivo' : team.time_local ? ` · ${team.time_local}` : ''}`}>
              vs {team.opponent}{live ? ' · ao vivo' : team.time_local ? ` · ${team.time_local}` : ''}
            </span>
          )}
        </div>
      </div>

      {typeof team.score === 'number' && (
        <div className="flex-shrink-0 text-right">
          <div className="font-mono text-[16px] font-bold leading-none tabular-nums text-ink">{team.score}</div>
          <div className="mt-1 text-[11px] uppercase tracking-wider text-ink-3">hype</div>
        </div>
      )}
    </div>
  )
}

export function HypeFlags({ hypeTeams, loading }: HypeFlagsProps) {
  return (
    <div className="flex flex-col rounded-xl border border-ink/[0.06] bg-ink/[0.02] p-4">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink/[0.06]">
          <Flame className="h-4 w-4 text-ink-2" />
        </div>
        <h2 className="text-[14px] font-semibold text-ink">Times em Alta</h2>
        {!loading && hypeTeams.length > 0 && (
          <span className="ml-auto rounded-lg bg-ink/[0.06] px-2 py-0.5 text-[11px] font-medium text-ink-3">
            {hypeTeams.length} {hypeTeams.length === 1 ? 'time' : 'times'}
          </span>
        )}
      </div>

      <div className="flex-1">
        {loading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-ink/[0.05]" />
            ))}
          </div>
        ) : hypeTeams.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Flame className="mb-4 h-8 w-8 text-line" />
            <p className="text-[13px] text-ink-3">Nenhum time em destaque hoje</p>
          </div>
        ) : (
          <div className="space-y-2">
            {hypeTeams.map((team, i) => (
              <HypeCard key={`${team.team}-${team.league_id}`} team={team} rank={i + 1} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
