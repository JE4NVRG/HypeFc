"use client"

import { Trophy } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Standing } from '@/hooks/useDashboardData'
import { isAllowedCrest } from '@/components/dashboard/HypeFlags'
import {
  chanceDoTime,
  formatarChance,
  notaDaSimulacao,
  type TitleOddsPayload,
} from '@/lib/titleOdds'

interface LeagueStandingsProps {
  standings: Standing[]
  leagueId: string
  leagueName: string
  capturedAt: string | null
  loading: boolean
  onLeagueChange: (id: string) => void
  /** Quando a secao de liga tem abas, o seletor so aparece uma vez (no cabecalho). */
  showLeagueSelect?: boolean
  /** Simulacao da temporada inteira (scripts/build-title-odds.ts). */
  titleOdds?: TitleOddsPayload | null
}

const LEAGUES = [
  { id: 'BSA', name: 'Brasileirão Série A', flag: '\u{1F1E7}\u{1F1F7}' },
  { id: 'PL', name: 'Premier League', flag: '\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}' },
  { id: 'PD', name: 'La Liga', flag: '\u{1F1EA}\u{1F1F8}' },
  { id: 'SA', name: 'Serie A', flag: '\u{1F1EE}\u{1F1F9}' },
  { id: 'FL1', name: 'Ligue 1', flag: '\u{1F1EB}\u{1F1F7}' },
  { id: 'BL1', name: 'Bundesliga', flag: '\u{1F1E9}\u{1F1EA}' },
  { id: 'DED', name: 'Eredivisie', flag: '\u{1F1F3}\u{1F1F1}' },
  { id: 'PPL', name: 'Primeira Liga', flag: '\u{1F1F5}\u{1F1F9}' },
  { id: 'ELC', name: 'Championship', flag: '\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}' },
  { id: 'CL', name: 'Champions League', flag: '\u{1F3C6}' },
] as const

function getPositionStyle(pos: number, totalTeams: number) {
  if (pos <= 4) return 'border-l-emerald-500/60 bg-emerald-500/[0.04]'
  if (pos <= 6) return 'border-l-blue-500/60 bg-blue-500/[0.03]'
  if (totalTeams > 0 && pos > totalTeams - 4) return 'border-l-red-500/60 bg-red-500/[0.04]'
  return 'border-l-transparent'
}

// As zonas mudam por pais: no Brasil nao existe vaga de Champions/Europa.
function getZones(leagueId: string, totalTeams: number) {
  const relegated = totalTeams > 0 ? totalTeams - 3 : 4
  if (leagueId === 'BSA') {
    return [
      { color: 'bg-emerald-500/60', label: `Libertadores (1-4)` },
      { color: 'bg-blue-500/60', label: `Sul-Americana (5-6)` },
      { color: 'bg-red-500/60', label: `Rebaixamento (${relegated}-${totalTeams || 20})` },
    ]
  }
  if (leagueId === 'ELC') {
    return [
      { color: 'bg-emerald-500/60', label: 'Acesso (1-2)' },
      { color: 'bg-blue-500/60', label: 'Playoff de acesso (3-6)' },
      { color: 'bg-red-500/60', label: `Rebaixamento (${relegated}-${totalTeams || 24})` },
    ]
  }
  if (leagueId === 'CL') return []
  return [
    { color: 'bg-emerald-500/60', label: 'Champions' },
    { color: 'bg-blue-500/60', label: 'Europa' },
    { color: 'bg-red-500/60', label: `Rebaixamento (${relegated}-${totalTeams || 20})` },
  ]
}

/**
 * A chance vem do build como "12.3%": aqui ela sai em pt-BR ("12,3%"). O
 * formatador e do lib e nao muda; a apresentacao e desta tela.
 */
function chanceBR(p: number): string {
  return formatarChance(p).replace('.', ',')
}

/**
 * A tabela precisa caber em 390px de largura. Com as 8 colunas de uma vez, o
 * nome do time ficava com 22px ("Flamengo" cortado) porque #, J, V, E, D, Pts e
 * Tit. comem a linha inteira. No mobile ficam as colunas que decidem (posicao,
 * time, jogos, pontos e chance de titulo); V/E/D entram a partir de sm.
 */
const GRADE =
  'grid-cols-[1.5rem_1fr_1.5rem_2.25rem_2.5rem] sm:grid-cols-[1.75rem_1fr_1.75rem_1.75rem_1.75rem_1.75rem_2.5rem_3rem]'
const SO_SM = 'hidden sm:block'

