"use client"

import { buildLeagueIntel, type TeamIntel } from '@/lib/leagueStats'
import type { Standing } from '@/hooks/useDashboardData'

interface LeagueIntelProps {
  table: Standing[]
  home?: Standing[]
  away?: Standing[]
  leagueName: string
  loading: boolean
}

function toSide(row: Standing) {
  return {
    team: row.team,
    crest: row.crest,
    pos: row.pos,
    played: row.played,
    points: row.pts,
    goalsFor: row.goalsFor || 0,
    goalsAgainst: row.goalsAgainst || 0,
    form: row.form,
  }
}

function contagem(total: number, singular: string, plural: string): string {
  return `${total} ${total === 1 ? singular : plural}`
}

function FormMarks({ form }: { form: Array<'W' | 'D' | 'L'> }) {
  if (!form.length) return <span className="text-ink-3">—</span>
  return (
    <span className="font-mono tracking-tight">
      {form.map((letter, index) => (
        <span
          key={`${letter}-${index}`}
          className={letter === 'W' ? 'text-ink' : letter === 'D' ? 'text-ink-3' : 'text-carimbo'}
        >
          {letter}
        </span>
      ))}
    </span>
  )
}

function Leader({ label, team, value }: { label: string; team: TeamIntel | null; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">{label}</p>
      <p className="truncate text-sm font-semibold text-ink" title={team?.team ?? undefined}>
        {team?.team || '—'}
      </p>
      <p className="font-mono text-xs text-ink">{value}</p>
    </div>
  )
}

export function LeagueIntel({ table, home = [], away = [], leagueName, loading }: LeagueIntelProps) {
  const intel = !loading && table.length
    ? buildLeagueIntel(table.map(toSide), home.map(toSide), away.map(toSide))
    : null
  const hasHomeSplit = Boolean(intel && intel.teams.some((team) => team.homePpg != null || team.awayPpg != null))

  return (
    <section className="mt-3 rounded-xl border border-ink/[0.06] bg-ink/[0.02] p-4">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-ink-3">Leitura da liga</p>
          <h2 className="text-base font-semibold text-ink">{leagueName || 'Estatísticas'}</h2>
        </div>
        {intel && (
          <p className="text-right font-mono text-[11px] text-ink-3">
            {contagem(intel.profile.matches, 'jogo', 'jogos')} · {intel.profile.goalsPerMatch} gols/jogo
            {intel.profile.homePointsShare != null ? ` · ${Math.round(intel.profile.homePointsShare * 100)}% pts em casa` : ''}
          </p>
        )}
      </div>

      {loading ? (
        <div className="h-40 animate-pulse rounded-xl bg-ink/5" />
      ) : !intel ? (
        <p className="py-8 text-center text-[12px] text-ink-3">Sem base estatística para esta liga.</p>
      ) : (
        <>
          <div className={`mb-4 grid grid-cols-2 gap-3 border-y border-ink/5 py-3 ${hasHomeSplit ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>
            <Leader label="Ataque" team={intel.leaders.attack} value={intel.leaders.attack ? `${intel.leaders.attack.gfPerGame} GF/j` : '—'} />
            <Leader label="Defesa" team={intel.leaders.defense} value={intel.leaders.defense ? `${intel.leaders.defense.gaPerGame} GA/j` : '—'} />
            {hasHomeSplit && (
              <Leader label="Fortaleza" team={intel.leaders.homeBias} value={intel.leaders.homeBias?.homeBias != null ? `${intel.leaders.homeBias.homeBias > 0 ? '+' : ''}${intel.leaders.homeBias.homeBias} PPG casa` : '—'} />
            )}
            <Leader label="Forma" team={intel.leaders.form} value={intel.leaders.form ? `${intel.leaders.form.formPoints} pts / 5` : '—'} />
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[640px]">
              <div className="grid grid-cols-[2rem_1fr_3rem_3rem_3rem_3rem_3rem_4.5rem] gap-2 px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-3">
                <span>#</span>
                <span>Time</span>
                <span className="text-right">PPG</span>
                <span className="text-right">GF/j</span>
                <span className="text-right">GA/j</span>
                <span className="text-right">Casa</span>
                <span className="text-right">Fora</span>
                <span className="text-right">Forma</span>
              </div>
              {intel.teams.map((team) => (
                <div
                  key={team.team}
                  className="grid grid-cols-[2rem_1fr_3rem_3rem_3rem_3rem_3rem_4.5rem] items-center gap-2 rounded-lg px-2 py-2 text-xs hover:bg-ink/[0.04]"
                >
                  <span className="font-mono text-ink-3">{team.pos}</span>
                  <span className="min-w-0 truncate font-medium text-ink" title={team.team}>
                    {team.team}
                    <span
                      className="ml-2 font-mono text-[11px] text-ink-3"
                      title={`Ataque: ${team.attackRank}º do ranking · Defesa: ${team.defenseRank}º do ranking`}
                    >
                      A{team.attackRank} D{team.defenseRank}
                    </span>
                  </span>
                  <span className="text-right font-mono text-ink">{team.ppg}</span>
                  <span className="text-right font-mono text-ink">{team.gfPerGame}</span>
                  <span className="text-right font-mono text-ink-2">{team.gaPerGame}</span>
                  <span className="text-right font-mono text-ink">{team.homePpg ?? '—'}</span>
                  <span className="text-right font-mono text-ink-2">{team.awayPpg ?? '—'}</span>
                  <span className="text-right"><FormMarks form={team.form} /></span>
                </div>
              ))}
            </div>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-ink-3">
            PPG = pontos por jogo · GF/j e GA/j = gols feitos e sofridos por jogo · A/D = posição no ranking de ataque
            e de defesa · Casa/Fora = PPG em cada mando. Casa/fora só entra com 3 jogos de cada lado. Posse, chutes e
            chutes no gol vêm da ESPN, sem chave. xG continua fora: nenhuma API grátis estável entrega isso.
          </p>
        </>
      )}
    </section>
  )
}