export function LeagueStandings({
  standings,
  leagueId,
  leagueName,
  capturedAt,
  loading,
  onLeagueChange,
  showLeagueSelect = true,
  titleOdds = null,
}: LeagueStandingsProps) {
  const liga = titleOdds?.leagues?.[leagueId] ?? null
  const simulacoes = titleOdds?.simulacoes ?? 0
  return (
    <div className="flex flex-col rounded-xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="mb-4 flex items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-500/10">
          <Trophy className="h-4 w-4 text-orange-300" />
        </div>
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-slate-100">Classificação</h2>
          {leagueName ? <p className="truncate text-[12px] text-slate-400">{leagueName}</p> : null}
        </div>
      </div>

      {liga && liga.times.length > 0 && simulacoes > 0 && (
        <div className="mb-4 rounded-xl border border-orange-500/20 bg-gradient-to-br from-orange-500/[0.08] to-transparent p-3.5">
          {/* Heading de verdade: o bloco é uma seção própria da classificação. */}
          <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h3 className="text-base font-semibold text-orange-200">Chance de título</h3>
            <span className="text-[11px] uppercase tracking-wider text-slate-400">
              {simulacoes.toLocaleString('pt-BR')} {simulacoes === 1 ? 'simulação' : 'simulações'}
            </span>
          </div>
          <div className="space-y-2">
            {liga.times.slice(0, 4).map((t, i) => (
              <div key={t.team} className="flex items-center gap-2">
                <span className="w-5 shrink-0 font-mono text-[11px] font-medium text-slate-400">{i + 1}º</span>
                <span className="w-[96px] shrink-0 truncate text-[13px] font-medium text-slate-100" title={t.team}>
                  {t.apelido || t.team}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.08]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-orange-500 to-yellow-400"
                    style={{ width: `${Math.max(2, Math.round(t.p_titulo * 100))}%` }}
                  />
                </div>
                <span className="w-14 shrink-0 text-right font-mono text-[13px] font-bold tabular-nums text-orange-200">
                  {chanceBR(t.p_titulo)}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2.5 text-[12px] leading-relaxed text-slate-400">
            {notaDaSimulacao(liga, simulacoes)} Não é palpite: o modelo é calibrado e não
            supera a âncora “melhor colocado vence”.
          </p>
        </div>
      )}

      {showLeagueSelect && (
        <Select value={leagueId} onValueChange={onLeagueChange}>
          <SelectTrigger className="mb-4 h-11 border-slate-700 bg-slate-800/60 text-[13px] text-slate-100 focus:ring-2 focus:ring-orange-400/60">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="border-white/10 bg-slate-900">
            {LEAGUES.map((league) => (
              <SelectItem key={league.id} value={league.id} className="text-slate-200 focus:bg-white/10 focus:text-white">
                <span className="flex items-center gap-2">
                  <span>{league.flag}</span>
                  <span>{league.name}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <div className="flex-1">
        {loading ? (
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-white/5" />
            ))}
          </div>
        ) : standings.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Trophy className="mb-3 h-8 w-8 text-slate-400" />
            <p className="text-[14px] text-slate-400">Sem classificação disponível</p>
          </div>
        ) : (
          <>
            <div
              className={`mb-1 grid ${GRADE} items-center gap-1 px-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400`}
            >
              <span aria-hidden="true">#</span>
              <span>Time</span>
              <span className="text-center" title="Jogos disputados">J</span>
              <span className={`text-center ${SO_SM}`} title="Vitórias">V</span>
              <span className={`text-center ${SO_SM}`} title="Empates">E</span>
              <span className={`text-center ${SO_SM}`} title="Derrotas">D</span>
              <span className="text-right" title="Pontos">Pts</span>
              <span className="text-right" title="Chance de título na simulação da temporada">Tit.</span>
            </div>

            <div className="space-y-0.5">
              {standings.map((s) => {
                const chance = chanceDoTime(titleOdds, leagueId, s.team)
                return (
                <div
                  key={`${s.pos}-${s.team}`}
                  className={`grid ${GRADE} items-center gap-1 rounded-lg border-l-2 px-2 py-2.5 transition-colors hover:bg-white/[0.04] ${getPositionStyle(s.pos, standings.length)}`}
                >
                  <span className="font-mono text-[12px] font-medium text-slate-400">{s.pos}</span>
                  <div className="flex items-center gap-2 overflow-hidden">
                    {s.crest && isAllowedCrest(s.crest) ? (
                      /* img comum pelo mesmo motivo do painel: lazy do
                         next/image nao dispara dentro do cockpit. */
                      // eslint-disable-next-line @next/next/no-img-element -- next/image nao carrega no cockpit
                      <img
                        src={s.crest}
                        alt={s.team}
                        width={20}
                        height={20}
                        loading="eager"
                        decoding="async"
                        className="h-5 w-5 flex-shrink-0 rounded object-contain"
                      />
                    ) : (
                      <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded bg-slate-800 text-[11px] font-bold text-slate-300">
                        {s.team.charAt(0)}
                      </div>
                    )}
                    <span className="truncate text-[13px] font-medium text-slate-100">{s.team}</span>
                  </div>
                  <span className="text-center font-mono text-[12px] tabular-nums text-slate-300">{s.played}</span>
                  <span className={`text-center font-mono text-[12px] tabular-nums text-emerald-300 ${SO_SM}`}>{s.wins}</span>
                  <span className={`text-center font-mono text-[12px] tabular-nums text-slate-300 ${SO_SM}`}>{s.draws}</span>
                  <span className={`text-center font-mono text-[12px] tabular-nums text-slate-300 ${SO_SM}`}>{s.losses}</span>
                  <span className="text-right font-mono text-[13px] font-bold tabular-nums text-slate-100">{s.pts}</span>
                  <span
                    className="text-right font-mono text-[12px] font-semibold tabular-nums text-orange-300"
                    title={
                      chance
                        ? `Chance de título ${chanceBR(chance.p_titulo)} · G4 ${(chance.p_g4 * 100).toFixed(0)}% · zona ${(chance.p_zona * 100).toFixed(0)}%`
                        : undefined
                    }
                  >
                    {chance ? chanceBR(chance.p_titulo) : '—'}
                  </span>
                </div>
                )
              })}
            </div>

            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-slate-400">
              {getZones(leagueId, standings.length).map((zone) => (
                <span key={zone.label} className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${zone.color}`} aria-hidden="true" /> {zone.label}
                </span>
              ))}
            </div>

            {capturedAt && (
              <p className="mt-3 text-[11px] text-slate-400">
                Atualizado em {new Date(capturedAt).toLocaleString('pt-BR')}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
